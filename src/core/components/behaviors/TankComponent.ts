import type { ComponentDefinition } from '../ComponentDefinition'
import { paramNumber } from '../ComponentDefinition'
import { BaseComponent } from '../BaseComponent'
import { PipeComponent } from './PipeComponent'
import type { MnaModel } from '../../circuit/MnaModel'
import { allEdgeInterfaces, interfaceWorldPos, isFluidReceptor, isFluidSupplier, modeAdmits, type FluidInterface, type FluidReceptor, type FluidSupplier } from '../../fluids/fluidInterface'
import type { TickContext } from '../../sim/TickContext'
import { fluidCompatible } from '../../fluids/fluids'

export class TankComponent extends BaseComponent implements FluidReceptor, FluidSupplier {
  readonly capacity: number
  private readonly transferRate: number
  private readonly outputRate: number
  storedFluidId: string | null = null
  storedAmount = 0

  constructor(def: ComponentDefinition) {
    super(def)
    this.capacity = paramNumber(def, 'capacity', 100)
    this.transferRate = paramNumber(def, 'transferRate', 4)
    this.outputRate = paramNumber(def, 'outputRate', 2)
  }

  getResistance(): number {
    return this.def.resistance
  }

  buildCircuitModel(_model: MnaModel): void {}

  canReceiveFluid(fluidId: string): boolean {
    return this.storedAmount < this.capacity && fluidCompatible(this.storedFluidId, fluidId)
  }

  receiveFluid(fluidId: string, amount: number, _px: number, _py: number): number {
    if (this.storedAmount >= this.capacity || !fluidCompatible(this.storedFluidId, fluidId)) return 0
    const accepted = Math.min(amount, this.capacity - this.storedAmount)
    if (this.storedFluidId === null) this.storedFluidId = fluidId
    this.storedAmount += accepted
    return accepted
  }

  provideFluid(max: number, filter?: (fluidId: string) => boolean): { fluidId: string; amount: number } | null {
    if (this.storedFluidId === null || this.storedAmount <= 0) return null
    if (filter !== undefined && !filter(this.storedFluidId)) return null
    const take = Math.min(max, this.storedAmount)
    this.storedAmount -= take
    const fluidId = this.storedFluidId
    if (this.storedAmount <= 1e-9) {
      this.storedAmount = 0
      this.storedFluidId = null
    }
    return { fluidId, amount: take }
  }

  onTick(ctx: TickContext): void {
    const host = ctx.host
    const throughput = this.transferRate * ctx.dt
    const linkedNetworks = new Set<number>()
    const linkedComponents = new Set<BaseComponent>()
    for (const neighbor of host.fluidLinksOf(this)) {
      if (this.storedAmount >= this.capacity) break
      if (!modeAdmits(neighbor.selfIface.mode, 'in') || !modeAdmits(neighbor.partnerIface.mode, 'out')) continue
      let draw: { fluidId: string; amount: number } | null = null
      if (neighbor.partner instanceof PipeComponent) {
        const networkId = host.pipeNetworkId(neighbor.partner)
        if (networkId === null || linkedNetworks.has(networkId)) continue
        draw = host.pullPipeFluid(neighbor.partner, Math.min(throughput, this.capacity - this.storedAmount), (id) => fluidCompatible(this.storedFluidId, id))
        if (draw !== null) linkedNetworks.add(networkId)
      } else if (isFluidSupplier(neighbor.partner)) {
        if (linkedComponents.has(neighbor.partner)) continue
        draw = neighbor.partner.provideFluid(Math.min(throughput, this.capacity - this.storedAmount), (id) => fluidCompatible(this.storedFluidId, id))
        if (draw !== null) linkedComponents.add(neighbor.partner)
      }
      if (draw === null) continue
      if (!fluidCompatible(this.storedFluidId, draw.fluidId)) continue
      if (this.storedFluidId === null) this.storedFluidId = draw.fluidId
      this.storedAmount += draw.amount
    }
    if (this.storedFluidId === null || this.storedAmount <= 0) return
    const outFluidId = this.storedFluidId
    linkedNetworks.clear()
    linkedComponents.clear()
    let remaining = this.outputRate * ctx.dt
    for (const neighbor of host.fluidLinksOf(this)) {
      if (remaining <= 0) break
      if (!modeAdmits(neighbor.selfIface.mode, 'out') || !modeAdmits(neighbor.partnerIface.mode, 'in')) continue
      let accepted = 0
      if (neighbor.partner instanceof PipeComponent) {
        const networkId = host.pipeNetworkId(neighbor.partner)
        if (networkId === null || linkedNetworks.has(networkId)) continue
        accepted = host.pushPipeFluid(neighbor.partner, outFluidId, Math.min(remaining, this.storedAmount))
        if (accepted > 0) linkedNetworks.add(networkId)
      } else if (isFluidReceptor(neighbor.partner)) {
        if (linkedComponents.has(neighbor.partner)) continue
        const pos = interfaceWorldPos(this, neighbor.selfIface)
        accepted = neighbor.partner.receiveFluid(outFluidId, Math.min(remaining, this.storedAmount), pos.x, pos.y)
        if (accepted > 0) linkedComponents.add(neighbor.partner)
      }
      remaining -= accepted
      this.storedAmount -= accepted
      if (this.storedAmount <= 1e-9) {
        this.storedAmount = 0
        this.storedFluidId = null
        return
      }
    }
  }

  getFluidInterfaces(): FluidInterface[] {
    return allEdgeInterfaces('both', this.width, this.height)
  }
}
