import type { BaseComponent } from '../components/BaseComponent'
import { CELL_SIZE } from '../../shared/constants'

export type FluidEdge = 'top' | 'bottom' | 'left' | 'right'
export type FluidIOMode = 'in' | 'out' | 'both'

export interface FluidInterface {
  cellX: number
  cellY: number
  edge: FluidEdge
  mode: FluidIOMode
}

export function oppositeEdge(edge: FluidEdge): FluidEdge {
  if (edge === 'top') return 'bottom'
  if (edge === 'bottom') return 'top'
  if (edge === 'left') return 'right'
  return 'left'
}

export function edgeUnit(edge: FluidEdge): { x: number; y: number } {
  if (edge === 'top') return { x: 0, y: -1 }
  if (edge === 'bottom') return { x: 0, y: 1 }
  if (edge === 'left') return { x: -1, y: 0 }
  return { x: 1, y: 0 }
}

export function modeAdmits(mode: FluidIOMode, direction: 'in' | 'out'): boolean {
  return mode === 'both' || mode === direction
}

export function interfaceCell(component: BaseComponent, iface: FluidInterface): { x: number; y: number } {
  return { x: component.x + iface.cellX, y: component.y + iface.cellY }
}

export function interfaceWorldPos(component: BaseComponent, iface: FluidInterface): { x: number; y: number } {
  const cell = interfaceCell(component, iface)
  const px = (cell.x + 0.5) * CELL_SIZE
  const py = (cell.y + 0.5) * CELL_SIZE
  const half = CELL_SIZE / 2
  if (iface.edge === 'top') return { x: px, y: py - half }
  if (iface.edge === 'bottom') return { x: px, y: py + half }
  if (iface.edge === 'left') return { x: px - half, y: py }
  return { x: px + half, y: py }
}

export function allEdgeInterfaces(mode: FluidIOMode, width = 1, height = 1): FluidInterface[] {
  const list: FluidInterface[] = []
  for (let cellY = 0; cellY < height; cellY++) {
    for (let cellX = 0; cellX < width; cellX++) {
      list.push({ cellX, cellY, edge: 'top', mode })
      list.push({ cellX, cellY, edge: 'bottom', mode })
      list.push({ cellX, cellY, edge: 'left', mode })
      list.push({ cellX, cellY, edge: 'right', mode })
    }
  }
  return list
}

export function interfaceKey(component: BaseComponent, iface: FluidInterface): string {
  const cell = interfaceCell(component, iface)
  return `${cell.x},${cell.y},${iface.edge}`
}

export interface FluidEndpoint {
  component: BaseComponent
  iface: FluidInterface
}

export interface FluidLink {
  a: FluidEndpoint
  b: FluidEndpoint
}

export interface FluidNeighbor {
  selfIface: FluidInterface
  partner: BaseComponent
  partnerIface: FluidInterface
}

export function buildFluidLinks(components: BaseComponent[]): FluidLink[] {
  const byKey = new Map<string, FluidEndpoint>()
  for (const component of components) {
    for (const iface of component.getFluidInterfaces()) {
      byKey.set(interfaceKey(component, iface), { component, iface })
    }
  }
  const links: FluidLink[] = []
  const seen = new Set<string>()
  for (const endpoint of byKey.values()) {
    const cell = interfaceCell(endpoint.component, endpoint.iface)
    const unit = edgeUnit(endpoint.iface.edge)
    const partnerKey = `${cell.x + unit.x},${cell.y + unit.y},${oppositeEdge(endpoint.iface.edge)}`
    const partner = byKey.get(partnerKey)
    if (partner === undefined) continue
    const pairKey = interfaceKey(endpoint.component, endpoint.iface) < partnerKey
      ? `${interfaceKey(endpoint.component, endpoint.iface)}|${partnerKey}`
      : `${partnerKey}|${interfaceKey(endpoint.component, endpoint.iface)}`
    if (seen.has(pairKey)) continue
    seen.add(pairKey)
    links.push({ a: endpoint, b: partner })
  }
  return links
}

export interface FluidReceptor {
  canReceiveFluid(fluidId: string): boolean
  receiveFluid(fluidId: string, amount: number, px: number, py: number): number
}

export function isFluidReceptor(component: BaseComponent): component is BaseComponent & FluidReceptor {
  return typeof (component as unknown as { canReceiveFluid?: unknown }).canReceiveFluid === 'function'
}

export interface FluidSupplier {
  provideFluid(max: number, filter?: (fluidId: string) => boolean): { fluidId: string; amount: number } | null
}

export function isFluidSupplier(component: BaseComponent): component is BaseComponent & FluidSupplier {
  return typeof (component as unknown as { provideFluid?: unknown }).provideFluid === 'function'
}
