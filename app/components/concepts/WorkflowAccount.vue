<script setup lang="ts">
import OrbitButton from "./OrbitButton.vue";
const account = useWorkflowAccount(),
  email = ref(""),
  otp = ref(""),
  sent = ref(false),
  sentEmail = ref(''),
  resendSeconds = ref(0),
  nickname = ref("");
const cloud = usePersonalCloud();
const nicknameBusy = ref(false), logoutBusy = ref(false), cloudAction = ref<'sync' | 'merge' | 'remote' | ''>('');
const cloudBusy = computed(() => !!cloudAction.value || ['loading', 'syncing'].includes(cloud.status.value));
let resendTimer: ReturnType<typeof setInterval> | undefined;
onBeforeUnmount(() => clearInterval(resendTimer));
watch(email, () => { sent.value = false; otp.value = ''; });
onMounted(account.refresh);
async function send() {
  if (resendSeconds.value > 0 || account.busy.value) return;
  if (
    await account.action("email-otp/send-verification-otp", {
      email: email.value.trim(),
      type: "sign-in",
    })
  ) {
    sent.value = true;
    sentEmail.value = email.value.trim();
    resendSeconds.value = 60;
    clearInterval(resendTimer);
    resendTimer = setInterval(() => { if (--resendSeconds.value <= 0) clearInterval(resendTimer); }, 1000);
  }
}
async function login() {
  if (account.busy.value || !sent.value) return;
  if (await account.action("sign-in/email-otp", {
    email: sentEmail.value,
    otp: otp.value.trim(),
  })) location.reload();
}
async function logout() {
  if (logoutBusy.value || account.busy.value || nicknameBusy.value || cloudBusy.value) return;
  logoutBusy.value = true;
  try {
    if (!(await cloud.flush())) { account.error.value = '尚有未同步修改，请先完成同步或处理冲突。'; return; }
    if (await account.action('sign-out')) location.reload();
  } finally {
    logoutBusy.value = false;
  }
}
async function rename() {
  if (nicknameBusy.value || account.busy.value || !nickname.value.trim()) return;
  nicknameBusy.value = true;
  account.error.value = '';
  try {
    await $fetch("/api/workflow/profile", {
      method: "POST",
      body: { name: nickname.value },
    });
    await account.refresh();
  } catch (e) {
    account.error.value =
      (e as { data?: { message: string } }).data?.message || "昵称保存失败";
  } finally {
    nicknameBusy.value = false;
  }
}
async function runCloud(action: 'sync' | 'merge' | 'remote') {
  if (cloudBusy.value || account.busy.value || logoutBusy.value || (cloud.status.value === 'conflict' && action !== 'remote')) return;
  cloudAction.value = action;
  try {
    if (action === 'sync') await cloud.flush();
    else if (action === 'merge') await cloud.mergeGuestData();
    else await cloud.useRemote();
  } finally {
    cloudAction.value = '';
  }
}
</script>
<template>
  <section class="workflow-form">
    <h2>账号</h2>
    <p v-if="!account.configured.value">
      账号服务尚未配置，待服务器接入后开放登录。
    </p>
    <template v-if="account.user.value"
      ><p>已登录：{{ account.user.value.name }}</p>
      <form class="workflow-form" @submit.prevent="rename">
        <label>昵称<input v-model="nickname" maxlength="24" required /></label
        ><OrbitButton type="submit" :busy="nicknameBusy" :disabled="account.busy.value">保存昵称</OrbitButton>
      </form>
      <PersonalCloudStatus />
      <p>卡组、草稿、展示背包和展示范围按账号保存。未登录时的数据不会自动归入账号。</p>
      <div class="workflow-form">
        <OrbitButton variant="outline" tone="neutral" :busy="cloudAction === 'sync' || cloud.status.value === 'syncing'" :disabled="cloudBusy || cloud.status.value === 'conflict' || account.busy.value || logoutBusy" @click="runCloud('sync')">立即同步</OrbitButton>
        <OrbitButton variant="outline" tone="neutral" :busy="cloudAction === 'merge'" :disabled="cloudBusy || cloud.status.value === 'conflict' || account.busy.value || logoutBusy" @click="runCloud('merge')">合并未登录时的数据</OrbitButton>
        <OrbitButton v-if="cloud.status.value === 'conflict'" variant="outline" tone="neutral" :busy="cloudAction === 'remote'" :disabled="cloudBusy || account.busy.value || logoutBusy" @click="runCloud('remote')">保留本机副本并读取云端</OrbitButton>
        <OrbitButton v-if="cloud.status.value === 'error'" variant="ghost" tone="neutral" @click="reloadNuxtApp({ force: true })">重新连接</OrbitButton>
      </div>
      <OrbitButton
        variant="ghost" tone="neutral"
        :busy="logoutBusy"
        :disabled="account.busy.value || nicknameBusy || cloudBusy"
        @click="logout"
      >
        退出登录
      </OrbitButton></template
    ><template v-else
      ><p v-if="account.registrationMode.value === 'native'">输入邮箱验证即可登录，首次验证会自动注册。</p><p v-else-if="account.sharedRegistration.value">与旧站共用账号。输入邮箱验证即可登录，首次验证会自动注册，无需跳转。</p><p v-else-if="account.registrationOrigin.value">迁移期间，新账号统一在旧站注册，再返回这里登录。<a :href="account.registrationOrigin.value" target="_blank" rel="noopener noreferrer">前往旧站注册</a></p><form class="workflow-form" @submit.prevent="send">
        <label
          >邮箱<input
            v-model="email"
            type="email"
            required
            :disabled="account.busy.value"
            autocomplete="email" /></label
        ><OrbitButton
          type="submit"
          :variant="sent ? 'outline' : 'default'"
          :tone="sent ? 'neutral' : 'brand'"
          :busy="account.busy.value"
          :disabled="!account.configured.value || account.busy.value || resendSeconds > 0"
        >
          {{ resendSeconds > 0 ? `${resendSeconds} 秒后重发` : '发送验证码' }}
        </OrbitButton>
      </form>
      <form v-if="sent" class="workflow-form" @submit.prevent="login">
        <p role="status">验证码已发送至 {{ sentEmail }}，请检查收件箱或垃圾邮件。</p>
        <label
          >验证码<input
            v-model="otp"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            pattern="[0-9]{6}"
            :disabled="account.busy.value"
            required /></label
        ><OrbitButton type="submit" :busy="account.busy.value">{{ ['shared','native'].includes(account.registrationMode.value) ? '登录 / 注册' : '登录' }}</OrbitButton>
      </form></template
    >
    <p v-if="account.error.value" role="alert">{{ account.error.value }}</p>
  </section>
</template>
