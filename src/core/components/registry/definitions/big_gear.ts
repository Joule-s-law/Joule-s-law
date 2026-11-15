import type { ComponentDefinition } from '../../ComponentDefinition'

export const BIG_GEAR: ComponentDefinition = {
  id: 'big_gear',
  displayName: '大齿轮',
  description: '占2×2的机械传动件：带动普通齿轮时转速减半，被普通齿轮带动时转速翻倍（齿比2:1），不接电。',
  loreDescription: '大齿轮与小齿轮的变速原理就是齿轮减速箱的基础。达芬奇的手稿中画满了齿轮变速设计。今天汽车的变速箱正是用齿比切换扭矩与转速。',
  price: 40,
  priceScaling: 1.2,
  portCount: 0,
  resistance: 0,
  ratedCurrent: 0,
  behaviorId: 'gear',
  behaviorParams: { teeth: 16, maxOmega: Math.PI * 12 },
  behaviorTags: { rotatable: '1' },
  width: 2,
  height: 2,
}
