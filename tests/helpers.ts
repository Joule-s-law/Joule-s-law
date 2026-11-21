﻿﻿﻿import { Simulation } from '../src/core/sim/Simulation'
import {
  HAND_CRANK,
  RESISTOR,
  WIRE,
  SWITCH,
  LAMP,
  PHOTOCELL,
  MOTOR,
  GEAR_GROUP,
  SECONDARY_BATTERY,
} from '../src/core/components/registry/definitions'
import type { ComponentDefinition } from '../src/core/components/ComponentDefinition'
import { createComponent } from '../src/core/components/registry/componentRegistry'
import { VoltageSourceComponent } from '../src/core/components/behaviors/VoltageSourceComponent'
import { ResistiveComponent } from '../src/core/components/behaviors/ResistiveComponent'
import { WireComponent } from '../src/core/components/behaviors/WireComponent'
import { SwitchComponent } from '../src/core/components/behaviors/SwitchComponent'
import { ConverterComponent } from '../src/core/components/behaviors/ConverterComponent'
import { BatteryComponent } from '../src/core/components/behaviors/BatteryComponent'
import { FieldSensorComponent } from '../src/core/components/behaviors/FieldSensorComponent'
import { MotorComponent } from '../src/core/components/behaviors/MotorComponent'
import { GearComponent } from '../src/core/components/behaviors/GearComponent'

export interface LoopFixture {
  sim: Simulation
  source: VoltageSourceComponent
  load: ResistiveComponent
  wire: WireComponent | null
}

export interface SeriesLoopFixture {
  sim: Simulation
  source: VoltageSourceComponent
  load: ResistiveComponent
  wire: WireComponent
}

export interface ParallelFixture {
  sim: Simulation
  source: VoltageSourceComponent
  loadA: ResistiveComponent
  loadB: ResistiveComponent
}

function expectType<T extends BaseComponentLike>(component: unknown, guard: (c: unknown) => c is T, message: string): T {
  if (!guard(component)) throw new Error(message)
  return component
}

interface BaseComponentLike {
  def: { id: string }
}

function isVoltageSource(c: unknown): c is VoltageSourceComponent {
  return (c as BaseComponentLike).def?.id !== undefined && (c as VoltageSourceComponent).buildCircuitModel !== undefined && (c as VoltageSourceComponent).getResistance !== undefined && (c as { constructor: { name: string } }).constructor.name === 'VoltageSourceComponent'
}

function isResistive(c: unknown): c is ResistiveComponent {
  return (c as { constructor: { name: string } }).constructor?.name === 'ResistiveComponent'
}

function isWire(c: unknown): c is WireComponent {
  return (c as { constructor: { name: string } }).constructor?.name === 'WireComponent'
}

export function buildSimpleLoop(): LoopFixture {
  const sim = new Simulation()
  const source = expectType(createComponent(HAND_CRANK), isVoltageSource, 'expected voltage source')
  const load = expectType(createComponent(RESISTOR), isResistive, 'expected resistive')
  source.rotationSpeed = Math.PI * 2
  source.rotationDrive = 1
  source.x = 0
  source.y = 0
  load.x = 2
  load.y = 0
  sim.addComponent(source)
  sim.addComponent(load)
  sim.connect(source.getPort(0), load.getPort(1))
  sim.connect(source.getPort(1), load.getPort(0))
  return { sim, source, load, wire: null }
}

export function buildSeriesLoop(wireMaterialId: string): SeriesLoopFixture {
  const sim = new Simulation()
  const source = expectType(createComponent(HAND_CRANK), isVoltageSource, 'expected voltage source')
  const wire = expectType(createComponent(WIRE, { wireMaterialId, wireLength: 1 }), isWire, 'expected wire')
  const load = expectType(createComponent(RESISTOR), isResistive, 'expected resistive')
  source.rotationSpeed = Math.PI * 2
  source.rotationDrive = 1
  source.x = 0
  source.y = 0
  wire.x = 2
  wire.y = 0
  load.x = 4
  load.y = 0
  sim.addComponent(source)
  sim.addComponent(wire)
  sim.addComponent(load)
  sim.connect(source.getPort(0), wire.getPort(0))
  sim.connect(wire.getPort(1), load.getPort(1))
  sim.connect(source.getPort(1), load.getPort(0))
  return { sim, source, load, wire }
}

