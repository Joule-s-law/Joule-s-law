<template>
  <div class="tech-overlay">
    <div class="tech-header">
      <button class="back-btn" @click="game.closeTechTree()">← 返回电路板</button>
      <h2>产线优化 · 科技树</h2>
      <div class="money">¥ {{ game.money.toFixed(2) }}</div>
    </div>
    <div class="tech-body">
      <canvas
        ref="canvasEl"
        class="tech-canvas"
        @mousedown="onMouseDown"
        @mousemove="onMouseMove"
        @mouseup="onMouseUp"
        @mouseleave="onMouseUp"
      ></canvas>
      <aside v-if="selected !== null" class="detail">
        <div class="name">{{ selected.displayName }}</div>
        <div class="desc">{{ selected.description }}</div>
        <div class="row"><span>等级</span><span>{{ selected.level }} / {{ selected.maxLevel }}</span></div>
        <div v-if="selected.parentName !== null" class="row"><span>前置</span><span>{{ selected.parentName }}</span></div>
        <div class="row"><span>下一级费用</span><span>¥ {{ formatCost(selected.cost) }}</span></div>
        <button
          v-if="selected.unlocked && selected.level < selected.maxLevel"
          class="buy"
          :disabled="!selected.canBuy"
          @click="game.buyTechLevel(selected.id)"
        >
          {{ selected.canBuy ? '升级' : '资金不足' }}
        </button>
        <div v-else-if="selected.level >= selected.maxLevel" class="maxed">已满级</div>
        <div v-else class="locked-tip">需先将「{{ selected.parentName }}」升至 1 级</div>
      </aside>
      <aside v-else class="detail placeholder">
        <p>点击节点查看详情</p>
        <p class="sub">拖动节点调整位置 · 拖动空白平移视图</p>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useGameStore } from '../stores/useGameStore'
import type { TechNodeInfo } from '../stores/useGameStore'

const NODE_W = 170
const NODE_H = 96

const game = useGameStore()
const canvasEl = ref<HTMLCanvasElement | null>(null)
const nodes = computed(() => {
  void game.techVersion
  void game.money
  return game.techNodeInfos()
})
const selected = computed(() => nodes.value.find((n) => n.id === game.selectedTechId) ?? null)

let ctx: CanvasRenderingContext2D | null = null
let rafHandle = 0
let view = { x: 0, y: 0 }
let dragNode: TechNodeInfo | null = null
let dragOffset = { x: 0, y: 0 }
let panning = false
let panStart = { x: 0, y: 0 }
let panViewStart = { x: 0, y: 0 }
let mouseDownAt: { x: number; y: number } | null = null

function initView(): void {
  view = { ...layoutView() }
}

function layoutView(): { x: number; y: number } {
  const raw = localStorage.getItem('joules-law-tech-layout')
  if (raw !== null) {
    try {
      const parsed = JSON.parse(raw) as { view?: { x: number; y: number } }
      if (parsed.view !== undefined) return parsed.view
    } catch {
    }
  }
  return { x: 0, y: 0 }
}

function nodeAt(mx: number, my: number): TechNodeInfo | null {
  for (const node of nodes.value) {
    if (mx >= node.x && mx <= node.x + NODE_W && my >= node.y && my <= node.y + NODE_H) {
      return node
    }
  }
  return null
}

function toWorld(clientX: number, clientY: number): { x: number; y: number } {
  const canvas = canvasEl.value
  if (canvas === null) return { x: 0, y: 0 }
  const rect = canvas.getBoundingClientRect()
  return { x: clientX - rect.left - view.x, y: clientY - rect.top - view.y }
}

function onMouseDown(event: MouseEvent): void {
  const world = toWorld(event.clientX, event.clientY)
  mouseDownAt = { x: event.clientX, y: event.clientY }
  const node = nodeAt(world.x, world.y)
  if (node !== null) {
    dragNode = node
    dragOffset = { x: world.x - node.x, y: world.y - node.y }
  } else {
    panning = true
    panStart = { x: event.clientX, y: event.clientY }
    panViewStart = { ...view }
  }
}

function onMouseMove(event: MouseEvent): void {
  if (dragNode !== null) {
    const world = toWorld(event.clientX, event.clientY)
    dragNode.x = world.x - dragOffset.x
    dragNode.y = world.y - dragOffset.y
    game.setTechNodePosition(dragNode.id, dragNode.x, dragNode.y)
    return
  }
  if (panning) {
    view.x = panViewStart.x + (event.clientX - panStart.x)
    view.y = panViewStart.y + (event.clientY - panStart.y)
    game.setTechView(view.x, view.y)
  }
}

function onMouseUp(event: MouseEvent): void {
  const wasDrag =
    mouseDownAt !== null &&
    Math.hypot(event.clientX - mouseDownAt.x, event.clientY - mouseDownAt.y) > 5
  if (dragNode !== null) {
    if (!wasDrag) game.selectTech(dragNode.id)
    dragNode = null
  } else if (panning) {
    if (!wasDrag) game.selectTech(null)
    panning = false
  }
  mouseDownAt = null
}

function render(): void {
  const canvas = canvasEl.value
  const context = ctx
  if (canvas === null || context === null) return
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#0d1220'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.save()
  context.translate(view.x, view.y)
  drawLinks(context)
  for (const node of nodes.value) {
    drawNode(context, node)
  }
  context.restore()
  rafHandle = requestAnimationFrame(render)
}

