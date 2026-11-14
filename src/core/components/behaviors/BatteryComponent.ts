import type { ComponentDefinition } from '../ComponentDefinition'
import { paramNumber } from '../ComponentDefinition'
import { BaseComponent } from '../BaseComponent'
import type { MnaModel } from '../../circuit/MnaModel'
import type { TickContext } from '../../sim/TickContext'

export class BatteryComponent extends BaseComponent {
  private readonly emfFull: number
  private readonly capacityJ: number
  private readonly chargeEfficiency: number
  stateOfCharge: number

  constructor(def: ComponentDefinition, stateOfCharge?: number) {
    super(def)
    this.emfFull = paramNumber(def, 'emfFull', 6)
    this.capacityJ = paramNumber(def, 'capacityJ', 5000)
    this.chargeEfficiency = paramNumber(def, 'chargeEfficiency', 0.8)
    this.stateOfCharge = stateOfCharge ?? 1
  }

  getEmf(): number {
    return this.emfFull * this.stateOfCharge
  }

  getResistance(): number {
    return this.def.resistance
  }

  buildCircuitModel(model: MnaModel): void {
    model.addBranch(this.nodeOf(0), this.nodeOf(1), this.def.resistance, this.getEmf(), this)
  }

  onTick(ctx: TickContext): void {
    const energy = this.current * this.getEmf() * ctx.dt
    if (energy > 0) {
      this.stateOfCharge = Math.max(0, this.stateOfCharge - energy / this.capacityJ)
    } else {
      this.stateOfCharge = Math.min(1, this.stateOfCharge + (-energy * this.chargeEfficiency) / this.capacityJ)
    }
  }
}
