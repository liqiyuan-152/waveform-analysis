<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  current: number
  pageCount: number
}>()

const emit = defineEmits<{
  change: [page: number]
}>()

type PageToken = number | 'start-ellipsis' | 'end-ellipsis'

const normalizedPageCount = computed(() => Math.max(1, Math.floor(props.pageCount) || 1))
const normalizedCurrent = computed(() =>
  Math.min(normalizedPageCount.value, Math.max(1, Math.floor(props.current) || 1)),
)

const pageTokens = computed<PageToken[]>(() => {
  const pageCount = normalizedPageCount.value
  const current = normalizedCurrent.value
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, 'end-ellipsis', pageCount]
  if (current >= pageCount - 3) {
    return [
      1,
      'start-ellipsis',
      pageCount - 4,
      pageCount - 3,
      pageCount - 2,
      pageCount - 1,
      pageCount,
    ]
  }
  return [1, 'start-ellipsis', current - 1, current, current + 1, 'end-ellipsis', pageCount]
})

function selectPage(page: number) {
  const nextPage = Math.min(normalizedPageCount.value, Math.max(1, Math.floor(page)))
  if (nextPage !== normalizedCurrent.value) emit('change', nextPage)
}
</script>

<template>
  <nav class="waveform-pagination" aria-label="波形分页">
    <button
      type="button"
      class="waveform-pagination__previous"
      aria-label="上一页"
      :disabled="normalizedCurrent === 1"
      @click="selectPage(normalizedCurrent - 1)"
    >
      ‹
    </button>
    <template v-for="token in pageTokens" :key="token">
      <span
        v-if="typeof token !== 'number'"
        class="waveform-pagination__ellipsis"
        aria-hidden="true"
      >
        …
      </span>
      <button
        v-else
        type="button"
        class="waveform-pagination__page"
        :class="{ 'is-active': token === normalizedCurrent }"
        :aria-current="token === normalizedCurrent ? 'page' : undefined"
        :aria-label="`第 ${token} 页`"
        @click="selectPage(token)"
      >
        {{ token }}
      </button>
    </template>
    <button
      type="button"
      class="waveform-pagination__next"
      aria-label="下一页"
      :disabled="normalizedCurrent === normalizedPageCount"
      @click="selectPage(normalizedCurrent + 1)"
    >
      ›
    </button>
  </nav>
</template>

<style scoped>
.waveform-pagination {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  padding: 3px;
  background: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  box-shadow: 0 1px 2px rgb(16 24 40 / 8%);
}

.waveform-pagination button {
  display: inline-grid;
  min-width: 28px;
  height: 28px;
  padding: 0 6px;
  color: #344054;
  font: inherit;
  font-size: 12px;
  line-height: 1;
  background: #fff;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  place-items: center;
}

.waveform-pagination button:hover:not(:disabled),
.waveform-pagination button:focus-visible {
  color: #0958d9;
  border-color: #1677ff;
  outline: none;
}

.waveform-pagination button.is-active {
  color: #0958d9;
  background: #e6f4ff;
  border-color: #1677ff;
}

.waveform-pagination button:disabled {
  color: #bfc4cc;
  cursor: not-allowed;
}

.waveform-pagination__ellipsis {
  display: inline-grid;
  min-width: 20px;
  height: 28px;
  color: #98a2b3;
  font-size: 12px;
  place-items: center;
}
</style>
