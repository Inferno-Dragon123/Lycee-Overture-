export default defineEventHandler(async (event) => {
  setHeader(event, "Cache-Control", "no-store");
  return {
    configured: !!useRuntimeConfig().workflowAuthOrigin,
    user: await workflowUser(event, false),
    ...(useRuntimeConfig().workflowAuthMode === 'native' ? { registrationMode: 'native' } : workflowSharedAuth() ? { registrationMode: 'shared' } : useRuntimeConfig().workflowLegacyIdentitySocket ? { registrationOrigin: 'https://lycee-toolbox.top' } : {}),
  };
});
