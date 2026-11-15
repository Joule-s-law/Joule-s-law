import type { ComponentDefinition } from '../../ComponentDefinition'

export const SWITCH: ComponentDefinition = {
  id: 'switch',
  displayName: '开关',
  description: '点击切换通断：闭合时接触电阻极小，断开时支路完全断开。',
  loreDescription: '开关是最简单的电路控制元件。19世纪电报员用莫尔斯电键日夜切换电路传递信息。从墙面开关到芯片里的晶体管，本质都是通断控制。',
  price: 8,
  priceScaling: 1,
  portCount: 2,
  resistance: 0.01,
  ratedCurrent: 10,
  behaviorId: 'switch',
  behaviorParams: { contactResistance: 0.01 },
  behaviorTags: {},
}
