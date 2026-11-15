import type { ComponentDefinition } from '../../ComponentDefinition'

export const DIODE: ComponentDefinition = {
  id: 'diode',
  displayName: '二极管',
  description: '单向导电：电流只能从左接线柱（阳极）流向右接线柱（阴极），反向完全截止——可用来防止电池反充或隔离两路电源。',
  loreDescription: '1904年弗莱明发明真空二极管，是最早的电子元件。此后近半个世纪它是整流的唯一选择。半导体PN结二极管让整流小型化，成为现代电力电子的基石。',
  price: 50,
  priceScaling: 1.15,
  portCount: 2,
  resistance: 0.5,
  ratedCurrent: 2,
  behaviorId: 'diode',
  behaviorParams: { forwardResistance: 0.5, blockingResistance: 1000000000 },
  behaviorTags: {},
}
