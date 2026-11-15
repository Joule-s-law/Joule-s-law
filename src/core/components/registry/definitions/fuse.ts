import type { ComponentDefinition } from '../../ComponentDefinition'

export const FUSE: ComponentDefinition = {
  id: 'fuse',
  displayName: '保险丝',
  description: '过流保护：正常时近似导线，电流超过额定值极短时间内熔断断开支路。熔断后下游元件不再被过流烧毁。',
  loreDescription: '保险丝由爱迪生在19世纪末随配电系统一同提出。它至今仍是电路过流保护的最后防线。',
  price: 3,
  priceScaling: 1,
  portCount: 2,
  resistance: 0.5,
  ratedCurrent: 2,
  behaviorId: 'resistive',
  behaviorParams: { overloadTolerance: 0.05 },
  behaviorTags: {},
}
