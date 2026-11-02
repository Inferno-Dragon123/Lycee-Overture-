import { assertWorkflowLegacyIdentity } from '../../utils/legacy-identity-client';
export default defineEventHandler(async (event) => {
  setHeader(event, "Cache-Control", "no-store");
  const path = getRouterParam(event, "path") || "";
  const methods: Record<string, string> = {
    "get-session": "GET",
    "email-otp/send-verification-otp": "POST",
    "sign-in/email-otp": "POST",
    "sign-out": "POST",
  };
  if (methods[path] !== event.method) throw createError({ statusCode: 404 });
  if (event.method === "POST") {
    workflowOriginCheck(event);
    await assertWorkflowBodySize(event, 4096);
  }
  let input = event.method === 'POST' ? await readBody(event) : undefined;
  const shared = workflowSharedAuth();
  if (path === 'email-otp/send-verification-otp' || path === 'sign-in/email-otp') {
    if (typeof input?.email !== 'string' || input.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()))
      throw createError({ statusCode: 400, message: '无效邮箱' });
    const email = input.email.trim().toLowerCase();
    if (path === 'email-otp/send-verification-otp') {
      if (input.type !== 'sign-in') throw createError({ statusCode: 400, message: '仅支持登录／注册验证码。' });
      input = { email, type: 'sign-in' };
    } else {
      if (typeof input.otp !== 'string' || !/^\d{6}$/.test(input.otp.trim())) throw createError({ statusCode: 400, message: '请输入六位验证码。' });
      input = { email, otp: input.otp.trim() };
    }
    if (shared && !useRuntimeConfig().workflowLegacyIdentitySocket) throw createError({ statusCode: 503, message: '账号同步服务尚未配置，请稍后重试。' });
    await assertWorkflowLegacyIdentity(email, undefined, { allowRegistration: shared });
  }
  const origin = workflowAuthOrigin();
  let response: Response;
  try { response = await fetch(`${origin}/api/auth/${path}${path === 'get-session' ? '?disableCookieCache=true' : ''}`, {
    method: event.method,
    headers: {
      "content-type": "application/json",
      origin: String(useRuntimeConfig().workflowAuthPublicOrigin || origin),
      cookie: workflowAuthCookies(getHeader(event, "cookie") || ""),
      'user-agent': getHeader(event, 'user-agent') || 'Lycee Toolbox V2',
      'x-real-ip': getHeader(event, 'x-real-ip') || getRequestIP(event) || '127.0.0.1',
    },
    body:
      event.method === "POST"
        ? JSON.stringify(input)
        : undefined,
    redirect: "error",
    signal: AbortSignal.timeout(25000),
  }); } catch { throw createError({ statusCode: 503, message: '账号服务暂时不可用，请稍后重试。' }); }
  const responseText = await response.text();
  if (shared && path === 'sign-in/email-otp' && response.ok) {
    let user: { id?: string; email?: string; emailVerified?: boolean } | undefined;
    try { user = JSON.parse(responseText)?.user; } catch { /* Reject malformed upstream success. */ }
    if (!user?.id || typeof user.id !== 'string' || user.id.length > 160 || typeof user.email !== 'string' || user.email.trim().toLowerCase() !== input.email || user.emailVerified !== true)
      throw createError({ statusCode: 502, message: '账号服务返回了无效的验证结果，请重试。' });
    // Upstream is the sole creator of the identity. Import its exact ID before exposing
    // the new session; never let the former local auth server create a second account.
    await assertWorkflowLegacyIdentity(input.email, user.id, { fresh: true });
  }
  if (path === 'get-session' && response.ok) {
    const session = JSON.parse(responseText);
    if (session?.user?.id) {
      if (shared && !useRuntimeConfig().workflowLegacyIdentitySocket) throw createError({ statusCode: 503, message: '账号同步服务尚未配置，请稍后重试。' });
      await assertWorkflowLegacyIdentity(session.user.email || '', session.user.id);
    }
  }
  for (const cookie of response.headers.getSetCookie()) {
    if (shared && !/^__Secure-neon-auth\.[\w.-]+=/.test(cookie)) continue;
    appendResponseHeader(
      event,
      "Set-Cookie",
      cookie.replace(/;\s*Domain=[^;]+/gi, "") + (getRequestURL(event).protocol === 'https:' && !/;\s*Secure(?:;|$)/i.test(cookie) ? '; Secure' : ''),
    );
  }
  setResponseStatus(event, response.status);
  setHeader(event, "Content-Type", "application/json");
  return responseText;
});
