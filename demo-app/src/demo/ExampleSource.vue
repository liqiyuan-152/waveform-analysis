<script setup lang="ts">
defineProps<{ title: string; description: string; source: string }>()
</script>
<template>
  <section class="example-source">
    <h1>{{ title }}</h1>
    <p>{{ description }}</p>
    <details>
      <summary>查看使用代码</summary>
      <pre><code>{{ source }}</code></pre>
    </details>
  </section>
</template>
<style scoped>
.example-source {
  padding: 16px;
  background: var(--demo-panel);
  color: var(--demo-text);
}
h1 {
  margin: 0 0 8px;
  font-size: 20px;
}
p {
  margin: 0 0 12px;
}
pre {
  overflow: auto;
  padding: 12px;
  background: var(--demo-page);
  font-size: 12px;
}
summary {
  cursor: pointer;
}
</style>
