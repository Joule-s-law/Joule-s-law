import type { ComponentDefinition } from '../ComponentDefinition'
import { paramNumber } from '../ComponentDefinition'
import { BaseComponent } from '../BaseComponent'
import { PipeComponent } from './PipeComponent'
import type { MnaModel } from '../../circuit/MnaModel'
import { isFluidReceptor, isFluidSupplier, modeAdmits, type FluidInterface } from '../../fluids/fluidInterface'
import type { TickContext } from '../../sim/TickContext'
import { CELL_SIZE } from '../../../shared/constants'

const AMBIENT_TEMP = 298
const HEAT_RISE_PER_SEC = 120
const RAMP_UP_PER_SEC = 1 / 10
const RAMP_DOWN_PER_SEC = 1 / 30
const BALANCE_LINE = 0.75

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
  readonly heatRatio: number
  readonly operatingTemp: number
  readonly meltdownTemp: number
  running = false
  controlRatio = 1
  reactorPower = 0
  balance = 0.5
  coreTempK = AMBIENT_TEMP
  melted = false

  constructor(def: ComponentDefinition) {
    super(def)
    this.waterRate = paramNumber(def, 'waterRate', 15)
    this.steamRate = paramNumber(def, 'steamRate', 30)
    this.heatRatio = paramNumber(def, 'heatRatio', 0.4)
    this.operatingTemp = paramNumber(def, 'operatingTemp', 1900)
    this.meltdownTemp = paramNumber(def, 'meltdownTemp', 3200)
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
    return this.melted ? 0 : this.reactorPower
  }

  onTick(ctx: TickContext): void {
    if (this.melted) return
    const host = ctx.host
    if (this.running) {
      const target = Math.max(0, Math.min(1, 1 - this.controlRatio))
      if (this.reactorPower < target) this.reactorPower = Math.min(target, this.reactorPower + RAMP_UP_PER_SEC * ctx.dt)
      else if (this.reactorPower > target) this.reactorPower = Math.max(target, this.reactorPower - RAMP_DOWN_PER_SEC * ctx.dt)
      if (this.reactorPower <= 0.0001) {
        this.reactorPower = 0
        this.running = false
      }
    } else {
      this.reactorPower = Math.max(0, this.reactorPower - RAMP_DOWN_PER_SEC * ctx.dt)
    }
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
    const coolingRate = waterNeed > 0.0001 ? pulled / waterNeed : 1.5
    const balance = coolingRate / (coolingRate + reactivity * this.heatRatio)
    this.balance = Math.max(0, Math.min(1, balance))
    const dev = balance - BALANCE_LINE
    if (reactivity > 0) {
      if (dev >= 0) {
        const targetTemp = AMBIENT_TEMP + (this.operatingTemp - AMBIENT_TEMP) * reactivity
        this.coreTempK += (targetTemp - this.coreTempK) * Math.min(1, ctx.dt * 1.5 * Math.min(1, dev / 0.04))
      } else {
        this.coreTempK += HEAT_RISE_PER_SEC * reactivity * Math.min(2, -dev / 0.25) * ctx.dt
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
