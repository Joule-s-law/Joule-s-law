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
	| 'gearMaxOmegaBoost'
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
	bio: string
	levelEffect: (nextLevel: number) => string
	parentId: string | null
	maxLevel: number
	baseCost: number
	costScaling: number
	requiredParentLevel?: number
	effects: TechEffect[]
}

export const BASE_UNLOCKED_COMPONENTS: string[] = ['hand_crank', 'resistor', 'wire', 'fuse', 'switch', 'diode', 'gear_group', 'big_gear', 'chain_drive']
const BASE_WIRE_MATERIALS: string[] = ['platinum']
const ROOT_INITIAL_LEVEL = 1

const TECH_LIST: TechNode[] = [
	{
		id: 'physics_must_3',
		displayName: '物理必修三',
		bio: '高中物理合订本：静电场、直流电路、磁场与电磁感应的统帅课程。',
		levelEffect: () => '收入 +100%',
		parentId: null,
		maxLevel: 5,
		baseCost: 1500 / 2.5,
		costScaling: 2.5,
		effects: [{ kind: 'globalMultiplier', perLevel: 1 }],
	},
	{
		id: 'higgs',
		displayName: '希格斯',
		bio: '彼得·希格斯（1929–2024），英国理论物理学家。1964 年预言希格斯玻色子，赋予基本粒子以质量；2012 年该粒子在 LHC 被证实，次年获诺贝尔物理学奖。',
		levelEffect: () => '点击产热 +1J，点击冷却 ×90%',
		parentId: 'physics_must_3',
		maxLevel: 10,
		baseCost: 1.63,
		costScaling: 1.8,
		effects: [
			{ kind: 'clickHeat', perLevel: 1 },
			{ kind: 'clickCooldownFactor', perLevel: 0.9 },
		],
	},
	{
		id: 'joule',
		displayName: '焦耳',
		bio: '詹姆斯·普雷斯科特·焦耳（1818–1889），英国物理学家，啤酒厂主人。自制温度计测定电流热效应与热功当量，证明热是能量的一种形式，能量守恒定律的奠基人之一。',
		levelEffect: () => '热量收入 +8%',
		parentId: 'physics_must_3',
		maxLevel: 10,
		baseCost: 1.63,
		costScaling: 1.8,
		effects: [{ kind: 'incomeMultiplier', target: EnergyType.HEAT, perLevel: 0.08 }],
	},
	{
		id: 'planck',
		displayName: '普朗克',
		bio: '马克斯·普朗克（1858–1947），德国物理学家。1900 年为解释黑体辐射提出能量量子化假说，开启量子力学时代，1918 年获诺贝尔物理学奖。',
		levelEffect: (n) => `光发射强度 +10%${n === 1 ? '，并解锁「灯泡」与「光伏板」' : ''}`,
		parentId: 'physics_must_3',
		maxLevel: 10,
		baseCost: 2.04,
		costScaling: 1.8,
		effects: [
			{ kind: 'unlockComponents', perLevel: 0, target: 'lamp,photocell' },
			{ kind: 'lightEmissionBoost', perLevel: 0.1 },
		],
	},
	{
		id: 'curie',
		displayName: '居里',
		bio: '玛丽·居里（1867–1934），波兰-法国物理学家、化学家。发现钋与镭并开创放射性研究，是至今唯一在物理与化学两个学科都获诺贝尔奖的科学家。',
		levelEffect: () => '化学能收入 +15%',
		parentId: 'physics_must_3',
		maxLevel: 10,
		baseCost: 2.04,
		costScaling: 1.8,
		effects: [
			{ kind: 'incomeMultiplier', target: EnergyType.CHEMICAL, perLevel: 0.15 },
		],
	},
	{
		id: 'faraday',
		displayName: '法拉第',
		bio: '迈克尔·法拉第（1791–1867），英国物理学家、化学家，装订工学徒出身。1831 年发现电磁感应并造出第一台发电机模型，"场"概念的奠基人。',
		levelEffect: (n) => `传感元件电动势 +6%${n === 1 ? '，并解锁「通电线圈」与「感应线圈」' : ''}`,
		parentId: 'physics_must_3',
		maxLevel: 10,
		baseCost: 2.71,
		costScaling: 1.8,
		effects: [
			{ kind: 'unlockComponents', perLevel: 0, target: 'coil,induction_coil' },
			{ kind: 'sensorEfficiencyBoost', perLevel: 0.06 },
		],
	},
	{
		id: 'ohm',
		displayName: '欧姆',
		bio: '格奥尔格·西蒙·欧姆（1789–1854），德国物理学家、中学教师。1826 年用自制器材发表欧姆定律 I=U/R，成果长期备受冷遇，晚年才获得承认。',
		levelEffect: (n) => `全体元件额定电流 ×110%${n === 1 ? '，并解锁「滑动变阻器」、「电流表」与「电压表」' : ''}`,
		parentId: 'physics_must_3',
		maxLevel: 10,
		baseCost: 0.53,
		costScaling: 2,
		effects: [
			{ kind: 'ratedCurrentFactor', perLevel: 1.1 },
			{ kind: 'unlockComponents', perLevel: 0, target: 'rheostat,ammeter,voltmeter' },
		],
	},
	{
		id: 'carnot',
		displayName: '卡诺',
		bio: '萨迪·卡诺（1796–1832），法国军事工程师。1824 年提出理想热机循环与卡诺效率，奠定热力学第二定律，被誉为"热力学之父"。',
		levelEffect: (n) => `能量转换效率 +1%${n === 1 ? '，并解锁「电动机」、「蒸汽机」与「涡轮发电机」' : ''}`,
		parentId: 'joule',
		maxLevel: 10,
		baseCost: 2.74,
		costScaling: 2,
		effects: [
			{ kind: 'unlockComponents', perLevel: 0, target: 'motor,steam_engine,turbine' },
			{ kind: 'efficiencyBoost', perLevel: 0.01 },
		],
	},
	{
		id: 'einstein',
		displayName: '爱因斯坦',
		bio: '阿尔伯特·爱因斯坦（1879–1955），出生于德国的理论物理学家。1905 年提出狭义相对论与光电方程，1915 年完成广义相对论，1921 年获诺贝尔物理学奖。',
		levelEffect: () => '收入 +15%',
		parentId: 'carnot',
		maxLevel: 10,
		baseCost: 10.26,
		costScaling: 2,
		effects: [{ kind: 'globalMultiplier', perLevel: 0.15 }],
	},
	{
		id: 'bell',
		displayName: '贝尔',
		bio: '亚历山大·格拉汉姆·贝尔（1847–1922），苏格兰-美国发明家。1876 年获得电话专利并创办贝尔电话公司，晚年资助了美国《科学》杂志的创刊。',
		levelEffect: (n) => `声能收入 +15%${n === 1 ? '，并解锁「蜂鸣器」与「麦克风」' : ''}`,
		parentId: 'curie',
		maxLevel: 10,
		baseCost: 2.05,
		costScaling: 2,
		effects: [
			{ kind: 'unlockComponents', perLevel: 0, target: 'buzzer,microphone' },
			{ kind: 'incomeMultiplier', target: EnergyType.SOUND, perLevel: 0.15 },
		],
	},
	{
		id: 'tesla',
		displayName: '特斯拉',
		bio: '尼古拉·特斯拉（1856–1943），塞尔维亚-美国发明家、电气工程师。推动交流输电系统落地，发明感应电动机与特斯拉线圈，一生持有一百余项专利。',
		levelEffect: (n) => `传感元件电动势 +5%${n === 1 ? '，并解锁「电池组」、「原电池」、「二倍升压器」与「二倍降压器」' : ''}`,
		parentId: 'faraday',
		maxLevel: 10,
		baseCost: 3.42,
		costScaling: 2,
		effects: [
			{ kind: 'unlockComponents', perLevel: 0, target: 'battery_pack,secondary_battery,voltage_doubler,voltage_halver' },
			{ kind: 'sensorEfficiencyBoost', perLevel: 0.05 },
		],
	},
	{
		id: 'maxwell',
		displayName: '麦克斯韦',
		bio: '詹姆斯·克拉克·麦克斯韦（1831–1879），苏格兰物理学家。用四组方程把电、磁、光统一为同一电磁现象，也是用统计方法研究分子运动的开创者。',
		levelEffect: () => '所有齿轮的转速上限 +2π/s',
		parentId: 'ohm',
		maxLevel: 10,
		baseCost: 1.17,
		costScaling: 2,
		effects: [{ kind: 'gearMaxOmegaBoost', perLevel: Math.PI * 2 }],
	},
	{
		id: 'onnes',
		displayName: '昂内斯',
		bio: '海克·卡末林·昂内斯（1853–1926），荷兰物理学家。1908 年首次液化氦气，1911 年借此发现超导现象，1913 年获诺贝尔物理学奖。',
		levelEffect: (n) => `解锁${[...["铁", "钨", "铜", "银"].map(e => `${e}导线`), "超导体"][n - 1]}`,
		parentId: 'ohm',
		maxLevel: 5,
		baseCost: 60,
		costScaling: 4,
		effects: [
			{ kind: 'unlockWireMaterial', target: 'iron', perLevel: 0, minLevel: 1 },
			{ kind: 'unlockWireMaterial', target: 'tungsten', perLevel: 0, minLevel: 2 },
			{ kind: 'unlockWireMaterial', target: 'copper', perLevel: 0, minLevel: 3 },
			{ kind: 'unlockWireMaterial', target: 'silver', perLevel: 0, minLevel: 4 },
			{ kind: 'unlockWireMaterial', target: 'superconductor', perLevel: 0, minLevel: 5 },
		],
	},
	{
		id: 'ender_interface',
		displayName: '末影接口',
		bio: '？？？（资料删除）该接口的制造者不详。它在你的科技树深处静静等待，直到有人望向世界的边界。',
		levelEffect: () => '解锁「第四发电机」',
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

	buy(id: string, free = false): boolean {
		const node = this.getNode(id)
		if (node === undefined || !this.canBuy(id)) return false
		const cost = this.getCost(id)
		if (!free && this.sim.economy.money < cost) return false
		if (!free) this.sim.economy.money -= cost
		this.levels.set(id, this.getLevel(id) + 1)
		this.recompute()
		return true
	}

	forceUnlock(id: string): void {
		const node = this.getNode(id)
		if (node === undefined) return
		this.levels.set(id, node.maxLevel)
		this.recompute()
	}

	forceUnlockAll(): void {
		for (const node of TECH_NODES) {
			if (node.parentId !== null && (node.requiredParentLevel ?? 1) > 1) continue
			this.levels.set(node.id, node.maxLevel)
		}
		this.recompute()
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
		let gearMaxOmegaBoost = 0
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
					case 'gearMaxOmegaBoost':
						if (active) gearMaxOmegaBoost += effect.perLevel * level
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
		this.sim.gearMaxOmegaBonus = gearMaxOmegaBoost
	}

	isComponentUnlocked(defId: string): boolean {
		return this.unlockedComponents.has(defId)
	}

	isWireMaterialUnlocked(materialId: string): boolean {
		return this.unlockedWireMaterials.has(materialId)
	}
}
