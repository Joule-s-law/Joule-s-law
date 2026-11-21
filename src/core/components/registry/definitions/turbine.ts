import type { ComponentDefinition } from '../../ComponentDefinition'

export const TURBINE: ComponentDefinition = {
  id: 'turbine',
  displayName: '涡轮发电机',
  description: '流体接收器：从相邻管道大量吸收蒸汽（也可直接接触空间中的蒸汽），叶轮随之旋转并输出最大10V电动势。蒸汽中只有一小部分能量被消耗，其余的会释放回空间中（上升消散）。',
  loreDescription: '涡轮机利用流体冲击叶片高速旋转，是现代发电厂的核心。帕森斯1884年发明蒸汽轮机，让发电效率大幅提升。今天全球八成以上电力仍由涡轮驱动发电机产生。',
  price: 500,
  priceScaling: 1.1,
  portCount: 2,
  resistance: 5,
  ratedCurrent: 5,
  behaviorId: 'steamTurbine',
  behaviorParams: { emfMax: 10, steamRate: 6 },
  behaviorTags: {},
}
