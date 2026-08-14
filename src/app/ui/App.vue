<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, onUnmounted, reactive, ref } from 'vue'
import Graph from 'graphology'
import { select } from 'd3-selection'
import { zoom as createZoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom'

import { createGraph, type Database } from '../controller/graph_generator'
import GraphNode from './GraphNode.vue'
import NoteDialog from './NoteDialog.vue'

type Point = { x: number; y: number }

// These are the same controls exposed by Obsidian's graph view. Values are
// kept here so the layout remains predictable and can later be bound to UI.
const physics = reactive({
  repelStrength: 850,
  linkDistance: 150,
  linkStrength: 0.005,
  centerStrength: 0.0003,
  alphaDecay: 0,
})

const width = 1100
const height = 680
const graph = ref<Graph | null>(null)
const positions = ref<Record<string, Point>>({})
const camera = ref<ZoomTransform>(zoomIdentity)
const graphSvg = ref<SVGSVGElement | null>(null)
function nodeFromUrl(): string | null {
  const node = new URLSearchParams(window.location.search).get('node')
  return node?.trim() || null
}

const selectedNode = ref<string | null>(nodeFromUrl())

let animationFrame: number | null = null
let zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> | null = null
let simulationAlpha = 1
const velocities: Record<string, Point> = {}
const draggingNode = ref<string | null>(null)

const markdownFiles = import.meta.glob('../database/**/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

function databaseFromFiles(): Database {
  return Object.fromEntries(
    Object.entries(markdownFiles).map(([path, content]) => {
      const filename = path.split('/').pop() ?? path
      return [filename.replace(/\.md$/i, ''), content]
    }),
  )
}

function randomPositions(nodes: string[]): Record<string, Point> {
  return Object.fromEntries(
    nodes.map((node) => [node, {
      x: 80 + Math.random() * (width - 160),
      y: 70 + Math.random() * (height - 140),
    }]),
  )
}

function runPhysics(): void {
  if (!graph.value) return
  const currentNodes = graph.value.nodes()
  const nextPositions = { ...positions.value }
  const forces: Record<string, Point> = Object.fromEntries(
    currentNodes.map((node) => [node, { x: 0, y: 0 }]),
  )

  // Pairwise inverse-square repulsion keeps unrelated notes readable.
  for (let i = 0; i < currentNodes.length; i += 1) {
    for (let j = i + 1; j < currentNodes.length; j += 1) {
      const first = currentNodes[i]!
      const second = currentNodes[j]!
      const a = nextPositions[first]!
      const b = nextPositions[second]!
      const dx = b.x - a.x
      const dy = b.y - a.y
      const distanceSquared = Math.max(dx * dx + dy * dy, 25)
      const distance = Math.sqrt(distanceSquared)
      const amount = physics.repelStrength / distanceSquared
      const x = (dx / distance) * amount
      const y = (dy / distance) * amount
      forces[first]!.x -= x
      forces[first]!.y -= y
      forces[second]!.x += x
      forces[second]!.y += y
    }
  }

  // Links behave like springs: link strength controls their pull and link
  // distance is their natural (resting) length.
  graph.value.forEachEdge((_edge, _attributes, source, target) => {
    const a = nextPositions[source]!
    const b = nextPositions[target]!
    const dx = b.x - a.x
    const dy = b.y - a.y
    const distance = Math.max(Math.hypot(dx, dy), 0.001)
    const amount = (distance - physics.linkDistance) * physics.linkStrength
    const x = (dx / distance) * amount
    const y = (dy / distance) * amount
    forces[source]!.x += x
    forces[source]!.y += y
    forces[target]!.x -= x
    forces[target]!.y -= y
  })

  const center = { x: width / 2, y: height / 2 }
  for (const node of currentNodes) {
    const position = nextPositions[node]!
    if (draggingNode.value === node) {
      const velocity = velocities[node] ?? (velocities[node] = { x: 0, y: 0 })
      velocity.x = 0
      velocity.y = 0
      continue
    }
    forces[node]!.x += (center.x - position.x) * physics.centerStrength
    forces[node]!.y += (center.y - position.y) * physics.centerStrength
    const velocity = velocities[node] ?? (velocities[node] = { x: 0, y: 0 })
    velocity.x = (velocity.x + forces[node]!.x * simulationAlpha) * 0.82
    velocity.y = (velocity.y + forces[node]!.y * simulationAlpha) * 0.82
    position.x = Math.max(25, Math.min(width - 25, position.x + velocity.x))
    position.y = Math.max(25, Math.min(height - 25, position.y + velocity.y))
  }

  simulationAlpha *= 1 - physics.alphaDecay
  positions.value = nextPositions
  if (simulationAlpha > 0.015) animationFrame = requestAnimationFrame(runPhysics)
  else animationFrame = null
}

function restartPhysics(): void {
  if (animationFrame !== null) cancelAnimationFrame(animationFrame)
  simulationAlpha = 1
  animationFrame = requestAnimationFrame(runPhysics)
}

onMounted(() => {
  const nextGraph = createGraph(databaseFromFiles())
  graph.value = nextGraph
  positions.value = randomPositions(nextGraph.nodes())
  for (const node of nextGraph.nodes()) velocities[node] = { x: 0, y: 0 }
  restartPhysics()

  if (graphSvg.value) {
    zoomBehavior = createZoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 4])
      .filter((event: Event) => {
        if (event.type === 'touchstart') {
          const target = event.target as Element | null
          if (target?.closest('.node')) return false
        }
        const pointerEvent = event as MouseEvent
        return (!pointerEvent.ctrlKey || event.type === 'wheel') && !pointerEvent.button
      })
      .on('zoom', ({ transform }: { transform: ZoomTransform }) => {
        camera.value = transform
      })
    select(graphSvg.value).call(zoomBehavior).call(zoomBehavior.transform, zoomIdentity)
  }
})

