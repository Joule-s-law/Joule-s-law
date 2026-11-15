import type { EnergyLedger } from '../energy/EnergyLedger'
import { EnergyType } from '../energy/EnergyType'
import type { BaseComponent } from '../components/BaseComponent'

export interface SimulationHost {
  kineticPool: number
  converterEfficiencyBoost: number
  sensorEfficiencyBoost: number
  lightEmissionBoost: number
  gearBreakdownChance: number
  gearMaxOmegaBonus: number
  emitEnergy(type: EnergyType, amount: number, x: number, y: number): void
  requestDestroy(component: BaseComponent): void
}

export interface TickContext {
  dt: number
  simTime: number
  ledger: EnergyLedger
  host: SimulationHost
}
