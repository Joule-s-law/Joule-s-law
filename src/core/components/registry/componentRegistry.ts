import type { ComponentDefinition } from '../ComponentDefinition'
import { BaseComponent } from '../BaseComponent'
import { VoltageSourceComponent } from '../behaviors/VoltageSourceComponent'
import { ResistiveComponent } from '../behaviors/ResistiveComponent'
import { WireComponent } from '../behaviors/WireComponent'
import { ConverterComponent } from '../behaviors/ConverterComponent'
import { TurbineComponent } from '../behaviors/TurbineComponent'
import { BatteryComponent } from '../behaviors/BatteryComponent'
import { SwitchComponent } from '../behaviors/SwitchComponent'
import { FieldSensorComponent } from '../behaviors/FieldSensorComponent'
import { GearComponent } from '../behaviors/GearComponent'
import { DiodeComponent } from '../behaviors/DiodeComponent'
import { RheostatComponent } from '../behaviors/RheostatComponent'
import { VoltageTransformerComponent } from '../behaviors/VoltageTransformerComponent'
import { FourthGeneratorComponent } from '../behaviors/FourthGeneratorComponent'
import { ALL_DEFS } from './definitions'

export interface ComponentCreateOptions {
  wireMaterialId?: string
  wireLength?: number
  wireAnchorA?: { x: number; y: number }
  wireAnchorB?: { x: number; y: number }
  wireControlPointA?: { x: number; y: number }
  wireControlPointB?: { x: number; y: number }
  batteryStateOfCharge?: number
  switchClosed?: boolean
  fourthGenUuid?: string
  fourthGenName?: string
}

export const COMPONENT_DEFS: ReadonlyMap<string, ComponentDefinition> = new Map(
  ALL_DEFS.map((def) => [def.id, def]),
)

export function createComponent(def: ComponentDefinition, options?: ComponentCreateOptions): BaseComponent {
  switch (def.behaviorId) {
    case 'voltageSource':
      return new VoltageSourceComponent(def)
    case 'resistive':
      return new ResistiveComponent(def)
    case 'wire':
      return new WireComponent(def, {
        materialId: options?.wireMaterialId,
        length: options?.wireLength,
        anchorA: options?.wireAnchorA,
        anchorB: options?.wireAnchorB,
        controlPointA: options?.wireControlPointA,
        controlPointB: options?.wireControlPointB,
      })
    case 'converter':
      return new ConverterComponent(def)
    case 'turbine':
      return new TurbineComponent(def)
    case 'battery':
      return new BatteryComponent(def, options?.batteryStateOfCharge)
    case 'switch':
      return new SwitchComponent(def, options?.switchClosed)
    case 'fieldSensor':
      return new FieldSensorComponent(def)
    case 'gear':
      return new GearComponent(def)
    case 'diode':
      return new DiodeComponent(def)
    case 'rheostat':
      return new RheostatComponent(def)
    case 'voltageTransformer':
      return new VoltageTransformerComponent(def)
    case 'fourthGenerator':
      return new FourthGeneratorComponent(def, {
        uuid: options?.fourthGenUuid,
        customName: options?.fourthGenName,
      })
    case 'chainDrive':
      throw new Error('chain drive must be created with explicit gears via ChainDriveComponent constructor')
  }
}

export function createComponentById(id: string, options?: ComponentCreateOptions): BaseComponent {
  const def = COMPONENT_DEFS.get(id)
  if (def === undefined) throw new Error(`unknown component definition: ${id}`)
  return createComponent(def, options)
}
