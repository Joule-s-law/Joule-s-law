import { describe, expect, it } from 'vitest'
import { Simulation } from '../src/core/sim/Simulation'
import { createComponentById } from '../src/core/components/registry/componentRegistry'
import { GearComponent } from '../src/core/components/behaviors/GearComponent'
import { VoltageSourceComponent } from '../src/core/components/behaviors/VoltageSourceComponent'
import { ResistiveComponent } from '../src/core/components/behaviors/ResistiveComponent'
import type { ComponentDefinition } from '../src/core/components/ComponentDefinition'
import { GEAR_GROUP, BIG_GEAR } from '../src/core/components/registry/definitions'
import { TechTree } from '../src/core/tech/TechTree'

const TWO_PI = Math.PI * 2

function buildCrankAt(x: number, y: number): { sim: Simulation; crank: VoltageSourceComponent } {
  const sim = new Simulation()
  const crank = createComponentById('hand_crank') as VoltageSourceComponent
  if (!(crank instanceof VoltageSourceComponent)) throw new Error('expected crank')
  crank.x = x
  crank.y = y
  sim.addComponent(crank)
  return { sim, crank }
}

function addGear(sim: Simulation, def: ComponentDefinition, x: number, y: number): GearComponent {
  const gear = createComponentById(def.id) as GearComponent
  if (!(gear instanceof GearComponent)) throw new Error('expected gear')
  gear.x = x
  gear.y = y
  sim.addComponent(gear)
  return gear
}

describe('RotationSystem', () => {
  it('crank ramps omega via drive and drives adjacent gear in opposite direction', () => {
    const { sim, crank } = buildCrankAt(0, 0)
    const gear = addGear(sim, GEAR_GROUP, 1, 0)
    crank.rotationDrive = -1
    for (let i = 0; i < 20; i++) {
      sim.tick()
    }
    expect(crank.rotationSpeed).toBeCloseTo(-TWO_PI, 6)
    expect(gear.rotationSpeed).toBeCloseTo(TWO_PI, 6)
    crank.rotationDrive = 0
    for (let i = 0; i < 20; i++) {
      sim.tick()
    }
    expect(crank.rotationSpeed).toBeCloseTo(0, 6)
    expect(gear.rotationSpeed).toBeCloseTo(0, 6)
  })

  it('big gear halves speed from small gear and doubles it back', () => {
    const { sim, crank } = buildCrankAt(0, 0)
    const big = addGear(sim, BIG_GEAR, 1, 0)
    const small = addGear(sim, GEAR_GROUP, 3, 1)
    crank.rotationSpeed = TWO_PI
    crank.rotationDrive = 1
    sim.tick()
    expect(big.rotationSpeed).toBeCloseTo(-Math.PI, 6)
    expect(small.rotationSpeed).toBeCloseTo(TWO_PI, 6)
  })

  it('three-member ring through big gear locks the whole system', () => {
    const { sim, crank } = buildCrankAt(0, 0)
    const big = addGear(sim, BIG_GEAR, 1, 0)
    const a = addGear(sim, GEAR_GROUP, 3, 0)
    const b = addGear(sim, GEAR_GROUP, 3, 1)
    void b
    crank.rotationSpeed = TWO_PI
    crank.rotationDrive = 1
    sim.tick()
    expect(sim.rotation.lockedComponents.size).toBe(4)
    expect(sim.rotation.lockedComponents.has(crank)).toBe(true)
    expect(sim.rotation.lockedComponents.has(big)).toBe(true)
    expect(a.rotationSpeed).toBe(0)
  })

  it('four-member square ring with alternating directions keeps spinning', () => {
    const { sim, crank } = buildCrankAt(0, 0)
    const a = addGear(sim, GEAR_GROUP, 1, 0)
    const b = addGear(sim, GEAR_GROUP, 1, 1)
    const c = addGear(sim, GEAR_GROUP, 0, 1)
    void b
    void c
    crank.rotationSpeed = TWO_PI
    crank.rotationDrive = 1
    sim.tick()
    expect(sim.rotation.lockedComponents.size).toBe(0)
    expect(a.rotationSpeed).toBeCloseTo(-TWO_PI, 6)
    expect(b.rotationSpeed).toBeCloseTo(TWO_PI, 6)
    expect(c.rotationSpeed).toBeCloseTo(-TWO_PI, 6)
  })

  it('overspeed gear breaks down based on breakdown chance', () => {
    const sim = new Simulation()
    const gear = addGear(sim, GEAR_GROUP, 0, 0)
    gear.rotationSpeed = 40
    sim.gearBreakdownChance = 10
    const ctx = { dt: 0.1, simTime: 0, ledger: sim.ledger, host: sim }
    gear.onTick(ctx)
    sim.tick()
    expect(sim.components.includes(gear)).toBe(false)
  })

  it('normal speed gears never break down', () => {
    const sim = new Simulation()
    const gear = addGear(sim, GEAR_GROUP, 0, 0)
    gear.rotationSpeed = 12 * Math.PI
    sim.gearBreakdownChance = 10
    const ctx = { dt: 0.1, simTime: 0, ledger: sim.ledger, host: sim }
    gear.onTick(ctx)
    sim.tick()
    expect(sim.components.includes(gear)).toBe(true)
  })

  it('maxwell tech reduces gear breakdown chance', () => {
    const sim = new Simulation()
    const tech = new TechTree(sim)
    sim.economy.money = 100000
    tech.buy('ohm')
    tech.buy('maxwell')
    expect(sim.gearBreakdownChance).toBeCloseTo(0.3, 8)
  })

  it('crank emf follows omega with correct polarity per direction', () => {
    const sim = new Simulation()
    const crank = createComponentById('hand_crank') as VoltageSourceComponent
    if (!(crank instanceof VoltageSourceComponent)) throw new Error('expected crank')
    const load = createComponentById('resistor') as ResistiveComponent
    if (!(load instanceof ResistiveComponent)) throw new Error('expected resistor')
    crank.x = 0
    crank.y = 0
    load.x = 2
    load.y = 0
    sim.addComponent(crank)
    sim.addComponent(load)
    sim.connect(crank.getPort(0), load.getPort(1))
    sim.connect(crank.getPort(1), load.getPort(0))
    crank.rotationSpeed = TWO_PI
    crank.rotationDrive = 1
    sim.tick()
    const cwCurrent = load.current
    expect(cwCurrent).toBeCloseTo(10 / 13, 6)
    crank.rotationSpeed = -TWO_PI
    crank.rotationDrive = -1
    sim.tick()
    expect(load.current).toBeCloseTo(-10 / 13, 6)
  })
})
