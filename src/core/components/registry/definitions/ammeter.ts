import type { ComponentDefinition } from '../../ComponentDefinition'

export const AMMETER: ComponentDefinition = {
  id: 'ammeter',
  displayName: '电流表',
  description: '测量仪器：串联接入电路，内阻仅 0.05Ω，本体显示流过的电流。电流表由安培与伏特共同改进，1860 年前后成为实验室标准仪表。测量时必须串联，直接并联会造成短路。',
  price: 80,
  priceScaling: 1.2,
  portCount: 2,
  resistance: 0.05,
  ratedCurrent: 5,
  behaviorId: 'resistive',
  behaviorParams: {},
  behaviorTags: {},
}
