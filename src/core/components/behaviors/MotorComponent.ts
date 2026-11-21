import type { ComponentDefinition } from '../ComponentDefinition'
import { paramNumber } from '../ComponentDefinition'
import { ResistiveComponent } from './ResistiveComponent'
import type { TickContext } from '../../sim/TickContext'

const TWO_PI = Math.PI * 2
const RATED_ACCELERATION = Math.PI * 8

export class MotorComponent extends ResistiveComponent {
  private readonly maxOmega: number

  constructor(def: ComponentDefinition) {
    super(def)
    this.maxOmega = paramNumber(def, 'maxOmega', 2) * TWO_PI
  }

  getAngularAcceleration(): number {
    return this.rotationDrive * RATED_ACCELERATION
  }

  getMaxOmega(): number {
    return this.maxOmega
  }

  onTick(ctx: TickContext): void {
    super.onTick(ctx)
    const rated = Math.max(0.001, this.def.ratedCurrent)
    const drive = Math.min(1, Math.abs(this.current) / rated)
    this.rotationDrive = this.current >= 0 ? drive : -drive
  }
}
