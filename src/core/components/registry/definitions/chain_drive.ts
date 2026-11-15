import type { ComponentDefinition } from '../../ComponentDefinition'

export const CHAIN_DRIVE: ComponentDefinition = {
  id: 'chain_drive',
  displayName: '链式传动杆',
  description: '机械传动件（不接电）：绷直的履带连接两个齿轮，使它们同向同速旋转。每个齿轮只能挂一条链条，且链条之间不能交叉。链条的同向约束若与齿轮啮合的反向约束冲突，整个系统会锁死。',
  loreDescription: '自行车链条于1885年由约翰·肯普·斯塔利发明，至今仍是最高效的机械传动方式之一。',
  price: 60,
  priceScaling: 1.2,
  portCount: 0,
  resistance: 0,
  ratedCurrent: 0,
  behaviorId: 'chainDrive',
  behaviorParams: {},
  behaviorTags: {},
}
