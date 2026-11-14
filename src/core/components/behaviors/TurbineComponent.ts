import type { ComponentDefinition } from '../ComponentDefinition'
import { paramNumber } from '../ComponentDefinition'
import { BaseComponent } from '../BaseComponent'
import type { MnaModel } from '../../circuit/MnaModel'
import type { TickContext } from '../../sim/TickContext'

export class TurbineComponent extends BaseComponent {
  private readonly emfMax: number
  private readonly poolBuffer: number

  constructor(def: ComponentDefinition) {
    super(def)
    this.emfMax = paramNumber(def, 'emfMax', 10)
    this.poolBuffer = paramNumber(def, 'poolBuffer', 50)
  }

  getResistance(): number {
    return this.def.resistance
  }

  buildCircuitModel(model: MnaModel): void {
    const pool = this.host?.kineticPool ?? 0
    const emf = this.emfMax * Math.min(1, pool / this.poolBuffer)
    model.addBranch(this.nodeOf(0), this.nodeOf(1), this.def.resistance, emf, this)
  }

  onTick(ctx: TickContext): void {
    if (this.current === 0 || this.host === null) return
    const pool = this.host.kineticPool
    const emfNow = this.emfMax * Math.min(1, pool / this.poolBuffer)
    const efficiency = Math.min(0.95, 0.85 + ctx.host.converterEfficiencyBoost)
    const drawn = (Math.abs(this.current) * Math.abs(emfNow) * ctx.dt) / efficiency
    this.host.kineticPool = Math.max(0, pool - drawn)
  }
}