export function buildParallel(): ParallelFixture {
  const sim = new Simulation()
  const source = expectType(createComponent(HAND_CRANK), isVoltageSource, 'expected voltage source')
  const loadA = expectType(createComponent(RESISTOR), isResistive, 'expected resistive')
  const loadB = expectType(createComponent(RESISTOR), isResistive, 'expected resistive')
  source.rotationSpeed = Math.PI * 2
  source.rotationDrive = 1
  source.x = 0
  source.y = 0
  loadA.x = 2
  loadA.y = 0
  loadB.x = 2
  loadB.y = 2
  sim.addComponent(source)
  sim.addComponent(loadA)
  sim.addComponent(loadB)
  sim.connect(source.getPort(0), loadA.getPort(1))
  sim.connect(source.getPort(0), loadB.getPort(1))
  sim.connect(source.getPort(1), loadA.getPort(0))
  sim.connect(source.getPort(1), loadB.getPort(0))
  return { sim, source, loadA, loadB }
}

export function buildSwitchLoop(closed: boolean): { sim: Simulation; source: VoltageSourceComponent; sw: SwitchComponent; load: ResistiveComponent } {
  const sim = new Simulation()
  const source = expectType(createComponent(HAND_CRANK), isVoltageSource, 'expected voltage source')
  const sw = expectType(createComponent(SWITCH, { switchClosed: closed }), isSwitch, 'expected switch')
  const load = expectType(createComponent(RESISTOR), isResistive, 'expected resistive')
  source.rotationSpeed = Math.PI * 2
  source.rotationDrive = 1
  source.x = 0
  source.y = 0
  sw.x = 2
  sw.y = 0
  load.x = 4
  load.y = 0
  sim.addComponent(source)
  sim.addComponent(sw)
  sim.addComponent(load)
  sim.connect(source.getPort(0), sw.getPort(0))
  sim.connect(sw.getPort(1), load.getPort(1))
  sim.connect(source.getPort(1), load.getPort(0))
  return { sim, source, sw, load }
}

function isSwitch(c: unknown): c is SwitchComponent {
  return (c as { constructor: { name: string } }).constructor?.name === 'SwitchComponent'
}

function isConverter(c: unknown): c is ConverterComponent {
  return (c as { constructor: { name: string } }).constructor?.name === 'ConverterComponent'
}

function isBattery(c: unknown): c is BatteryComponent {
  return (c as { constructor: { name: string } }).constructor?.name === 'BatteryComponent'
}

function isSensor(c: unknown): c is FieldSensorComponent {
  return (c as { constructor: { name: string } }).constructor?.name === 'FieldSensorComponent'
}

function isMotor(c: unknown): c is MotorComponent {
  return (c as { constructor: { name: string } }).constructor?.name === 'MotorComponent'
}

function isGear(c: unknown): c is GearComponent {
  return (c as { constructor: { name: string } }).constructor?.name === 'GearComponent'
}

export function buildConverterLoop(defId: string): { sim: Simulation; source: VoltageSourceComponent; converter: ConverterComponent } {
  const sim = new Simulation()
  const def: ComponentDefinition = {
    id: defId,
    displayName: 'TestConverter',
    description: '',
    price: 120,
    priceScaling: 1.1,
    portCount: 2,
    resistance: 15,
    ratedCurrent: 3,
    behaviorId: 'converter',
    behaviorParams: { efficiency: 0.8 },
    behaviorTags: { outputMode: 'income', outputForm: 'chemical' },
  }
  const source = expectType(createComponent(HAND_CRANK), isVoltageSource, 'expected voltage source')
  const converter = expectType(createComponent(def), isConverter, 'expected converter')
  source.rotationSpeed = Math.PI * 2
  source.rotationDrive = 1
  source.x = 0
  source.y = 0
  converter.x = 2
  converter.y = 0
  sim.addComponent(source)
  sim.addComponent(converter)
  sim.connect(source.getPort(0), converter.getPort(1))
  sim.connect(source.getPort(1), converter.getPort(0))
  return { sim, source, converter }
}

