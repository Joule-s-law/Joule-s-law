export type FieldType = 'light' | 'sound' | 'magnetic'

export interface FieldEmission {
  type: FieldType
  x: number
  y: number
  strength: number
}

interface FieldSource {
  type: FieldType
  x: number
  y: number
  strength: number
}

const FALLOFF = 0.15
const MAGNETIC_DECAY = 0.6

export class FieldGrid {
  private readonly sources: FieldSource[] = []
  private readonly contributions = new Map<FieldType, Float64Array>()

  constructor(
    public readonly cols: number,
    public readonly rows: number,
  ) {
    for (const type of ['light', 'sound', 'magnetic'] as FieldType[]) {
      this.contributions.set(type, new Float64Array(cols * rows))
    }
  }

  update(components: FieldEmitter[], _dt: number): void {
    this.sources.length = 0
    for (const emitter of components) {
      const source = emitter.getFieldEmission(_dt)
      if (source !== null && source.strength > 0) {
        this.sources.push(source)
      }
    }
    for (const [, cells] of this.contributions) {
      cells.fill(0)
    }
    for (const source of this.sources) {
      const cells = this.contributions.get(source.type)
      if (cells === undefined) continue
      const radius = source.type === 'magnetic' ? 6 : 9
      for (let dy = -radius; dy <= radius; dy++) {
        const cy = source.y + dy
        if (cy < 0 || cy >= this.rows) continue
        for (let dx = -radius; dx <= radius; dx++) {
          const cx = source.x + dx
          if (cx < 0 || cx >= this.cols) continue
          const d2 = dx * dx + dy * dy
          const decay = source.type === 'magnetic' ? MAGNETIC_DECAY : FALLOFF
          const index = cy * this.cols + cx
          const previous = cells[index]
          cells[index] = (previous ?? 0) + (source.strength / (1 + d2 * decay))
        }
      }
    }
  }

  sample(type: FieldType, x: number, y: number): number {
    const cells = this.contributions.get(type)
    if (cells === undefined) return 0
    const index = y * this.cols + x
    return cells[index] ?? 0
  }
}

export interface FieldEmitter {
  x: number
  y: number
  getFieldEmission(dt: number): FieldEmission | null
}
