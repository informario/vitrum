<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  title: string | null
  content: string
}>()

const emit = defineEmits<{
  close: []
  select: [node: string]
}>()

const assetUrls = import.meta.glob('../database/assets/**/*', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

function assetUrl(name: string): string | undefined {
  const normalizedName = name.trim().replace(/^\.\//, '')
  const entry = Object.entries(assetUrls).find(([path]) => path.endsWith(`/${normalizedName}`))
  return entry?.[1]
}

const parts = computed(() => {
  const result: Array<{ text?: string; node?: string; title?: string; image?: string; italic?: boolean; hashtag?: boolean }> = []
  const contentPattern = /(!)?\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]|__([^_\n]+?)__|_([^_\n]+?)_|(?<!\S)(#[\w-]+)/g
  let lastIndex = 0

  for (const match of props.content.matchAll(contentPattern)) {
    const index = match.index ?? 0
    if (index > lastIndex) result.push({ text: props.content.slice(lastIndex, index) })
    if (match[2]) {
      const node = match[2].trim().replace(/^\.\//, '')
      const title = (match[3] ?? node).trim()
      const url = match[1] ? assetUrl(node) : undefined
      if (url) result.push({ image: url, title })
      else if (node) result.push({ node, title })
    } else if (match[4] ?? match[5]) {
      result.push({ text: match[4] ?? match[5], italic: true })
    } else {
      result.push({ text: match[6], hashtag: true })
    }
    lastIndex = index + match[0].length
  }

  if (lastIndex < props.content.length) result.push({ text: props.content.slice(lastIndex) })
  return result
})

const imageParts = computed(() => parts.value.filter((part) => part.image))
const textParts = computed(() => parts.value.filter((part) => !part.image))
</script>

<template>
  <dialog :open="title !== null" class="note-dialog" @click.self="emit('close')">
    <button class="dialog-close" type="button" aria-label="Close note" @click="emit('close')">×</button>
    <h2>{{ title }}</h2>
    <div v-if="title" class="note-body" :class="{ 'note-body-with-assets': imageParts.length > 0 }">
      <div v-if="imageParts.length" class="note-assets">
        <img v-for="(part, index) in imageParts" :key="index" class="note-image" :src="part.image" :alt="part.title">
      </div>
      <pre class="note-content"><template v-for="(part, index) in textParts" :key="index"><button v-if="part.node" type="button" class="wikilink" @click="emit('select', part.node)">{{ part.title }}</button><em v-else-if="part.italic">{{ part.text }}</em><span v-else-if="part.hashtag" class="hashtag">{{ part.text }}</span><template v-else>{{ part.text }}</template></template></pre>
    </div>
  </dialog>
</template>