export function buildBatteryLoop(): { sim: Simulation; battery: BatteryComponent; load: ResistiveComponent } {
  const sim = new Simulation()
  const battery = expectType(createComponent(SECONDARY_BATTERY), isBattery, 'expected battery')
  const load = expectType(createComponent(RESISTOR), isResistive, 'expected resistive')
  battery.x = 0
  battery.y = 0
  load.x = 2
  load.y = 0
  sim.addComponent(battery)
  sim.addComponent(load)
  sim.connect(battery.getPort(0), load.getPort(1))
  sim.connect(battery.getPort(1), load.getPort(0))
  return { sim, battery, load }
}

export function buildFieldPair(): { sim: Simulation; lamp: ResistiveComponent; sensor: FieldSensorComponent; sensorLoad: ResistiveComponent } {
  const sim = new Simulation()
  const source = expectType(createComponent(HAND_CRANK), isVoltageSource, 'expected voltage source')
  const lamp = expectType(createComponent(LAMP), isResistive, 'expected lamp')
  const sensor = expectType(createComponent(PHOTOCELL), isSensor, 'expected sensor')
  const sensorLoad = expectType(createComponent(RESISTOR), isResistive, 'expected resistive')
  source.rotationSpeed = Math.PI * 2
  source.rotationDrive = 1
  source.x = 0
  source.y = 0
  lamp.x = 1
  lamp.y = 0
  sensor.x = 4
  sensor.y = 0
  sensorLoad.x = 5
  sensorLoad.y = 0
  sim.addComponent(source)
  sim.addComponent(lamp)
  sim.connect(source.getPort(0), lamp.getPort(1))
  sim.connect(source.getPort(1), lamp.getPort(0))
  sim.addComponent(sensor)
  sim.addComponent(sensorLoad)
  sim.connect(sensor.getPort(0), sensorLoad.getPort(1))
  sim.connect(sensor.getPort(1), sensorLoad.getPort(0))
  return { sim, lamp, sensor, sensorLoad }
}

export function buildMotorPair(): { sim: Simulation; motor: MotorComponent; gear: GearComponent } {
  const sim = new Simulation()
  const source = expectType(createComponent(HAND_CRANK), isVoltageSource, 'expected voltage source')
  const motor = expectType(createComponent(MOTOR), isMotor, 'expected motor')
  const gearDef: ComponentDefinition = { ...GEAR_GROUP, behaviorParams: { teeth: 8, maxOmega: Math.PI * 12, damping: 0.2 } }
  const gear = expectType(createComponent(gearDef), isGear, 'expected gear')
  source.rotationSpeed = Math.PI * 2
  source.rotationDrive = 1
  source.x = 0
  source.y = 0
  motor.x = 2
  motor.y = 0
  gear.x = 3
  gear.y = 0
  sim.addComponent(source)
  sim.addComponent(motor)
  sim.connect(source.getPort(0), motor.getPort(1))
  sim.connect(source.getPort(1), motor.getPort(0))
  sim.addComponent(gear)
  return { sim, motor, gear }
}

export function buildOverloadLoop(): { sim: Simulation; source: VoltageSourceComponent; victim: ResistiveComponent } {
  const sim = new Simulation()
  const source = expectType(createComponent(HAND_CRANK), isVoltageSource, 'expected voltage source')
  const victim = expectType(createComponent({ ...RESISTOR, id: 'test_victim', ratedCurrent: 0.4 }), isResistive, 'expected resistive')
  source.rotationSpeed = Math.PI * 2
  source.rotationDrive = 1
  source.x = 0
  source.y = 0
  victim.x = 2
  victim.y = 0
  sim.addComponent(source)
  sim.addComponent(victim)
  sim.connect(source.getPort(0), victim.getPort(1))
  sim.connect(source.getPort(1), victim.getPort(0))
  return { sim, source, victim }
}


