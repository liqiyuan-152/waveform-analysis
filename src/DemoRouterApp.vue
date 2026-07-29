<template>
  <div class="demo-shell">
    <header class="demo-shell__header">
      <RouterLink class="demo-shell__brand" to="/">Waveform Analysis</RouterLink>
      <nav class="demo-shell__nav" aria-label="示例导航">
        <RouterLink to="/">综合示例</RouterLink>
        <RouterLink to="/fixed-y-domain">固定振幅范围</RouterLink>
      </nav>
    </header>
    <div class="demo-shell__content">
      <RouterView />
    </div>
  </div>
</template>
