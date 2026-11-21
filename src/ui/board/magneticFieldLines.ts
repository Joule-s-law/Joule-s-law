import type { BaseComponent } from '../../core/components/BaseComponent'
import { CELL_SIZE } from '../../shared/constants'
import type { FieldBounds } from './electricFieldView'

export interface Point {
  x: number
  y: number
}

export interface MagneticSource {
  x: number
  y: number
  moment: number
  current: number
}

export interface FieldLine {
  points: Point[]
  alpha: number
}

const MIN_SOURCE_DIST = 9
const STEP = 4
const MAX_STEPS = 500
const BASE_ALPHA = 0.28
const MAX_LINES = 14
const MIN_LOOP = 30
const MAX_LOOP = 150

export function collectMagneticSources(components: BaseComponent[]): MagneticSource[] {
  const sources: MagneticSource[] = []
  for (const component of components) {
    if (component.def.behaviorTags['emitField'] !== 'magnetic') continue
    if (Math.abs(component.current) < 0.0005) continue
    const emitStrength = component.def.behaviorParams['emitStrength'] ?? 1
    sources.push({
      x: (component.x + component.width / 2) * CELL_SIZE,
      y: (component.y + component.height / 2) * CELL_SIZE,
      moment: Math.sign(component.current) * Math.abs(component.current) * emitStrength,
      current: component.current,
    })
  }
  return sources
}

function totalFieldDirection(sources: MagneticSource[], px: number, py: number): Point | null {
  let bx = 0
  let by = 0
  for (const source of sources) {
    const dx = px - source.x
    const dy = py - source.y
    const r2 = dx * dx + dy * dy
    if (r2 < MIN_SOURCE_DIST * MIN_SOURCE_DIST) return null
    const r5 = r2 * r2 * Math.sqrt(r2)
    bx += (source.moment * (2 * dx * dx - dy * dy)) / r5
    by += (source.moment * 3 * dx * dy) / r5
  }
  const magnitude = Math.hypot(bx, by)
  if (magnitude < 1e-10) return null
  return { x: bx / magnitude, y: by / magnitude }
}

export function magneticFieldVector(sources: MagneticSource[], px: number, py: number): { bx: number; by: number } {
  let bx = 0
  let by = 0
  for (const source of sources) {
    const dx = px - source.x
    const dy = py - source.y
    const r2 = dx * dx + dy * dy
    if (r2 < MIN_SOURCE_DIST * MIN_SOURCE_DIST) continue
    const r5 = r2 * r2 * Math.sqrt(r2)
    bx += (source.moment * (2 * dx * dx - dy * dy)) / r5
    by += (source.moment * 3 * dx * dy) / r5
  }
  return { bx, by }
}

function march(
  seed: Point,
  direction: number,
  sources: MagneticSource[],
  bounds: FieldBounds,
): Point[] {
  const points: Point[] = []
  let px = seed.x
  let py = seed.y
  for (let step = 0; step < MAX_STEPS; step++) {
    const field = totalFieldDirection(sources, px, py)
    if (field === null) break
    const midX = px + (direction * STEP * field.x) / 2
    const midY = py + (direction * STEP * field.y) / 2
    const midField = totalFieldDirection(sources, midX, midY)
    if (midField === null) break
    px += direction * STEP * midField.x
    py += direction * STEP * midField.y
    points.push({ x: px, y: py })
    if (px < bounds.x0 - 60 || py < bounds.y0 - 60 || px > bounds.x1 + 60 || py > bounds.y1 + 60) break
  }
  return points
}

function clampLineCount(current: number): number {
  return Math.min(MAX_LINES, Math.max(3, Math.round(Math.abs(current) * 4) + 2))
}

export function traceMagneticFieldLines(
  components: BaseComponent[],
  bounds: FieldBounds,
): FieldLine[] {
  const sources = collectMagneticSources(components)
  const lines: FieldLine[] = []
  for (const source of sources) {
    const axisSign = Math.sign(source.moment)
    if (axisSign === 0) continue
    const count = clampLineCount(source.current)
    const alpha = Math.min(0.6, BASE_ALPHA + 0.1 * Math.abs(source.current))
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? 1 : -1
      const distance = MIN_LOOP + ((i + 0.5) * (MAX_LOOP - MIN_LOOP)) / count
      const seed = { x: source.x, y: source.y + side * distance * axisSign }
      const forward = march(seed, 1, sources, bounds)
      const backward = march(seed, -1, sources, bounds)
      backward.reverse()
      const points = [...backward, seed, ...forward]
      if (points.length >= 6) lines.push({ points, alpha })
    }
  }
  return lines
}
