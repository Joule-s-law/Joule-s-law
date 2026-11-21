import type { ComponentDefinition } from '../../ComponentDefinition'
import { HAND_CRANK } from './hand_crank'
import { RESISTOR } from './resistor'
import { WIRE } from './wire'
import { FUSE } from './fuse'
import { SWITCH } from './switch'
import { LAMP } from './lamp'
import { BUZZER } from './buzzer'
import { BATTERY_PACK } from './battery_pack'
import { MOTOR } from './motor'
import { STEAM_ENGINE } from './steam_engine'
import { TURBINE } from './turbine'
import { SECONDARY_BATTERY } from './secondary_battery'
import { PHOTOCELL } from './photocell'
import { MICROPHONE } from './microphone'
import { COIL } from './coil'
import { INDUCTION_COIL } from './induction_coil'
import { GEAR_GROUP } from './gear_group'
import { BIG_GEAR } from './big_gear'
import { CHAIN_DRIVE } from './chain_drive'
import { DIODE } from './diode'
import { RHEOSTAT } from './rheostat'
import { AMMETER } from './ammeter'
import { VOLTMETER } from './voltmeter'
import { VOLTAGE_DOUBLER, VOLTAGE_HALVER } from './voltage_transformer'
import { FOURTH_GENERATOR } from './fourth_generator'
import { PHOTON_SCREEN } from './photon_screen'
import { ELECTRON_GUN } from './electron_gun'
import { CLUTCH, FLYWHEEL } from './clutch'
import { FREE_TERMINAL } from './free_terminal'
import { PIPE, TANK, CONDENSER, FISSION_REACTOR, WATER_PUMP } from './fluid_components'

export const ALL_DEFS: ComponentDefinition[] = [
  HAND_CRANK,
  RESISTOR,
  WIRE,
  FUSE,
  SWITCH,
  DIODE,
  LAMP,
  BUZZER,
  BATTERY_PACK,
  MOTOR,
  STEAM_ENGINE,
  TURBINE,
  SECONDARY_BATTERY,
  PHOTOCELL,
  MICROPHONE,
  COIL,
  INDUCTION_COIL,
  GEAR_GROUP,
  BIG_GEAR,
  CHAIN_DRIVE,
  RHEOSTAT,
  AMMETER,
  VOLTMETER,
  VOLTAGE_DOUBLER,
  VOLTAGE_HALVER,
  FOURTH_GENERATOR,
  PHOTON_SCREEN,
  ELECTRON_GUN,
  CLUTCH,
  FLYWHEEL,
  FREE_TERMINAL,
  PIPE,
  TANK,
  CONDENSER,
  FISSION_REACTOR,
  WATER_PUMP,
]

const COMPONENT_LABELS: Record<string, string[]> = {
  hand_crank: ['电磁感应', '机械传动'],
  resistor: ['焦耳热'],
  wire: ['低电阻'],
  fuse: ['焦耳热'],
  switch: ['通断'],
  diode: ['半导体'],
  lamp: ['焦耳热', '热辐射'],
  buzzer: ['声波', '电磁感应'],
  battery_pack: ['电化学'],
  motor: ['磁场力', '机械传动'],
  steam_engine: ['热机', '机械传动'],
  turbine: ['动能冲击', '机械传动'],
  secondary_battery: ['电化学', '可充电'],
  photocell: ['光电效应'],
  microphone: ['声波', '电磁感应'],
  coil: ['电流磁效应'],
  induction_coil: ['电磁感应'],
  gear_group: ['机械传动'],
  big_gear: ['机械传动'],
  chain_drive: ['机械传动'],
  rheostat: ['欧姆定律', '焦耳热'],
  ammeter: ['测量'],
  voltmeter: ['测量'],
  voltage_doubler: ['电磁感应'],
  voltage_halver: ['电磁感应'],
  fourth_generator: ['打破第四面墙'],
  photon_screen: ['光电效应'],
  electron_gun: ['电子发射'],
  clutch: ['机械传动', '电磁吸合'],
  flywheel: ['机械传动', '惯性储能'],
  free_terminal: ['接线'],
  pipe: ['流体系统'],
  tank: ['流体系统', '储存'],
  condenser: ['流体系统', '凝结'],
  water_pump: ['流体系统', '泵'],
  fission_reactor: ['核物理', '热机'],
}

for (const def of ALL_DEFS) {
  def.labels = COMPONENT_LABELS[def.id] ?? []
}

export {
  HAND_CRANK,
  RESISTOR,
  WIRE,
  FUSE,
  SWITCH,
  DIODE,
  LAMP,
  BUZZER,
  BATTERY_PACK,
  MOTOR,
  STEAM_ENGINE,
  TURBINE,
  SECONDARY_BATTERY,
  PHOTOCELL,
  MICROPHONE,
  COIL,
  INDUCTION_COIL,
  GEAR_GROUP,
  BIG_GEAR,
  CHAIN_DRIVE,
  RHEOSTAT,
  AMMETER,
  VOLTMETER,
  VOLTAGE_DOUBLER,
  VOLTAGE_HALVER,
  FOURTH_GENERATOR,
  PHOTON_SCREEN,
  ELECTRON_GUN,
  CLUTCH,
  FLYWHEEL,
  FREE_TERMINAL,
  PIPE,
  TANK,
  CONDENSER,
  FISSION_REACTOR,
  WATER_PUMP,
}
