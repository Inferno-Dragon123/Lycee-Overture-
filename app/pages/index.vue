<script setup lang="ts">
const route=useRoute();
if(typeof route.query.publication==='string' && /^p_[A-Za-z0-9_-]{1,100}$/.test(route.query.publication))
  await navigateTo({path:'/concepts/orbit/deck',query:{publication:route.query.publication,legacy:'1'}},{redirectCode:302});
else if(typeof route.query.deck==='string' && /^d_[A-Za-z0-9_-]{1,100}$/.test(route.query.deck))
  await navigateTo({path:'/concepts/orbit/deck',query:{snapshot:route.query.deck}},{redirectCode:302});
else await navigateTo("/concepts/orbit", { redirectCode: 302 });
</script>
<template><div /></template>
