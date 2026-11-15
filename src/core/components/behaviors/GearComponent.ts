import type { ComponentDefinition } from '../ComponentDefinition'
import { paramNumber } from '../ComponentDefinition'
import { BaseComponent } from '../BaseComponent'
import type { MnaModel } from '../../circuit/MnaModel'
import type { TickContext } from '../../sim/TickContext'

const TWO_PI = Math.PI * 2

export class GearComponent extends BaseComponent {
  readonly gearRatio: number
  private readonly maxOmega: number
  overSpeed = false

  constructor(def: ComponentDefinition) {
    super(def)
    this.gearRatio = paramNumber(def, 'gearRatio', 1)
    this.maxOmega = paramNumber(def, 'maxOmega', Math.PI * 12)
  }

  getResistance(): number {
    return 0
  }

  buildCircuitModel(_model: MnaModel): void {}

  onTick(ctx: TickContext): void {
    const maxOmega = this.maxOmega + ctx.host.gearMaxOmegaBonus
    this.overSpeed = Math.abs(this.rotationSpeed) > maxOmega
    if (!this.overSpeed) return
    const chance = ctx.host.gearBreakdownChance * ctx.dt
    if (chance > 0 && Math.random() < chance) {
      ctx.host.requestDestroy(this)
    }
  }
}

export { TWO_PI }
