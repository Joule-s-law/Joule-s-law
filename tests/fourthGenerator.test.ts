import { describe, expect, it } from 'vitest'
import { createComponent } from '../src/core/components/registry/componentRegistry'
import { FOURTH_GENERATOR, RESISTOR } from '../src/core/components/registry/definitions'
import { FourthGeneratorComponent } from '../src/core/components/behaviors/FourthGeneratorComponent'
import { ResistiveComponent } from '../src/core/components/behaviors/ResistiveComponent'
import { Simulation } from '../src/core/sim/Simulation'
import { TechTree } from '../src/core/tech/TechTree'
import { TECH_NODES } from '../src/core/tech/TechTree'

describe('fourth generator', () => {
  it('has a stable uuid and editable custom name', () => {
    const generator = createComponent(FOURTH_GENERATOR) as FourthGeneratorComponent
    expect(generator.uuid).toMatch(/^[0-9a-f-]{36}$/)
    generator.customName = '观众一号'
    expect(generator.customName).toBe('观众一号')
    expect(generator.externalEmf).toBe(0)
  })

  it('applies summed external emf, negative included, through MNA', () => {
    const sim = new Simulation()
    const generator = createComponent(FOURTH_GENERATOR) as FourthGeneratorComponent
    const load = createComponent(RESISTOR) as ResistiveComponent
    generator.x = 0
    generator.y = 0
    load.x = 2
    load.y = 0
    sim.addComponent(generator)
    sim.addComponent(load)
    sim.connect(generator.getPort(1), load.getPort(0))
    sim.connect(load.getPort(1), generator.getPort(0))
    generator.externalEmf = 11
    sim.tick()
    expect(generator.current).toBeCloseTo(1, 5)
    expect(generator.voltage).toBeLessThan(0)
    generator.externalEmf = -5
    sim.tick()
    expect(generator.current).toBeCloseTo(-5 / 11, 5)
  })
})

describe('ender interface tech node', () => {
  it('stays hidden until physics_must_3 reaches max level', () => {
    const sim = new Simulation()
    const techTree = new TechTree(sim)
    const node = TECH_NODES.find((entry) => entry.id === 'ender_interface')
    expect(node?.requiredParentLevel).toBe(5)
    expect(techTree.isRevealed('ender_interface')).toBe(false)
    expect(techTree.isUnlocked('ender_interface')).toBe(false)
    techTree.buy('physics_must_3')
    expect(techTree.isRevealed('ender_interface')).toBe(false)
    sim.economy.money = 1e9
    while (techTree.getLevel('physics_must_3') < 5) {
      expect(techTree.buy('physics_must_3')).toBe(true)
    }
    expect(techTree.isRevealed('ender_interface')).toBe(true)
    expect(techTree.isUnlocked('ender_interface')).toBe(true)
    expect(techTree.buy('ender_interface')).toBe(true)
    expect(techTree.isComponentUnlocked('fourth_generator')).toBe(true)
    expect(techTree.canBuy('ender_interface')).toBe(false)
  })
})
