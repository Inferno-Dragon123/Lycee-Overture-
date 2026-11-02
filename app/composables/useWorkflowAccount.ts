export function useWorkflowAccount() {
  const scopeOwner = useState<string | null>('personal-owner', () => null);
  const scopeReady = useState('personal-scope-ready', () => false);
  const registrationOrigin = useState('workflow-registration-origin', () => '');
  const sharedRegistration = useState('workflow-shared-registration', () => false);
  const registrationMode = useState('workflow-registration-mode', () => '');
  const user = useState<{ id: string; name: string } | null>(
      "workflow-user",
      () => null,
    ),
    configured = useState("workflow-auth-configured", () => false),
    error = useState("workflow-auth-error", () => ""),
    busy = useState("workflow-auth-busy", () => false);
  async function refresh() {
    try {
      const data = await $fetch<{
        configured: boolean;
        registrationOrigin?: string;
        registrationMode?: string;
        user: { id: string; name: string } | null;
      }>("/api/workflow/session");
      if (scopeReady.value && scopeOwner.value !== (data.user?.id || null)) {
        location.reload();
        return;
      }
      configured.value = data.configured;
      registrationOrigin.value = data.registrationOrigin === 'https://lycee-toolbox.top' ? data.registrationOrigin : '';
      sharedRegistration.value = data.registrationMode === 'shared';
      registrationMode.value = data.registrationMode || '';
      user.value = data.user;
    } catch {
      error.value = "无法连接账号服务";
    }
  }
  async function action(path: string, body: Record<string, string> = {}) {
    busy.value = true;
    error.value = "";
    try {
      await $fetch(`/api/auth/${path}`, { method: "POST", body });
      await refresh();
      return true;
    } catch (e) {
      error.value =
        (e as { data?: { message?: string; error?: string } }).data?.message ||
        (typeof (e as { data?: { error?: unknown } }).data?.error === 'string' ? (e as { data: { error: string } }).data.error : '') ||
        "账号操作失败，请稍后重试。";
      return false;
    } finally {
      busy.value = false;
    }
  }
  return { user, configured, error, busy, refresh, action, registrationOrigin, sharedRegistration, registrationMode };
}
