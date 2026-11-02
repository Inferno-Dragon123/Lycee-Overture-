<script setup lang="ts">
const route = useRoute()
const showcase = computed(() => route.path === '/' || route.path.startsWith('/concepts'))
</script>
<template><NuxtPage v-if="showcase" /><LegacyShell v-else /></template>
