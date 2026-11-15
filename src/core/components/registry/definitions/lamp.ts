import type { ComponentDefinition } from '../../ComponentDefinition'

export const LAMP: ComponentDefinition = {
  id: 'lamp',
  displayName: '灯泡',
  description: '耗能发热并发出光场（亮度∝功率），光场可被光伏板感应为电动势；发热同样换取收入。',
  loreDescription: '白炽灯由斯旺与爱迪生在1879年前后独立实用化。灯丝在真空或惰性气体中被加热到上千度而发光。它是"电→热→光"的经典能量链条。',
  price: 25,
  priceScaling: 1,
  portCount: 2,
  resistance: 8,
  ratedCurrent: 1.2,
  behaviorId: 'resistive',
  behaviorParams: { emitStrength: 2 },
  behaviorTags: { emitField: 'light' },
}
