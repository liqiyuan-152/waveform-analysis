<script setup lang="ts">
import ControlExamplePage from '../../controls/ControlExamplePage.vue'
import { mount } from '../../controls/examples/select'
import source from '../../controls/examples/select.ts?raw'
</script>
<template>
  <ControlExamplePage
    title="Select 选择器"
    description="受控选择、键盘操作及禁用状态。"
    :mount="mount"
    :source="source"
  />
</template>
