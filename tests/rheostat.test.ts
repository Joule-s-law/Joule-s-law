import { describe, expect, it } from 'vitest'
import { createComponent } from '../src/core/components/registry/componentRegistry'
import { HAND_CRANK, RHEOSTAT } from '../src/core/components/registry/definitions'
import { RheostatComponent } from '../src/core/components/behaviors/RheostatComponent'
import { VoltageSourceComponent } from '../src/core/components/behaviors/VoltageSourceComponent'
import { Simulation } from '../src/core/sim/Simulation'

describe('rheostat', () => {
  it('resistance follows slider position with clamping', () => {
    const rheostat = createComponent(RHEOSTAT) as RheostatComponent
    rheostat.setSliderPosition(0)
    expect(rheostat.getResistance()).toBeCloseTo(0.5, 6)
    rheostat.setSliderPosition(1)
    expect(rheostat.getResistance()).toBeCloseTo(50, 6)
    rheostat.setSliderPosition(0.5)
    expect(rheostat.getResistance()).toBeCloseTo(25.25, 6)
    rheostat.setSliderPosition(5)
    expect(rheostat.getResistance()).toBeCloseTo(50, 6)
    rheostat.setSliderPosition(-2)
    expect(rheostat.getResistance()).toBeCloseTo(0.5, 6)
  })

  it('changes loop current through the MNA solver', () => {
    const sim = new Simulation()
    const source = createComponent(HAND_CRANK) as VoltageSourceComponent
    const rheostat = createComponent(RHEOSTAT) as RheostatComponent
    source.rotationSpeed = Math.PI * 2
    source.rotationDrive = 1
    source.x = 0
    source.y = 0
    rheostat.x = 2
    rheostat.y = 0
    sim.addComponent(source)
    sim.addComponent(rheostat)
    sim.connect(source.getPort(0), rheostat.getPort(1))
    sim.connect(source.getPort(1), rheostat.getPort(0))
    rheostat.setSliderPosition(1)
    sim.tick()
    const weak = Math.abs(rheostat.current)
    rheostat.setSliderPosition(0)
    sim.tick()
    const strong = Math.abs(rheostat.current)
    expect(weak).toBeGreaterThan(0.1)
    expect(strong).toBeGreaterThan(weak * 5)
  })
})
