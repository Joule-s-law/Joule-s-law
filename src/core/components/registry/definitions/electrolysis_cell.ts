import type { ComponentDefinition } from '../../ComponentDefinition'

export const ELECTROLYSIS_CELL: ComponentDefinition = {
  id: 'electrolysis_cell',
  displayName: '电解池',
  description: '输入电能，按效率转化为化学能收益（无需关心具体材料），超过额定电流会熔毁。法拉第1834年提出电解定律：析出物的质量与通过的电量成正比。"电解（electrolysis）"一词正是他创造的。电解奠定了整个电化学工业的基础。',
  price: 120,
  priceScaling: 1.1,
  portCount: 2,
  resistance: 15,
  ratedCurrent: 3,
  behaviorId: 'converter',
  behaviorParams: { efficiency: 0.8 },
  behaviorTags: { outputMode: 'income', outputForm: 'chemical' },
}
