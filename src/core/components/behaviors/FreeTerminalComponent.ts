import type { ComponentDefinition } from '../ComponentDefinition'
import { BaseComponent } from '../BaseComponent'
import { CELL_SIZE } from '../../../shared/constants'
import type { MnaModel } from '../../circuit/MnaModel'
import type { TickContext } from '../../sim/TickContext'

export class FreeTerminalComponent extends BaseComponent {
  posX = 0
  posY = 0

  constructor(def: ComponentDefinition) {
    super(def)
  }

  setFreePosition(px: number, py: number): void {
    this.posX = px
    this.posY = py
    this.x = Math.floor(px / CELL_SIZE)
    this.y = Math.floor(py / CELL_SIZE)
  }

  occupies(): boolean {
    return false
  }

  getResistance(): number {
    return 0
  }

  getPortWorldPos(_index: number): { x: number; y: number } {
    return { x: this.posX, y: this.posY }
  }

  buildCircuitModel(_model: MnaModel): void {}

  onTick(_ctx: TickContext): void {}
}