function updateUrl(node: string | null, historyMode: 'push' | 'replace' = 'push'): void {
  const url = new URL(window.location.href)
  if (node) url.searchParams.set('node', node)
  else url.searchParams.delete('node')

  window.history[`${historyMode}State`](window.history.state, '', url)
}

function closeNode(): void {
  selectedNode.value = null
  updateUrl(null)
}

function handleHistoryChange(): void {
  selectedNode.value = nodeFromUrl()
}

onMounted(() => window.addEventListener('popstate', handleHistoryChange))

onBeforeUnmount(() => {
  if (animationFrame !== null) cancelAnimationFrame(animationFrame)
  if (graphSvg.value && zoomBehavior) select(graphSvg.value).on('.zoom', null)
})

onUnmounted(() => window.removeEventListener('popstate', handleHistoryChange))

const nodes = computed(() => graph.value?.nodes() ?? [])
const edges = computed(() => graph.value?.mapEdges((edge, attributes, source, target) => ({
  edge,
  source,
  target,
  attributes,
})) ?? [])
const selectedContent = computed(() => selectedNode.value ? contentFor(selectedNode.value) : '')

function point(node: string): Point {
  return positions.value[node] ?? { x: 0, y: 0 }
}

function updateNodePosition(node: string, position: Point): void {
  positions.value = { ...positions.value, [node]: position }
  velocities[node] = { x: 0, y: 0 }
}

function startNodeDrag(node: string): void {
  draggingNode.value = node
}

function endNodeDrag(node: string): void {
  if (draggingNode.value !== node) return
  draggingNode.value = null
  restartPhysics()
}

function selectNode(node: string): void {
  selectedNode.value = null
  requestAnimationFrame(() => {
    selectedNode.value = node
    updateUrl(node)
  })
}

function selectGraphNode(node: string): void {
  selectedNode.value = node
  updateUrl(node)
}

function contentFor(node: string): string {
  const target = node.trim().replace(/^\.\//, '').replace(/\.md$/i, '')
  const path = Object.keys(markdownFiles).find((filePath) => {
    const filename = filePath.split('/').pop()?.replace(/\.md$/i, '')
    return filename === target
  })
  return (path && markdownFiles[path]) || `No content found for “${node}”.`
}

</script>

<template>
  <main class="graph-page">
    <section class="graph-shell" aria-label="Knowledge graph">
      <form class="physics-controls" aria-label="Graph physics controls" @submit.prevent>
        <label>
          <span>Repel</span>
          <input v-model.number="physics.repelStrength" type="range" min="0" max="2400" step="50" @input="restartPhysics">
        </label>
        <label>
          <span>Link distance</span>
          <input v-model.number="physics.linkDistance" type="range" min="40" max="320" step="5" @input="restartPhysics">
        </label>
        <label>
          <span>Link strength</span>
          <input v-model.number="physics.linkStrength" type="range" min="0" max="0.12" step="0.005" @input="restartPhysics">
        </label>
        <label>
          <span>Center</span>
          <input v-model.number="physics.centerStrength" type="range" min="0" max="0.015" step="0.0005" @input="restartPhysics">
        </label>
        <label>
          <span>Alpha decay</span>
          <input v-model.number="physics.alphaDecay" type="range" min="0.002" max="0.08" step="0.002" @input="restartPhysics">
        </label>
      </form>
      <svg
        ref="graphSvg"
        :viewBox="`0 0 ${width} ${height}`"
        role="img"
      >
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" />
          </marker>
        </defs>

        <g class="camera" :transform="camera.toString()">
          <g class="edges">
            <line
              v-for="item in edges"
              :key="item.edge"
              :x1="point(item.source).x"
              :y1="point(item.source).y"
              :x2="point(item.target).x"
              :y2="point(item.target).y"
            />
          </g>

          <GraphNode
            v-for="node in nodes"
            :key="node"
            :label="node"
            :x="point(node).x"
            :y="point(node).y"
            :canvas-width="width"
            :canvas-height="height"
            @drag-start="startNodeDrag(node)"
            @drag-end="endNodeDrag(node)"
            @moved="updateNodePosition(node, $event)"
            @selected="selectGraphNode(node)"
          />
        </g>
      </svg>
      <p v-if="!graph" class="loading">Loading graph…</p>
    </section>

    <NoteDialog
      :title="selectedNode"
      :content="selectedContent"
      @close="closeNode"
      @select="selectNode"
    />
  </main>
</template>
