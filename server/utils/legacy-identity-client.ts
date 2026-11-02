import http from 'node:http';
export function requestLegacyIdentity(socketPath: string, email: string, id?: string, fresh = false): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = http.request({ socketPath, path: '/check', method: 'POST', timeout: 30000,
      headers: { 'content-type': 'application/json' } }, response => {
      const chunks: Buffer[] = []; let size = 0;
      response.on('data', chunk => { size += chunk.length; if (size > 16384) response.destroy(new Error('Identity reply too large')); else chunks.push(Buffer.from(chunk)); });
      response.on('error', reject);
      response.on('end', () => {
        try {
          const value = JSON.parse(Buffer.concat(chunks).toString());
          if (response.statusCode !== 200 || !['allowed', 'register', 'conflict', 'banned'].includes(value.decision)) throw new Error('Identity check unavailable');
          resolve(value.decision);
        } catch { reject(new Error('Identity check unavailable')); }
      });
    });
    request.on('error', reject);
    request.on('timeout', () => request.destroy(new Error('Identity check timed out')));
    request.end(JSON.stringify({ email, id, ...(fresh ? { fresh: true } : {}) }));
  });
}
export async function assertWorkflowLegacyIdentity(email: string, id?: string, options: { allowRegistration?: boolean; fresh?: boolean } = {}) {
  const socket = String(useRuntimeConfig().workflowLegacyIdentitySocket || '');
  if (!socket) return;
  let decision: string;
  try { decision = await requestLegacyIdentity(socket, email, id, options.fresh); }
  catch { throw createError({ statusCode: 503, message: '旧账号核对暂时不可用，请稍后重试；本机数据仍保留。' }); }
  if (decision === 'register' && !options.allowRegistration) throw createError({ statusCode: 409, message: useRuntimeConfig().workflowAuthMode === 'shared' ? '旧站账号尚未同步完成，请稍后重新登录；已有个人数据仍保留。' : '此邮箱尚无可登录账号。迁移期间请先在旧站完成注册，再返回二代登录。' });
  if (decision === 'conflict') throw createError({ statusCode: 409, message: '旧站与二代账号信息需要核对，请联系维护者。' });
  if (decision === 'banned') throw createError({ statusCode: 403, message: '该账户暂时无法登录。' });
}
