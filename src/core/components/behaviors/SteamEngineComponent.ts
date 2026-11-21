import type { ComponentDefinition } from '../ComponentDefinition'
import { paramNumber } from '../ComponentDefinition'
import { ResistiveComponent } from './ResistiveComponent'
import { PipeComponent } from './PipeComponent'
import type { BaseComponent } from '../BaseComponent'
import { allEdgeInterfaces, interfaceWorldPos, isFluidReceptor, modeAdmits, type FluidInterface } from '../../fluids/fluidInterface'
import type { TickContext } from '../../sim/TickContext'
import { CELL_SIZE } from '../../../shared/constants'

export class SteamEngineComponent extends ResistiveComponent {
  private readonly steamRate: number

  constructor(def: ComponentDefinition) {
    super(def)
    this.steamRate = paramNumber(def, 'steamRate', 3)
  }

  onTick(ctx: TickContext): void {
    super.onTick(ctx)
    const rated = Math.max(0.001, this.def.ratedCurrent * ctx.host.ratedCurrentBoost)
    const drive = Math.min(1, Math.abs(this.current) / rated)
    if (drive <= 0) return
    const rate = this.steamRate * drive * Math.min(0.95, 0.7 + ctx.host.converterEfficiencyBoost) * ctx.dt
    let remaining = rate
    const linkedNetworks = new Set<number>()
    const linkedComponents = new Set<BaseComponent>()
    for (const neighbor of ctx.host.fluidLinksOf(this)) {
      if (remaining <= 0) break
      if (!modeAdmits(neighbor.selfIface.mode, 'out') || !modeAdmits(neighbor.partnerIface.mode, 'in')) continue
      if (neighbor.partner instanceof PipeComponent) {
        const networkId = ctx.host.pipeNetworkId(neighbor.partner)
        if (networkId === null || linkedNetworks.has(networkId)) continue
        const accepted = ctx.host.pushPipeFluid(neighbor.partner, 'steam', remaining)
        if (accepted > 0) linkedNetworks.add(networkId)
        remaining -= accepted
      } else if (isFluidReceptor(neighbor.partner)) {
        if (linkedComponents.has(neighbor.partner)) continue
        const pos = interfaceWorldPos(this, neighbor.selfIface)
        const accepted = neighbor.partner.receiveFluid('steam', remaining, pos.x, pos.y)
        if (accepted > 0) linkedComponents.add(neighbor.partner)
        remaining -= accepted
      }
    }
    if (remaining <= 0) return
    const px = (this.x + this.width / 2) * CELL_SIZE
    const py = (this.y + this.height / 2) * CELL_SIZE
    ctx.host.emitFluid(px, py, 'steam', 0, 0, Math.max(1, Math.ceil(remaining * 3)))
  }

  getFluidInterfaces(): FluidInterface[] {
    return allEdgeInterfaces('out', this.width, this.height)
  }
}
