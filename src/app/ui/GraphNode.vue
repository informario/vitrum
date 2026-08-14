<script setup lang="ts">
import { ref, watch } from 'vue'

type Point = { x: number; y: number }

const props = defineProps<{
  label: string
  x: number
  y: number
  canvasWidth: number
  canvasHeight: number
}>()

const emit = defineEmits<{
  'drag-start': []
  'drag-end': []
  moved: [position: Point]
  selected: []
}>()

const position = ref<Point>({ x: props.x, y: props.y })
let dragStart: { pointer: Point; moved: boolean } | null = null

watch(() => [props.x, props.y], ([x, y]) => {
  if (typeof x === 'number' && typeof y === 'number') position.value = { x, y }
})

function pointerPosition(event: PointerEvent): Point {
  const node = event.currentTarget as SVGGraphicsElement
  const svg = node.ownerSVGElement
  const graphLayer = node.parentElement as SVGGraphicsElement | null
  const transform = graphLayer?.getScreenCTM() ?? svg?.getScreenCTM()
  if (svg && transform) {
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const graphPoint = point.matrixTransform(transform.inverse())
    return { x: graphPoint.x, y: graphPoint.y }
  }

  const bounds = svg?.getBoundingClientRect()
  if (!bounds) return { x: event.clientX, y: event.clientY }
  return {
    x: (event.clientX - bounds.left) * (props.canvasWidth / bounds.width),
    y: (event.clientY - bounds.top) * (props.canvasHeight / bounds.height),
  }
}

function startDrag(event: PointerEvent): void {
  event.stopPropagation()
  if (event.button !== 0 && event.pointerType !== 'touch') return
  dragStart = { pointer: pointerPosition(event), moved: false }
  ;(event.currentTarget as SVGElement).setPointerCapture(event.pointerId)
}

function move(event: PointerEvent): void {
  if (!dragStart) return
  const pointer = pointerPosition(event)
  const delta = { x: pointer.x - dragStart.pointer.x, y: pointer.y - dragStart.pointer.y }
  if (!dragStart.moved && (Math.abs(delta.x) > 3 || Math.abs(delta.y) > 3)) {
    dragStart.moved = true
    emit('drag-start')
  }
  if (!dragStart.moved) return
  position.value = pointer
  emit('moved', pointer)
}

function endDrag(event: PointerEvent): void {
  if (!dragStart) return
  const target = event.currentTarget as SVGElement
  if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
  if (dragStart.moved) emit('drag-end')
  if (!dragStart.moved) emit('selected')
  dragStart = null
}
</script>

<template>
  <g
    class="node"
    :transform="`translate(${position.x} ${position.y})`"
    @pointerdown="startDrag"
    @mousedown.stop
    @pointermove="move"
    @pointerup="endDrag"
    @pointercancel="endDrag"
  >
    <circle class="hit-area" r="8" aria-hidden="true" />
    <circle r="8" />
    <text x="14" y="5">{{ label }}</text>
  </g>
</template>
