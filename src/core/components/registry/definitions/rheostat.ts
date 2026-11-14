import type { ComponentDefinition } from '../../ComponentDefinition'

export const RHEOSTAT: ComponentDefinition = {
  id: 'rheostat',
  displayName: '滑动变阻器',
  description: '拖动元件上方的滑块，在 0.5Ω 到 50Ω 之间连续调节电阻——限制电流、分压与保护电路的核心。输入电能、输出热量，发热功率 I²R 随阻值实时变化。欧姆1826年用滑线变阻器控制电流大小，才得以发现欧姆定律。焦耳测定热功当量的实验也靠它精确调节回路电流。今天的调光旋钮和音量电位器都是它的后代。',
  price: 150,
  priceScaling: 1.12,
  portCount: 2,
  resistance: 25,
  ratedCurrent: 2,
  behaviorId: 'rheostat',
  behaviorParams: { minResistance: 0.5, maxResistance: 50, overloadTolerance: 1.5 },
  behaviorTags: {},
}
