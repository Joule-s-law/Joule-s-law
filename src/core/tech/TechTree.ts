import { EnergyType } from '../energy/EnergyType'
import type { Simulation } from '../sim/Simulation'

export type TechEffectKind =
  | 'globalMultiplier'
  | 'incomeMultiplier'
  | 'clickHeat'
  | 'clickCooldownFactor'
  | 'ratedCurrentFactor'
  | 'efficiencyBoost'
  | 'sensorEfficiencyBoost'
  | 'lightEmissionBoost'
  | 'breakdownFactor'
  | 'unlockComponents'
  | 'unlockWireMaterial'

export interface TechEffect {
  kind: TechEffectKind
  target?: string
  perLevel: number
  minLevel?: number
}

export interface TechNode {
  id: string
  displayName: string
  description: string
  parentId: string | null
  maxLevel: number
  baseCost: number
  costScaling: number
  requiredParentLevel?: number
  effects: TechEffect[]
}

export const BASE_UNLOCKED_COMPONENTS: string[] = ['hand_crank', 'resistor', 'wire', 'fuse', 'switch', 'diode', 'gear_group', 'big_gear', 'chain_drive']
const BASE_WIRE_MATERIALS: string[] = ['copper']
const ROOT_INITIAL_LEVEL = 1

const TECH_LIST: TechNode[] = [
  {
    id: 'physics_must_3',
    displayName: '物理必修三',
    description: '电磁学统帅课程：全局资金倍率每级 +100%。作为根节点，费用极其昂贵；未研究则全局倍率为 0。',
    parentId: null,
    maxLevel: 5,
    baseCost: 500,
    costScaling: 2.5,
    effects: [{ kind: 'globalMultiplier', perLevel: 1 }],
  },
  {
    id: 'higgs',
    displayName: '希格斯',
    description: '希格斯玻色子赋予你的手指以质量：点击产热 +1J/级，点击冷却 ×0.85/级。',
    parentId: 'physics_must_3',
    maxLevel: 3,
    baseCost: 120,
    costScaling: 1.8,
    effects: [
      { kind: 'clickHeat', perLevel: 1 },
      { kind: 'clickCooldownFactor', perLevel: 0.85 },
    ],
  },
  {
    id: 'joule',
    displayName: '焦耳',
    description: '热功当量：热量资金倍率 +0.5/级。',
    parentId: 'physics_must_3',
    maxLevel: 3,
    baseCost: 120,
    costScaling: 1.8,
    effects: [{ kind: 'incomeMultiplier', target: EnergyType.HEAT, perLevel: 0.5 }],
  },
  {
    id: 'planck',
    displayName: '普朗克',
    description: '光电效应：解锁灯泡与光伏板；光发射强度 +10%/级。',
    parentId: 'physics_must_3',
    maxLevel: 3,
    baseCost: 150,
    costScaling: 1.8,
    effects: [
      { kind: 'unlockComponents', perLevel: 0, minLevel: 1, target: 'lamp,photocell' },
      { kind: 'lightEmissionBoost', perLevel: 0.1 },
    ],
  },
  {
    id: 'curie',
    displayName: '居里',
    description: '放射性化学：解锁电解池；化学能资金倍率 +0.5/级。',
    parentId: 'physics_must_3',
    maxLevel: 3,
    baseCost: 150,
    costScaling: 1.8,
    effects: [
      { kind: 'unlockComponents', perLevel: 0, minLevel: 1, target: 'electrolysis_cell' },
      { kind: 'incomeMultiplier', target: EnergyType.CHEMICAL, perLevel: 0.5 },
    ],
  },
  {
    id: 'faraday',
    displayName: '法拉第',
    description: '电磁感应：解锁通电线圈与感应线圈；传感元件电动势 +15%/级。',
    parentId: 'physics_must_3',
    maxLevel: 3,
    baseCost: 200,
    costScaling: 1.8,
    effects: [
      { kind: 'unlockComponents', perLevel: 0, minLevel: 1, target: 'coil,induction_coil' },
      { kind: 'sensorEfficiencyBoost', perLevel: 0.15 },
    ],
  },
  {
    id: 'ohm',
    displayName: '欧姆',
    description: '材料强度：全体元件额定电流 ×1.25/级；1 级解锁滑动变阻器、电流表与电压表。',
    parentId: 'physics_must_3',
    maxLevel: 2,
    baseCost: 180,
    costScaling: 2,
    effects: [
      { kind: 'ratedCurrentFactor', perLevel: 1.25 },
      { kind: 'unlockComponents', perLevel: 0, minLevel: 1, target: 'rheostat,ammeter,voltmeter' },
    ],
  },
  {
    id: 'carnot',
    displayName: '卡诺',
    description: '热机循环：解锁电动机、蒸汽机、涡轮发电机；能量转换效率 +2%/级。',
    parentId: 'joule',
    maxLevel: 3,
    baseCost: 400,
    costScaling: 2,
    effects: [
      { kind: 'unlockComponents', perLevel: 0, minLevel: 1, target: 'motor,steam_engine,turbine' },
      { kind: 'efficiencyBoost', perLevel: 0.02 },
    ],
  },
  {
    id: 'einstein',
    displayName: '爱因斯坦',
    description: '质能方程 E=mc²：全局资金倍率 +50%/级。树的最深处。',
    parentId: 'carnot',
    maxLevel: 3,
    baseCost: 1500,
    costScaling: 2,
    effects: [{ kind: 'globalMultiplier', perLevel: 0.5 }],
  },
  {
    id: 'bell',
    displayName: '贝尔',
    description: '声学电话：解锁蜂鸣器与麦克风；声能资金倍率 +0.5/级。',
    parentId: 'curie',
    maxLevel: 3,
    baseCost: 300,
    costScaling: 2,
    effects: [
      { kind: 'unlockComponents', perLevel: 0, minLevel: 1, target: 'buzzer,microphone' },
      { kind: 'incomeMultiplier', target: EnergyType.SOUND, perLevel: 0.5 },
    ],
  },
  {
    id: 'tesla',
    displayName: '特斯拉',
    description: '无线输电之梦：解锁电池组、二次电池、二倍升压器与二倍降压器；传感元件电动势 +10%/级。',
    parentId: 'faraday',
    maxLevel: 3,
    baseCost: 500,
    costScaling: 2,
    effects: [
      { kind: 'unlockComponents', perLevel: 0, minLevel: 1, target: 'battery_pack,secondary_battery,voltage_doubler,voltage_halver' },
      { kind: 'sensorEfficiencyBoost', perLevel: 0.1 },
    ],
  },
  {
    id: 'maxwell',
    displayName: '麦克斯韦',
    description: '统计力学：齿轮组超速损坏概率 ×0.6/级。',
    parentId: 'ohm',
    maxLevel: 2,
    baseCost: 400,
    costScaling: 2,
    effects: [{ kind: 'breakdownFactor', perLevel: 0.6 }],
  },
  {
    id: 'onnes',
    displayName: '昂内斯',
    description: '超导现象：1 级解锁银导线，2 级解锁超导体。',
    parentId: 'ohm',
    maxLevel: 2,
    baseCost: 800,
    costScaling: 2.2,
    effects: [
      { kind: 'unlockWireMaterial', target: 'silver', perLevel: 0, minLevel: 1 },
      { kind: 'unlockWireMaterial', target: 'superconductor', perLevel: 0, minLevel: 2 },
    ],
  },
  {
    id: 'ender_interface',
    displayName: '末影接口',
    description: '在世界的边界上凿一扇门：解锁"第四发电机"——它的电动势不是来自这个世界，而是来自正在观测你的未知存在。它们是谁？它们想要什么？只有把门打开的人才知道。',
    parentId: 'physics_must_3',
    maxLevel: 1,
    baseCost: 9000,
    costScaling: 1,
    requiredParentLevel: 5,
    effects: [{ kind: 'unlockComponents', perLevel: 0, minLevel: 1, target: 'fourth_generator' }],
  },
]

