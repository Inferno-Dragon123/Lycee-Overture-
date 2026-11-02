<script setup lang="ts">
const cloud = usePersonalCloud(), scope = usePersonalScope();
const labels: Record<string, string> = { guest: '仅保存在此浏览器', loading: '正在读取云端数据…', pending: '本机已保存，等待同步', syncing: '正在同步…', saved: '已同步到账号', conflict: '云端有其他设备的更新', error: '同步暂未完成，本机修改仍保留' };
</script>
<template>
  <div v-if="scope.owner.value" aria-label="个人数据同步状态">
    <p role="status">{{ labels[cloud.status.value] }}</p>
    <p v-if="cloud.error.value" role="alert">{{ cloud.error.value }} 请在账号面板处理。</p>
  </div>
</template>
