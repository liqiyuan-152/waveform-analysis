<script setup lang="ts">
import ControlExamplePage from '../../controls/ControlExamplePage.vue'
import { mount } from '../../controls/examples/colorPicker'
import source from '../../controls/examples/colorPicker.ts?raw'
</script>
<template>
  <ControlExamplePage
    title="ColorPicker 颜色选择器"
    description="编辑颜色、透明度和不同颜色格式。"
    :mount="mount"
    :source="source"
  />
</template>
