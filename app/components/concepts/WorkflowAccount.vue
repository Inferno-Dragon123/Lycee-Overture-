<script setup lang="ts">
const account = useWorkflowAccount(),
  email = ref(""),
  otp = ref(""),
  sent = ref(false),
  sentEmail = ref(''),
  resendSeconds = ref(0),
  nickname = ref("");
const cloud = usePersonalCloud();
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
  if (await account.action("sign-in/email-otp", {
    email: sentEmail.value,
    otp: otp.value.trim(),
  })) location.reload();
}
async function logout() {
  if (!(await cloud.flush())) { account.error.value = '尚有未同步修改，请先完成同步或处理冲突。'; return; }
  if (await account.action('sign-out')) location.reload();
}
async function rename() {
  try {
    await $fetch("/api/workflow/profile", {
      method: "POST",
      body: { name: nickname.value },
    });
    await account.refresh();
  } catch (e) {
    account.error.value =
      (e as { data?: { message: string } }).data?.message || "昵称保存失败";
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
        ><button class="p-button">保存昵称</button>
      </form>
      <PersonalCloudStatus />
      <p>卡组、草稿、展示背包和展示范围按账号保存。未登录时的数据不会自动归入账号。</p>
      <div class="workflow-form">
        <button class="p-button" @click="cloud.flush">立即同步</button>
        <button class="p-button" @click="cloud.mergeGuestData()">合并未登录时的数据</button>
        <button v-if="cloud.status.value === 'conflict'" class="p-button" @click="cloud.useRemote">保留本机副本并读取云端</button>
        <button v-if="cloud.status.value === 'error'" class="p-button" @click="reloadNuxtApp({ force: true })">重新连接</button>
      </div>
      <button
        class="p-button"
        :disabled="account.busy.value"
        @click="logout"
      >
        退出登录
      </button></template
    ><template v-else
      ><p v-if="account.registrationMode.value === 'native'">输入邮箱验证即可登录，首次验证会自动注册。</p><p v-else-if="account.sharedRegistration.value">与旧站共用账号。输入邮箱验证即可登录，首次验证会自动注册，无需跳转。</p><p v-else-if="account.registrationOrigin.value">迁移期间，新账号统一在旧站注册，再返回这里登录。<a :href="account.registrationOrigin.value" target="_blank" rel="noopener noreferrer">前往旧站注册</a></p><form class="workflow-form" @submit.prevent="send">
        <label
          >邮箱<input
            v-model="email"
            type="email"
            required
            :disabled="account.busy.value"
            autocomplete="email" /></label
        ><button
          class="p-button"
          :disabled="!account.configured.value || account.busy.value || resendSeconds > 0"
        >
          {{ resendSeconds > 0 ? `${resendSeconds} 秒后重发` : '发送验证码' }}
        </button>
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
        ><button class="p-button" :disabled="account.busy.value">{{ ['shared','native'].includes(account.registrationMode.value) ? '登录 / 注册' : '登录' }}</button>
      </form></template
    >
    <p v-if="account.error.value" role="alert">{{ account.error.value }}</p>
  </section>
</template>
