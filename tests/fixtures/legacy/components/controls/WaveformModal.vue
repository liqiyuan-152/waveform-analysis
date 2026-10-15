<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { mountModal } from './modalLifecycle'

const props = defineProps<{
  titleId: string
  popupId: string
  canConfirm: boolean
  initialFocus: () => HTMLElement | undefined
  dismissPopup: () => boolean
}>()
const emit = defineEmits<{ cancel: []; confirm: [] }>()
const dialog = ref<HTMLDialogElement>()
const ready = ref(false)
let dispose: (() => void) | undefined
onMounted(() => {
  if (!dialog.value) return
  dispose = mountModal(dialog.value, {
    initialFocus: props.initialFocus,
    cancel: () => emit('cancel'),
    dismissPopup: props.dismissPopup,
  })
  ready.value = true
})
onBeforeUnmount(() => dispose?.())
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="waveform-annotation-editor-root waveform-annotation-editor"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      tabindex="-1"
    >
      <div class="waveform-modal">
        <div class="waveform-modal__panel">
          <header class="waveform-modal__header"><slot name="title" /></header>
          <button
            type="button"
            class="waveform-modal__close"
            aria-label="关闭"
            @click="emit('cancel')"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 3 10 10M13 3 3 13" /></svg>
          </button>
          <div class="waveform-modal__body"><slot :ready="ready" /></div>
          <footer class="waveform-modal__footer">
            <button type="button" class="waveform-modal__button" @click="emit('cancel')">
              取 消
            </button>
            <button
              type="button"
              class="waveform-modal__button waveform-modal__button--primary"
              :disabled="!canConfirm"
              @click="emit('confirm')"
            >
              保存标注
            </button>
          </footer>
        </div>
      </div>
      <div :id="popupId" class="waveform-modal__popups" />
    </dialog>
  </Teleport>
</template>

<style src="../../../../../src/components/controls/WaveformModal.css"></style>
