import type { ComponentDefinition } from '../ComponentDefinition'
import { paramNumber, paramTag } from '../ComponentDefinition'
import { BaseComponent } from '../BaseComponent'
import type { MnaModel } from '../../circuit/MnaModel'
import { EnergyType } from '../../energy/EnergyType'
import type { TickContext } from '../../sim/TickContext'
import type { FieldEmission, FieldType } from '../../fields/FieldGrid'

export class ResistiveComponent extends BaseComponent {
  private readonly emitField: FieldType | null
  private readonly emitStrength: number

  constructor(def: ComponentDefinition) {
    super(def)
    const tag = paramTag(def, 'emitField', '')
    this.emitField = tag === '' ? null : (tag as FieldType)
    this.emitStrength = paramNumber(def, 'emitStrength', 1)
  }

  getResistance(): number {
    return this.def.resistance
  }

  buildCircuitModel(model: MnaModel): void {
    model.addBranch(this.nodeOf(0), this.nodeOf(1), this.getResistance(), 0, this)
  }

  onTick(ctx: TickContext): void {
    const heat = this.current * this.current * this.getResistance() * ctx.dt
    ctx.ledger.add(EnergyType.HEAT, heat)
    if (heat > 0.001 && ctx.host !== null) {
      ctx.host.emitEnergy(EnergyType.HEAT, heat, this.x + 0.5, this.y + 0.5)
    }
  }

  getFieldEmission(_dt: number): FieldEmission | null {
    if (this.emitField === null || this.current === 0) return null
    const power = this.current * this.current * this.getResistance()
    const boost = 1 + (this.host?.lightEmissionBoost ?? 0)
    return { type: this.emitField, x: this.x, y: this.y, strength: power * this.emitStrength * boost }
  }
}
