<script setup lang="ts">
import ControlExamplePage from '../../controls/ControlExamplePage.vue'
import { mount } from '../../controls/examples/modal'
import source from '../../controls/examples/modal.ts?raw'
</script>
<template>
  <ControlExamplePage
    title="Modal 模态弹窗"
    description="自定义内容、焦点管理和关闭确认。"
    :mount="mount"
    :source="source"
  />
</template>