export const TECH_NODES: TechNode[] = TECH_LIST

export class TechTree {
  readonly levels = new Map<string, number>()
  readonly unlockedComponents = new Set<string>(BASE_UNLOCKED_COMPONENTS)
  readonly unlockedWireMaterials = new Set<string>(BASE_WIRE_MATERIALS)

  constructor(private readonly sim: Simulation) {
    this.resetLevels()
    this.recompute()
  }

  resetLevels(): void {
    this.levels.clear()
    for (const node of TECH_NODES) {
      this.levels.set(node.id, node.parentId === null ? ROOT_INITIAL_LEVEL : 0)
    }
    this.unlockedComponents.clear()
    for (const id of BASE_UNLOCKED_COMPONENTS) this.unlockedComponents.add(id)
    this.unlockedWireMaterials.clear()
    for (const id of BASE_WIRE_MATERIALS) this.unlockedWireMaterials.add(id)
  }

  getLevel(id: string): number {
    return this.levels.get(id) ?? 0
  }

  getNode(id: string): TechNode | undefined {
    return TECH_NODES.find((node) => node.id === id)
  }

  isUnlocked(id: string): boolean {
    const node = this.getNode(id)
    if (node === undefined) return false
    if (node.parentId === null) return true
    return this.getLevel(node.parentId) >= (node.requiredParentLevel ?? 1)
  }

