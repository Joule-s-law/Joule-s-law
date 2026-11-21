import type { BaseComponent } from '../../core/components/BaseComponent'
import { CELL_SIZE } from '../../shared/constants'

export interface Point {
  x: number
  y: number
}

export interface ChargeSource {
  x: number
  y: number
  charge: number
}

export type ChargeContributor = ChargeSource

export interface FieldLine {
  points: Point[]
  alpha: number
}

export interface Isoline {
  segments: Point[]
  positive: boolean
}

export interface FieldVector {
  ex: number
  ey: number
}

export interface FieldBounds {
  x0: number
  y0: number
  x1: number
  y1: number
}

const FIELD_K = 2400
const CHARGE_PER_VOLT = 1.5
const SOFTEN_DIST = 26
const NEAR_SOURCE_DIST = 22
const LINE_SEED_DIST = 30
const LINE_STEP = 6
const LINE_MAX_STEPS = 260
const SAMPLE_STEP = 24
const POTENTIAL_LEVELS = [40, 90, 160, 260, 400, 600, 900, 1300]

export function collectChargeSources(components: BaseComponent[], contributors: ChargeContributor[]): ChargeSource[] {
  const sources: ChargeSource[] = []
  for (const component of components) {
    if (Math.abs(component.voltage) < 0.0005) continue
    sources.push({
      x: (component.x + component.width / 2) * CELL_SIZE,
      y: (component.y + component.height / 2) * CELL_SIZE,
      charge: component.voltage * CHARGE_PER_VOLT,
    })
  }
  for (const contributor of contributors) {
    if (Math.abs(contributor.charge) < 0.05) continue
    sources.push(contributor)
  }
  return sources
}

export function electricFieldAt(
  sources: ChargeSource[],
  px: number,
  py: number,
  exclude?: ChargeContributor,
  nearStop = 0,
): FieldVector | null {
  let ex = 0
  let ey = 0
  const softenSq = SOFTEN_DIST * SOFTEN_DIST
  const nearSq = nearStop * nearStop
  for (const source of sources) {
    if (source === exclude) continue
    const dx = px - source.x
    const dy = py - source.y
    const r2 = dx * dx + dy * dy
    if (nearSq > 0 && r2 < nearSq) return null
    const r = Math.sqrt(Math.max(r2, softenSq))
    const magnitude = (FIELD_K * source.charge) / (r * r)
    ex += (magnitude * dx) / r
    ey += (magnitude * dy) / r
  }
  return { ex, ey }
}

export function electricPotentialAt(sources: ChargeSource[], px: number, py: number): number {
  let potential = 0
  for (const source of sources) {
    const dx = px - source.x
    const dy = py - source.y
    const r = Math.max(Math.hypot(dx, dy), 20)
    potential += (FIELD_K * source.charge) / r
  }
  return potential
}

function fieldDirection(sources: ChargeSource[], px: number, py: number): Point | null {
  const field = electricFieldAt(sources, px, py, undefined, NEAR_SOURCE_DIST)
  if (field === null) return null
  const magnitude = Math.hypot(field.ex, field.ey)
  if (magnitude < 1e-9) return null
  return { x: field.ex / magnitude, y: field.ey / magnitude }
}

function marchFieldLine(seed: Point, direction: number, sources: ChargeSource[], bounds: FieldBounds): Point[] {
  const points: Point[] = []
  let px = seed.x
  let py = seed.y
  for (let step = 0; step < LINE_MAX_STEPS; step++) {
    const field = fieldDirection(sources, px, py)
    if (field === null) break
    const midX = px + (direction * LINE_STEP * field.x) / 2
    const midY = py + (direction * LINE_STEP * field.y) / 2
    const midField = fieldDirection(sources, midX, midY)
    if (midField === null) break
    px += direction * LINE_STEP * midField.x
    py += direction * LINE_STEP * midField.y
    points.push({ x: px, y: py })
    if (px < bounds.x0 - 60 || py < bounds.y0 - 60 || px > bounds.x1 + 60 || py > bounds.y1 + 60) break
  }
  return points
}

export function traceElectricFieldLines(sources: ChargeSource[], bounds: FieldBounds): FieldLine[] {
  const lines: FieldLine[] = []
  for (const source of sources) {
    if (Math.abs(source.charge) < 0.5) continue
    const direction = source.charge > 0 ? 1 : -1
    const count = Math.min(12, Math.max(4, Math.round(Math.abs(source.charge) * 0.5) + 3))
    const alpha = Math.min(0.55, 0.24 + Math.abs(source.charge) * 0.012)
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const seed = { x: source.x + Math.cos(angle) * LINE_SEED_DIST, y: source.y + Math.sin(angle) * LINE_SEED_DIST }
      const marched = marchFieldLine(seed, direction, sources, bounds)
      const points = direction > 0 ? [seed, ...marched] : [...marched.slice().reverse(), seed]
      if (points.length >= 6) lines.push({ points, alpha })
    }
  }
  return lines
}

function appendEdgeCrossing(out: Point[], target: number, ax: number, ay: number, av: number, bx: number, by: number, bv: number): void {
  const da = av - target
  const db = bv - target
  if ((da > 0 && db > 0) || (da < 0 && db < 0) || (da === 0 && db === 0)) return
  const t = da / (da - db)
  out.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t })
}

function appendCellSegments(out: Point[], target: number, x0: number, y0: number, v0: number, v1: number, v2: number, v3: number): void {
  const x1 = x0 + SAMPLE_STEP
  const y1 = y0 + SAMPLE_STEP
  const crossings: Point[] = []
  appendEdgeCrossing(crossings, target, x0, y0, v0, x1, y0, v1)
  appendEdgeCrossing(crossings, target, x1, y0, v1, x1, y1, v2)
  appendEdgeCrossing(crossings, target, x0, y1, v3, x1, y1, v2)
  appendEdgeCrossing(crossings, target, x0, y0, v0, x0, y1, v3)
  for (let i = 0; i + 1 < crossings.length; i += 2) {
    const first = crossings[i]
    const second = crossings[i + 1]
    if (first === undefined || second === undefined) break
    out.push(first, second)
  }
}

export function computeIsolines(sources: ChargeSource[], bounds: FieldBounds): Isoline[] {
  const cols = Math.floor((bounds.x1 - bounds.x0) / SAMPLE_STEP) + 1
  const rows = Math.floor((bounds.y1 - bounds.y0) / SAMPLE_STEP) + 1
  const values = new Float64Array(cols * rows)
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      values[row * cols + col] = electricPotentialAt(sources, bounds.x0 + col * SAMPLE_STEP, bounds.y0 + row * SAMPLE_STEP)
    }
  }
  const isolines: Isoline[] = []
  for (const level of POTENTIAL_LEVELS) {
    for (const sign of [1, -1]) {
      const segments: Point[] = []
      const target = sign * level
      for (let row = 0; row < rows - 1; row++) {
        for (let col = 0; col < cols - 1; col++) {
          const x0 = bounds.x0 + col * SAMPLE_STEP
          const y0 = bounds.y0 + row * SAMPLE_STEP
          const v0 = values[row * cols + col] ?? 0
          const v1 = values[row * cols + col + 1] ?? 0
          const v2 = values[(row + 1) * cols + col + 1] ?? 0
          const v3 = values[(row + 1) * cols + col] ?? 0
          appendCellSegments(segments, target, x0, y0, v0, v1, v2, v3)
        }
      }
      if (segments.length > 0) isolines.push({ segments, positive: sign > 0 })
    }
  }
  return isolines
}
