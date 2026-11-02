export default defineEventHandler(async (event) => {
  workflowOriginCheck(event);
  const user = await workflowUser(event);
  await assertWorkflowBodySize(event, 1024);
  const body = await readBody(event);
  try {
    return { name: workflowStore().setProfile(user!.id, body.name) };
  } catch (e) {
    throw createError({ statusCode: 400, message: (e as Error).message });
  }
});
