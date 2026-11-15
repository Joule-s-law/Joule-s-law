import type { ComponentDefinition } from '../../ComponentDefinition'

export const FOURTH_GENERATOR: ComponentDefinition = {
  id: 'fourth_generator',
  displayName: '第四发电机',
  description: '？？？这台发电机没有线圈，没有磁体，没有手柄——它的动力来自"画布之外"。每一个观测这个宇宙的未知存在，都可以为它贡献电动势（正负皆可），总和即为它的输出。右边的面板可以给它起名字。',
  loreDescription: '1831年法拉第问：磁能生电，那宇宙之外能否生电？这是一个不该被回答的问题。',
  price: 8000,
  priceScaling: 1.2,
  portCount: 2,
  resistance: 1,
  ratedCurrent: 8,
  behaviorId: 'fourthGenerator',
  behaviorParams: { overloadTolerance: 2 },
  behaviorTags: {},
}
