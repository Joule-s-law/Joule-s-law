import type { ComponentDefinition } from '../../ComponentDefinition'

export const MOTOR: ComponentDefinition = {
  id: 'motor',
  displayName: '电动机',
  description: '机械驱动源：通电后转子按电流大小输出角加速度（额定电流时 8π/s²），带动相邻齿轮组成旋转系统。同步转速上限 4π/s，电流反向则反转。转子发热会造成过载，注意散热余量。',
  loreDescription: '奥斯特1820年发现电流能使磁针偏转，法拉第据此造出最早的电动机模型。现代电动机实现了电能与机械能的大规模互换——游戏中它是全电动传动链的起点。',
  price: 300,
  priceScaling: 1.1,
  portCount: 2,
  resistance: 10,
  ratedCurrent: 4,
  behaviorId: 'motor',
  behaviorParams: { maxOmega: 2 },
  behaviorTags: { rotatable: '1' },
}
