import type { ComponentDefinition } from '../../ComponentDefinition'

export const ELECTRON_GUN: ComponentDefinition = {
  id: 'electron_gun',
  displayName: '电子枪',
  description: '通电后向指定方向发射电子（电荷量-1e）：两端电压每+1V发射频率+1Hz，未通电时不发射；在元件信息面板可调节发射方向（0~2π）和初速度。',
  loreDescription: '阴极射线管是电子技术的起点：布劳恩1897年用它做出了第一台示波器，电视机的显像管正是它的后代。热阴极发射的电子在电场中加速，被聚焦成束射向目标。',
  price: 120,
  priceScaling: 1.1,
  portCount: 2,
  resistance: 1000,
  ratedCurrent: 2,
  behaviorId: 'electronGun',
  behaviorParams: {},
  behaviorTags: {},
  width: 1,
  height: 1,
}
