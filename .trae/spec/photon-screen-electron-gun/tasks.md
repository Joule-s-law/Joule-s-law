# 任务清单：光子屏 + 电子枪

- [x] T1 core 定义层：ComponentDefinition BehaviorId + portLayout 'vertical'；BaseComponent vertical 端口分支
- [x] T2 新建 definitions/photon_screen.ts、definitions/electron_gun.ts 并在 index.ts 注册（labels）
- [x] T3 新建 PhotonScreenComponent（spots 金斑 2s）、ElectronGunComponent（aimAngle/launchSpeed/emitAccum onTick 发射）
- [x] T4 Simulation + TickContext：emitElectron 事件流 + drainElectronLaunches
- [x] T5 componentRegistry：options + 2 个 case；TechTree BASE_UNLOCKED_COMPONENTS；SaveService 存档字段
- [x] T6 BoardCanvas：callbacks、发射事件生成电子（charge -1）、光子屏 AABB 碰撞、绘制（光斑/枪体）
- [x] T7 BoardView 回调 + useGameStore（ComponentInfo 字段 + set 动作）+ InfoPanel（方向/初速滑条、频率显示）
- [x] T8 全量验证：vue-tsc / pnpm test / pnpm run build
