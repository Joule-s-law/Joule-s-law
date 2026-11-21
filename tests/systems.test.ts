﻿﻿﻿import { describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { EnergyType } from '../src/core/energy/EnergyType'
import { useGameStore } from '../src/ui/stores/useGameStore'
import { TechTree } from '../src/core/tech/TechTree'
import { SaveService } from '../src/core/save/SaveService'
import { createComponentById } from '../src/core/components/registry/componentRegistry'
import { WireComponent } from '../src/core/components/behaviors/WireComponent'
import { BatteryComponent } from '../src/core/components/behaviors/BatteryComponent'
import { Simulation } from '../src/core/sim/Simulation'
import type { BaseComponent } from '../src/core/components/BaseComponent'
import { portPosition } from '../src/ui/board/boardMath'
import { buildBatteryLoop, buildConverterLoop, buildFieldPair, buildMotorPair, buildOverloadLoop, buildSimpleLoop, buildSwitchLoop } from './helpers'

describe('Converters and systems', () => {
  it('secondary battery charges when source + terminal feeds battery + terminal, discharges when reversed', () => {
    const buildCharger = (reversed: boolean): { sim: Simulation; crank: BaseComponent; battery: BatteryComponent } => {
      const sim = new Simulation()
      const crank = createComponentById('hand_crank')
      const battery = createComponentById('secondary_battery')
      crank.x = 0
      crank.y = 0
      battery.x = 2
      battery.y = 0
      crank.rotationSpeed = Math.PI * 2
      crank.rotationDrive = 1
      sim.addComponent(crank)
      sim.addComponent(battery)
      if (reversed) {
        sim.connect(crank.getPort(1), battery.getPort(0))
        sim.connect(crank.getPort(0), battery.getPort(1))
      } else {
        sim.connect(crank.getPort(1), battery.getPort(1))
        sim.connect(crank.getPort(0), battery.getPort(0))
      }
      return { sim, crank, battery: battery as BatteryComponent }
    }
    const forward = buildCharger(false)
    forward.battery.stateOfCharge = 0.5
    forward.sim.tick()
    expect(forward.battery.stateOfCharge).toBeGreaterThan(0.5)
    const reversed = buildCharger(true)
    reversed.sim.tick()
    expect(reversed.battery.stateOfCharge).toBeLessThan(1)
  })

  it('converter pays chemical income', () => {
    const { sim } = buildConverterLoop('test_chem')
    sim.economy.setMultiplier(EnergyType.CHEMICAL, 2)
    sim.tick()
    const current = 10 / (3 + 15)
    const expected = current ** 2 * 15 * 0.1 * 0.8 * 2
    expect(sim.economy.money).toBeCloseTo(expected, 8)
  })

  it('open switch blocks current, closed switch conducts', () => {
    const open = buildSwitchLoop(false)
    open.sim.tick()
    expect(open.load.current).toBeCloseTo(0, 8)
    const closed = buildSwitchLoop(true)
    closed.sim.tick()
    expect(closed.load.current).toBeCloseTo(10 / 13.01, 6)
  })

  it('battery discharges and loses state of charge', () => {
    const { sim, battery } = buildBatteryLoop()
    sim.tick()
    expect(battery.stateOfCharge).toBeLessThan(1)
    expect(battery.stateOfCharge).toBeGreaterThan(0)
    expect(Math.abs(battery.current)).toBeGreaterThan(0)
  })

  it('overloaded component is destroyed with 10% refund', () => {
    const { sim, victim } = buildOverloadLoop()
    let ticks = 0
    while (sim.components.includes(victim) && ticks < 50) {
      sim.tick()
      ticks++
    }
    expect(sim.components.includes(victim)).toBe(false)
    expect(ticks).toBeGreaterThan(1)
    expect(sim.economy.money).toBeGreaterThan(victim.def.price * 0.1)
  })

  it('motor drives adjacent gear as mechanical rotation source', () => {
    const { sim, motor, gear } = buildMotorPair()
    for (let i = 0; i < 60; i++) {
      sim.tick()
    }
    expect(motor.current).not.toBe(0)
    expect(Math.abs(gear.rotationSpeed)).toBeGreaterThan(0.1)
    expect(Math.sign(gear.rotationSpeed)).toBe(-Math.sign(motor.current))
  })

  it('lamp light reaches photocell and produces current', () => {
    const { sim, sensor } = buildFieldPair()
    sim.tick()
    sim.tick()
    expect(sim.fieldGrid.sample('light', 4, 0)).toBeGreaterThan(0)
    expect(sensor.current).not.toBe(0)
  })

  it('tech tree: root starts at level 1 granting 100% global multiplier', () => {
    const { sim } = buildSimpleLoop()
    const tech = new TechTree(sim)
    expect(tech.getLevel('physics_must_3')).toBe(1)
    expect(sim.economy.globalMultiplier).toBe(1)
    sim.economy.money = 2000
    expect(tech.buy('physics_must_3')).toBe(true)
    expect(tech.getLevel('physics_must_3')).toBe(2)
    expect(sim.economy.globalMultiplier).toBe(2)
    expect(sim.economy.money).toBeCloseTo(500, 6)
  })

  it('tech tree: children unlock only after parent reaches level 1', () => {
    const { sim } = buildSimpleLoop()
    const tech = new TechTree(sim)
    expect(tech.canBuy('einstein')).toBe(false)
    expect(tech.isComponentUnlocked('lamp')).toBe(false)
    sim.economy.money = 100000
    expect(tech.buy('higgs')).toBe(true)
    expect(sim.clickHeat).toBeCloseTo(2, 8)
    expect(sim.clickCooldown).toBeCloseTo(0.5 * 0.9, 6)
    expect(tech.buy('joule')).toBe(true)
    expect(tech.buy('carnot')).toBe(true)
    expect(tech.buy('carnot')).toBe(true)
    expect(tech.buy('carnot')).toBe(true)
    expect(tech.buy('carnot')).toBe(true)
    expect(tech.isComponentUnlocked('motor')).toBe(true)
    expect(sim.converterEfficiencyBoost).toBeCloseTo(0.04, 8)
    expect(tech.buy('planck')).toBe(true)
    expect(tech.buy('planck')).toBe(true)
    expect(tech.buy('planck')).toBe(true)
    expect(tech.isComponentUnlocked('lamp')).toBe(true)
    expect(sim.lightEmissionBoost).toBeCloseTo(0.3, 8)
    expect(tech.buy('ohm')).toBe(true)
    expect(sim.ratedCurrentBoost).toBeCloseTo(1.1, 8)
    for (let i = 0; i < 4; i++) tech.buy('onnes')
    expect(tech.isWireMaterialUnlocked('silver')).toBe(true)
    expect(tech.isWireMaterialUnlocked('superconductor')).toBe(false)
    tech.buy('onnes')
    expect(tech.isWireMaterialUnlocked('superconductor')).toBe(true)
  })

  it('tech tree: multi-parent nodes require every parent at level 1', () => {
    const { sim } = buildSimpleLoop()
    const tech = new TechTree(sim)
    expect(tech.isUnlocked('roentgen')).toBe(false)
    sim.economy.money = 1000000
    expect(tech.buy('higgs')).toBe(true)
    expect(tech.buy('joule')).toBe(true)
    expect(tech.buy('carnot')).toBe(true)
    expect(tech.buy('curie')).toBe(true)
    expect(tech.isUnlocked('roentgen')).toBe(false)
    expect(tech.buy('einstein')).toBe(true)
    expect(tech.isUnlocked('roentgen')).toBe(true)
    expect(tech.buy('roentgen')).toBe(true)
    expect(tech.isComponentUnlocked('fission_reactor')).toBe(true)
  })

  it('wire resistance follows anchor distance', () => {
    const { sim } = buildSimpleLoop()
    const wire = createComponentById('wire', {
      wireMaterialId: 'copper',
      wireAnchorA: { x: 0, y: 0 },
      wireAnchorB: { x: 48 * 5, y: 0 },
    })
    sim.addComponent(wire)
    if (!(wire instanceof WireComponent)) throw new Error('expected wire')
    expect(wire.getLengthCells()).toBeCloseTo(5, 8)
    expect(wire.getResistance()).toBeCloseTo(5 * 1.68e-8, 15)
  })

  it('selling a component also sells its attached wires', () => {
    localStorage.removeItem('joules-law-save-v1')
    setActivePinia(createPinia())
    const store = useGameStore()
    store.sim.economy.money = 100
    store.tryPlaceAt('hand_crank', 3, 3)
    store.tryPlaceAt('resistor', 6, 3)
    const crank = store.sim.components.find((c) => c.def.id === 'hand_crank')
    const resistor = store.sim.components.find((c) => c.def.id === 'resistor')
    if (crank === undefined || resistor === undefined) throw new Error('components not placed')
    store.onPortClick(crank, 0)
    store.onPortClick(resistor, 1)
    const wires = store.sim.components.filter((c): c is WireComponent => c instanceof WireComponent)
    expect(wires.length).toBe(1)
    const moneyBefore = store.money
    store.sellComponent(crank)
    expect(store.sim.components.includes(crank)).toBe(false)
    expect(store.sim.components.includes(wires[0]!)).toBe(false)
    expect(store.sim.economy.money).toBeCloseTo(moneyBefore + crank.def.price * 0.5 + wires[0]!.def.price * 0.5, 6)
  })

  it('moving a component drags attached wire anchors along', () => {
    localStorage.removeItem('joules-law-save-v1')
    setActivePinia(createPinia())
    const store = useGameStore()
    store.sim.economy.money = 100
    store.tryPlaceAt('hand_crank', 3, 3)
    store.tryPlaceAt('resistor', 7, 3)
    const crank = store.sim.components.find((c) => c.def.id === 'hand_crank')
    const resistor = store.sim.components.find((c) => c.def.id === 'resistor')
    if (crank === undefined || resistor === undefined) throw new Error('components not placed')
    store.onPortClick(crank, 1)
    store.onPortClick(resistor, 1)
    const wire = store.sim.components.find((c): c is WireComponent => c instanceof WireComponent)
    if (wire === undefined) throw new Error('wire not created')
    store.moveComponent(resistor, 9, 5)
    const anchors = wire.getAnchors()
    const expected = portPosition(resistor, 1)
    expect(anchors.b.x).toBeCloseTo(expected.px, 6)
    expect(anchors.b.y).toBeCloseTo(expected.py, 6)
    expect(resistor.x).toBe(9)
    expect(resistor.y).toBe(5)
  })

  it('melting a component also destroys attached wires with 10% refund', () => {
    const { sim, victim } = buildOverloadLoop()
    const wire = createComponentById('wire', {
      wireAnchorA: { x: 0, y: 0 },
      wireAnchorB: { x: 48, y: 0 },
    })
    sim.addComponent(wire)
    sim.connect(victim.getPort(0), wire.getPort(0))
    let ticks = 0
    let moneyBeforeLast = sim.economy.money
    while (sim.components.includes(victim) && ticks < 50) {
      moneyBeforeLast = sim.economy.money
      sim.tick()
      ticks++
    }
    expect(sim.components.includes(victim)).toBe(false)
    expect(sim.components.includes(wire)).toBe(false)
    const lastHeat = (10 / 13) ** 2 * 10 * 0.1
    expect(sim.economy.money).toBeCloseTo(moneyBeforeLast + lastHeat + victim.def.price * 0.1 + wire.def.price * 0.1, 6)
  })

  it('save roundtrip restores circuit and state', () => {
    const sim = buildSimpleLoop().sim
    const tech = new TechTree(sim)
    sim.economy.money = 200
    tech.buy('higgs')
    sim.simTime = 5
    sim.economy.setMultiplier(EnergyType.HEAT, 3)
    const saver = new SaveService(sim, tech)
    saver.save()
    const sim2 = buildSimpleLoop().sim
    const tech2 = new TechTree(sim2)
    const result = new SaveService(sim2, tech2).load()
    expect(result).not.toBeNull()
    expect(sim2.economy.money).toBeGreaterThan(0)
    expect(sim2.clickHeat).toBeCloseTo(2, 8)
    expect(tech2.getLevel('higgs')).toBe(1)
    expect(sim2.economy.globalMultiplier).toBe(1)
    expect(sim2.economy.getMultiplier(EnergyType.HEAT)).toBe(3)
    expect(sim2.components.length).toBe(sim.components.length)
    expect(() => sim2.tick()).not.toThrow()
  })
})

