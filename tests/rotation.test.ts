import { describe, expect, it } from 'vitest'
import { Simulation } from '../src/core/sim/Simulation'
import { createComponentById } from '../src/core/components/registry/componentRegistry'
import { GearComponent } from '../src/core/components/behaviors/GearComponent'
import { VoltageSourceComponent } from '../src/core/components/behaviors/VoltageSourceComponent'
import { ResistiveComponent } from '../src/core/components/behaviors/ResistiveComponent'
import type { ComponentDefinition } from '../src/core/components/ComponentDefinition'
import { GEAR_GROUP, BIG_GEAR, CHAIN_DRIVE, FLYWHEEL } from '../src/core/components/registry/definitions'
import { ChainDriveComponent } from '../src/core/components/behaviors/ChainDriveComponent'
import { ClutchComponent } from '../src/core/components/behaviors/ClutchComponent'
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

function addChain(sim: Simulation, gearA: GearComponent, gearB: GearComponent): ChainDriveComponent {
  const chain = new ChainDriveComponent(CHAIN_DRIVE, gearA, gearB)
  sim.addComponent(chain)
  return chain
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
    expect(crank.rotationSpeed).toBe(0)
    expect(gear.rotationSpeed).toBe(0)
  })

  it('big gear halves speed from small gear and doubles it back', () => {
    const { sim, crank } = buildCrankAt(0, 0)
    const big = addGear(sim, BIG_GEAR, 1, 0)
    const small = addGear(sim, GEAR_GROUP, 3, 1)
    crank.rotationSpeed = TWO_PI
    big.rotationSpeed = -Math.PI
    small.rotationSpeed = TWO_PI
    crank.rotationDrive = 1
    sim.tick()
    expect(big.rotationSpeed).toBeCloseTo(-crank.rotationSpeed / 2, 6)
    expect(small.rotationSpeed).toBeCloseTo(crank.rotationSpeed, 6)
  })

  it('chain drive synchronizes two distant gears with same speed and direction', () => {
    const { sim, crank } = buildCrankAt(0, 0)
    const a = addGear(sim, GEAR_GROUP, 1, 0)
    const b = addGear(sim, GEAR_GROUP, 5, 3)
    addChain(sim, a, b)
    crank.rotationSpeed = TWO_PI
    a.rotationSpeed = -TWO_PI
    b.rotationSpeed = -TWO_PI
    crank.rotationDrive = 1
    sim.tick()
    expect(a.rotationSpeed).toBeCloseTo(-crank.rotationSpeed, 6)
    expect(b.rotationSpeed).toBeCloseTo(a.rotationSpeed, 6)
  })

  it('chain drive and meshing between the same pair of gears lock the system', () => {
    const { sim, crank } = buildCrankAt(0, 0)
    const a = addGear(sim, GEAR_GROUP, 1, 0)
    const b = addGear(sim, GEAR_GROUP, 2, 0)
    addChain(sim, a, b)
    crank.rotationSpeed = TWO_PI
    crank.rotationDrive = 1
    sim.tick()
    expect(sim.rotation.lockedComponents.has(a)).toBe(true)
    expect(sim.rotation.lockedComponents.has(b)).toBe(true)
  })

  it('removing a gear also removes its chain from the simulation', () => {
    const { sim } = buildCrankAt(0, 0)
    const a = addGear(sim, GEAR_GROUP, 1, 0)
    const b = addGear(sim, GEAR_GROUP, 5, 3)
    const chain = addChain(sim, a, b)
    sim.removeComponent(a)
    expect(sim.components.includes(chain)).toBe(false)
    expect(sim.chainByGear.has(b)).toBe(false)
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
    a.rotationSpeed = -TWO_PI
    b.rotationSpeed = TWO_PI
    c.rotationSpeed = -TWO_PI
    crank.rotationDrive = 1
    sim.tick()
    expect(sim.rotation.lockedComponents.size).toBe(0)
    expect(a.rotationSpeed).toBeCloseTo(-crank.rotationSpeed, 6)
    expect(b.rotationSpeed).toBeCloseTo(-a.rotationSpeed, 6)
    expect(c.rotationSpeed).toBeCloseTo(a.rotationSpeed, 6)
  })

  it('lifting clutch keeps its own speed and ignores adjacent gears', () => {
    const { sim, crank } = buildCrankAt(0, 0)
    const clutch = createComponentById('clutch') as ClutchComponent
    if (!(clutch instanceof ClutchComponent)) throw new Error('expected clutch')
    clutch.x = 1
    clutch.y = 0
    sim.addComponent(clutch)
    const gear = addGear(sim, GEAR_GROUP, 2, 0)
    crank.rotationSpeed = TWO_PI
    clutch.rotationSpeed = 5
    sim.tick()
    expect(clutch.rotationSpeed).toBeCloseTo(5 - 0.05, 6)
    expect(gear.rotationSpeed).toBe(0)
    expect(crank.rotationSpeed).toBeCloseTo(TWO_PI - Math.PI * 0.1, 6)
  })

  it('engaged clutch joins the coupling system with momentum conservation', () => {
    const { sim, crank } = buildCrankAt(0, 0)
    const clutch = createComponentById('clutch') as ClutchComponent
    if (!(clutch instanceof ClutchComponent)) throw new Error('expected clutch')
    clutch.x = 1
    clutch.y = 0
    sim.addComponent(clutch)
    crank.rotationSpeed = TWO_PI
    clutch.rotationSpeed = 5
    const ctx = { dt: 0.1, simTime: 0, ledger: sim.ledger, host: sim }
    clutch.current = 0.1
    clutch.onTick(ctx)
    expect(clutch.engaged).toBe(true)
    sim.tick()
    const expected = (64 * TWO_PI - 64 * 5) / 128 - ((64 * Math.PI + 32) / 128) * 0.1
    expect(crank.rotationSpeed).toBeCloseTo(expected, 6)
    expect(clutch.rotationSpeed).toBeCloseTo(-expected, 6)
  })

  it('disengaging clutch releases the gear back to independence', () => {
    const { sim, crank } = buildCrankAt(0, 0)
    const clutch = createComponentById('clutch') as ClutchComponent
    if (!(clutch instanceof ClutchComponent)) throw new Error('expected clutch')
    clutch.x = 1
    clutch.y = 0
    sim.addComponent(clutch)
    const gear = addGear(sim, GEAR_GROUP, 2, 0)
    const ctx = { dt: 0.1, simTime: 0, ledger: sim.ledger, host: sim }
    clutch.current = 0.1
    clutch.onTick(ctx)
    crank.rotationSpeed = TWO_PI
    clutch.rotationSpeed = -TWO_PI
    gear.rotationSpeed = -TWO_PI
    sim.tick()
    const expected = (64 * TWO_PI + 64 * TWO_PI - 64 * TWO_PI) / 192 - ((128 * Math.PI + 32) / 192) * 0.1
    expect(gear.rotationSpeed).toBeCloseTo(expected, 6)
    clutch.current = 0
    clutch.onTick(ctx)
    expect(clutch.engaged).toBe(false)
    for (let i = 0; i < 60; i++) {
      sim.tick()
    }
    expect(crank.rotationSpeed).toBe(0)
    expect(clutch.rotationSpeed).toBe(0)
    expect(gear.rotationSpeed).toBe(0)
  })

  it('flywheel extends coasting and conserves momentum when coupled', () => {
    const sim = new Simulation()
    const gear = addGear(sim, GEAR_GROUP, 0, 0)
    const flywheel = addGear(sim, FLYWHEEL, 1, 0)
    gear.rotationSpeed = TWO_PI
    sim.tick()
    const expected = (64 * TWO_PI) / (64 + 1152 * (4 / 9)) - ((64 * Math.PI) / (64 + 1152 * (4 / 9))) * 0.1
    expect(gear.rotationSpeed).toBeCloseTo(expected, 6)
    expect(flywheel.rotationSpeed).toBeCloseTo(-expected * (2 / 3), 6)
    for (let i = 0; i < 10; i++) {
      sim.tick()
    }
    const coasted = expected - (Math.PI / 9) * 1.0
    expect(gear.rotationSpeed).toBeCloseTo(coasted, 6)
    expect(flywheel.rotationSpeed).toBeCloseTo(-coasted * (2 / 3), 6)
  })

  it('damped gears stop when no drive remains', () => {
    const sim = new Simulation()
    const gear = addGear(sim, GEAR_GROUP, 0, 0)
    gear.rotationSpeed = 10
    for (let i = 0; i < 40; i++) {
      sim.tick()
    }
    expect(gear.rotationSpeed).toBe(0)
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

  it('maxwell tech raises gear max omega per level', () => {
    const sim = new Simulation()
    const tech = new TechTree(sim)
    sim.economy.money = 100000
    tech.buy('ohm')
    tech.buy('maxwell')
    expect(sim.gearMaxOmegaBonus).toBeCloseTo(Math.PI * 2, 8)
    tech.buy('maxwell')
    expect(sim.gearMaxOmegaBonus).toBeCloseTo(Math.PI * 4, 8)
    expect(sim.gearBreakdownChance).toBeCloseTo(0.5, 8)
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
