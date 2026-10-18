<script setup lang="ts">
import ControlExamplePage from '../../controls/ControlExamplePage.vue'
import { mount } from '../../controls/examples/pagination'
import source from '../../controls/examples/pagination.ts?raw'
</script>
<template>
  <ControlExamplePage
    title="Pagination 分页"
    description="页码切换、跳页及页数更新。"
    :mount="mount"
    :source="source"
  />
</template>
