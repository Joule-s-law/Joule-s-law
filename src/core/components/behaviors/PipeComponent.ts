import type { ComponentDefinition } from '../ComponentDefinition'
import { BaseComponent } from '../BaseComponent'
import type { MnaModel } from '../../circuit/MnaModel'
import type { TickContext } from '../../sim/TickContext'
import { allEdgeInterfaces, type FluidInterface } from '../../fluids/fluidInterface'

export class PipeComponent extends BaseComponent {
  constructor(def: ComponentDefinition) {
    super(def)
  }

  getResistance(): number {
    return this.def.resistance
  }

  buildCircuitModel(_model: MnaModel): void {}

  onTick(_ctx: TickContext): void {}

  getFluidInterfaces(): FluidInterface[] {
    return allEdgeInterfaces('both')
  }
}