  isRevealed(id: string): boolean {
    const node = this.getNode(id)
    if (node === undefined) return false
    if (node.requiredParentLevel === undefined) return true
    return this.getLevel(node.parentId ?? '') >= node.requiredParentLevel
  }

  canBuy(id: string): boolean {
    const node = this.getNode(id)
    if (node === undefined) return false
    if (!this.isUnlocked(id)) return false
    return this.getLevel(id) < node.maxLevel
  }

  getCost(id: string): number {
    const node = this.getNode(id)
    if (node === undefined) return Number.POSITIVE_INFINITY
    const targetLevel = this.getLevel(id) + 1
    return node.baseCost * Math.pow(node.costScaling, targetLevel - 1)
  }

  buy(id: string): boolean {
    const node = this.getNode(id)
    if (node === undefined || !this.canBuy(id)) return false
    const cost = this.getCost(id)
    if (this.sim.economy.money < cost) return false
    this.sim.economy.money -= cost
    this.levels.set(id, this.getLevel(id) + 1)
    this.recompute()
    return true
  }

  applyLevels(record: Record<string, number>): void {
    this.resetLevels()
    for (const [id, level] of Object.entries(record)) {
      if (this.levels.has(id)) this.levels.set(id, level)
    }
    this.recompute()
  }

  exportLevels(): Record<string, number> {
    const record: Record<string, number> = {}
    for (const [id, level] of this.levels) {
      record[id] = level
    }
    return record
  }

  recompute(): void {
    let globalMultiplier = 0
    const incomeBonus = new Map<EnergyType, number>()
    let clickHeat = 1
    let clickCooldown = 0.5
    let ratedCurrentBoost = 1
    let efficiencyBoost = 0
    let sensorEfficiencyBoost = 0
    let lightEmissionBoost = 0
    let breakdownFactor = 1
    for (const node of TECH_NODES) {
      const level = this.getLevel(node.id)
      for (const effect of node.effects) {
        const active = level >= (effect.minLevel ?? 1)
        switch (effect.kind) {
          case 'globalMultiplier':
            globalMultiplier += effect.perLevel * level
            break
          case 'incomeMultiplier': {
            const type = effect.target as EnergyType
            if (active) {
              incomeBonus.set(type, (incomeBonus.get(type) ?? 0) + effect.perLevel * level)
            }
            break
          }
          case 'clickHeat':
            if (active) clickHeat += effect.perLevel * level
            break
          case 'clickCooldownFactor':
            if (active) clickCooldown *= Math.pow(effect.perLevel, level)
            break
          case 'ratedCurrentFactor':
            if (active) ratedCurrentBoost *= Math.pow(effect.perLevel, level)
            break
          case 'efficiencyBoost':
            if (active) efficiencyBoost += effect.perLevel * level
            break
          case 'sensorEfficiencyBoost':
            if (active) sensorEfficiencyBoost += effect.perLevel * level
            break
          case 'lightEmissionBoost':
            if (active) lightEmissionBoost += effect.perLevel * level
            break
          case 'breakdownFactor':
            if (active) breakdownFactor *= effect.perLevel
            break
          case 'unlockComponents':
            if (active && effect.target !== undefined) {
              for (const id of effect.target.split(',')) {
                this.unlockedComponents.add(id)
              }
            }
            break
          case 'unlockWireMaterial':
            if (active && effect.target !== undefined) {
              this.unlockedWireMaterials.add(effect.target)
            }
            break
        }
      }
    }
    this.sim.economy.globalMultiplier = globalMultiplier
    for (const type of Object.values(EnergyType)) {
      this.sim.economy.setMultiplier(type, 1 + (incomeBonus.get(type) ?? 0))
    }
    this.sim.clickHeat = clickHeat
    this.sim.clickCooldown = clickCooldown
    this.sim.ratedCurrentBoost = ratedCurrentBoost
    this.sim.converterEfficiencyBoost = efficiencyBoost
    this.sim.sensorEfficiencyBoost = sensorEfficiencyBoost
    this.sim.lightEmissionBoost = lightEmissionBoost
    this.sim.gearBreakdownChance = 0.5 * breakdownFactor
  }

  isComponentUnlocked(defId: string): boolean {
    return this.unlockedComponents.has(defId)
  }

  isWireMaterialUnlocked(materialId: string): boolean {
    return this.unlockedWireMaterials.has(materialId)
  }
}
