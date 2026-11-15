import type { ComponentDefinition } from '../../ComponentDefinition'

export const SECONDARY_BATTERY: ComponentDefinition = {
  id: 'secondary_battery',
  displayName: '原电池',
  description: '可反复充电/放电的化学电池（5×3）。放置时随机生成电极材料、电解质溶液与离子交换膜——电极组合保证构成可充电的二次电池。元件上不标注正负极：观察溶液中的离子移动方向和通电后的极性显示，自己判断谁是正极。选中原电池后可在信息面板重新随机生成配置。',
  price: 350,
  priceScaling: 1.1,
  portCount: 2,
  width: 5,
  height: 3,
  resistance: 4,
  ratedCurrent: 5,
  behaviorId: 'battery',
  behaviorParams: { emfFull: 6, capacityJ: 5000, chargeEfficiency: 0.8 },
  behaviorTags: {},
}
