import type { ComponentDefinition } from '../ComponentDefinition'
import { paramNumber } from '../ComponentDefinition'
import { BaseComponent } from '../BaseComponent'
import type { MnaModel } from '../../circuit/MnaModel'
import type { TickContext } from '../../sim/TickContext'

export type MembraneKind = 'none' | 'cation' | 'anion'

export interface BatteryCellConfig {
  pairName: string
  negativeName: string
  positiveName: string
  electrolyteName: string
  solutionColor: string
  cationName: string
  cationColor: string
  anionName: string
  anionColor: string
  membrane: MembraneKind
  flipped: boolean
  pairIndex: number
  electrolyteIndex: number
}

export interface BatteryIon {
  nx: number
  ny: number
  vx: number
  vy: number
  cation: boolean
}

interface CellElectrolyte {
  name: string
  color: string
  cation: string
  cationColor: string
  anion: string
  anionColor: string
}

interface CellPair {
  name: string
  negative: string
  positive: string
  electrolytes: CellElectrolyte[]
}

const CELL_PAIRS: CellPair[] = [
  {
    name: '铅蓄电池',
    negative: '铅 Pb',
    positive: '二氧化铅 PbO₂',
    electrolytes: [
      { name: '硫酸溶液', color: '#c9bd8a', cation: 'H⁺', cationColor: '#ff8a80', anion: 'SO₄²⁻', anionColor: '#82b1ff' },
    ],
  },
  {
    name: '镍镉电池',
    negative: '镉 Cd',
    positive: '氢氧化镍 NiOOH',
    electrolytes: [
      { name: '氢氧化钾溶液', color: '#a8b4c4', cation: 'K⁺', cationColor: '#ffb74d', anion: 'OH⁻', anionColor: '#4fc3f7' },
    ],
  },
  {
    name: '锂离子电池',
    negative: '石墨嵌锂 LiC₆',
    positive: '钴酸锂 LiCoO₂',
    electrolytes: [
      { name: '六氟磷酸锂溶液', color: '#b3a2c9', cation: 'Li⁺', cationColor: '#ffd54f', anion: 'PF₆⁻', anionColor: '#ba68c8' },
    ],
  },
]

const ION_COUNT_PER_KIND = 12
const ION_JITTER = 0.5
const ION_MAX_SPEED = 0.16
const MEMBRANE_NX = 0.5

export class BatteryComponent extends BaseComponent {
  private readonly emfFull: number
  private readonly capacityJ: number
  private readonly chargeEfficiency: number
  stateOfCharge: number
  cellConfig: BatteryCellConfig
  ions: BatteryIon[] = []

  constructor(
    def: ComponentDefinition,
    stateOfCharge?: number,
    savedCell?: { pairIndex: number; electrolyteIndex: number; membrane: MembraneKind; flipped: boolean },
  ) {
    super(def)
    this.emfFull = paramNumber(def, 'emfFull', 6)
    this.capacityJ = paramNumber(def, 'capacityJ', 5000)
    this.chargeEfficiency = paramNumber(def, 'chargeEfficiency', 0.8)
    this.stateOfCharge = stateOfCharge ?? 1
    this.cellConfig = this.buildConfig(savedCell)
    this.spawnIons()
  }

  getEmf(): number {
    return this.emfFull * this.stateOfCharge
  }

  getResistance(): number {
    return this.def.resistance
  }

  buildCircuitModel(model: MnaModel): void {
    model.addBranch(this.nodeOf(0), this.nodeOf(1), this.def.resistance, this.getEmf(), this)
  }

  randomizeCellConfig(): void {
    this.cellConfig = this.buildConfig(undefined)
    this.spawnIons()
  }

  onTick(ctx: TickContext): void {
    const energy = this.current * this.getEmf() * ctx.dt
    if (energy > 0) {
      this.stateOfCharge = Math.max(0, this.stateOfCharge - energy / this.capacityJ)
    } else {
      this.stateOfCharge = Math.min(1, this.stateOfCharge + (-energy * this.chargeEfficiency) / this.capacityJ)
    }
    this.updateIons(ctx.dt)
  }

  private buildConfig(saved?: { pairIndex: number; electrolyteIndex: number; membrane: MembraneKind; flipped: boolean }): BatteryCellConfig {
    const pairIndex = saved !== undefined && saved.pairIndex >= 0 && saved.pairIndex < CELL_PAIRS.length
      ? saved.pairIndex
      : Math.floor(Math.random() * CELL_PAIRS.length)
    const pair = CELL_PAIRS[pairIndex]!
    const electrolyteIndex = saved !== undefined && saved.electrolyteIndex >= 0 && saved.electrolyteIndex < pair.electrolytes.length
      ? saved.electrolyteIndex
      : Math.floor(Math.random() * pair.electrolytes.length)
    const electrolyte = pair.electrolytes[electrolyteIndex]!
    const membrane: MembraneKind = saved !== undefined ? saved.membrane : (['none', 'cation', 'anion'] as const)[Math.floor(Math.random() * 3)]!
    const flipped = saved !== undefined ? saved.flipped : Math.random() < 0.5
    return {
      pairName: pair.name,
      negativeName: pair.negative,
      positiveName: pair.positive,
      electrolyteName: electrolyte.name,
      solutionColor: electrolyte.color,
      cationName: electrolyte.cation,
      cationColor: electrolyte.cationColor,
      anionName: electrolyte.anion,
      anionColor: electrolyte.anionColor,
      membrane,
      flipped,
      pairIndex,
      electrolyteIndex,
    }
  }

  private spawnIons(): void {
    this.ions = []
    for (let i = 0; i < ION_COUNT_PER_KIND; i++) {
      this.ions.push(this.randomIon(true))
      this.ions.push(this.randomIon(false))
    }
  }

  private randomIon(cation: boolean): BatteryIon {
    const nx = Math.random()
    const ny = Math.random()
    const angle = Math.random() * Math.PI * 2
    return {
      nx,
      ny,
      vx: Math.cos(angle) * ION_MAX_SPEED * 0.5,
      vy: Math.sin(angle) * ION_MAX_SPEED * 0.5,
      cation,
    }
  }

  private updateIons(dt: number): void {
    for (const ion of this.ions) {
      ion.vx += (Math.random() - 0.5) * ION_JITTER * dt
      ion.vy += (Math.random() - 0.5) * ION_JITTER * dt
      const speed = Math.hypot(ion.vx, ion.vy)
      if (speed > ION_MAX_SPEED) {
        ion.vx = (ion.vx / speed) * ION_MAX_SPEED
        ion.vy = (ion.vy / speed) * ION_MAX_SPEED
      }
      const blocked = this.cellConfig.membrane === 'cation' ? !ion.cation : this.cellConfig.membrane === 'anion' ? ion.cation : false
      let nextNx = ion.nx + ion.vx * dt
      if (blocked && (ion.nx - MEMBRANE_NX) * (nextNx - MEMBRANE_NX) < 0) {
        nextNx = ion.nx
        ion.vx = -ion.vx
      }
      ion.nx = nextNx
      ion.ny += ion.vy * dt
      if (ion.nx < 0) {
        ion.nx = 0
        ion.vx = Math.abs(ion.vx)
      }
      if (ion.nx > 1) {
        ion.nx = 1
        ion.vx = -Math.abs(ion.vx)
      }
      if (ion.ny < 0) {
        ion.ny = 0
        ion.vy = Math.abs(ion.vy)
      }
      if (ion.ny > 1) {
        ion.ny = 1
        ion.vy = -Math.abs(ion.vy)
      }
    }
  }
}
