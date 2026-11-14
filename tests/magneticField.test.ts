import { describe, expect, it } from 'vitest'
import { createComponent } from '../src/core/components/registry/componentRegistry'
import { COIL, INDUCTION_COIL, RESISTOR } from '../src/core/components/registry/definitions'
import { FieldSensorComponent } from '../src/core/components/behaviors/FieldSensorComponent'
import type { BaseComponent } from '../src/core/components/BaseComponent'
import { FieldGrid } from '../src/core/fields/FieldGrid'
import { MnaModel } from '../src/core/circuit/MnaModel'
import {
  collectMagneticSources,
  traceMagneticFieldLines,
} from '../src/ui/board/magneticFieldLines'

function buildCoil(current: number, cellX = 12, cellY = 7): BaseComponent {
  const coil = createComponent(COIL)
  coil.x = cellX
  coil.y = cellY
  coil.current = current
  return coil
}

describe('collectMagneticSources', () => {
  it('ignores de-energized coil', () => {
    const sources = collectMagneticSources([buildCoil(0)])
    expect(sources.length).toBe(0)
  })

  it('maps current direction and strength to moment', () => {
    const positive = collectMagneticSources([buildCoil(2)])
    expect(positive.length).toBe(1)
    expect(positive[0]?.moment).toBe(10)
    const negative = collectMagneticSources([buildCoil(-1.5)])
    expect(negative[0]?.moment).toBeLessThan(0)
  })
})

describe('traceMagneticFieldLines', () => {
  const width = 24 * 48
  const height = 14 * 48

  it('returns no lines without sources', () => {
    expect(traceMagneticFieldLines([], width, height).length).toBe(0)
  })

  it('draws count lines scaling with current, all closed near the coil', () => {
    const coil = buildCoil(2, 12, 7)
    const lines = traceMagneticFieldLines([coil], width, height)
    expect(lines.length).toBeGreaterThanOrEqual(6)
    const cx = 12.5 * 48
    const cy = 7.5 * 48
    for (const line of lines) {
      const first = line.points[0]
      const last = line.points[line.points.length - 1]
      expect(first).toBeDefined()
      expect(last).toBeDefined()
      const startDist = Math.hypot((first?.x ?? 0) - cx, (first?.y ?? 0) - cy)
      const endDist = Math.hypot((last?.x ?? 0) - cx, (last?.y ?? 0) - cy)
      expect(startDist).toBeLessThan(20)
      expect(endDist).toBeLessThan(20)
    }
  })

  it('weak current yields fewer lines than strong current', () => {
    const weak = traceMagneticFieldLines([buildCoil(0.2, 12, 7)], width, height)
    const strong = traceMagneticFieldLines([buildCoil(3, 12, 7)], width, height)
    expect(strong.length).toBeGreaterThan(weak.length)
  })

  it('reversing current mirrors the loop across the coil', () => {
    const forward = traceMagneticFieldLines([buildCoil(2, 12, 7)], width, height)
    const reversed = traceMagneticFieldLines([buildCoil(-2, 12, 7)], width, height)
    expect(forward.length).toBe(reversed.length)
    const cy = 7.5 * 48
    const firstSeed = forward[0]?.points[Math.floor((forward[0]?.points.length ?? 1) / 2)]
    const secondSeed = reversed[0]?.points[Math.floor((reversed[0]?.points.length ?? 1) / 2)]
    expect(firstSeed).toBeDefined()
    expect(secondSeed).toBeDefined()
    const forwardSide = Math.sign((firstSeed?.y ?? 0) - cy)
    const reversedSide = Math.sign((secondSeed?.y ?? 0) - cy)
    expect(forwardSide).toBe(-reversedSide)
  })

  it('two coils bend each other field lines', () => {
    const coilA = buildCoil(2, 6, 7)
    const coilB = buildCoil(2, 17, 7)
    const lines = traceMagneticFieldLines([coilA, coilB], width, height)
    expect(lines.length).toBeGreaterThanOrEqual(6)
  })
})

describe('magnetic sensor reading', () => {
  it('reports flux density and flux from the field grid', () => {
    const coil = buildCoil(2, 5, 7)
    const grid = new FieldGrid(24, 14)
    grid.update([coil], 0.016)
    const sensor = createComponent(INDUCTION_COIL) as FieldSensorComponent
    sensor.x = 5
    sensor.y = 7
    sensor.bindFieldGrid(grid)
    expect(sensor.getSensedFluxDensity()).toBeCloseTo(10, 6)
    expect(sensor.getSensedFlux()).toBeCloseTo(0.1, 6)
  })

  it('non-sensor components sense nothing', () => {
    const plain = createComponent(RESISTOR)
    expect(plain.getSensedFluxDensity()).toBe(0)
    expect(plain.getSensedFlux()).toBe(0)
  })

  it('stores induced emf for the glow indicator', () => {
    const coil = buildCoil(2, 5, 7)
    const grid = new FieldGrid(24, 14)
    const sensor = createComponent(INDUCTION_COIL) as FieldSensorComponent
    sensor.x = 5
    sensor.y = 7
    sensor.bindFieldGrid(grid)
    sensor.getPort(0).nodeId = 0
    sensor.getPort(1).nodeId = 1
    const model = new MnaModel()
    model.reserveNodes(2)
    coil.current = 2
    grid.update([coil], 0.016)
    sensor.buildCircuitModel(model)
    expect(Math.abs(sensor.lastEmf)).toBeGreaterThan(0.001)
    grid.update([coil], 0.016)
    sensor.buildCircuitModel(model)
    expect(sensor.lastEmf).toBeCloseTo(0, 6)
  })
})
