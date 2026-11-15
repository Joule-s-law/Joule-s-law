import type { ComponentDefinition } from '../../ComponentDefinition'

export const MICROPHONE: ComponentDefinition = {
  id: 'microphone',
  displayName: '麦克风',
  description: '感应周围声场强度，产生最大6V的电动势输出电能——把蜂鸣器的声音变成收入。',
  loreDescription: '贝尔1876年发明电话，话筒把声振动转换为电流。碳粒话筒曾是电话百年标配。游戏中的麦克风反向工作：声音越响，输出电压越高。',
  price: 220,
  priceScaling: 1.1,
  portCount: 2,
  resistance: 25,
  ratedCurrent: 2,
  behaviorId: 'fieldSensor',
  behaviorParams: { emfPerUnit: 0.4, emfMax: 6 },
  behaviorTags: { sensorField: 'sound' },
}
