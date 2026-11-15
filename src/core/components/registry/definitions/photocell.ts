import type { ComponentDefinition } from '../../ComponentDefinition'

export const PHOTOCELL: ComponentDefinition = {
  id: 'photocell',
  displayName: '光伏板',
  description: '感应周围光场亮度，产生最大8V的电动势输出电能——把灯泡的光照进你的电路；红+蓝−标记会随实际电压实时显示正负极。',
  loreDescription: '贝克勒尔1839年首次观察到光生伏特效应。1954年贝尔实验室制成第一块实用硅太阳能电池。光电转换让"光→电"成为现实的能量通道。',
  price: 180,
  priceScaling: 1.1,
  portCount: 2,
  resistance: 20,
  ratedCurrent: 2,
  behaviorId: 'fieldSensor',
  behaviorParams: { emfPerUnit: 0.5, emfMax: 8 },
  behaviorTags: { sensorField: 'light' },
}
