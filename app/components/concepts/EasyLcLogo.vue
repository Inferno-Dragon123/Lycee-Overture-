<template>
  <span class="easylc-logo" aria-hidden="true">
    <img
      class="easylc-logo-dark"
      src="/easylc/wordmark-dark.svg"
      alt=""
      width="427"
      height="184"
      decoding="async"
    />
    <img
      class="easylc-logo-light"
      src="/easylc/wordmark-light.svg"
      alt=""
      width="427"
      height="184"
      decoding="async"
    />
  </span>
</template>

<style>
.easylc-logo {
  display: block;
  width: 100%;
  aspect-ratio: 427 / 184;
}
.easylc-logo img {
  display: block;
  width: 100%;
  height: 100%;
}
.easylc-logo .easylc-logo-light,
.concept-orbit.a-light .easylc-logo-dark {
  display: none;
}
.concept-orbit.a-light .easylc-logo-light {
  display: block;
}
</style>
