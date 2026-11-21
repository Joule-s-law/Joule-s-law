import type { ComponentDefinition } from '../ComponentDefinition'
import { paramNumber } from '../ComponentDefinition'
import { BaseComponent } from '../BaseComponent'
import { PipeComponent } from './PipeComponent'
import type { MnaModel } from '../../circuit/MnaModel'
import { isFluidReceptor, isFluidSupplier, modeAdmits, type FluidInterface } from '../../fluids/fluidInterface'
import type { TickContext } from '../../sim/TickContext'
import { CELL_SIZE } from '../../../shared/constants'

const AMBIENT_TEMP = 300
const HEAT_RISE_PER_SEC = 120

interface CellEdge {
  cellX: number
  cellY: number
  edge: string
}

function samePort(a: CellEdge, b: CellEdge): boolean {
  return a.cellX === b.cellX && a.cellY === b.cellY && a.edge === b.edge
}

export class FissionReactorComponent extends BaseComponent {
  readonly waterRate: number
  readonly steamRate: number
  readonly operatingTemp: number
  readonly meltdownTemp: number
  running = false
  controlRatio = 1
  coreTempK = AMBIENT_TEMP
  melted = false

  constructor(def: ComponentDefinition) {
    super(def)
    this.waterRate = paramNumber(def, 'waterRate', 15)
    this.steamRate = paramNumber(def, 'steamRate', 30)
    this.operatingTemp = paramNumber(def, 'operatingTemp', 650)
    this.meltdownTemp = paramNumber(def, 'meltdownTemp', 1200)
  }

  getResistance(): number {
    return this.def.resistance
  }

  buildCircuitModel(_model: MnaModel): void {}

  getFluidInterfaces(): FluidInterface[] {
    return [
      { cellX: 1, cellY: 0, edge: 'top', mode: 'in' },
      { cellX: 3, cellY: 0, edge: 'top', mode: 'in' },
      { cellX: 1, cellY: this.height - 1, edge: 'bottom', mode: 'out' },
      { cellX: 3, cellY: this.height - 1, edge: 'bottom', mode: 'out' },
    ]
  }

  get reactivity(): number {
    if (!this.running || this.melted) return 0
    return Math.max(0, Math.min(1, 1 - this.controlRatio))
  }

  onTick(ctx: TickContext): void {
    if (this.melted) return
    const host = ctx.host
    const reactivity = this.reactivity
    const interfaces = this.getFluidInterfaces()
    const inInterfaces = interfaces.filter((iface) => iface.mode === 'in')
    const outInterfaces = interfaces.filter((iface) => iface.mode === 'out')
    let pulled = 0
    if (reactivity > 0) {
      const perPort = ((this.waterRate / inInterfaces.length) * reactivity) * ctx.dt
      for (const iface of inInterfaces) {
        const linkedNetworks = new Set<number>()
        const linkedComponents = new Set<BaseComponent>()
        for (const neighbor of host.fluidLinksOf(this)) {
          if (!samePort(neighbor.selfIface, iface)) continue
          if (!modeAdmits(neighbor.partnerIface.mode, 'out')) continue
          if (neighbor.partner instanceof PipeComponent) {
            const networkId = host.pipeNetworkId(neighbor.partner)
            if (networkId === null || linkedNetworks.has(networkId)) continue
            const draw = host.pullPipeFluid(neighbor.partner, perPort, (id) => id === 'water')
            if (draw !== null) {
              pulled += draw.amount
              linkedNetworks.add(networkId)
            }
          } else if (isFluidSupplier(neighbor.partner)) {
            if (linkedComponents.has(neighbor.partner)) continue
            const draw = neighbor.partner.provideFluid(perPort, (id) => id === 'water')
            if (draw !== null) {
              pulled += draw.amount
              linkedComponents.add(neighbor.partner)
            }
          }
        }
      }
    }
    const desired = this.steamRate * reactivity * ctx.dt
    const quota = Math.min(desired, pulled * 3)
    let remaining = quota
    const linkedNetworks = new Set<number>()
    const linkedComponents = new Set<BaseComponent>()
    for (const iface of outInterfaces) {
      if (remaining <= 0) break
      for (const neighbor of host.fluidLinksOf(this)) {
        if (!samePort(neighbor.selfIface, iface)) continue
        if (!modeAdmits(neighbor.partnerIface.mode, 'in')) continue
        if (neighbor.partner instanceof PipeComponent) {
          const networkId = host.pipeNetworkId(neighbor.partner)
          if (networkId === null || linkedNetworks.has(networkId)) continue
          const accepted = host.pushPipeFluid(neighbor.partner, 'steam', remaining)
          if (accepted > 0) {
            linkedNetworks.add(networkId)
            remaining -= accepted
          }
        } else if (isFluidReceptor(neighbor.partner)) {
          if (linkedComponents.has(neighbor.partner)) continue
          const pos = this.interfacePos(iface)
          const accepted = neighbor.partner.receiveFluid('steam', remaining, pos.x, pos.y)
          if (accepted > 0) {
            linkedComponents.add(neighbor.partner)
            remaining -= accepted
          }
        }
      }
    }
    const pushed = quota - remaining
    const leftover = Math.min(desired, pulled * 3) - pushed
    if (leftover > 0.001) {
      const count = Math.max(1, Math.ceil(leftover * 2))
      for (const iface of outInterfaces) {
        const pos = this.interfacePos(iface)
        for (let i = 0; i < count; i++) {
          host.emitFluid(pos.x + (Math.random() - 0.5) * CELL_SIZE * 0.5, pos.y, 'steam', (Math.random() - 0.5) * 20, -30, 1)
        }
      }
    }
    const waterNeed = (this.steamRate / 3) * reactivity * ctx.dt
    const supplyRatio = waterNeed > 0.0001 ? Math.min(1, pulled / waterNeed) : 1
    if (reactivity > 0) {
      if (supplyRatio >= 0.999) {
        this.coreTempK += (this.operatingTemp - this.coreTempK) * Math.min(1, ctx.dt * 0.8)
      } else {
        this.coreTempK += HEAT_RISE_PER_SEC * reactivity * (1 - supplyRatio) * ctx.dt
      }
    } else {
      this.coreTempK += (AMBIENT_TEMP - this.coreTempK) * Math.min(1, ctx.dt * 0.5)
    }
    if (this.coreTempK >= this.meltdownTemp) {
      this.melted = true
      host.meltdownAt(this.x + this.width / 2, this.y + this.height / 2)
    }
  }

  private interfacePos(iface: FluidInterface): { x: number; y: number } {
    const cellX = this.x + iface.cellX + 0.5
    const cellY = this.y + iface.cellY + 0.5
    const half = CELL_SIZE / 2
    const py = iface.edge === 'bottom' ? cellY * CELL_SIZE + half : cellY * CELL_SIZE
    return { x: cellX * CELL_SIZE, y: py }
  }
}
