export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'no-store');
  const user = await workflowUser(event);
  // A session can change in another tab; reject writes from a stale account UI.
  if (getHeader(event, 'x-lycee-owner') !== user!.id)
    throw createError({ statusCode: 409, message: '登录账号已变化，请刷新后继续。' });
  if (event.method === 'GET') return workflowStore().personal(user!.id);
  if (event.method !== 'PUT') throw createError({ statusCode: 405 });
  workflowOriginCheck(event);
  await assertWorkflowBodySize(event, 2 * 1024 * 1024);
  const body = await readBody(event);
  try { return workflowStore().savePersonal(user!.id, body?.revision, body?.data); }
  catch (error) {
    const conflict = (error as Error).message === 'PERSONAL_CONFLICT';
    throw createError({ statusCode: conflict ? 409 : 400, message: conflict ? '云端已有其他设备的更新，本机修改已保留，请选择如何处理。' : (error as Error).message });
  }
});
