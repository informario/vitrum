<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Graph from 'graphology'

import { createGraph, type Database } from '../controller/graph_generator'

type Point = { x: number; y: number }

const width = 1100
const height = 680
const graph = ref<Graph | null>(null)
const positions = ref<Record<string, Point>>({})

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

onMounted(() => {
  const nextGraph = createGraph(databaseFromFiles())
  graph.value = nextGraph
  positions.value = randomPositions(nextGraph.nodes())
})

const nodes = computed(() => graph.value?.nodes() ?? [])
const edges = computed(() => graph.value?.mapEdges((edge, attributes, source, target) => ({
  edge,
  source,
  target,
  attributes,
})) ?? [])

function point(node: string): Point {
  return positions.value[node] ?? { x: 0, y: 0 }
}

</script>

<template>
  <main class="graph-page">
    <section class="graph-shell" aria-label="Knowledge graph">
      <svg :viewBox="`0 0 ${width} ${height}`" role="img">
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" />
          </marker>
        </defs>

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

        <g
          v-for="node in nodes"
          :key="node"
          class="node"
          :transform="`translate(${point(node).x} ${point(node).y})`"
        >
          <circle r="8" />
          <text x="14" y="5">{{ node }}</text>
        </g>
      </svg>
      <p v-if="!graph" class="loading">Loading graph…</p>
    </section>
  </main>
</template>
