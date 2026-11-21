import type { ComponentDefinition } from '../ComponentDefinition'
import { paramNumber } from '../ComponentDefinition'
import { ResistiveComponent } from './ResistiveComponent'
import type { TickContext } from '../../sim/TickContext'

export class ClutchComponent extends ResistiveComponent {
  readonly engageCurrent: number
  engaged = false

  constructor(def: ComponentDefinition) {
    super(def)
    this.engageCurrent = paramNumber(def, 'engageCurrent', 0.01)
    this.rotationZ = 1
  }

  onTick(_ctx: TickContext): void {
    const shouldEngage = Math.abs(this.current) >= this.engageCurrent
    if (shouldEngage === this.engaged) return
    this.engaged = shouldEngage
    this.rotationZ = shouldEngage ? 0 : 1
  }
}
