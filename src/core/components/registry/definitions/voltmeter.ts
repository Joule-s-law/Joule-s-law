import type { ComponentDefinition } from '../../ComponentDefinition'

export const VOLTMETER: ComponentDefinition = {
  id: 'voltmeter',
  displayName: '电压表',
  description: '测量仪器：并联在元件两端，内阻高达 1MΩ，几乎不分走电流，本体显示两端电压。世上第一支电压表由奥斯特的电流磁效应衍生而来。测量时必须并联，串联进电路会让回路近似断路。',
  price: 120,
  priceScaling: 1.2,
  portCount: 2,
  resistance: 1000000,
  ratedCurrent: 0.01,
  behaviorId: 'resistive',
  behaviorParams: {},
  behaviorTags: {},
}
