import type { EnergyLedger } from '../energy/EnergyLedger'
import { EnergyType } from '../energy/EnergyType'
import type { BaseComponent } from '../components/BaseComponent'
import type { PipeComponent } from '../components/behaviors/PipeComponent'
import type { FluidNeighbor } from '../fluids/fluidInterface'

export interface SimulationHost {
  readonly components: readonly BaseComponent[]
  converterEfficiencyBoost: number
  sensorEfficiencyBoost: number
  lightEmissionBoost: number
  gearBreakdownChance: number
  gearMaxOmegaBonus: number
  ratedCurrentBoost: number
  emitEnergy(type: EnergyType, amount: number, x: number, y: number): void
  emitElectron(x: number, y: number, vx: number, vy: number): void
  emitFluid(x: number, y: number, fluidId: string, vx: number, vy: number, count: number): void
  fluidLinksOf(component: BaseComponent): FluidNeighbor[]
  pipeNetworkId(pipe: PipeComponent): number | null
  pushPipeFluid(pipe: PipeComponent, fluidId: string, amount: number): number
  pullPipeFluid(pipe: PipeComponent, max: number, filter?: (fluidId: string) => boolean): { fluidId: string; amount: number } | null
  meltdownAt(cx: number, cy: number): void
  incomeFactorAt(x: number, y: number): number
  workFactorAt(x: number, y: number): number
  requestDestroy(component: BaseComponent): void
}

export interface TickContext {
  dt: number
  simTime: number
  ledger: EnergyLedger
  host: SimulationHost
}
