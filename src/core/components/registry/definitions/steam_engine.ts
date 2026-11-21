import type { ComponentDefinition } from '../../ComponentDefinition'

export const STEAM_ENGINE: ComponentDefinition = {
  id: 'steam_engine',
  displayName: '蒸汽机',
  description: '流体源：通电后把电能转化为热能"烧水"，按功率持续输出蒸汽。蒸汽优先进入相邻管道（线路中已有其他流体时不注入），没有管道时直接释放到空间中（蒸汽会上升）。',
  loreDescription: '瓦特1769年改进蒸汽机并发明分离式冷凝器，掀起了第一次工业革命。卡诺1824年据此提出卡诺循环，奠定热力学第二定律。游戏中它把电能变成蒸汽流体。',
  price: 400,
  priceScaling: 1.1,
  portCount: 2,
  resistance: 12,
  ratedCurrent: 4,
  behaviorId: 'steamSource',
  behaviorParams: { steamRate: 3, overloadTolerance: 1 },
  behaviorTags: {},
}
