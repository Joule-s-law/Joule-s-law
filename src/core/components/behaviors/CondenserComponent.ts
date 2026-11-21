import type { ComponentDefinition } from '../ComponentDefinition'
import { paramNumber } from '../ComponentDefinition'
import { BaseComponent } from '../BaseComponent'
import { PipeComponent } from './PipeComponent'
import type { MnaModel } from '../../circuit/MnaModel'
import { allEdgeInterfaces, interfaceWorldPos, isFluidReceptor, isFluidSupplier, modeAdmits, type FluidInterface, type FluidReceptor } from '../../fluids/fluidInterface'
import type { TickContext } from '../../sim/TickContext'

export class CondenserComponent extends BaseComponent implements FluidReceptor {
  private readonly steamIntake: number
  private readonly waterOutput: number
  private steamBuffer = 0

  constructor(def: ComponentDefinition) {
    super(def)
    this.steamIntake = paramNumber(def, 'steamIntake', 4)
    this.waterOutput = paramNumber(def, 'waterOutput', 4)
  }

  getResistance(): number {
    return this.def.resistance
  }

  canReceiveFluid(fluidId: string): boolean {
    return fluidId === 'steam'
  }

  receiveFluid(fluidId: string, amount: number, _px: number, _py: number): number {
    if (fluidId !== 'steam') return 0
    this.steamBuffer += amount
    return amount
  }

  buildCircuitModel(_model: MnaModel): void {}

  onTick(ctx: TickContext): void {
    const host = ctx.host
    let want = this.steamIntake * ctx.dt
    const linkedNetworks = new Set<number>()
    const linkedComponents = new Set<BaseComponent>()
    for (const neighbor of host.fluidLinksOf(this)) {
      if (want <= 0) break
      if (!modeAdmits(neighbor.selfIface.mode, 'in') || !modeAdmits(neighbor.partnerIface.mode, 'out')) continue
      if (neighbor.partner instanceof PipeComponent) {
        const networkId = host.pipeNetworkId(neighbor.partner)
        if (networkId === null || linkedNetworks.has(networkId)) continue
        const draw = host.pullPipeFluid(neighbor.partner, want, (id) => id === 'steam')
        if (draw !== null) {
          this.steamBuffer += draw.amount
          want -= draw.amount
          linkedNetworks.add(networkId)
        }
      } else if (isFluidSupplier(neighbor.partner)) {
        if (linkedComponents.has(neighbor.partner)) continue
        const draw = neighbor.partner.provideFluid(want, (id) => id === 'steam')
        if (draw !== null) {
          this.steamBuffer += draw.amount
          want -= draw.amount
          linkedComponents.add(neighbor.partner)
        }
      }
    }
    if (this.steamBuffer <= 0) return
    const water = this.steamBuffer
    let remaining = Math.min(water, this.waterOutput * ctx.dt * 4)
    linkedNetworks.clear()
    linkedComponents.clear()
    for (const neighbor of host.fluidLinksOf(this)) {
      if (remaining <= 0) break
      if (!modeAdmits(neighbor.selfIface.mode, 'out') || !modeAdmits(neighbor.partnerIface.mode, 'in')) continue
      if (neighbor.partner instanceof PipeComponent) {
        const networkId = host.pipeNetworkId(neighbor.partner)
        if (networkId === null || linkedNetworks.has(networkId)) continue
        const accepted = host.pushPipeFluid(neighbor.partner, 'water', remaining)
        if (accepted > 0) {
          linkedNetworks.add(networkId)
          remaining -= accepted
        }
      } else if (isFluidReceptor(neighbor.partner)) {
        if (linkedComponents.has(neighbor.partner)) continue
        const pos = interfaceWorldPos(this, neighbor.selfIface)
        const accepted = neighbor.partner.receiveFluid('water', remaining, pos.x, pos.y)
        if (accepted > 0) {
          linkedComponents.add(neighbor.partner)
          remaining -= accepted
        }
      }
    }
    const released = water - Math.max(0, remaining)
    this.steamBuffer = 0
    if (released < water - 1e-9) {
      const leftover = water - released
      const left = interfaceWorldPos(this, { cellX: 0, cellY: 0, edge: 'left', mode: 'out' })
      const right = interfaceWorldPos(this, { cellX: this.width - 1, cellY: 0, edge: 'right', mode: 'out' })
      const count = Math.max(1, Math.ceil(leftover * 3))
      for (let i = 0; i < count; i++) {
        const fromLeft = Math.random() < 0.5
        const pos = fromLeft ? left : right
        host.emitFluid(pos.x, pos.y, 'water', fromLeft ? -45 : 45, -10, 1)
      }
    }
  }

  getFluidInterfaces(): FluidInterface[] {
    return allEdgeInterfaces('both', this.width, this.height)
  }
}
