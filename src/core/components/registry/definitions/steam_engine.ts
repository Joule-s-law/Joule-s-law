import type { ComponentDefinition } from '../../ComponentDefinition'

export const STEAM_ENGINE: ComponentDefinition = {
  id: 'steam_engine',
  displayName: '蒸汽机',
  description: '输出元件：输入电能模拟"烧水做功"，按效率把能量注入动能池，本身不是可旋转元件。瓦特1769年改进蒸汽机并发明分离式冷凝器，掀起了第一次工业革命。卡诺1824年据此提出卡诺循环，奠定热力学第二定律。游戏中它以电代煤，演示经典的热-功转换。',
  price: 400,
  priceScaling: 1.1,
  portCount: 2,
  resistance: 12,
  ratedCurrent: 4,
  behaviorId: 'converter',
  behaviorParams: { efficiency: 0.7 },
  behaviorTags: { outputMode: 'kineticPool' },
}
