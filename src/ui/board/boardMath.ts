import type { BaseComponent } from '../../core/components/BaseComponent'
import type { Port } from '../../core/circuit/Port'
import { CELL_SIZE } from '../../shared/constants'
import { FreeTerminalComponent } from '../../core/components/behaviors/FreeTerminalComponent'

export { CELL_SIZE }

export interface Point {
  px: number
  py: number
}

export function portPosition(component: BaseComponent, portIndex: number): Point {
  if (component instanceof FreeTerminalComponent) {
    const pos = component.getPortWorldPos(portIndex)
    return { px: pos.x, py: pos.y }
  }
  const baseX = component.x * CELL_SIZE
  const top = component.y * CELL_SIZE
  const height = component.height * CELL_SIZE
  if (component.def.portCount === 4) {
    if (component.def.portLayout === 'rows') {
      if (portIndex === 0) return { px: baseX + component.width * CELL_SIZE * 0.25, py: top }
      if (portIndex === 1) return { px: baseX + component.width * CELL_SIZE * 0.75, py: top }
      if (portIndex === 2) return { px: baseX + component.width * CELL_SIZE * 0.25, py: top + height }
      return { px: baseX + component.width * CELL_SIZE * 0.75, py: top + height }
    }
    if (portIndex === 0) return { px: baseX, py: top + height * 0.25 }
    if (portIndex === 1) return { px: baseX, py: top + height * 0.75 }
    if (portIndex === 2) return { px: baseX + component.width * CELL_SIZE, py: top + height * 0.25 }
    return { px: baseX + component.width * CELL_SIZE, py: top + height * 0.75 }
  }
  const baseY = top + height / 2
  if (portIndex === 0) {
    return { px: baseX, py: baseY }
  }
  return { px: baseX + component.width * CELL_SIZE, py: baseY }
}

export function portOf(component: BaseComponent, portIndex: number): Port {
  return component.getPort(portIndex)
}

export function wireDistance(portA: Port, portB: Port): number {
  const a = portPosition(portA.owner, portA.index)
  const b = portPosition(portB.owner, portB.index)
  return Math.hypot(a.px - b.px, a.py - b.py) / CELL_SIZE
}

export function componentAt(components: BaseComponent[], cellX: number, cellY: number): BaseComponent | null {
  for (const component of components) {
    if (component.occupies(cellX, cellY)) return component
  }
  return null
}
