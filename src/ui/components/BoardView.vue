<template>
  <div class="board-wrap">
    <canvas ref="canvasEl" class="board"></canvas>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useGameStore } from '../stores/useGameStore'
import { gearCenter } from '../../core/components/behaviors/ChainDriveComponent'
import { BoardCanvas } from '../board/BoardCanvas'
import type { BaseComponent } from '../../core/components/BaseComponent'
import type { PipeNetwork } from '../../core/fluids/pipeSystem'
import type { PipeComponent } from '../../core/components/behaviors/PipeComponent'
import type { FluidEmission } from '../../core/sim/Simulation'

const game = useGameStore()
const canvasEl = ref<HTMLCanvasElement | null>(null)
let board: BoardCanvas | null = null

onMounted(() => {
  const canvas = canvasEl.value
  if (canvas === null) return
  board = new BoardCanvas(canvas, {
    getComponents: (): BaseComponent[] => game.sim.components,
    getDragGhost: (): { defId: string; cellX: number; cellY: number; px: number; py: number } | null => game.dragPlace,
    getWirePending: (): { owner: BaseComponent; portIndex: number; color: string | null } | null => game.wirePendingPort,
    getChainPlacement: (): { first: { x: number; y: number } | null } | null =>
      game.chainPlacing ? { first: game.chainFirstGear ? gearCenter(game.chainFirstGear) : null } : null,
    getSelected: (): BaseComponent | null => game.selectedComponent,
    getClickProgress: (): number => game.getClickProgress(),
    drainEnergyEvents: () => game.sim.drainEnergyEvents(),
    drainElectronLaunches: () => game.sim.drainElectronLaunches(),
    getScreenPlacing: (): boolean => game.screenPlacing,
    onScreenPlace: (rect: { x: number; y: number; width: number; height: number }): void => game.placePhotonScreen(rect),
    getPipePlacing: (): boolean => game.pipePlacing,
    onPipePlace: (cells: Array<{ x: number; y: number }>): void => game.placePipes(cells),
    getPipeNetworks: (): PipeNetwork[] => game.sim.pipeSystem.getNetworks(),
    getPipeNetwork: (pipe: PipeComponent): PipeNetwork | null => game.sim.pipeSystem.networkOf(pipe),
    getContamination: (): { x: number; y: number; radius: number } | null => game.sim.contaminationZone,
    getTerrainSeed: (): number => game.sim.terrainSeed,
    drainFluidEmissions: (): FluidEmission[] => game.sim.drainFluidEmissions(),
    onFreeTerminalMove: (component: BaseComponent, px: number, py: number): void => game.moveFreeTerminal(component, px, py),
    getLockedComponents: (): BaseComponent[] => [...game.sim.rotation.lockedComponents],
    getSimTime: (): number => game.sim.simTime,
    onComponentClick: (component: BaseComponent): void => game.selectComponent(component),
    onComponentMove: (component: BaseComponent, cellX: number, cellY: number): void => game.moveComponent(component, cellX, cellY),
    onComponentDropAtScreen: (clientX: number, clientY: number, component: BaseComponent): void => {
      const element = document.elementFromPoint(clientX, clientY)
      if (element !== null && element.closest('.shop') !== null) game.sellComponent(component)
    },
    onPortClick: (component: BaseComponent, portIndex: number): void => game.onPortClick(component, portIndex),
    onToggleMonitor: (component: BaseComponent): void => game.toggleMonitor(component),
    onBlankClick: (x: number, y: number): void => game.canvasBlankClick(x, y),
    onEscape: (): void => {
      game.cancelWirePending()
      game.cancelChainPlacement()
      game.cancelScreenPlacement()
      game.cancelPipePlacement()
      game.selectComponent(null)
    },
  })
  game.registerBoardRect((clientX: number, clientY: number) => {
    if (board === null) return null
    const rect = canvas.getBoundingClientRect()
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null
    return board.screenToWorld(clientX, clientY)
  })
})

onUnmounted(() => {
  board?.dispose()
  board = null
  game.registerBoardRect(null)
})
</script>

<style scoped>
.board-wrap {
  overflow: hidden;
  background: #0b0e13;
  border: 1px solid #2c3648;
  border-radius: 8px;
  width: 100%;
  height: 100%;
  min-height: 0;
}
.board {
  display: block;
  width: 100%;
  height: 100%;
  user-select: none;
}
</style>
