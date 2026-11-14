import { describe, expect, it } from 'vitest'
import { createComponent } from '../src/core/components/registry/componentRegistry'
import { HAND_CRANK, RESISTOR, VOLTAGE_DOUBLER, VOLTAGE_HALVER } from '../src/core/components/registry/definitions'
import { ResistiveComponent } from '../src/core/components/behaviors/ResistiveComponent'
import { VoltageSourceComponent } from '../src/core/components/behaviors/VoltageSourceComponent'
import { VoltageTransformerComponent } from '../src/core/components/behaviors/VoltageTransformerComponent'
import { Simulation } from '../src/core/sim/Simulation'
import { portPosition } from '../src/ui/board/boardMath'
import { CELL_SIZE } from '../src/shared/constants'

const BIG_LOAD = 10000000

interface TransformerFixture {
  sim: Simulation
  transformer: VoltageTransformerComponent
  load: ResistiveComponent
}

function buildTransformerLoop(def: typeof VOLTAGE_DOUBLER, loadResistance: number): TransformerFixture {
  const sim = new Simulation()
  const source = createComponent(HAND_CRANK) as VoltageSourceComponent
  source.rotationSpeed = Math.PI * 2
  source.rotationDrive = 1
  source.x = 0
  source.y = 0
  const transformer = createComponent(def) as VoltageTransformerComponent
  transformer.x = 2
  transformer.y = 0
  sim.addComponent(source)
  sim.addComponent(transformer)
  sim.connect(source.getPort(1), transformer.getPort(0))
  sim.connect(source.getPort(0), transformer.getPort(1))
  const load = createComponent({ ...RESISTOR, id: 'test_load', resistance: loadResistance }) as ResistiveComponent
  load.x = 4
  load.y = 0
  sim.addComponent(load)
  sim.connect(transformer.getPort(2), load.getPort(0))
  sim.connect(load.getPort(1), transformer.getPort(3))
  return { sim, transformer, load }
}

function settle(fixture: TransformerFixture, ticks = 30): void {
  for (let i = 0; i < ticks; i++) {
    fixture.sim.tick()
  }
}

describe('voltage transformer', () => {
  it('doubles input voltage at no load', () => {
    const fixture = buildTransformerLoop(VOLTAGE_DOUBLER, BIG_LOAD)
    settle(fixture)
    expect(Number.isFinite(fixture.transformer.voltage)).toBe(true)
    expect(Math.abs(fixture.transformer.voltage)).toBeGreaterThan(19.5)
  })

  it('halves input voltage at no load', () => {
    const fixture = buildTransformerLoop(VOLTAGE_HALVER, BIG_LOAD)
    settle(fixture)
    expect(Math.abs(fixture.transformer.voltage)).toBeGreaterThan(4.5)
    expect(Math.abs(fixture.transformer.voltage)).toBeLessThan(5.5)
  })

  it('droops under load but still steps up, respecting energy conservation', () => {
    const fixture = buildTransformerLoop(VOLTAGE_DOUBLER, 100)
    settle(fixture)
    const outputPower = Math.abs(fixture.transformer.voltage) * fixture.transformer.current
    const inputPower = fixture.transformer.getInputVoltage() * fixture.transformer.getInputCurrent()
    expect(Math.abs(fixture.transformer.voltage)).toBeGreaterThan(fixture.transformer.getInputVoltage() * 1.5)
    expect(outputPower).toBeGreaterThan(0)
    expect(inputPower).toBeGreaterThanOrEqual(outputPower - 0.01)
  })

  it('places four ports at quarter heights of the left and right edges', () => {
    const transformer = createComponent(VOLTAGE_DOUBLER)
    transformer.x = 2
    transformer.y = 0
    const baseX = 2 * CELL_SIZE
    const p0 = portPosition(transformer, 0)
    const p1 = portPosition(transformer, 1)
    const p2 = portPosition(transformer, 2)
    const p3 = portPosition(transformer, 3)
    expect(p0.px).toBe(baseX)
    expect(p0.py).toBeCloseTo(CELL_SIZE * 0.5, 6)
    expect(p1.py).toBeCloseTo(CELL_SIZE * 1.5, 6)
    expect(p2.px).toBe(baseX + CELL_SIZE)
    expect(p2.py).toBeCloseTo(CELL_SIZE * 0.5, 6)
    expect(p3.py).toBeCloseTo(CELL_SIZE * 1.5, 6)
  })
})
