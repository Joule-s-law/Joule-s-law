import type { ComponentDefinition } from '../../ComponentDefinition'

export const PHOTON_SCREEN: ComponentDefinition = {
  id: 'photon_screen',
  displayName: '光子屏',
  description: '一块可自由设定尺寸的绝缘荧光屏：在商店点击后按住鼠标在画布上拖出矩形即可放置（按面积计价）。带电粒子撞上会被吸收并在撞击位置留下金色光点，光点每2秒向传播方向移动一格，移出屏幕后消失——用电子枪持续打点、把屏摆成横条，就是一台示波器。传播方向在元件信息面板调整。',
  loreDescription: '1897年汤姆孙借助荧光屏观察到阴极射线在电场中的偏转，从而发现了电子。荧光屏把不可见的粒子轨迹变成可见的光斑，是粒子物理最古老的"显示器"。',
  price: 150,
  priceScaling: 1.1,
  portCount: 2,
  resistance: 1e9,
  ratedCurrent: 0.01,
  behaviorId: 'photonScreen',
  behaviorParams: { spotDuration: 2 },
  behaviorTags: {},
  width: 1,
  height: 1,
  portLayout: 'vertical',
}
