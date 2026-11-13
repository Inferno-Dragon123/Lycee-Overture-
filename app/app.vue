<script setup lang="ts">
const route = useRoute()
const showcase = computed(() => route.path === '/' || route.path.startsWith('/concepts') || route.path.startsWith('/cards/'))
</script>
<template><NuxtPage v-if="showcase" /><LegacyShell v-else /></template>
