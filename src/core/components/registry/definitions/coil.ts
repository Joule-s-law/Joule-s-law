import type { ComponentDefinition } from '../../ComponentDefinition'

export const COIL: ComponentDefinition = {
  id: 'coil',
  displayName: '通电线圈',
  description: '通电后向四周发射磁场（磁感应强度与电流成正比），本身几乎不产生收益——它是磁场产业的发射端。',
  loreDescription: '奥斯特1820年发现电流周围存在磁场，安培随后建立磁场定量理论。电磁铁如今是继电器、电机与磁悬浮的核心。它也是法拉第研究电磁感应的实验起点。',
  price: 450,
  priceScaling: 1.1,
  portCount: 2,
  resistance: 25,
  ratedCurrent: 3,
  behaviorId: 'converter',
  behaviorParams: { efficiency: 0, emitStrength: 5 },
  behaviorTags: { outputMode: 'none', emitField: 'magnetic' },
}
