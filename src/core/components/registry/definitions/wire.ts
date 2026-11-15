import type { ComponentDefinition } from '../../ComponentDefinition'

export const WIRE: ComponentDefinition = {
  id: 'wire',
  displayName: '导线',
  description: '连接两个接线柱，电阻=电阻率×长度（可在信息面板切换铜/银/超导材料）。',
  loreDescription: '现实导线多用铜，电阻率约1.7×10⁻⁸Ω·m。超导现象1911年由昂内斯发现：某些材料冷却到极低温度时电阻率突变为零。游戏中的银导线与超导体数值为便于阅读做了夸张化。',
  price: 1,
  priceScaling: 1,
  portCount: 2,
  resistance: 0,
  ratedCurrent: 1e6,
  behaviorId: 'wire',
  behaviorParams: {},
  behaviorTags: {},
}
