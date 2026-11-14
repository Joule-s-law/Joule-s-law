import type { ComponentDefinition } from '../ComponentDefinition'
import { paramNumber } from '../ComponentDefinition'
import { BaseComponent } from '../BaseComponent'
import type { MnaModel } from '../../circuit/MnaModel'
import type { TickContext } from '../../sim/TickContext'

export class SwitchComponent extends BaseComponent {
  closed: boolean
  private readonly contactResistance: number

  constructor(def: ComponentDefinition, closed?: boolean) {
    super(def)
    this.closed = closed ?? true
    this.contactResistance = paramNumber(def, 'contactResistance', 0.01)
  }

  getResistance(): number {
    return this.closed ? this.contactResistance : Number.POSITIVE_INFINITY
  }

  buildCircuitModel(model: MnaModel): void {
    if (!this.closed) return
    model.addBranch(this.nodeOf(0), this.nodeOf(1), this.contactResistance, 0, this)
  }

  onTick(_ctx: TickContext): void {}
}
