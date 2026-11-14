import type { ComponentDefinition } from '../../ComponentDefinition'

export const RESISTOR: ComponentDefinition = {
  id: 'resistor',
  displayName: '电阻',
  description: '纯耗能：电流经过时按 Q=I²Rt 把电能全部转化为热量并换取收入，超过额定电流会熔毁。欧姆1826年发表欧姆定律，确定了电流、电压与电阻的定量关系。焦耳1841年用实验测定电流的热效应，确立了焦耳定律。电阻器至今仍是最基础的电子元件。',
  price: 5,
  priceScaling: 1,
  portCount: 2,
  resistance: 10,
  ratedCurrent: 5,
  behaviorId: 'resistive',
  behaviorParams: {},
  behaviorTags: {},
}
