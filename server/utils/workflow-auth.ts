import type { H3Event } from "h3";
import { createHash } from "node:crypto";
import { assertWorkflowLegacyIdentity } from './legacy-identity-client';
export function workflowOriginCheck(event: H3Event) {
  const origin = getHeader(event, "origin");
  if (!origin || origin !== getRequestURL(event).origin)
    throw createError({ statusCode: 403, message: "请求来源不匹配" });
}
export function workflowAuthOrigin() {
  const raw = String(useRuntimeConfig().workflowAuthOrigin || "");
  if (!raw)
    throw createError({
      statusCode: 503,
      message: "账号服务尚未配置，待服务器接入后开放登录。",
    });
  const url = new URL(raw);
  if (
    url.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(url.hostname)
  )
    throw createError({
      statusCode: 503,
      message: "账号服务地址必须使用 HTTPS",
    });
  return url.origin;
}
export function workflowSharedAuth() { return useRuntimeConfig().workflowAuthMode === 'shared'; }
export function workflowAuthCookies(raw: string) {
  if (!workflowSharedAuth()) return raw;
  // Send only upstream auth cookies. The signed SDK session-data cache is deliberately
  // omitted: protected access always asks the authoritative service for a fresh session.
  return raw.split(';').map(cookie => cookie.trim()).filter(cookie =>
    /^__Secure-neon-auth\.(?:session_token|session_challenge)=/.test(cookie)).join('; ');
}
export async function workflowUser(event: H3Event, required = true) {
  const raw = String(useRuntimeConfig().workflowAuthOrigin || "");
  if (!raw) {
    if (required) workflowAuthOrigin();
    return null;
  }
  const cookie = workflowAuthCookies(getHeader(event, "cookie") || "");
  if (workflowSharedAuth() && !/(?:^|;\s*)__Secure-neon-auth\.session_token=[^;]+/.test(cookie)) {
    if (required) throw createError({ statusCode: 401, message: '请先使用注册账号登录并验证邮箱。' });
    return null;
  }
  try {
    const response = await fetch(
      `${workflowAuthOrigin()}/api/auth/get-session?disableCookieCache=true`,
      {
        headers: { cookie },
        signal: AbortSignal.timeout(20000),
        redirect: "error",
      },
    );
    if (!response.ok) throw new Error("session");
    const data = (await response.json()) as {
      user?: { id?: string; email?: string; name?: string; emailVerified?: boolean; banned?: boolean; banExpires?: string };
      session?: { expiresAt?: string };
    };
    const banned = data?.user?.banned && (!data.user.banExpires || !(new Date(data.user.banExpires).getTime() <= Date.now()));
    if (data?.user?.id && data.user.emailVerified && !banned && new Date(data.session?.expiresAt || '').getTime() > Date.now()) {
      if (workflowSharedAuth() && !useRuntimeConfig().workflowLegacyIdentitySocket) throw new Error('Identity broker not configured');
      await assertWorkflowLegacyIdentity(data.user.email || '', data.user.id);
      return {
        id: data.user.id,
        name:
          workflowStore().profile(data.user.id) ||
          `玩家 ${createHash("sha256").update(data.user.id).digest("hex").slice(0, 8)}`,
      };
    }
  } catch (error) {
    if (required && [403, 409].includes(Number((error as { statusCode?: number }).statusCode))) throw error;
    if (required)
      throw createError({
        statusCode: 503,
        message: "无法验证登录会话，请稍后重试。",
      });
    return null;
  }
  if (required)
    throw createError({
      statusCode: 401,
      message: "请先使用注册账号登录并验证邮箱。",
    });
  return null;
}
export function publicPublication<T extends { owner: string }>(d: T) {
  const { owner, ...rest } = d;
  return rest;
}

export async function assertWorkflowBodySize(event: H3Event, limit: number) {
  if (Number(getHeader(event, "content-length") || 0) > limit)
    throw createError({ statusCode: 413, message: "上传内容过大" });
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of event.node.req) {
    size += chunk.length;
    if (size > limit)
      throw createError({ statusCode: 413, message: "上传内容过大" });
    chunks.push(Buffer.from(chunk));
  }
  (event.node.req as typeof event.node.req & { rawBody: Buffer }).rawBody =
    Buffer.concat(chunks);
}
