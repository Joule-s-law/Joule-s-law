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
import { PhotonScreenComponent } from '../behaviors/PhotonScreenComponent'
import type { PhotonPropagation } from '../behaviors/PhotonScreenComponent'
import { ElectronGunComponent } from '../behaviors/ElectronGunComponent'
import { ClutchComponent } from '../behaviors/ClutchComponent'
import { FreeTerminalComponent } from '../behaviors/FreeTerminalComponent'
import { SteamEngineComponent } from '../behaviors/SteamEngineComponent'
import { MotorComponent } from '../behaviors/MotorComponent'
import { PipeComponent } from '../behaviors/PipeComponent'
import { TankComponent } from '../behaviors/TankComponent'
import { CondenserComponent } from '../behaviors/CondenserComponent'
import { FissionReactorComponent } from '../behaviors/FissionReactorComponent'
import { WaterPumpComponent } from '../behaviors/WaterPumpComponent'
import { ALL_DEFS } from './definitions'

export interface ComponentCreateOptions {
  wireMaterialId?: string
  wireLength?: number
  wireAnchorA?: { x: number; y: number }
  wireAnchorB?: { x: number; y: number }
  wireControlPointA?: { x: number; y: number }
  wireControlPointB?: { x: number; y: number }
  batteryStateOfCharge?: number
  batteryCell?: { pairIndex: number; electrolyteIndex: number; membrane: 'none' | 'cation' | 'anion'; flipped: boolean }
  switchClosed?: boolean
  fourthGenUuid?: string
  fourthGenName?: string
  electronGunAngle?: number
  electronGunSpeed?: number
  photonPropagation?: PhotonPropagation
  terminalX?: number
  terminalY?: number
  tankFluidId?: string | null
  tankAmount?: number
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
    case 'motor':
      return new MotorComponent(def)
    case 'steamSource':
      return new SteamEngineComponent(def)
    case 'steamTurbine':
      return new TurbineComponent(def)
    case 'pipe':
      return new PipeComponent(def)
    case 'tank': {
      const tank = new TankComponent(def)
      if (options?.tankFluidId !== undefined && options.tankFluidId !== null) tank.storedFluidId = options.tankFluidId
      if (options?.tankAmount !== undefined) tank.storedAmount = options.tankAmount
      return tank
    }
    case 'condenser':
      return new CondenserComponent(def)
    case 'fissionReactor':
      return new FissionReactorComponent(def)
    case 'waterPump':
      return new WaterPumpComponent(def)
    case 'battery':
      return new BatteryComponent(def, options?.batteryStateOfCharge, options?.batteryCell)
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
    case 'photonScreen': {
      const screen = new PhotonScreenComponent(def)
      if (options?.photonPropagation !== undefined) screen.propagation = options.photonPropagation
      return screen
    }
    case 'electronGun': {
      const gun = new ElectronGunComponent(def)
      if (options?.electronGunAngle !== undefined) gun.aimAngle = options.electronGunAngle
      if (options?.electronGunSpeed !== undefined) gun.launchSpeed = options.electronGunSpeed
      return gun
    }
    case 'clutch':
      return new ClutchComponent(def)
    case 'freeTerminal': {
      const terminal = new FreeTerminalComponent(def)
      if (options?.terminalX !== undefined && options?.terminalY !== undefined) {
        terminal.setFreePosition(options.terminalX, options.terminalY)
      }
      return terminal
    }
    case 'chainDrive':
      throw new Error('chain drive must be created with explicit gears via ChainDriveComponent constructor')
  }
}

export function createComponentById(id: string, options?: ComponentCreateOptions): BaseComponent {
  const def = COMPONENT_DEFS.get(id)
  if (def === undefined) throw new Error(`unknown component definition: ${id}`)
  return createComponent(def, options)
}
