import type { ComponentDefinition } from '../ComponentDefinition'
import { paramNumber } from '../ComponentDefinition'
import { BaseComponent } from '../BaseComponent'
import { ResistiveComponent } from './ResistiveComponent'
import { PipeComponent } from './PipeComponent'
import { allEdgeInterfaces, isFluidReceptor, modeAdmits, type FluidInterface } from '../../fluids/fluidInterface'
import type { MnaModel } from '../../circuit/MnaModel'
import type { TickContext } from '../../sim/TickContext'
import { terrainTypeAt } from '../../world/terrain'
import { CELL_SIZE } from '../../../shared/constants'

export class WaterPumpComponent extends ResistiveComponent {
  private readonly maxRate: number
  private readonly powerToFlow: number
  private budget = 0
  private seed = 0

  constructor(def: ComponentDefinition) {
    super(def)
    this.maxRate = paramNumber(def, 'maxRate', 10)
    this.powerToFlow = paramNumber(def, 'powerToFlow', 0.4)
  }

  buildCircuitModel(model: MnaModel): void {
    model.addBranch(this.nodeOf(0), this.nodeOf(1), this.getResistance(), 0, this)
  }

  getFluidInterfaces(): FluidInterface[] {
    return allEdgeInterfaces('out', this.width, this.height)
  }

  get onWater(): boolean {
    const type = terrainTypeAt(this.seed, this.x, this.y)
    return type === 'ocean' || type === 'lake'
  }

  get outputRate(): number {
    return this.maxRate
  }

  onTick(ctx: TickContext): void {
    super.onTick(ctx)
    this.seed = ctx.host.terrainSeed
    const power = this.current * this.current * this.getResistance()
    this.budget = Math.min(this.maxRate * ctx.dt, this.budget + power * this.powerToFlow * ctx.dt)
    this.pushOutput(ctx)
  }

  private pushOutput(ctx: TickContext): void {
    if (this.budget <= 0) return
    const linkedNetworks = new Set<number>()
    const linkedComponents = new Set<BaseComponent>()
    const cx = (this.x + 0.5) * CELL_SIZE
    const cy = (this.y + 0.5) * CELL_SIZE
    for (const neighbor of ctx.host.fluidLinksOf(this)) {
      if (this.budget <= 0) break
      if (!modeAdmits(neighbor.partnerIface.mode, 'in')) continue
      if (neighbor.partner instanceof PipeComponent) {
        const networkId = ctx.host.pipeNetworkId(neighbor.partner)
        if (networkId === null || linkedNetworks.has(networkId)) continue
        const accepted = ctx.host.pushPipeFluid(neighbor.partner, 'water', this.budget)
        if (accepted > 0) {
          linkedNetworks.add(networkId)
          this.budget -= accepted
        }
      } else if (isFluidReceptor(neighbor.partner)) {
        if (linkedComponents.has(neighbor.partner)) continue
        const accepted = neighbor.partner.receiveFluid('water', this.budget, cx, cy)
        if (accepted > 0) {
          linkedComponents.add(neighbor.partner)
          this.budget -= accepted
        }
      }
    }
    if (this.budget > 0.001) {
      ctx.host.emitFluid(cx, cy, 'water', (Math.random() - 0.5) * 10, 15, this.budget)
      this.budget = 0
    }
  }

  provideFluid(max: number, filter?: (fluidId: string) => boolean): { fluidId: string; amount: number } | null {
    if (!this.onWater || this.budget <= 0) return null
    if (filter !== undefined && !filter('water')) return null
    const take = Math.min(max, this.budget)
    this.budget -= take
    return { fluidId: 'water', amount: take }
  }
}
