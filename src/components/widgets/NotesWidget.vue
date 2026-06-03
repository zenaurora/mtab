<script setup lang="ts">
import { computed } from 'vue'
import { useSettingsStore } from '../../stores/settings'

const store = useSettingsStore()

const content = computed({
  get: () => store.data.notesContent,
  set: (val: string) => store.setNotesContent(val),
})
</script>

<template>
  <div class="notes-widget">
    <div class="notes-header">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
      <span>Notes</span>
    </div>
    <textarea
      v-model="content"
      class="notes-textarea"
      placeholder="Write something..."
      spellcheck="false"
    ></textarea>
  </div>
</template>

<style scoped>
.notes-widget {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px;
  gap: 8px;
}

.notes-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
  flex-shrink: 0;
}

.notes-textarea {
  flex: 1;
  resize: none;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 13px;
  font-family: var(--font);
  line-height: 1.6;
  outline: none;
  padding: 0;
}

.notes-textarea::placeholder {
  color: var(--text-secondary);
  opacity: 0.5;
}
</style>
