<script setup lang="ts">
import ControlExamplePage from '../../controls/ControlExamplePage.vue'
import { mount } from '../../controls/examples/popup'
import source from '../../controls/examples/popup.ts?raw'
</script>
<template>
  <ControlExamplePage
    title="Popup 定位浮层"
    description="围绕触发元素定位的可交互浮层。"
    :mount="mount"
    :source="source"
  />
</template>
