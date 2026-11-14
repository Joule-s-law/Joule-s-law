import type { ComponentDefinition } from '../ComponentDefinition'
import { paramNumber } from '../ComponentDefinition'
import { ResistiveComponent } from './ResistiveComponent'

export class RheostatComponent extends ResistiveComponent {
  sliderPosition = 1
  private readonly minResistance: number
  private readonly maxResistance: number

  constructor(def: ComponentDefinition) {
    super(def)
    this.minResistance = paramNumber(def, 'minResistance', 0.5)
    this.maxResistance = paramNumber(def, 'maxResistance', 50)
  }

  getResistance(): number {
    return this.minResistance + (this.maxResistance - this.minResistance) * this.sliderPosition
  }

  setSliderPosition(value: number): void {
    this.sliderPosition = Math.min(1, Math.max(0, value))
  }
}
