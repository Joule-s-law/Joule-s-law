import type { ComponentDefinition } from '../ComponentDefinition'
import { BaseComponent } from '../BaseComponent'
import type { MnaModel } from '../../circuit/MnaModel'
import { getWireMaterial, hasWireMaterial, DEFAULT_WIRE_MATERIAL_ID, wireMaterialColor } from '../registry/wireMaterials'
import type { TickContext } from '../../sim/TickContext'
import { CELL_SIZE } from '../../../shared/constants'

export interface WireAnchor {
  x: number
  y: number
}

const MIN_LENGTH_CELLS = 0.1

export class WireComponent extends BaseComponent {
  private materialId: string
  private anchorA: WireAnchor
  private anchorB: WireAnchor
  private controlOffsetA: WireAnchor
  private controlOffsetB: WireAnchor
  visualColor: string | null = null

  getVisualColor(): string {
    return this.visualColor ?? wireMaterialColor(this.materialId)
  }

  setVisualColor(color: string | null): void {
    this.visualColor = color
  }

  constructor(def: ComponentDefinition, options?: {
    materialId?: string
    length?: number
    anchorA?: WireAnchor
    anchorB?: WireAnchor
    controlPointA?: WireAnchor
    controlPointB?: WireAnchor
  }) {
    super(def)
    this.materialId = options?.materialId ?? DEFAULT_WIRE_MATERIAL_ID
    if (options?.anchorA !== undefined && options?.anchorB !== undefined) {
      this.anchorA = { ...options.anchorA }
      this.anchorB = { ...options.anchorB }
    } else {
      const length = options?.length ?? 1
      this.anchorA = { x: this.x * CELL_SIZE, y: this.y * CELL_SIZE + CELL_SIZE / 2 }
      this.anchorB = { x: this.anchorA.x + length * CELL_SIZE, y: this.anchorA.y }
    }
    this.controlOffsetA = options?.controlPointA !== undefined
      ? { x: options.controlPointA.x - this.anchorA.x, y: options.controlPointA.y - this.anchorA.y }
      : this.defaultControlOffsetA()
    this.controlOffsetB = options?.controlPointB !== undefined
      ? { x: options.controlPointB.x - this.anchorB.x, y: options.controlPointB.y - this.anchorB.y }
      : this.defaultControlOffsetB()
    this.syncCellPosition()
  }

  getMaterialId(): string {
    return this.materialId
  }

  setMaterialId(id: string): void {
    if (!hasWireMaterial(id)) throw new Error(`unknown wire material: ${id}`)
    this.materialId = id
  }

  getAnchors(): { a: WireAnchor; b: WireAnchor } {
    return { a: { ...this.anchorA }, b: { ...this.anchorB } }
  }

  setAnchors(a: WireAnchor, b: WireAnchor): void {
    this.anchorA = { ...a }
    this.anchorB = { ...b }
    this.syncCellPosition()
  }

  getControlPoints(): { a: WireAnchor; b: WireAnchor } {
    return {
      a: { x: this.anchorA.x + this.controlOffsetA.x, y: this.anchorA.y + this.controlOffsetA.y },
      b: { x: this.anchorB.x + this.controlOffsetB.x, y: this.anchorB.y + this.controlOffsetB.y },
    }
  }

  setControlPoints(a: WireAnchor, b: WireAnchor): void {
    this.controlOffsetA = { x: a.x - this.anchorA.x, y: a.y - this.anchorA.y }
    this.controlOffsetB = { x: b.x - this.anchorB.x, y: b.y - this.anchorB.y }
  }

  getLengthCells(): number {
    const dx = this.anchorB.x - this.anchorA.x
    const dy = this.anchorB.y - this.anchorA.y
    return Math.max(MIN_LENGTH_CELLS, Math.hypot(dx, dy) / CELL_SIZE)
  }

  getResistance(): number {
    return getWireMaterial(this.materialId).resistivity * this.getLengthCells()
  }

  buildCircuitModel(model: MnaModel): void {
    model.addBranch(this.nodeOf(0), this.nodeOf(1), this.getResistance(), 0, this)
  }

  onTick(_ctx: TickContext): void {}

  private defaultControlOffsetA(): WireAnchor {
    return { x: (this.anchorB.x - this.anchorA.x) * 0.45, y: 0 }
  }

  private defaultControlOffsetB(): WireAnchor {
    return { x: -(this.anchorB.x - this.anchorA.x) * 0.45, y: 0 }
  }

  private syncCellPosition(): void {
    this.x = Math.floor((this.anchorA.x + this.anchorB.x) / 2 / CELL_SIZE)
    this.y = Math.floor((this.anchorA.y + this.anchorB.y) / 2 / CELL_SIZE)
  }
}
