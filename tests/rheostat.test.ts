import { describe, expect, it } from 'vitest'
import { createComponent } from '../src/core/components/registry/componentRegistry'
import { HAND_CRANK, RHEOSTAT } from '../src/core/components/registry/definitions'
import { RheostatComponent } from '../src/core/components/behaviors/RheostatComponent'
import { VoltageSourceComponent } from '../src/core/components/behaviors/VoltageSourceComponent'
import { Simulation } from '../src/core/sim/Simulation'

function buildRheostatLoop(): { sim: Simulation; source: VoltageSourceComponent; rheostat: RheostatComponent } {
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
  return { sim, source, rheostat }
}

describe('rheostat', () => {
  it('clamps slider position to [0, 1]', () => {
    const rheostat = createComponent(RHEOSTAT) as RheostatComponent
    rheostat.setSliderPosition(5)
    expect(rheostat.sliderPosition).toBe(1)
    rheostat.setSliderPosition(-2)
    expect(rheostat.sliderPosition).toBe(0)
    rheostat.setSliderPosition(0.5)
    expect(rheostat.sliderPosition).toBe(0.5)
  })

  it('one bottom + one top terminal gives slider-dependent resistance', () => {
    const { sim, source, rheostat } = buildRheostatLoop()
    sim.connect(source.getPort(0), rheostat.getPort(0))
    sim.connect(source.getPort(1), rheostat.getPort(2))
    rheostat.setSliderPosition(1)
    sim.tick()
    expect(Math.abs(rheostat.current)).toBeCloseTo(10 / 53, 6)
    rheostat.setSliderPosition(0.5)
    sim.tick()
    expect(Math.abs(rheostat.current)).toBeCloseTo(10 / 28, 6)
    expect(rheostat.getResistance()).toBeCloseTo(25, 6)
  })

  it('both bottom terminals always give the full wire resistance', () => {
    const { sim, source, rheostat } = buildRheostatLoop()
    sim.connect(source.getPort(0), rheostat.getPort(2))
    sim.connect(source.getPort(1), rheostat.getPort(3))
    rheostat.setSliderPosition(0.2)
    sim.tick()
    expect(Math.abs(rheostat.current)).toBeCloseTo(10 / 53.01, 5)
    rheostat.setSliderPosition(0.8)
    sim.tick()
    expect(Math.abs(rheostat.current)).toBeCloseTo(10 / 53.01, 5)
    expect(rheostat.getResistance()).toBeCloseTo(50.01, 3)
  })

  it('both top terminals are shorted by the metal rod', () => {
    const { sim, source, rheostat } = buildRheostatLoop()
    sim.connect(source.getPort(0), rheostat.getPort(0))
    sim.connect(source.getPort(1), rheostat.getPort(1))
    rheostat.setSliderPosition(0.5)
    sim.tick()
    expect(Math.abs(rheostat.current)).toBeCloseTo(10 / 3.01, 4)
  })
})
