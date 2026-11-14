import type { ComponentDefinition } from '../../ComponentDefinition'

export const MOTOR: ComponentDefinition = {
  id: 'motor',
  displayName: '电动机',
  description: '输出元件：输入电能，按效率把能量注入动能池（供涡轮发电机吸收），本身不是可旋转元件。奥斯特1820年发现电流能使磁针偏转，法拉第据此造出最早的电动机模型。现代电动机实现了电能与机械能的大规模互换。它是动能产业的起点。',
  price: 300,
  priceScaling: 1.1,
  portCount: 2,
  resistance: 10,
  ratedCurrent: 4,
  behaviorId: 'converter',
  behaviorParams: { efficiency: 0.85 },
  behaviorTags: { outputMode: 'kineticPool' },
}
