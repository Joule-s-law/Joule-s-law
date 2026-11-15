import { describe, expect, it } from 'vitest'
import { buildParallel, buildSeriesLoop, buildSimpleLoop } from './helpers'
import { Simulation } from '../src/core/sim/Simulation'
import { AMMETER, VOLTMETER, HAND_CRANK, RESISTOR } from '../src/core/components/registry/definitions'
import { createComponent } from '../src/core/components/registry/componentRegistry'
import { ResistiveComponent } from '../src/core/components/behaviors/ResistiveComponent'
import { VoltageSourceComponent } from '../src/core/components/behaviors/VoltageSourceComponent'

describe('meters', () => {
  it('ammeter in series reads loop current with negligible voltage drop', () => {
    const sim = new Simulation()
    const source = createComponent(HAND_CRANK) as VoltageSourceComponent
    const meter = createComponent(AMMETER) as ResistiveComponent
    const load = createComponent(RESISTOR) as ResistiveComponent
    source.rotationSpeed = Math.PI * 2
    source.rotationDrive = 1
    source.x = 0
    source.y = 0
    meter.x = 2
    meter.y = 0
    load.x = 4
    load.y = 0
    sim.addComponent(source)
    sim.addComponent(meter)
    sim.addComponent(load)
    sim.connect(source.getPort(0), meter.getPort(1))
    sim.connect(meter.getPort(0), load.getPort(1))
    sim.connect(source.getPort(1), load.getPort(0))
    sim.tick()
    const expected = 10 / (3 + 0.05 + 10)
    expect(meter.current).toBeCloseTo(expected, 6)
    expect(load.current).toBeCloseTo(expected, 6)
  })

  it('voltmeter in parallel barely draws current and reads the terminal voltage', () => {
    const sim = new Simulation()
    const source = createComponent(HAND_CRANK) as VoltageSourceComponent
    const load = createComponent(RESISTOR) as ResistiveComponent
    const vmeter = createComponent(VOLTMETER) as ResistiveComponent
    source.rotationSpeed = Math.PI * 2
    source.rotationDrive = 1
    source.x = 0
    source.y = 0
    load.x = 2
    load.y = 0
    vmeter.x = 2
    vmeter.y = 2
    sim.addComponent(source)
    sim.addComponent(load)
    sim.addComponent(vmeter)
    sim.connect(source.getPort(0), load.getPort(1))
    sim.connect(source.getPort(1), load.getPort(0))
    sim.connect(source.getPort(0), vmeter.getPort(1))
    sim.connect(source.getPort(1), vmeter.getPort(0))
    sim.tick()
    expect(Math.abs(vmeter.current)).toBeLessThan(0.0001)
    expect(vmeter.voltage).toBeCloseTo(load.voltage, 6)
  })
})

describe('MNASolver', () => {
  it('solves single loop current: I = emf / (ri + R)', () => {
    const { sim, source, load } = buildSimpleLoop()
    sim.tick()
    const expected = 10 / 13
    expect(source.current).toBeCloseTo(expected, 6)
    expect(load.current).toBeCloseTo(expected, 6)
  })

  it('hand crank ramps voltage when held and decays when released', () => {
    const { sim, source } = buildSimpleLoop()
    source.rotationSpeed = 0
    source.rotationDrive = 1
    for (let i = 0; i < 20; i++) {
      sim.tick()
    }
    expect(source.rotationSpeed).toBeCloseTo(Math.PI * 2, 6)
    source.rotationDrive = 0
    for (let i = 0; i < 20; i++) {
      sim.tick()
    }
    expect(source.rotationSpeed).toBeCloseTo(0, 6)
  })

  it('copper wire adds negligible series resistance', () => {
    const { sim, load } = buildSeriesLoop('copper')
    sim.tick()
    const expected = 10 / (13 + 1.68e-8)
    expect(load.current).toBeCloseTo(expected, 9)
  })

  it('superconductor wire merges nodes and carries no loss', () => {
    const { sim, load, wire } = buildSeriesLoop('superconductor')
    sim.tick()
    expect(load.current).toBeCloseTo(10 / 13, 9)
    expect(wire.getResistance()).toBe(0)
    expect(wire.current).toBe(0)
  })

  it('adjacent components with coincident ports conduct without a wire', () => {
    const { sim, source, load } = buildSimpleLoop()
    sim.disconnect(source.getPort(0), load.getPort(1))
    sim.disconnect(source.getPort(1), load.getPort(0))
    load.x = 1
    load.y = 0
    sim.resyncAdjacencyFor(load)
    sim.connect(source.getPort(0), load.getPort(1))
    sim.tick()
    expect(load.current).toBeCloseTo(10 / 13, 6)
    load.x = 5
    load.y = 5
    sim.resyncAdjacencyFor(load)
    sim.tick()
    expect(load.current).toBeCloseTo(0, 8)
  })

  it('splits current between parallel loads', () => {
    const { sim, loadA, loadB } = buildParallel()
    sim.tick()
    const expected = 10 / 16
    expect(loadA.current).toBeCloseTo(expected, 6)
    expect(loadB.current).toBeCloseTo(expected, 6)
  })

  it('handles open-circuit component without singular matrix', () => {
    const { sim, load, source } = buildSimpleLoop()
    sim.disconnect(load.getPort(1), source.getPort(0))
    expect(() => sim.tick()).not.toThrow()
    expect(load.current).toBeCloseTo(0, 8)
  })
})


