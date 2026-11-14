import type { ComponentDefinition } from '../ComponentDefinition'
import { paramNumber, paramTag } from '../ComponentDefinition'
import { BaseComponent } from '../BaseComponent'
import type { MnaModel } from '../../circuit/MnaModel'
import type { FieldGrid } from '../../fields/FieldGrid'
import type { TickContext } from '../../sim/TickContext'

export class FieldSensorComponent extends BaseComponent {
  readonly sensorField: 'light' | 'sound' | 'magnetic'
  readonly emfPerUnit: number
  readonly emfMax: number
  readonly fluxDerivative: boolean
  lastEmf = 0
  private previousFlux = 0

  constructor(def: ComponentDefinition) {
    super(def)
    this.sensorField = paramTag(def, 'sensorField', 'light') as 'light' | 'sound' | 'magnetic'
    this.emfPerUnit = paramNumber(def, 'emfPerUnit', 0.5)
    this.emfMax = paramNumber(def, 'emfMax', 8)
    this.fluxDerivative = paramNumber(def, 'fluxDerivative', 0) > 0
  }

  getResistance(): number {
    return this.def.resistance
  }

  bindFieldGrid(grid: FieldGrid): void {
    this.grid = grid
  }

  getSensedFluxDensity(): number {
    return this.sampleField()
  }

  private grid: FieldGrid | null = null

  private sampleField(): number {
    if (this.grid === null) return 0
    return this.grid.sample(this.sensorField, this.x, this.y)
  }

  buildCircuitModel(model: MnaModel): void {
    const value = this.sampleField()
    const boost = 1 + (this.host?.sensorEfficiencyBoost ?? 0)
    let emf = 0
    if (this.fluxDerivative) {
      emf = Math.max(-this.emfMax, Math.min(this.emfMax, -this.emfPerUnit * boost * (value - this.previousFlux)))
      this.previousFlux = value
    } else {
      emf = Math.min(this.emfMax, this.emfPerUnit * boost * value)
    }
    this.lastEmf = emf
    model.addBranch(this.nodeOf(0), this.nodeOf(1), this.def.resistance, emf, this)
  }

  onTick(_ctx: TickContext): void {}
}
