import type { ComponentDefinition } from '../ComponentDefinition'
import { BaseComponent } from '../BaseComponent'
import type { MnaModel } from '../../circuit/MnaModel'
import type { TickContext } from '../../sim/TickContext'

export class FourthGeneratorComponent extends BaseComponent {
  readonly uuid: string
  customName: string
  externalEmf = 0

  constructor(def: ComponentDefinition, options?: { uuid?: string; customName?: string }) {
    super(def)
    this.uuid = options?.uuid ?? crypto.randomUUID()
    this.customName = options?.customName ?? def.displayName
  }

  getResistance(): number {
    return this.def.resistance
  }

  buildCircuitModel(model: MnaModel): void {
    model.addBranch(this.nodeOf(0), this.nodeOf(1), this.getResistance(), this.externalEmf, this)
  }

  onTick(_ctx: TickContext): void {}
}
