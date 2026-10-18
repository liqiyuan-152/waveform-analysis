<script setup lang="ts">
import ControlExamplePage from '../../controls/ControlExamplePage.vue'
import { mount } from '../../controls/examples/inputNumber'
import source from '../../controls/examples/inputNumber.ts?raw'
</script>
<template>
  <ControlExamplePage
    title="InputNumber 数字输入框"
    description="数字步进、范围限制与输入状态。"
    :mount="mount"
    :source="source"
  />
</template>
