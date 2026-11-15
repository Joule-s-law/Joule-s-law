import type { ComponentDefinition } from '../../ComponentDefinition'

export const VOLTAGE_DOUBLER: ComponentDefinition = {
  id: 'voltage_doubler',
  displayName: '二倍升压器',
  description: '左侧接入电压 V，右侧输出约 2V。输入侧按输出功率的 1.1 倍吸收电能（效率 90%），损耗化作热量：能量守恒，升压不凭空发电。带重载时输出电压会下垂，电源功率不足就带不动。',
  loreDescription: '开关电容电荷泵是升压的原理。1836年卡兰制成首台感应升压机，今天手机快充里的 Boost 电路是它的直系后代。',
  price: 600,
  priceScaling: 1.15,
  portCount: 4,
  resistance: 25,
  ratedCurrent: 3,
  behaviorId: 'voltageTransformer',
  behaviorParams: { gain: 2, efficiency: 0.9, outputResistance: 0.5, overloadTolerance: 1.5 },
  behaviorTags: {},
  height: 2,
}

export const VOLTAGE_HALVER: ComponentDefinition = {
  id: 'voltage_halver',
  displayName: '二倍降压器',
  description: '左侧接入电压 V，右侧输出约 V/2。输入侧按输出功率的 1.1 倍吸收电能（效率 90%），差额化作热量散失，绝不凭空产生能量。适合给低压元件限压供电。',
  loreDescription: '1885年齐珀诺夫斯基发明变压器让远距离输电成为可能，今天的手机充电器本质上就是一台微型降压器。',
  price: 600,
  priceScaling: 1.15,
  portCount: 4,
  resistance: 25,
  ratedCurrent: 3,
  behaviorId: 'voltageTransformer',
  behaviorParams: { gain: 0.5, efficiency: 0.9, outputResistance: 0.5, overloadTolerance: 1.5 },
  behaviorTags: {},
  height: 2,
}
