import type { ComponentDefinition } from '../../ComponentDefinition'

export const PIPE: ComponentDefinition = {
  id: 'pipe',
  displayName: '管道',
  description: '流体管道：按住鼠标拖动即可自由绘制（只能横竖走线，可交叉）。管道四条边自带液体接口，接口相对接即自动并线；一条线路同一时间只能传输一种流体——已装蒸汽的线路接上存水的储罐时，储罐不会把水输出进去。',
  loreDescription: '从罗马的铅管到现代的城市管网，管道让流体能够被输送到任意远方。工业管道的法兰接口必须对齐，否则轻则泄漏，重则爆管。',
  price: 15,
  priceScaling: 1,
  portCount: 0,
  resistance: 0,
  ratedCurrent: 0,
  behaviorId: 'pipe',
  behaviorParams: {},
  behaviorTags: {},
  width: 1,
  height: 1,
}

export const TANK: ComponentDefinition = {
  id: 'tank',
  displayName: '储罐',
  description: '流体储罐：可同时从管道输入和输出流体，容量100单位。一个储罐只能储存一种流体——已装蒸汽的罐不会接收水，空罐接收第一种进入的流体后即被"占用"。',
  loreDescription: '从水塔到液化天然气储罐，储存是流体系统的缓冲器。储罐让供应与消耗不必同步：蒸汽机可以持续产汽，涡轮想什么时候吃就什么时候吃。',
  price: 250,
  priceScaling: 1.15,
  portCount: 0,
  resistance: 0,
  ratedCurrent: 0,
  behaviorId: 'tank',
  behaviorParams: { capacity: 100, transferRate: 4, outputRate: 2 },
  behaviorTags: {},
  width: 2,
  height: 2,
}

export const CONDENSER: ComponentDefinition = {
  id: 'condenser',
  displayName: '冷凝板',
  description: '宽5格的冷凝表面：蒸汽接触到它就会凝结成水。凝结出的水优先输出到相邻管道，若没有接管道（或管道里已是其他流体），则从左右两个侧面释放到空间中自然下落。',
  loreDescription: '瓦特的分离式冷凝器把汽缸和冷凝分开，让热机效率提升数倍。发电厂的冷凝塔把废气蒸汽凝回水循环利用——你看到电厂上方的"白云"其实正是被释放的水蒸气。',
  price: 180,
  priceScaling: 1.15,
  portCount: 0,
  resistance: 0,
  ratedCurrent: 0,
  behaviorId: 'condenser',
  behaviorParams: { steamIntake: 4, waterOutput: 4 },
  behaviorTags: {},
  width: 5,
  height: 1,
}
