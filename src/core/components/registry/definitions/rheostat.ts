import type { ComponentDefinition } from '../../ComponentDefinition'

export const RHEOSTAT: ComponentDefinition = {
  id: 'rheostat',
  displayName: '滑动变阻器',
  description: '四个接线柱：上排两个接在金属杆（滑片）上，下排两个接电阻丝两端。接"一下一上"时，拖动元件中间的滑片可在 0 到 50Ω 之间连续调节电阻；两下接线柱之间始终是全阻值 50Ω；两上接线柱之间直接短接。输入电能、输出热量，发热功率 I²R 随阻值实时变化。',
  loreDescription: '欧姆1826年用滑线变阻器控制电流大小，才得以发现欧姆定律。焦耳测定热功当量的实验也靠它精确调节回路电流。今天的调光旋钮和音量电位器都是它的后代。',
  price: 150,
  priceScaling: 1.12,
  portCount: 4,
  portLayout: 'rows',
  resistance: 50,
  ratedCurrent: 2,
  behaviorId: 'rheostat',
  behaviorParams: { maxResistance: 50, overloadTolerance: 1.5 },
  behaviorTags: {},
}
