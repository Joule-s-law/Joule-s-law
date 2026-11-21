import type { ComponentDefinition } from '../ComponentDefinition'
import { paramNumber } from '../ComponentDefinition'
import { BaseComponent } from '../BaseComponent'
import { PipeComponent } from './PipeComponent'
import { isFluidSupplier, modeAdmits, type FluidInterface } from '../../fluids/fluidInterface'
import type { MnaModel } from '../../circuit/MnaModel'
import type { TickContext } from '../../sim/TickContext'

export class TurbineRotorComponent extends BaseComponent {
  readonly intakeMax: number
  readonly emfPerFlow: number
  readonly internalResistance: number
  flowRate = 0
  spinAngle = 0
  spinAngleAt = 0

  constructor(def: ComponentDefinition) {
    super(def)
    this.intakeMax = paramNumber(def, 'intakeMax', 1000)
    this.emfPerFlow = paramNumber(def, 'emfPerFlow', 2)
    this.internalResistance = paramNumber(def, 'internalResistance', 1)
  }

  getResistance(): number {
    return this.internalResistance
  }

  buildCircuitModel(model: MnaModel): void {
    const emf = this.flowRate * this.emfPerFlow
    model.addBranch(this.nodeOf(0), this.nodeOf(1), this.internalResistance, emf, this)
  }

  getFluidInterfaces(): FluidInterface[] {
    const list: FluidInterface[] = []
    for (let cellX = 0; cellX < this.width; cellX++) {
      list.push({ cellX, cellY: 0, edge: 'top', mode: 'in' })
      list.push({ cellX, cellY: this.height - 1, edge: 'bottom', mode: 'in' })
    }
    for (let cellY = 1; cellY < this.height - 1; cellY++) {
      list.push({ cellX: 0, cellY, edge: 'left', mode: 'in' })
      list.push({ cellX: this.width - 1, cellY, edge: 'right', mode: 'in' })
    }
    return list
  }

  get emf(): number {
    return this.flowRate * this.emfPerFlow
  }

  onTick(ctx: TickContext): void {
    const host = ctx.host
    const want = this.intakeMax * ctx.dt
    let pulled = 0
    for (const neighbor of host.fluidLinksOf(this)) {
      if (!modeAdmits(neighbor.partnerIface.mode, 'out')) continue
      if (neighbor.partner instanceof PipeComponent) {
        const draw = host.pullPipeFluid(neighbor.partner, want - pulled, (id) => id === 'steam')
        if (draw !== null) pulled += draw.amount
      } else if (isFluidSupplier(neighbor.partner)) {
        const draw = neighbor.partner.provideFluid(want - pulled, (id) => id === 'steam')
        if (draw !== null) pulled += draw.amount
      }
    }
    const instant = pulled / ctx.dt
    this.flowRate += (instant - this.flowRate) * Math.min(1, ctx.dt * 3)
    this.spinAngle += this.flowRate * Math.PI * 2 * ctx.dt
    this.spinAngleAt = performance.now()
  }
}
