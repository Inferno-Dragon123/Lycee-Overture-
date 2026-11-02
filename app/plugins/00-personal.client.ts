export default defineNuxtPlugin(async () => {
  if (!location.pathname.startsWith('/concepts/orbit') && location.pathname !== '/') return;
  if (/\/deck-loom(?:-v2)?$/.test(location.pathname)) return;
  await usePersonalCloud().initialize();
  useState('personal-scope-ready', () => false).value = true;
});
