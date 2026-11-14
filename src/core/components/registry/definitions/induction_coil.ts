import type { ComponentDefinition } from '../../ComponentDefinition'

export const INDUCTION_COIL: ComponentDefinition = {
  id: 'induction_coil',
  displayName: '感应线圈',
  description: '感应周围磁场的变化率，产生最大12V的感应电动势输出电能——放在高速通断的线圈旁边最有效。法拉第1831年用变化磁场穿过线圈得到感应电流。发电机与变压器都基于这条电磁感应定律。静止不变的磁场不会让它有任何输出。',
  price: 600,
  priceScaling: 1.1,
  portCount: 2,
  resistance: 30,
  ratedCurrent: 3,
  behaviorId: 'fieldSensor',
  behaviorParams: { emfPerUnit: 2, emfMax: 12, fluxDerivative: 1 },
  behaviorTags: { sensorField: 'magnetic' },
}
