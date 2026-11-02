import http from 'node:http';
import { isIP } from 'node:net';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { getLocalAuth, localAuthReady, prepareOtpDelivery, isUserBanned, configuredSiteOrigin, closeLocalAuth } from './local-auth.js';

const routes = { 'get-session': 'GET', 'email-otp/send-verification-otp': 'POST', 'sign-in/email-otp': 'POST', 'sign-out': 'POST' };
export function authInput(path, input) {
  const invalid = () => { throw Object.assign(new Error('无效登录请求'), { status: 400 }); };
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid();
  const allowed = path === 'email-otp/send-verification-otp' ? ['email', 'type'] : path === 'sign-in/email-otp' ? ['email', 'otp'] : [];
  if (Object.keys(input).some(key => !allowed.includes(key))) invalid();
  if (path === 'sign-out') return {};
  if (typeof input.email !== 'string' || input.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) invalid();
  const email = input.email.trim().toLowerCase();
  if (path === 'email-otp/send-verification-otp') { if (input.type !== 'sign-in') invalid(); return { email, type: 'sign-in' }; }
  if (typeof input.otp !== 'string' || !/^\d{6}$/.test(input.otp.trim())) invalid();
  return { email, otp: input.otp.trim() };
}
export function createAuthServer({ origin, instance, prepareDelivery = prepareOtpDelivery, readiness = localAuthReady }) {
  return http.createServer(async (req, res) => {
    res.setHeader('content-type', 'application/json; charset=utf-8'); res.setHeader('cache-control', 'no-store');
    try {
      const url = new URL(req.url, origin), path = url.pathname.slice('/api/auth/'.length);
      if (req.url === '/healthz' && req.method === 'GET') { await readiness(); res.end('{"status":"ok"}'); return; }
      if (!url.pathname.startsWith('/api/auth/') || !Object.hasOwn(routes,path) || routes[path] !== req.method) { res.statusCode = 404; res.end('{}'); return; }
      let input;
      if (req.method === 'POST') {
        if (req.headers.origin !== origin) { res.statusCode = 403; res.end('{"message":"请求来源不匹配"}'); return; }
        if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) { res.statusCode=415;res.end('{}');return; }
        const chunks = []; let size = 0;
        for await (const chunk of req) { if ((size += chunk.length) > 4096) { res.statusCode=413;res.end('{}');return; } chunks.push(chunk); }
        try { input = authInput(path, JSON.parse(Buffer.concat(chunks).toString())); }
        catch { res.statusCode=400;res.end('{"message":"无效登录请求"}');return; }
        if (path === 'email-otp/send-verification-otp') await prepareDelivery(input.email);
      }
      const target = new URL(`/api/auth/${path}`, origin);
      if (path === 'get-session') target.searchParams.set('disableCookieCache','true');
      const headers = new Headers({ 'content-type':'application/json', origin, cookie:req.headers.cookie || '' });
      const peer = req.socket.remoteAddress, address = req.headers['x-real-ip'];
      if (['127.0.0.1','::1','::ffff:127.0.0.1'].includes(peer) && typeof address === 'string' && isIP(address)) headers.set('x-lycee-client-ip',address);
      const response = await instance.handler(new Request(target,{ method:req.method,headers, ...(req.method==='POST'?{body:JSON.stringify(input)}:{}) }));
      res.statusCode=response.status;
      const cookies=response.headers.getSetCookie(); if(cookies.length)res.setHeader('set-cookie',cookies);
      if(path==='get-session' && response.ok) { const data=await response.json();res.end(JSON.stringify(isUserBanned(data?.user)?null:data)); }
      else res.end(Buffer.from(await response.arrayBuffer()));
    } catch(error) { res.statusCode=error.status===429?429:503;res.end(JSON.stringify({message:res.statusCode===429?'验证码请求过于频繁，请稍后再试':'账号服务暂时不可用，请稍后重试'})); }
  });
}
async function main() {
  const origin=configuredSiteOrigin(), parsed=new URL(origin);
  if(parsed.hostname!=='127.0.0.1')throw new Error('Auth service must use loopback');
  const server=createAuthServer({ origin,instance:getLocalAuth() });
  await localAuthReady();
  server.listen(Number(parsed.port),'127.0.0.1',()=>console.log('Local account service ready'));
  process.on('SIGTERM',()=>server.close(async()=>{await closeLocalAuth();process.exit(0);}));
}
const entry=process.argv[1]?await fs.realpath(process.argv[1]).catch(()=>process.argv[1]):'';
if(entry && import.meta.url===pathToFileURL(entry).href)main().catch(()=>{console.error('Local account startup failed; check private configuration');process.exitCode=1;});
