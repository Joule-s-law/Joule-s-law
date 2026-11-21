import type { ComponentDefinition } from '../ComponentDefinition'
import { paramNumber, paramTag } from '../ComponentDefinition'
import { BaseComponent } from '../BaseComponent'
import type { MnaModel } from '../../circuit/MnaModel'
import { EnergyType } from '../../energy/EnergyType'
import type { TickContext } from '../../sim/TickContext'
import type { FieldEmission, FieldType } from '../../fields/FieldGrid'

export type ConverterOutputMode = 'income' | 'none'

export class ConverterComponent extends BaseComponent {
  readonly efficiency: number
  readonly outputMode: ConverterOutputMode
  readonly outputForm: EnergyType
  private readonly emitField: FieldType | null
  private readonly emitStrength: number

  constructor(def: ComponentDefinition) {
    super(def)
    this.efficiency = paramNumber(def, 'efficiency', 0.8)
    this.outputMode = paramTag(def, 'outputMode', 'none') as ConverterOutputMode
    this.outputForm = paramTag(def, 'outputForm', 'heat') as EnergyType
    const tag = paramTag(def, 'emitField', '')
    this.emitField = tag === '' ? null : (tag as FieldType)
    this.emitStrength = paramNumber(def, 'emitStrength', 1)
  }

  getEffectiveEfficiency(boost: number): number {
    return Math.min(0.95, this.efficiency + boost)
  }

  getResistance(): number {
    return this.def.resistance
  }

  buildCircuitModel(model: MnaModel): void {
    model.addBranch(this.nodeOf(0), this.nodeOf(1), this.getResistance(), 0, this)
  }

  onTick(ctx: TickContext): void {
    const dissipated = this.current * this.current * this.getResistance() * ctx.dt
    if (dissipated <= 0) return
    if (this.outputMode === 'income') {
      const effective = dissipated * this.getEffectiveEfficiency(ctx.host.converterEfficiencyBoost)
      const cx = this.x + this.width / 2
      const cy = this.y + this.height / 2
      const income = effective * ctx.host.incomeFactorAt(cx, cy)
      ctx.ledger.add(this.outputForm, income)
      ctx.host.emitEnergy(this.outputForm, income * ctx.host.workFactorAt(cx, cy), cx, cy)
    }
  }

  getFieldEmission(_dt: number): FieldEmission | null {
    if (this.emitField === null || this.current === 0) return null
    const strength =
      this.emitField === 'magnetic'
        ? Math.abs(this.current) * this.emitStrength
        : this.current * this.current * this.getResistance() * this.emitStrength
    return { type: this.emitField, x: this.x, y: this.y, strength }
  }
}
