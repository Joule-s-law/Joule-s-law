import { describe, expect, it } from 'vitest'
import { Simulation } from '../src/core/sim/Simulation'
import { createComponentById } from '../src/core/components/registry/componentRegistry'
import { fluidCompatible, buoyancyVelocity, getFluid } from '../src/core/fluids/fluids'
import { VoltageSourceComponent } from '../src/core/components/behaviors/VoltageSourceComponent'
import { SteamEngineComponent } from '../src/core/components/behaviors/SteamEngineComponent'
import { TurbineComponent } from '../src/core/components/behaviors/TurbineComponent'
import { TankComponent } from '../src/core/components/behaviors/TankComponent'
import { FissionReactorComponent } from '../src/core/components/behaviors/FissionReactorComponent'
import { WaterPumpComponent } from '../src/core/components/behaviors/WaterPumpComponent'
import { terrainTypeAt } from '../src/core/world/terrain'
import { ResistiveComponent } from '../src/core/components/behaviors/ResistiveComponent'

function addPipe(sim: Simulation, x: number, y: number) {
  const pipe = createComponentById('pipe')
  pipe.x = x
  pipe.y = y
  sim.addComponent(pipe)
  return pipe
}

describe('fluids', () => {
  it('fluid rules: gas rises, liquid sinks, viscosity slows both', () => {
    const steam = getFluid('steam')
    const water = getFluid('water')
    expect(buoyancyVelocity(steam)).toBeLessThan(0)
    expect(buoyancyVelocity(water)).toBeGreaterThan(0)
    const thickWater = { ...water, viscosity: 0.9 }
    expect(Math.abs(buoyancyVelocity(thickWater))).toBeLessThan(Math.abs(buoyancyVelocity(water)))
    const denseWater = { ...water, density: 120 }
    expect(buoyancyVelocity(denseWater)).toBeGreaterThan(buoyancyVelocity(water))
    const denseGas = { ...steam, density: 0.9 }
    expect(buoyancyVelocity(denseGas)).toBeCloseTo(buoyancyVelocity(steam), 6)
  })

  it('fluidCompatible rejects mixed fluids', () => {
    expect(fluidCompatible(null, 'steam')).toBe(true)
    expect(fluidCompatible('steam', 'steam')).toBe(true)
    expect(fluidCompatible('steam', 'water')).toBe(false)
  })

  it('adjacent pipes merge into one network; a network carries a single fluid', () => {
    const sim = new Simulation()
    const a = addPipe(sim, 0, 0)
    const b = addPipe(sim, 1, 0)
    const far = addPipe(sim, 6, 6)
    expect(sim.pipeSystem.networkOf(a)).toBe(sim.pipeSystem.networkOf(b))
    expect(sim.pipeSystem.networkOf(far)).not.toBe(sim.pipeSystem.networkOf(a))
    expect(sim.pipeSystem.pushFluid(a, 'steam', 5)).toBe(5)
    expect(sim.pipeSystem.pushFluid(a, 'water', 5)).toBe(0)
    expect(sim.pipeSystem.networkOf(a)?.fluidId).toBe('steam')
    expect(sim.pipeSystem.pullFluid(b, 3)).toEqual({ fluidId: 'steam', amount: 3 })
    sim.removeComponent(b)
    expect(sim.pipeSystem.networkOf(a)).not.toBeNull()
    expect(sim.pipeSystem.pipeAt(1, 0)).toBeNull()
  })

  it('fission reactor converts water to steam through its four interfaces', () => {
    const sim = new Simulation()
    const reactor = createComponentById('fission_reactor') as FissionReactorComponent
    reactor.x = 0
    reactor.y = 0
    sim.addComponent(reactor)
    const waterPipe = addPipe(sim, 1, -1)
    const waterPipe2 = addPipe(sim, 3, -1)
    const steamPipe = addPipe(sim, 1, 3)
    sim.pipeSystem.pushFluid(waterPipe, 'water', 500)
    sim.pipeSystem.pushFluid(waterPipe2, 'water', 500)
    reactor.running = true
    reactor.controlRatio = 0
    for (let i = 0; i < 150; i++) sim.tick()
    const steam = sim.pipeSystem.networkOf(steamPipe)
    expect(steam?.fluidId).toBe('steam')
    expect(steam?.volume).toBeGreaterThan(3)
    expect(sim.pipeSystem.networkOf(waterPipe)?.volume).toBeLessThan(500)
    expect(reactor.reactorPower).toBeGreaterThan(0.99)
    expect(reactor.coreTempK).toBeGreaterThan(1700)
    expect(reactor.coreTempK).toBeLessThan(reactor.meltdownTemp)
  })

  it('reactor meltdown destroys components in radius and contaminates the zone', () => {
    const sim = new Simulation()
    const reactor = createComponentById('fission_reactor') as FissionReactorComponent
    reactor.x = 0
    reactor.y = 0
    sim.addComponent(reactor)
    const victim = createComponentById('resistor')
    victim.x = 5
    victim.y = 0
    sim.addComponent(victim)
    const survivor = createComponentById('resistor')
    survivor.x = 5000
    survivor.y = 0
    sim.addComponent(survivor)
    reactor.running = true
    reactor.controlRatio = 0
    reactor.reactorPower = 1
    reactor.coreTempK = 3100
    for (let i = 0; i < 20; i++) sim.tick()
    expect(reactor.melted).toBe(true)
    expect(sim.components).not.toContain(victim)
    expect(sim.components).not.toContain(reactor)
    expect(sim.components).toContain(survivor)
    expect(sim.contaminationZone).not.toBeNull()
    expect(sim.incomeFactorAt(victim.x, victim.y)).toBe(0.25)
    expect(sim.workFactorAt(victim.x, victim.y)).toBe(0.1)
    expect(sim.incomeFactorAt(survivor.x, survivor.y)).toBe(1)
  })

  it('water pump supplies water only on water terrain, flow scales with power', () => {
    let waterX = 0
    let waterY = 0
    let landX = 0
    let landY = 0
    let found = false
    for (let seed = 1; seed < 200 && !found; seed++) {
      let water = false
      let land = false
      for (let x = -100; x < 100 && !(water && land); x += 2) {
        for (let y = -100; y < 100 && !(water && land); y += 2) {
          const type = terrainTypeAt(seed, x, y)
          if (!water && (type === 'ocean' || type === 'lake')) {
            waterX = x
            waterY = y
            water = true
          }
          if (!land && type === 'grass') {
            landX = x
            landY = y
            land = true
          }
        }
      }
      found = water && land
    }
    expect(found).toBe(true)
    const sim = new Simulation()
    sim.terrainSeed = 1
    const pump = createComponentById('water_pump') as WaterPumpComponent
    pump.x = waterX
    pump.y = waterY
    sim.addComponent(pump)
    const crank = createComponentById('hand_crank') as VoltageSourceComponent
    crank.rotationSpeed = Math.PI * 2
    crank.rotationDrive = 1
    crank.x = waterX + 10
    crank.y = waterY
    sim.addComponent(crank)
    sim.connect(crank.getPort(0), pump.getPort(1))
    sim.connect(crank.getPort(1), pump.getPort(0))
    for (let i = 0; i < 5; i++) sim.tick()
    expect(Math.abs(pump.current)).toBeGreaterThan(0)
    expect(pump.onWater).toBe(true)
    const drainPipe = addPipe(sim, waterX + 1, waterY)
    for (let i = 0; i < 3; i++) sim.tick()
    const network = sim.pipeSystem.networkOf(drainPipe)
    expect(network?.fluidId).toBe('water')
    expect(network?.volume).toBeGreaterThan(0)
    pump.x = landX
    pump.y = landY
    expect(pump.onWater).toBe(false)
    expect(pump.provideFluid(100)).toBeNull()
  })

  it('steam engine pushes steam through pipes and turbine converts it to emf', () => {
    const sim = new Simulation()
    const crank = createComponentById('hand_crank') as VoltageSourceComponent
    crank.rotationSpeed = Math.PI * 2
    crank.rotationDrive = 1
    crank.x = 0
    crank.y = 2
    const engine = createComponentById('steam_engine') as SteamEngineComponent
    engine.x = 2
    engine.y = 2
    const turbine = createComponentById('turbine') as TurbineComponent
    turbine.x = 8
    turbine.y = 2
    const load = createComponentById('resistor') as ResistiveComponent
    load.x = 10
    load.y = 2
    sim.addComponent(crank)
    sim.addComponent(engine)
    sim.addComponent(turbine)
    sim.addComponent(load)
    for (let x = 3; x <= 7; x++) addPipe(sim, x, 2)
    sim.connect(crank.getPort(0), engine.getPort(0))
    sim.connect(engine.getPort(1), crank.getPort(1))
    sim.connect(turbine.getPort(0), load.getPort(0))
    sim.connect(load.getPort(1), turbine.getPort(1))
    for (let i = 0; i < 80; i++) {
      sim.tick()
      sim.drainFluidEmissions()
    }
    expect(Math.abs(turbine.current)).toBeGreaterThan(0.005)
    expect(turbine.steamPower).toBeGreaterThan(0.02)
    expect(Math.abs(load.voltage)).toBeGreaterThan(0.1)
  })

  it('tank stores one fluid and refuses to mix', () => {
    const sim = new Simulation()
    const supply = addPipe(sim, 0, 0)
    const bridge = addPipe(sim, 1, 0)
    const tank = createComponentById('tank') as TankComponent
    tank.x = 2
    tank.y = 0
    sim.addComponent(tank)
    expect(sim.pipeSystem.pushFluid(supply, 'steam', 20)).toBe(20)
    for (let i = 0; i < 60; i++) sim.tick()
    expect(tank.storedFluidId).toBe('steam')
    expect(tank.storedAmount).toBeGreaterThan(0)
    const other = addPipe(sim, 2, -1)
    expect(sim.pipeSystem.pushFluid(other, 'water', 10)).toBe(10)
    for (let i = 0; i < 30; i++) sim.tick()
    expect(tank.storedFluidId).toBe('steam')
    expect(tank.storedAmount).toBeGreaterThan(0)
    expect(sim.pipeSystem.networkOf(bridge)?.fluidId).toBe('steam')
    expect(sim.pipeSystem.networkOf(other)?.fluidId).toBe('water')
  })

  it('component-component interfaces connect without pipes', () => {
    const sim = new Simulation()
    const crank = createComponentById('hand_crank') as VoltageSourceComponent
    crank.rotationSpeed = Math.PI * 2
    crank.rotationDrive = 1
    crank.x = 0
    crank.y = 0
    const engine = createComponentById('steam_engine') as SteamEngineComponent
    engine.x = 2
    engine.y = 0
    const turbine = createComponentById('turbine') as TurbineComponent
    turbine.x = 3
    turbine.y = 0
    const load = createComponentById('resistor') as ResistiveComponent
    load.x = 5
    load.y = 0
    sim.addComponent(crank)
    sim.addComponent(engine)
    sim.addComponent(turbine)
    sim.addComponent(load)
    sim.connect(crank.getPort(0), engine.getPort(0))
    sim.connect(engine.getPort(1), crank.getPort(1))
    sim.connect(turbine.getPort(0), load.getPort(0))
    sim.connect(load.getPort(1), turbine.getPort(1))
    for (let i = 0; i < 80; i++) {
      sim.tick()
      sim.drainFluidEmissions()
    }
    expect(turbine.steamPower).toBeGreaterThan(0.02)
    expect(Math.abs(turbine.current)).toBeGreaterThan(0.005)
  })
})
