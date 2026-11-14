import type { ComponentDefinition } from '../ComponentDefinition'
import { BaseComponent } from '../BaseComponent'
import type { MnaModel } from '../../circuit/MnaModel'
import type { TickContext } from '../../sim/TickContext'
import { CELL_SIZE } from '../../../shared/constants'

export class ChainDriveComponent extends BaseComponent {
  gearA: BaseComponent
  gearB: BaseComponent

  constructor(def: ComponentDefinition, gearA: BaseComponent, gearB: BaseComponent) {
    super(def)
    this.gearA = gearA
    this.gearB = gearB
    this.x = gearA.x
    this.y = gearA.y
  }

  getResistance(): number {
    return Number.POSITIVE_INFINITY
  }

  buildCircuitModel(_model: MnaModel): void {}

  onTick(_ctx: TickContext): void {}

  occupies(_cellX: number, _cellY: number): boolean {
    return false
  }

  getEndpointA(): { x: number; y: number } {
    return gearCenter(this.gearA)
  }

  getEndpointB(): { x: number; y: number } {
    return gearCenter(this.gearB)
  }

  connectsGear(gear: BaseComponent): boolean {
    return this.gearA === gear || this.gearB === gear
  }
}

export function gearCenter(gear: BaseComponent): { x: number; y: number } {
  return {
    x: (gear.x + gear.width / 2) * CELL_SIZE,
    y: (gear.y + gear.height / 2) * CELL_SIZE,
  }
}
