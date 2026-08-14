<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

type Point = { x: number; y: number }

const tailLength = 32
const tailAmplitude = 4

const props = defineProps<{
  label: string
  x: number
  y: number
  velocityX: number
  velocityY: number
  lightMode: boolean
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
const tailDirection = ref<Point>({ x: 0, y: 1 })
const wavePhase = ref(0)
let dragStart: { pointer: Point; moved: boolean } | null = null
let animationFrame: number | null = null
let previousAnimationTime: number | null = null

const tailPath = computed(() => {
  if (!props.lightMode) return ''

  const segments = 12
  const normal = { x: -tailDirection.value.y, y: tailDirection.value.x }
  const phase = wavePhase.value
  let path = 'M 0 0'

  for (let index = 1; index <= segments; index += 1) {
    const progress = index / segments
    const distance = tailLength * progress
    const wave = tailAmplitude * Math.sin(phase + progress * Math.PI * 2) * Math.sin(progress * Math.PI / 2)
    const x = tailDirection.value.x * distance + normal.x * wave
    const y = tailDirection.value.y * distance + normal.y * wave
    path += ` L ${x} ${y}`
  }

  return path
})

watch(() => [props.x, props.y], ([x, y]) => {
  if (typeof x === 'number' && typeof y === 'number') position.value = { x, y }
})

watch(() => [props.velocityX, props.velocityY], ([velocityX, velocityY]) => {
  if (typeof velocityX !== 'number' || typeof velocityY !== 'number') return
  const speed = Math.hypot(velocityX, velocityY)
  if (speed > 0.001) {
    tailDirection.value = { x: -velocityX / speed, y: -velocityY / speed }
  }
})

function animate(timestamp: number): void {
  if (previousAnimationTime !== null) {
    const elapsed = Math.min((timestamp - previousAnimationTime) / 1000, 0.1)
    const speed = Math.hypot(props.velocityX, props.velocityY)
    wavePhase.value += speed * 60 * (Math.PI * 2 / tailLength) * elapsed
  }
  previousAnimationTime = timestamp
  animationFrame = requestAnimationFrame(animate)
}

onMounted(() => {
  if (props.lightMode) animationFrame = requestAnimationFrame(animate)
})

onBeforeUnmount(() => {
  if (animationFrame !== null) cancelAnimationFrame(animationFrame)
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
    @touchstart.stop
    @touchmove.stop
    @pointermove="move"
    @pointerup="endDrag"
    @pointercancel="endDrag"
  >
    <path v-if="lightMode" class="node-tail" :d="tailPath" aria-hidden="true" />
    <circle class="hit-area" r="8" aria-hidden="true" />
    <circle r="8" />
    <text x="14" y="5">{{ label }}</text>
  </g>
</template>
