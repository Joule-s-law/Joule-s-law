import type { ComponentDefinition } from '../../ComponentDefinition'

export const BATTERY_PACK: ComponentDefinition = {
  id: 'battery_pack',
  displayName: '电池组',
  description: '恒定电动势电源：提供稳定电压持续驱动电路，注意串联元件的额定电流限制。伏特1800年发明伏打电堆，用锌片与铜片夹盐水首次产生持续电流。这是人类第一个化学电源。它让此后所有电磁学实验成为可能。',
  price: 150,
  priceScaling: 1.15,
  portCount: 2,
  resistance: 8,
  ratedCurrent: 4,
  behaviorId: 'voltageSource',
  behaviorParams: { emf: 12, internalResistance: 8 },
  behaviorTags: {},
}
