﻿﻿﻿import { describe, expect, it } from 'vitest'
import { EnergyType } from '../src/core/energy/EnergyType'
import { BATTERY_PACK } from '../src/core/components/registry/definitions'
import { buildSimpleLoop } from './helpers'

const HEAT_PER_TICK = (10 / 13) ** 2 * 10 * 0.1

describe('Economy', () => {
  it('emits energy events for click heat and component work', () => {
    const { sim } = buildSimpleLoop()
    expect(sim.click(1.5, 2.5)).toBe(true)
    const clickEvents = sim.drainEnergyEvents()
    expect(clickEvents.length).toBe(1)
    expect(clickEvents[0]!.type).toBe(EnergyType.HEAT)
    expect(clickEvents[0]!.amount).toBe(1)
    expect(clickEvents[0]!.x).toBeCloseTo(1.5, 8)
    sim.tick()
    const tickEvents = sim.drainEnergyEvents()
    expect(tickEvents.length).toBe(1)
    expect(tickEvents[0]!.amount).toBeCloseTo((10 / 13) ** 2 * 10 * 0.1, 6)
  })

  it('pays money for resistor heat: Q = I^2 * R * t', () => {
    const { sim } = buildSimpleLoop()
    sim.tick()
    expect(sim.economy.money).toBeCloseTo(HEAT_PER_TICK, 10)
    expect(sim.lastIncome).toBeCloseTo(HEAT_PER_TICK, 10)
  })

  it('applies energy type multiplier', () => {
    const { sim } = buildSimpleLoop()
    sim.economy.setMultiplier(EnergyType.HEAT, 2.5)
    sim.tick()
    expect(sim.economy.money).toBeCloseTo(HEAT_PER_TICK * 2.5, 10)
  })

  it('applies global multiplier on top of type multiplier', () => {
    const { sim } = buildSimpleLoop()
    sim.economy.setMultiplier(EnergyType.HEAT, 2)
    sim.economy.globalMultiplier = 3
    sim.tick()
    expect(sim.economy.money).toBeCloseTo(HEAT_PER_TICK * 2 * 3, 10)
  })

  it('click produces 1J heat with 0.5s cooldown', () => {
    const { sim } = buildSimpleLoop()
    expect(sim.click()).toBe(true)
    expect(sim.economy.money).toBeCloseTo(1, 10)
    expect(sim.click()).toBe(false)
    expect(sim.economy.money).toBeCloseTo(1, 10)
    sim.simTime += 0.6
    expect(sim.click()).toBe(true)
    expect(sim.economy.money).toBeCloseTo(2, 10)
  })

  it('click income respects heat multiplier', () => {
    const { sim } = buildSimpleLoop()
    sim.economy.setMultiplier(EnergyType.HEAT, 10)
    expect(sim.click()).toBe(true)
    expect(sim.economy.money).toBeCloseTo(10, 10)
  })

  it('ledger is drained after each tick', () => {
    const { sim } = buildSimpleLoop()
    sim.tick()
    sim.tick()
    expect(sim.economy.money).toBeCloseTo(HEAT_PER_TICK * 2, 10)
  })

  it('price scales with purchase count', () => {
    const { sim } = buildSimpleLoop()
    expect(sim.getComponentPrice(BATTERY_PACK)).toBe(BATTERY_PACK.price)
    sim.registerPurchase(BATTERY_PACK)
    sim.registerPurchase(BATTERY_PACK)
    expect(sim.getComponentPrice(BATTERY_PACK)).toBeCloseTo(BATTERY_PACK.price * 1.15 ** 2, 8)
  })
})

