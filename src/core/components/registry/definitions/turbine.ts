import type { ComponentDefinition } from '../../ComponentDefinition'

export const TURBINE: ComponentDefinition = {
  id: 'turbine',
  displayName: '涡轮发电机',
  description: '吸收动能池的能量，转换为最大10V的电动势输出电能。涡轮机利用流体冲击叶片高速旋转，是现代发电厂的核心。帕森斯1884年发明蒸汽轮机，让发电效率大幅提升。今天全球八成以上电力仍由涡轮驱动发电机产生。',
  price: 500,
  priceScaling: 1.1,
  portCount: 2,
  resistance: 5,
  ratedCurrent: 5,
  behaviorId: 'turbine',
  behaviorParams: { emfMax: 10, poolBuffer: 50 },
  behaviorTags: {},
}
