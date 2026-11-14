import type { ComponentDefinition } from '../../ComponentDefinition'

export const SECONDARY_BATTERY: ComponentDefinition = {
  id: 'secondary_battery',
  displayName: '二次电池',
  description: '可反复充电/放电：把外部电源的"+"极接到电池的"+"极（红标）才会充电，接反了电池反而会放电；可在信息面板观察充电/放电状态。普朗特1859年发明可充电的铅酸电池。二次电池让能量得以"先存后用"。今天的锂电池已支撑起电动汽车与手机。',
  price: 350,
  priceScaling: 1.1,
  portCount: 2,
  resistance: 4,
  ratedCurrent: 5,
  behaviorId: 'battery',
  behaviorParams: { emfFull: 6, capacityJ: 5000, chargeEfficiency: 0.8 },
  behaviorTags: {},
}
