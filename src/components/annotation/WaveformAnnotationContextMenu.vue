<script setup lang="ts">
interface Props {
  visible: boolean
  x: number
  y: number
  canEdit: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (event: 'edit'): void
  (event: 'delete'): void
  (event: 'close'): void
}>()
</script>

<template>
  <div
    v-if="props.visible && props.canEdit"
    class="waveform-annotation-context-menu"
    :style="{ left: `${props.x}px`, top: `${props.y}px` }"
    role="menu"
    @contextmenu.prevent
  >
    <button type="button" role="menuitem" @click="emit('edit')">编辑标注</button>
    <button type="button" role="menuitem" @click="emit('delete')">删除标注</button>
    <button type="button" role="menuitem" @click="emit('close')">取消</button>
  </div>
</template>

<style scoped>
.waveform-annotation-context-menu {
  position: absolute;
  z-index: 30;
  display: grid;
  min-width: 112px;
  padding: 4px;
  background: #fff;
  border: 1px solid #dfe5ef;
  border-radius: 4px;
  box-shadow: 0 4px 14px rgb(16 24 40 / 16%);
}

.waveform-annotation-context-menu button {
  padding: 7px 10px;
  color: #344054;
  font-size: 12px;
  text-align: left;
  white-space: nowrap;
  background: transparent;
  border: 0;
  border-radius: 3px;
  cursor: pointer;
}

.waveform-annotation-context-menu button:hover {
  background: #f2f4f7;
}
</style>