function drawLinks(context: CanvasRenderingContext2D): void {
  for (const node of nodes.value) {
    if (node.parentName === null) continue
    const parent = nodes.value.find((n) => n.displayName === node.parentName)
    if (parent === undefined) continue
    const x1 = parent.x + NODE_W
    const y1 = parent.y + NODE_H / 2
    const x2 = node.x
    const y2 = node.y + NODE_H / 2
    context.strokeStyle = node.level > 0 ? '#4fc3f7' : 'rgba(120, 144, 156, 0.4)'
    context.lineWidth = node.level > 0 ? 2.5 : 1.5
    context.beginPath()
    context.moveTo(x1, y1)
    context.bezierCurveTo(x1 + 40, y1, x2 - 40, y2, x2, y2)
    context.stroke()
  }
}

function drawNode(context: CanvasRenderingContext2D, node: TechNodeInfo): void {
  context.fillStyle = node.level >= node.maxLevel
    ? '#3d3520'
    : node.unlocked
      ? '#1e2a3a'
      : '#151b25'
  context.strokeStyle = node.id === game.selectedTechId
    ? '#ffd54f'
    : node.level >= node.maxLevel
      ? '#ffd54f'
      : node.unlocked
        ? '#4fc3f7'
        : '#3a4658'
  context.lineWidth = node.id === game.selectedTechId ? 2.5 : 1.5
  context.beginPath()
  context.roundRect(node.x, node.y, NODE_W, NODE_H, 8)
  context.fill()
  context.stroke()

  context.fillStyle = node.unlocked ? '#ecf0f1' : '#607d8b'
  context.font = 'bold 14px system-ui, sans-serif'
  context.textAlign = 'left'
  context.fillText(node.displayName, node.x + 10, node.y + 22)

  context.fillStyle = node.level > 0 ? '#4fc3f7' : '#78909c'
  context.font = '11px system-ui, sans-serif'
  context.fillText(`Lv ${node.level} / ${node.maxLevel}`, node.x + 10, node.y + 40)

  if (!node.unlocked) {
    context.fillStyle = '#e74c3c'
    context.fillText('未解锁', node.x + NODE_W - 52, node.y + 22)
  } else if (node.level < node.maxLevel) {
    context.fillStyle = node.canBuy ? '#ffd54f' : '#78909c'
    context.fillText(`¥ ${formatCost(node.cost)}`, node.x + NODE_W - 62, node.y + 22)
  } else {
    context.fillStyle = '#ffd54f'
    context.fillText('MAX', node.x + NODE_W - 40, node.y + 22)
  }

  context.fillStyle = node.unlocked ? '#90a4ae' : '#546e7a'
  const words = node.description.split('：')
  context.fillText(words[0] ?? '', node.x + 10, node.y + 62)
  context.fillText((words.slice(1).join('：')).slice(0, 18), node.x + 10, node.y + 78)
}

function formatCost(cost: number): string {
  return cost >= 10000 ? cost.toExponential(2) : Math.round(cost).toString()
}

onMounted(() => {
  const canvas = canvasEl.value
  if (canvas === null) return
  const context = canvas.getContext('2d')
  if (context === null) return
  ctx = context
  canvas.width = canvas.clientWidth
  canvas.height = canvas.clientHeight
  initView()
  rafHandle = requestAnimationFrame(render)
})

onUnmounted(() => {
  cancelAnimationFrame(rafHandle)
})
</script>

<style scoped>
.tech-overlay {
  position: fixed;
  inset: 0;
  top: 53px;
  background: #0b0e16;
  display: flex;
  flex-direction: column;
  z-index: 100;
}
.tech-header {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 10px 20px;
  background: #1b2230;
  border-bottom: 1px solid #2c3648;
}
.tech-header h2 {
  font-size: 16px;
  color: #ecf0f1;
}
.money {
  margin-left: auto;
  color: #ffd54f;
  font-weight: 700;
}
.back-btn {
  padding: 6px 12px;
  background: #2c3648;
  color: #cfd8dc;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.tech-body {
  position: relative;
  flex: 1;
  overflow: hidden;
}
.tech-canvas {
  width: 100%;
  height: 100%;
  display: block;
  cursor: grab;
}
.detail {
  position: absolute;
  right: 16px;
  top: 16px;
  width: 300px;
  background: #1b2230;
  border: 1px solid #2c3648;
  border-radius: 8px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.detail.placeholder {
  color: #607d8b;
  font-size: 13px;
}
.detail .sub {
  color: #546e7a;
  font-size: 11px;
}
.name {
  font-size: 16px;
  font-weight: 700;
  color: #4fc3f7;
}
.desc {
  font-size: 12px;
  color: #b0bec5;
  line-height: 1.6;
}
.row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #90a4ae;
}
.buy {
  padding: 8px;
  background: #2c6e9e;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}
.buy:disabled {
  background: #37474f;
  color: #78909c;
  cursor: not-allowed;
}
.maxed {
  color: #ffd54f;
  font-size: 13px;
  text-align: center;
}
.locked-tip {
  color: #e74c3c;
  font-size: 12px;
}
</style>
