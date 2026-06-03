<script setup lang="ts">
defineOptions({ name: 'BookmarkFolderMenu' })

export type BookmarkMenuItem = {
  id: string
  title: string
  url?: string
  children?: BookmarkMenuItem[]
}

defineProps<{
  items: BookmarkMenuItem[]
}>()

const emit = defineEmits<{
  open: [item: BookmarkMenuItem]
}>()

function itemLabel(item: BookmarkMenuItem) {
  if (item.title) return item.title
  if (!item.url) return 'Untitled'
  try {
    return new URL(item.url).hostname.replace(/^www\./, '')
  } catch {
    return item.url
  }
}

function visibleChildren(item: BookmarkMenuItem) {
  return item.children?.filter((child) => child.title || child.url || child.children?.length) ?? []
}
</script>

<template>
  <div>
    <template v-for="item in items" :key="item.id">
      <button
        v-if="item.url"
        class="folder-menu-item"
        :title="item.url"
        @click.stop="emit('open', item)"
      >
        <span class="bookmark-dot"></span>
        <span>{{ itemLabel(item) }}</span>
      </button>

      <div v-else class="folder-menu-folder">
        <button class="folder-menu-item" :title="itemLabel(item)" @click.stop>
          <span class="folder-icon"></span>
          <span>{{ itemLabel(item) }}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 6 15 12 9 18" />
          </svg>
        </button>
        <BookmarkFolderMenu
          v-if="visibleChildren(item).length"
          class="folder-submenu"
          :items="visibleChildren(item)"
          @open="emit('open', $event)"
        />
      </div>
    </template>
  </div>
</template>
