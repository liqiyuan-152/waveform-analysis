<script setup lang="ts">
import { computed } from 'vue'
import { paginationItems } from '@/components/controls/pagination'

const props = defineProps<{ current: number; pageSize: number; total: number }>()
const emit = defineEmits<{ change: [page: number] }>()
const pageCount = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const items = computed(() => paginationItems(props.current, pageCount.value))
function change(page: number) {
  if (page >= 1 && page <= pageCount.value && page !== props.current) emit('change', page)
}
</script>

<template>
  <nav class="waveform-pagination" aria-label="波形分页">
    <button type="button" aria-label="上一页" :disabled="current <= 1" @click="change(current - 1)">
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m10 3-5 5 5 5" /></svg>
    </button>
    <button
      v-for="(item, index) in items"
      :key="item.key"
      type="button"
      :aria-label="
        item.kind === 'page'
          ? `第 ${item.page} 页`
          : item.kind === 'jump-prev'
            ? '向前 5 页'
            : '向后 5 页'
      "
      :aria-current="item.kind === 'page' && item.page === current ? 'page' : undefined"
      :class="{
        'waveform-pagination__jump': item.kind !== 'page',
        'waveform-pagination__window-edge':
          item.kind === 'page' &&
          (items[index - 1]?.kind === 'jump-prev' || items[index + 1]?.kind === 'jump-next'),
      }"
      @click="change(item.page)"
    >
      <template v-if="item.kind === 'page'">{{ item.page }}</template>
      <template v-else>
        <span class="waveform-pagination__dots" aria-hidden="true">•••</span>
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          :class="{ 'is-prev': item.kind === 'jump-prev' }"
        >
          <path d="m3 3 5 5-5 5m5-10 5 5-5 5" />
        </svg>
      </template>
    </button>
    <button
      type="button"
      aria-label="下一页"
      :disabled="current >= pageCount"
      @click="change(current + 1)"
    >
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>
    </button>
  </nav>
</template>

<style scoped src="../../../../../src/components/controls/WaveformPagination.css"></style>
