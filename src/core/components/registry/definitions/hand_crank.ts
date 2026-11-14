import type { ComponentDefinition } from '../../ComponentDefinition'

export const HAND_CRANK: ComponentDefinition = {
  id: 'hand_crank',
  displayName: '手摇发电机',
  description: '输入：按住左键逆时针/右键顺时针旋转（2秒加速到2π/s）；输出：电能，电压=角速度×10V/2π。法拉第1831年发现电磁感应：磁通量变化会在线圈中产生电动势。手摇发电机靠线圈在磁场中旋转发电，是人类最早的人力发电装置。早期无线电与军用电话都靠它供电。',
  price: 10,
  priceScaling: 1,
  portCount: 2,
  resistance: 3,
  ratedCurrent: 1.5,
  behaviorId: 'voltageSource',
  behaviorParams: { emf: 10, internalResistance: 3 },
  behaviorTags: { holdable: '1', rotatable: '1' },
}
