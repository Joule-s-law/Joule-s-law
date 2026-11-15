import type { ComponentDefinition } from '../../ComponentDefinition'

export const GEAR_GROUP: ComponentDefinition = {
  id: 'gear_group',
  displayName: '齿轮组',
  description: '机械传动件（不接电）：与相邻旋转元件啮合反向传转，转速上限12π/s，超速每秒有损坏概率。',
  loreDescription: '齿轮是最古老的机械元件之一，可追溯到公元前。中国的《墨经》与阿基米德都研究过齿轮传动。齿轮组至今仍在几乎所有机械中传递动力。',
  price: 15,
  priceScaling: 1.2,
  portCount: 0,
  resistance: 0,
  ratedCurrent: 0,
  behaviorId: 'gear',
  behaviorParams: { teeth: 8, maxOmega: Math.PI * 12 },
  behaviorTags: { rotatable: '1' },
}
