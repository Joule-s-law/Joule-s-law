import { describe, expect, it } from 'vitest'
import { Simulation } from '../src/core/sim/Simulation'
import { createComponentById } from '../src/core/components/registry/componentRegistry'
import { DiodeComponent } from '../src/core/components/behaviors/DiodeComponent'
import { BatteryComponent } from '../src/core/components/behaviors/BatteryComponent'
import { VoltageSourceComponent } from '../src/core/components/behaviors/VoltageSourceComponent'
import { ResistiveComponent } from '../src/core/components/behaviors/ResistiveComponent'
import type { BaseComponent } from '../src/core/components/BaseComponent'

const TWO_PI = Math.PI * 2

function expectDiode(component: BaseComponent): DiodeComponent {
  if (!(component instanceof DiodeComponent)) throw new Error('expected diode')
  return component
}

function buildDiodeLoop(reversed: boolean): { sim: Simulation; crank: VoltageSourceComponent; diode: DiodeComponent; load: ResistiveComponent } {
  const sim = new Simulation()
  const crank = createComponentById('hand_crank')
  if (!(crank instanceof VoltageSourceComponent)) throw new Error('expected crank')
  const diode = expectDiode(createComponentById('diode'))
  const load = createComponentById('resistor')
  if (!(load instanceof ResistiveComponent)) throw new Error('expected resistor')
  crank.x = 0
  crank.y = 0
  diode.x = 1
  diode.y = 0
  load.x = 3
  load.y = 0
  crank.rotationSpeed = TWO_PI
  crank.rotationDrive = 1
  sim.addComponent(crank)
  sim.addComponent(diode)
  sim.addComponent(load)
  if (reversed) {
    sim.connect(crank.getPort(1), diode.getPort(1))
    sim.connect(diode.getPort(0), crank.getPort(0))
    sim.connect(crank.getPort(1), load.getPort(0))
    sim.connect(diode.getPort(0), load.getPort(1))
  } else {
    sim.connect(crank.getPort(1), diode.getPort(0))
    sim.connect(diode.getPort(1), load.getPort(1))
    sim.connect(crank.getPort(0), load.getPort(0))
  }
  return { sim, crank, diode, load }
}

describe('Diode', () => {
  it('conducts forward with small resistance', () => {
    const { sim, diode, load } = buildDiodeLoop(false)
    sim.tick()
    expect(diode.conducting).toBe(true)
    expect(load.current).toBeCloseTo(-10 / 13.5, 6)
  })

  it('blocks reverse current', () => {
    const { sim, diode, load } = buildDiodeLoop(true)
    sim.tick()
    expect(diode.conducting).toBe(false)
    expect(Math.abs(load.current)).toBeLessThan(1e-6)
  })

  it('diode prevents battery back-discharge on reversed crank', () => {
    const sim = new Simulation()
    const crank = createComponentById('hand_crank')
    if (!(crank instanceof VoltageSourceComponent)) throw new Error('expected crank')
    const diode = expectDiode(createComponentById('diode'))
    const battery = createComponentById('secondary_battery')
    if (!(battery instanceof BatteryComponent)) throw new Error('expected battery')
    crank.x = 0
    crank.y = 0
    diode.x = 1
    diode.y = 0
    battery.x = 3
    battery.y = 0
    sim.addComponent(crank)
    sim.addComponent(diode)
    sim.addComponent(battery)
    sim.connect(crank.getPort(1), diode.getPort(0))
    sim.connect(diode.getPort(1), battery.getPort(1))
    sim.connect(crank.getPort(0), battery.getPort(0))
    battery.stateOfCharge = 0.5
    crank.rotationSpeed = TWO_PI
    crank.rotationDrive = 1
    sim.tick()
    expect(diode.conducting).toBe(true)
    expect(battery.stateOfCharge).toBeGreaterThan(0.5)
    crank.rotationSpeed = -TWO_PI
    crank.rotationDrive = -1
    sim.tick()
    expect(diode.conducting).toBe(false)
    expect(battery.stateOfCharge).toBeCloseTo(0.5, 3)
  })
})
