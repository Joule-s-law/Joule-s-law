import type { ComponentDefinition } from '../../ComponentDefinition'

export const BUZZER: ComponentDefinition = {
  id: 'buzzer',
  displayName: '蜂鸣器',
  description: '输入电能转化为声能收益，并朝外发射声场（可被麦克风感应）；超过额定电流会熔毁。蜂鸣器基于电磁铁反复吸引金属簧片振动发声。1840年代电磁蜂鸣器随电报系统诞生。如今蜂鸣器广泛用于报警与提示音。',
  price: 200,
  priceScaling: 1.1,
  portCount: 2,
  resistance: 30,
  ratedCurrent: 0.8,
  behaviorId: 'converter',
  behaviorParams: { efficiency: 0.9, overloadTolerance: 0.5, emitStrength: 1 },
  behaviorTags: { outputMode: 'income', outputForm: 'sound', emitField: 'sound' },
}
