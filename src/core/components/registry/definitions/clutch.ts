import type { ComponentDefinition } from '../../ComponentDefinition'

export const CLUTCH: ComponentDefinition = {
  id: 'clutch',
  displayName: '离合器',
  description: '带电磁吸合机构的传动件：未通电时齿轮抬起（悬浮在啮合平面上方，不与任何齿轮耦合，靠自身阻尼自由减速）；通电后齿轮落下与相邻齿轮啮合传动。接合瞬间整个耦合系统按角动量守恒重算转速——挂上重载会明显掉速。',
  loreDescription: '离合器让旋转的动力"按需接入"。1940年代的汽车已经用液压离合器换挡，而电磁离合器利用电流产生磁力压紧摩擦片，让机器在不停机的情况下切换负载。',
  price: 80,
  priceScaling: 1.15,
  portCount: 2,
  resistance: 0.5,
  ratedCurrent: 2,
  behaviorId: 'clutch',
  behaviorParams: { teeth: 8, damping: 0.5, engageCurrent: 0.01, maxOmega: Math.PI * 12 },
  behaviorTags: { rotatable: '1' },
  width: 1,
  height: 1,
}

export const FLYWHEEL: ComponentDefinition = {
  id: 'flywheel',
  displayName: '飞轮',
  description: '大惯量储能轮：阻尼为0，不会让系统减速；巨大的转动惯量让接合它的系统转速更平稳，断电后靠惯性长时间滑行。与齿轮啮合时按角动量守恒交换转速。',
  loreDescription: '从陶轮到蒸汽机，飞轮一直是储存旋转动能的工具。单缸发动机靠飞轮跨过做功间隙，现代电网的飞轮储能电站能把动能存进钢轮再放出来。',
  price: 60,
  priceScaling: 1.15,
  portCount: 0,
  resistance: 0,
  ratedCurrent: 0,
  behaviorId: 'gear',
  behaviorParams: { teeth: 12, damping: 0, inertia: 8, maxOmega: Math.PI * 24 },
  behaviorTags: { rotatable: '1' },
  width: 1,
  height: 1,
}
