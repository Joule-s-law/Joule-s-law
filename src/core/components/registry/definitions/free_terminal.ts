import type { ComponentDefinition } from '../../ComponentDefinition'

export const FREE_TERMINAL: ComponentDefinition = {
  id: 'free_terminal',
  displayName: '游离接线柱',
  description: '一个不占棋盘格的独立接线柱：可以放在画布任意位置（不必对齐格子），放好后按住即可随意拖动。电气行为和元件自带的接线柱完全一样——把导线连上去，它就是一个自由节点/汇流点，也常用来给飞线做中转。',
  loreDescription: '面包板上的每一排插孔都是游离接线柱：它们自己不是任何元件，却让电路的拓扑可以自由重组。物理实验里的鳄鱼夹和接线端子也扮演同样的角色。',
  price: 10,
  priceScaling: 1.1,
  portCount: 1,
  resistance: 0,
  ratedCurrent: 0,
  behaviorId: 'freeTerminal',
  behaviorParams: {},
  behaviorTags: {},
  width: 1,
  height: 1,
}
