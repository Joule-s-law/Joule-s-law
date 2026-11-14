import type { ComponentDefinition } from '../ComponentDefinition'
import { paramNumber, paramTag } from '../ComponentDefinition'
import { BaseComponent } from '../BaseComponent'
import type { MnaModel } from '../../circuit/MnaModel'
import type { TickContext } from '../../sim/TickContext'

const TWO_PI = Math.PI * 2

export class VoltageSourceComponent extends BaseComponent {
  private readonly emfMax: number
  private readonly internalResistance: number
  private readonly holdable: boolean

  constructor(def: ComponentDefinition) {
    super(def)
    this.emfMax = paramNumber(def, 'emf', 1)
    this.internalResistance = paramNumber(def, 'internalResistance', 1)
    this.holdable = paramTag(def, 'holdable', '') === '1'
  }

  getResistance(): number {
    return this.internalResistance
  }

  getAngularAcceleration(): number {
    if (this.rotationDrive === 0) return 0
    if (this.rotationDrive > 0 && this.rotationSpeed >= TWO_PI) return 0
    if (this.rotationDrive < 0 && this.rotationSpeed <= -TWO_PI) return 0
    return this.rotationDrive * TWO_PI
  }

  buildCircuitModel(model: MnaModel): void {
    const emf = this.holdable ? (this.emfMax * this.rotationSpeed) / TWO_PI : this.emfMax
    model.addBranch(this.nodeOf(0), this.nodeOf(1), this.internalResistance, emf, this)
  }

  onTick(_ctx: TickContext): void {}
}
