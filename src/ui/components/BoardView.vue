<template>
  <div class="board-wrap">
    <canvas ref="canvasEl" class="board"></canvas>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useGameStore } from '../stores/useGameStore'
import { BoardCanvas } from '../board/BoardCanvas'
import type { BaseComponent } from '../../core/components/BaseComponent'

const game = useGameStore()
const canvasEl = ref<HTMLCanvasElement | null>(null)
let board: BoardCanvas | null = null

onMounted(() => {
  const canvas = canvasEl.value
  if (canvas === null) return
  game.registerBoardRect(() => canvas.getBoundingClientRect())
  board = new BoardCanvas(canvas, {
    getComponents: (): BaseComponent[] => game.sim.components,
    getDragGhost: (): { cellX: number; cellY: number } | null => game.dragPlace,
    getWirePending: (): { owner: BaseComponent; portIndex: number } | null => game.wirePendingPort,
    getSelected: (): BaseComponent | null => game.selectedComponent,
    getClickProgress: (): number => game.getClickProgress(),
    drainEnergyEvents: () => game.sim.drainEnergyEvents(),
    getLockedComponents: (): BaseComponent[] => [...game.sim.rotation.lockedComponents],
    getSimTime: (): number => game.sim.simTime,
    onComponentClick: (component: BaseComponent): void => game.selectComponent(component),
    onComponentMove: (component: BaseComponent, cellX: number, cellY: number): void => game.moveComponent(component, cellX, cellY),
    onPortClick: (component: BaseComponent, portIndex: number): void => game.onPortClick(component, portIndex),
    onBlankClick: (x: number, y: number): void => game.canvasBlankClick(x, y),
    onEscape: (): void => {
      game.cancelWirePending()
      game.selectComponent(null)
    },
  })
})

onUnmounted(() => {
  board?.dispose()
  board = null
  game.registerBoardRect(() => null)
})
</script>

<style scoped>
.board-wrap {
  overflow: auto;
  background: #0b0e13;
  border: 1px solid #2c3648;
  border-radius: 8px;
  max-width: 100%;
}
.board {
  display: block;
  width: 100%;
  min-width: 720px;
  height: auto;
}
</style>
