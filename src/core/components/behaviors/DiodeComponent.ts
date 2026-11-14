import type { ComponentDefinition } from '../ComponentDefinition'
import { paramNumber } from '../ComponentDefinition'
import { BaseComponent } from '../BaseComponent'
import type { MnaModel } from '../../circuit/MnaModel'
import type { TickContext } from '../../sim/TickContext'

export class DiodeComponent extends BaseComponent {
  private readonly forwardResistance: number
  private readonly blockingResistance: number
  conducting = false

  constructor(def: ComponentDefinition) {
    super(def)
    this.forwardResistance = paramNumber(def, 'forwardResistance', 0.5)
    this.blockingResistance = paramNumber(def, 'blockingResistance', 1e9)
  }

  getResistance(): number {
    return this.conducting ? this.forwardResistance : Number.POSITIVE_INFINITY
  }

  buildCircuitModel(model: MnaModel): void {
    const resistance = this.conducting ? this.forwardResistance : this.blockingResistance
    model.addBranch(this.nodeOf(0), this.nodeOf(1), resistance, 0, this)
  }

  updateConduction(): boolean {
    const desired = this.conducting ? this.current >= 0 : this.voltage > 0
    if (desired === this.conducting) return false
    this.conducting = desired
    return true
  }

  onTick(_ctx: TickContext): void {}
}
