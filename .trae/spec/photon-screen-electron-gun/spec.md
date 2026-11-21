# 光子屏 + 电子枪 实施规格

## 需求原文
- 光子屏：7 高 1 宽；玩家鼠标发射的带电粒子撞击后粒子被摧毁，撞击位置变金色并维持 2 秒。
- 电子枪：1×1；元件信息面板控制发射方向（0~2π）和初速度；两端电压每 +1V 发射频率 +1Hz；未通电不发射；电子 = 电荷量为 -1e 的带电粒子（即 charge=-1 的 ChargedParticle）。

## 已确认的调研结论
- 粒子系统在 UI 层（BoardCanvas.particles，上限 80），charge 单位为 e 数量；粒子每帧最大位移约 3px，中心点 AABB 检测不会隧穿 1 格宽屏幕。
- 元件事件流模式：Simulation.emitEnergy（上限 64）→ drainEnergyEvents → BoardCanvas 消费；电子发射仿此新增事件队列。
- SimulationHost 接口（TickContext.ts）是元件 onTick 触发事件的通道，需新增 emitElectron 方法。
- BaseComponent.getPortWorldPos 默认 2 端口在左右两侧中点；1×7 竖条需新增 `portLayout: 'vertical'`（上端中点 / 下端中点）。
- BoardView.vue 回调直接透传 `game.sim.drainEnergyEvents()`，新增 drain 同样直接透传，无需改 store 的 drain。
- 存档模式：SavedComponent 可选字段 + serialize 展开分支 + createComponentById options 反序列化。

## 变更清单

### 1. src/core/components/ComponentDefinition.ts
- BehaviorId 增加 `'photonScreen' | 'electronGun'`
- portLayout 类型增加 `'vertical'`

### 2. src/core/components/BaseComponent.ts
- getPortWorldPos 增加 vertical 分支：port0 = (x+w/2, top)，port1 = (x+w/2, top+height)

### 3. src/core/components/registry/definitions/photon_screen.ts（新建）
- id 'photon_screen'，1 宽 7 高，price 150 / scaling 1.1，portCount 2，resistance 1e9，ratedCurrent 0.01，behaviorId 'photonScreen'，behaviorParams `{ spotDuration: 2 }`
- 描述：绝缘背景板，带电粒子撞击留下金色荧光斑（光电/荧光效应）

### 4. src/core/components/registry/definitions/electron_gun.ts（新建）
- id 'electron_gun'，1×1，price 120 / scaling 1.1，portCount 2，resistance 1000，ratedCurrent 2，behaviorId 'electronGun'，behaviorParams `{ minLaunchSpeed: 50 }`
- 描述：通电后按 |电压| Hz 频率发射电子（阴极射线管原理）

### 5. src/core/components/registry/definitions/index.ts
- import + ALL_DEFS 注册 + COMPONENT_LABELS：photon_screen ['光电效应']，electron_gun ['电子发射'] + re-export

### 6. src/core/components/behaviors/PhotonScreenComponent.ts（新建）
- extends ResistiveComponent
- `readonly spots: { localY: number; bornAt: number }[]`（localY = 相对元件顶部的像素偏移，bornAt = simTime）
- `addSpot(worldX, worldY): void`：仅当 worldX 在屏幕列内时记录；spots 上限 64，addSpot 时清理过期（2s）
- `getSpotAlpha(spot, simTime)`: 剩余时间 > 0.5s 不衰减，否则线性降到 0

### 7. src/core/components/behaviors/ElectronGunComponent.ts（新建）
- extends ResistiveComponent
- `aimAngle = 0`（弧度，0 = 向右，屏幕 y 向下故 vy = sin）
- `launchSpeed = 300`（px/s，范围 50~700）
- `emitAccum = 0`
- onTick：`freq = Math.abs(this.voltage)`；freq > 0 时 `emitAccum += ctx.dt`，while (emitAccum >= 1/freq) 发射：位置 = 元件中心像素 ± 随机抖动 3px，速度 = (cos, sin) × launchSpeed，调 `ctx.host.emitElectron(...)`；同时保留基类焦耳热逻辑（super.onTick(ctx)）

### 8. src/core/sim/TickContext.ts + Simulation.ts
- SimulationHost 增加 `emitElectron(x, y, vx, vy): void`
- Simulation 增加 `ElectronLaunch {x,y,vx,vy}`、私有 `electronLaunches` 数组（单 tick 上限 128）、`emitElectron` 实现、`drainElectronLaunches(): ElectronLaunch[]`

### 9. src/core/components/registry/componentRegistry.ts
- ComponentCreateOptions 增加 `electronGunAngle?` / `electronGunSpeed?`
- createComponent switch 增加 'photonScreen' / 'electronGun' case（构造时应用角度/初速度）

### 10. src/core/tech/TechTree.ts
- BASE_UNLOCKED_COMPONENTS 增加 'photon_screen'、'electron_gun'

### 11. src/core/save/SaveService.ts
- SavedComponent 增加 `electronGunAngle?` / `electronGunSpeed?`
- serialize：instanceof ElectronGunComponent 分支展开
- deserialize：透传到 createComponentById options

### 12. src/ui/board/BoardCanvas.ts
- BoardCallbacks 增加 `drainElectronLaunches(): ElectronLaunch[]`
- render 主循环：updateParticles 前消费 launch 事件生成 ChargedParticle（charge=-1，上限 80，超出 shift）
- updateParticles：积分后遍历粒子 × PhotonScreenComponent，中心点 AABB 命中 → 移除粒子 + addSpot
- drawComponents：PhotonScreenComponent 分支画竖条主体 + 金色光斑（金色 #ffd54f，按剩余寿命 alpha 衰减）；ElectronGunComponent 分支画枪体圆 + 方向指示线 + 名字 y+10

### 13. src/ui/components/BoardView.vue
- callbacks 增加 `drainElectronLaunches: () => game.sim.drainElectronLaunches()`

### 14. src/ui/stores/useGameStore.ts
- ComponentInfo 增加 `isElectronGun` / `aimAngle` / `launchSpeed` / `launchFrequency`（= |voltage| Hz）
- 新 action `setElectronGunAim(angle)` / `setElectronGunSpeed(speed)` 并加入 return 导出
- import ElectronGunComponent

### 15. src/ui/components/InfoPanel.vue
- 电子枪分支：方向滑条 0~6.283 step 0.05（显示角度+弧度）、初速滑条 50~700 step 10、发射频率行（|voltage| Hz，未通电提示）

## 验证
- `pnpm exec vue-tsc --noEmit` 类型检查通过
- `pnpm test` 全部通过
- `pnpm run build` 构建通过
