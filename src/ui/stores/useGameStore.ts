import { defineStore } from 'pinia'
import { markRaw, ref, shallowRef } from 'vue'
import { Simulation } from '../../core/sim/Simulation'
import { TickLoop } from '../../core/sim/TickLoop'
import { TechTree, TECH_NODES } from '../../core/tech/TechTree'
import type { TechNode } from '../../core/tech/TechTree'
import { SaveService } from '../../core/save/SaveService'
import { COMPONENT_DEFS, createComponentById } from '../../core/components/registry/componentRegistry'
import type { ComponentDefinition } from '../../core/components/ComponentDefinition'
import type { BaseComponent } from '../../core/components/BaseComponent'
import { WireComponent } from '../../core/components/behaviors/WireComponent'
import { SwitchComponent } from '../../core/components/behaviors/SwitchComponent'
import { BatteryComponent } from '../../core/components/behaviors/BatteryComponent'
import { FourthGeneratorComponent } from '../../core/components/behaviors/FourthGeneratorComponent'
import { ClutchComponent } from '../../core/components/behaviors/ClutchComponent'
import { FreeTerminalComponent } from '../../core/components/behaviors/FreeTerminalComponent'
import { TankComponent } from '../../core/components/behaviors/TankComponent'
import { TurbineComponent } from '../../core/components/behaviors/TurbineComponent'
import { ElectronGunComponent } from '../../core/components/behaviors/ElectronGunComponent'
import { PhotonScreenComponent } from '../../core/components/behaviors/PhotonScreenComponent'
import type { PhotonPropagation } from '../../core/components/behaviors/PhotonScreenComponent'
import { VoltageTransformerComponent } from '../../core/components/behaviors/VoltageTransformerComponent'
import { ChainDriveComponent, gearCenter } from '../../core/components/behaviors/ChainDriveComponent'
import { FourthWallClient } from '../../net/FourthWallClient'
import { useSettingsStore } from '../settings/useSettingsStore'
import { WIRE } from '../../core/components/registry/definitions'
import { WIRE_MATERIALS, getWireMaterial, DEFAULT_WIRE_MATERIAL_ID } from '../../core/components/registry/wireMaterials'
import { CELL_SIZE, portPosition, wireDistance } from '../board/boardMath'

const WIRE_MATERIAL_PREF_KEY = 'joules-law-wire-material'

const SELL_REFUND_RATIO = 0.5
const TECH_LAYOUT_KEY = 'joules-law-tech-layout'

export interface ComponentInfo {
  uid: number
  displayName: string
  defId: string
  description: string
  loreDescription: string | null
  labels: string[]
  current: number
  voltage: number
  resistance: number
  ratedCurrent: number
  overloadRatio: number
  isWire: boolean
  isSwitch: boolean
  isBattery: boolean
  switchClosed: boolean
  stateOfCharge: number
  wireMaterialId: string
  wireVisualColor: string
  isMagneticSensor: boolean
  sensedFluxDensity: number
  sensedFlux: number
  isTransformer: boolean
  inputVoltage: number
  inputCurrent: number
  isFourthGenerator: boolean
  isClutch: boolean
  clutchEngaged: boolean
  fourthGenUuid: string
  fourthGenName: string
  externalEmf: number
  externalMaxEmf: number
  isTank: boolean
  tankFluidId: string | null
  tankAmount: number
  tankCapacity: number
  isTurbine: boolean
  turbineSteamPower: number
  isElectronGun: boolean
  aimAngle: number
  launchSpeed: number
  launchFrequency: number
  isPhotonScreen: boolean
  propagation: PhotonPropagation
  rotatable: boolean
  rotationSpeed: number
  monitored: boolean
  batteryConfig: {
    negativeName: string
    positiveName: string
    electrolyteName: string
    cationName: string
    anionName: string
    membrane: string
  } | null
}

export interface TechNodeInfo {
  id: string
  displayName: string
  bio: string
  levelEffect: string
  level: number
  maxLevel: number
  cost: number
  unlocked: boolean
  canBuy: boolean
  parentName: string | null
  x: number
  y: number
}

export const useGameStore = defineStore('game', () => {
  const sim = markRaw(new Simulation())
  const techTree = markRaw(new TechTree(sim))
  const saver = new SaveService(sim, techTree)

  const money = ref(0)
  const incomePerSecond = ref(0)
  const clickCooldownRemaining = ref(0)
  const clickHeat = ref(1)
  const selectedComponent = shallowRef<BaseComponent | null>(null)
  const selectedInfo = ref<ComponentInfo | null>(null)
  const wirePendingPort = shallowRef<{ owner: BaseComponent; portIndex: number; color: string | null } | null>(null)
  const offlineGained = ref(0)
  const unlockedComponentsVersion = ref(0)
  const saveMarker = ref(0)
  const techTreeOpen = ref(false)
  const chainPlacing = ref(false)
  const chainFirstGear = shallowRef<BaseComponent | null>(null)
  const toast = ref<string | null>(null)
  let toastTimer: ReturnType<typeof setTimeout> | null = null

  function showToast(message: string): void {
    toast.value = message
    if (toastTimer !== null) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      toast.value = null
      toastTimer = null
    }, 2500)
  }
  const selectedTechId = ref<string | null>(null)
  const techVersion = ref(0)
  const clickProgress = ref(1)

  const uids = new WeakMap<BaseComponent, number>()
  let nextUid = 1
  const settings = useSettingsStore()

  const fourthWall = new FourthWallClient(settings.wsUrl, (totals, maxTotals) => {
    for (const component of sim.components) {
      if (!(component instanceof FourthGeneratorComponent)) continue
      component.externalEmf = totals[component.uuid] ?? 0
      component.externalMaxEmf = maxTotals[component.uuid] ?? 0
    }
  })
  let lastGeneratorSync = ''
  const preferredWireMaterial = ref(readPreferredWireMaterial())

  function readPreferredWireMaterial(): string {
    const raw = localStorage.getItem(WIRE_MATERIAL_PREF_KEY)
    if (raw !== null && WIRE_MATERIALS.has(raw)) return raw
    return DEFAULT_WIRE_MATERIAL_ID
  }

  function syncFourthGenerators(): void {
    if (!techTree.isComponentUnlocked('fourth_generator')) return
    fourthWall.connect()
    const list = sim.components
      .filter((component): component is FourthGeneratorComponent => component instanceof FourthGeneratorComponent)
      .map((component) => ({ uuid: component.uuid, name: component.customName }))
    const key = JSON.stringify(list)
    if (key === lastGeneratorSync) return
    lastGeneratorSync = key
    fourthWall.sendSync(list)
  }

  function uidOf(component: BaseComponent): number {
    let uid = uids.get(component)
    if (uid === undefined) {
      uid = nextUid++
      uids.set(component, uid)
    }
    return uid
  }

  const loadResult = saver.load()
  if (loadResult !== null) {
    offlineGained.value = loadResult.offlineGained
  } else {
    sim.economy.money = 20
  }

  const loop = new TickLoop(sim, 100)
  loop.start()

  function refreshSnapshot(): void {
    money.value = sim.economy.money
    incomePerSecond.value = sim.incomePerSecond
    clickCooldownRemaining.value = sim.clickReadyIn()
    clickHeat.value = sim.clickHeat
    clickProgress.value = sim.clickCooldown > 0 ? 1 - sim.clickReadyIn() / sim.clickCooldown : 1
    const selected = selectedComponent.value
    if (selected !== null && sim.components.includes(selected)) {
      selectedInfo.value = buildInfo(selected)
    } else {
      selectedComponent.value = null
      selectedInfo.value = null
    }
    syncFourthGenerators()
  }

  function buildInfo(component: BaseComponent): ComponentInfo {
    return {
      uid: uidOf(component),
      displayName: component.def.displayName,
      defId: component.def.id,
      description: component.def.description,
      loreDescription: component.def.loreDescription ?? null,
      labels: component.def.labels ?? [],
      current: component.current,
      voltage: component.voltage,
      resistance: component.getResistance(),
      ratedCurrent: component.def.ratedCurrent * sim.ratedCurrentBoost,
      overloadRatio: Math.min(1, component.overloadSeconds / (component.def.behaviorParams['overloadTolerance'] ?? 1)),
      isWire: component instanceof WireComponent,
      isSwitch: component instanceof SwitchComponent,
      isBattery: component instanceof BatteryComponent,
      switchClosed: component instanceof SwitchComponent ? component.closed : false,
      stateOfCharge: component instanceof BatteryComponent ? component.stateOfCharge : 0,
      wireMaterialId: component instanceof WireComponent ? component.getMaterialId() : '',
      wireVisualColor: component instanceof WireComponent ? component.getVisualColor() : '',
      isMagneticSensor: component.def.behaviorTags['sensorField'] === 'magnetic',
      sensedFluxDensity: component.getSensedFluxDensity(),
      sensedFlux: component.getSensedFlux(),
      isTransformer: component instanceof VoltageTransformerComponent,
      inputVoltage: component instanceof VoltageTransformerComponent ? component.getInputVoltage() : 0,
      inputCurrent: component instanceof VoltageTransformerComponent ? component.getInputCurrent() : 0,
      isFourthGenerator: component instanceof FourthGeneratorComponent,
      isClutch: component instanceof ClutchComponent,
      clutchEngaged: component instanceof ClutchComponent ? component.engaged : false,
      fourthGenUuid: component instanceof FourthGeneratorComponent ? component.uuid : '',
      fourthGenName: component instanceof FourthGeneratorComponent ? component.customName : '',
      externalEmf: component instanceof FourthGeneratorComponent ? component.externalEmf : 0,
      externalMaxEmf: component instanceof FourthGeneratorComponent ? component.externalMaxEmf : 0,
      isTank: component instanceof TankComponent,
      tankFluidId: component instanceof TankComponent ? component.storedFluidId : null,
      tankAmount: component instanceof TankComponent ? component.storedAmount : 0,
      tankCapacity: component instanceof TankComponent ? component.capacity : 0,
      isTurbine: component instanceof TurbineComponent,
      turbineSteamPower: component instanceof TurbineComponent ? component.steamPower : 0,
      isElectronGun: component instanceof ElectronGunComponent,
      aimAngle: component instanceof ElectronGunComponent ? component.aimAngle : 0,
      launchSpeed: component instanceof ElectronGunComponent ? component.launchSpeed : 0,
      launchFrequency: component instanceof ElectronGunComponent ? Math.abs(component.voltage) : 0,
      isPhotonScreen: component instanceof PhotonScreenComponent,
      propagation: component instanceof PhotonScreenComponent ? component.propagation : 'right',
      rotatable: component.def.behaviorTags['rotatable'] === '1',
      rotationSpeed: component.rotationSpeed,
      monitored: component.monitored,
      batteryConfig:
        component instanceof BatteryComponent
          ? {
              negativeName: component.cellConfig.negativeName,
              positiveName: component.cellConfig.positiveName,
              electrolyteName: component.cellConfig.electrolyteName,
              cationName: component.cellConfig.cationName,
              anionName: component.cellConfig.anionName,
              membrane: component.cellConfig.membrane,
            }
          : null,
    }
  }

  setInterval(refreshSnapshot, 100)
  window.addEventListener('mousemove', (event) => {
    updateShopDrag(event.clientX, event.clientY)
  })
  window.addEventListener('mouseup', () => {
    endShopDrag()
  })
  ;(window as unknown as { gainCoin: (amount: number) => void }).gainCoin = (amount: number) => {
    sim.economy.money += amount
    refreshSnapshot()
  }
  refreshSnapshot()

  function shopItems(): { def: ComponentDefinition; price: number; unlocked: boolean }[] {
    const items: { def: ComponentDefinition; price: number; unlocked: boolean }[] = []
    for (const def of COMPONENT_DEFS.values()) {
      if (def.id === 'wire') continue
      items.push({ def, price: settings.freePurchases ? 0 : sim.getComponentPrice(def), unlocked: techTree.isComponentUnlocked(def.id) })
    }
    return items
  }

  function techNodeInfos(): TechNodeInfo[] {
    const infos: TechNodeInfo[] = []
    for (const node of TECH_NODES) {
      if (!techTree.isRevealed(node.id)) continue
      const layout = techLayout.positions[node.id] ?? defaultNodePosition(node)
      const parent = node.parentId !== null ? TECH_NODES.find((n) => n.id === node.parentId) : undefined
      infos.push({
        id: node.id,
        displayName: node.displayName,
        bio: node.bio,
        levelEffect: node.levelEffect(techTree.getLevel(node.id) + 1),
        level: techTree.getLevel(node.id),
        maxLevel: node.maxLevel,
        cost: techTree.getCost(node.id),
        unlocked: techTree.isUnlocked(node.id),
        canBuy: techTree.canBuy(node.id) && (settings.freePurchases || techTree.getCost(node.id) <= sim.economy.money),
        parentName: parent?.displayName ?? null,
        x: layout.x,
        y: layout.y,
      })
    }
    return infos
  }

  function nodeDepth(node: TechNode): number {
    let depth = 0
    let cursor: string | null = node.parentId
    while (cursor !== null) {
      depth++
      cursor = TECH_NODES.find((n) => n.id === cursor)?.parentId ?? null
    }
    return depth
  }

  function defaultNodePosition(node: TechNode): { x: number; y: number } {
    const depth = nodeDepth(node)
    const sameDepth = TECH_NODES.filter((n) => nodeDepth(n) === depth)
    return { x: 80 + depth * 260, y: 80 + sameDepth.indexOf(node) * 130 }
  }

  const techLayout = loadTechLayout()

  function loadTechLayout(): { positions: Record<string, { x: number; y: number }>; view: { x: number; y: number } } {
    const empty = { positions: {}, view: { x: 0, y: 0 } }
    try {
      const raw = localStorage.getItem(TECH_LAYOUT_KEY)
      if (raw === null) return empty
      const layout = JSON.parse(raw) as { positions: Record<string, { x: number; y: number }>; view: { x: number; y: number } }
      const seen = new Set<string>()
      for (const [id, pos] of Object.entries(layout.positions)) {
        const key = `${Math.round(pos.x)},${Math.round(pos.y)}`
        if (seen.has(key)) delete layout.positions[id]
        else seen.add(key)
      }
      return layout
    } catch {
      return empty
    }
  }

  function saveTechLayout(): void {
    localStorage.setItem(TECH_LAYOUT_KEY, JSON.stringify(techLayout))
  }

  function setTechNodePosition(id: string, x: number, y: number): void {
    techLayout.positions[id] = { x, y }
    saveTechLayout()
  }

  function setTechView(x: number, y: number): void {
    techLayout.view = { x, y }
    saveTechLayout()
  }

  function openTechTree(): void {
    techTreeOpen.value = true
    selectedTechId.value = null
  }

  function closeTechTree(): void {
    techTreeOpen.value = false
    selectedTechId.value = null
  }

  function selectTech(id: string | null): void {
    selectedTechId.value = id
    techVersion.value++
  }

  function buyTechLevel(id: string): void {
    techTree.buy(id, settings.freePurchases)
    techVersion.value++
    unlockedComponentsVersion.value++
    refreshSnapshot()
  }

  function addMoney(amount: number): void {
    sim.economy.money += amount
    refreshSnapshot()
  }

  function debugUnlockEnder(): void {
    techTree.forceUnlock('ender_interface')
    techVersion.value++
    unlockedComponentsVersion.value++
    refreshSnapshot()
  }

  function debugUnlockAllTech(): void {
    techTree.forceUnlockAll()
    techVersion.value++
    unlockedComponentsVersion.value++
    refreshSnapshot()
  }

  function canvasBlankClick(x: number, y: number): void {
    if (wirePendingPort.value !== null) {
      wirePendingPort.value = null
      return
    }
    if (selectedComponent.value !== null) {
      selectComponent(null)
      return
    }
    sim.click(x, y)
    refreshSnapshot()
  }

  function getClickProgress(): number {
    return clickProgress.value
  }

  function selectComponent(component: BaseComponent | null): void {
    if (chainPlacing.value && component !== null) {
      handleChainPlacementClick(component)
      return
    }
    selectedComponent.value = component
    wirePendingPort.value = null
    selectedInfo.value = component !== null ? buildInfo(component) : null
  }

  function isGearComponent(component: BaseComponent): boolean {
    return component.def.behaviorId === 'gear'
  }

  function chainSegmentIntersectsAny(a: BaseComponent, b: BaseComponent): boolean {
    const pa = gearCenter(a)
    const pb = gearCenter(b)
    for (const chain of sim.components) {
      if (!(chain instanceof ChainDriveComponent)) continue
      if (segmentsIntersect2(pa, pb, chain.getEndpointA(), chain.getEndpointB())) return true
    }
    return false
  }

  function handleChainPlacementClick(component: BaseComponent): void {
    if (!isGearComponent(component)) {
      showToast('链式传动杆只能装在齿轮上')
      return
    }
    const first = chainFirstGear.value
    if (first === null) {
      if (sim.chainByGear.has(component)) {
        showToast('这个齿轮上已经有链条了')
        return
      }
      chainFirstGear.value = component
      return
    }
    if (component === first) {
      cancelChainPlacement()
      return
    }
    if (sim.chainByGear.has(component)) {
      showToast('这个齿轮上已经有链条了')
      return
    }
    const def = COMPONENT_DEFS.get('chain_drive')
    if (def === undefined) return
    const price = settings.freePurchases ? 0 : sim.getComponentPrice(def)
    if (sim.economy.money < price) {
      showToast('资金不足')
      return
    }
    if (chainSegmentIntersectsAny(first, component)) {
      showToast('链条不能与其他链条交叉')
      return
    }
    const chainPrice = settings.freePurchases ? 0 : price
    sim.economy.money -= chainPrice
    sim.registerPurchase(def)
    sim.addComponent(new ChainDriveComponent(def, first, component))
    chainPlacing.value = false
    chainFirstGear.value = null
    refreshSnapshot()
  }

  function cancelChainPlacement(): void {
    chainPlacing.value = false
    chainFirstGear.value = null
  }

  function startChainPlacement(): void {
    if (!techTree.isComponentUnlocked('chain_drive')) return
    const def = COMPONENT_DEFS.get('chain_drive')
    if (def === undefined) return
    if (!settings.freePurchases && sim.economy.money < sim.getComponentPrice(def)) return
    chainPlacing.value = true
    chainFirstGear.value = null
    selectComponentForChain()
  }

  function selectComponentForChain(): void {
    selectedComponent.value = null
    selectedInfo.value = null
  }

  function segmentsIntersect2(
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p3: { x: number; y: number },
    p4: { x: number; y: number },
  ): boolean {
    const d1 = (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x)
    const d2 = (p2.x - p1.x) * (p4.y - p1.y) - (p2.y - p1.y) * (p4.x - p1.x)
    const d3 = (p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)
    const d4 = (p4.x - p3.x) * (p2.y - p3.y) - (p4.y - p3.y) * (p2.x - p3.x)
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  }

  function isAreaFree(cellX: number, cellY: number, width: number, height: number, ignore: BaseComponent | null): boolean {
    for (const other of sim.components) {
      if (other === ignore) continue
      if (other instanceof WireComponent || other instanceof ChainDriveComponent) continue
      if (other.x < cellX + width && other.x + other.width > cellX && other.y < cellY + height && other.y + other.height > cellY) {
        return false
      }
    }
    return true
  }

  function findNearestFreeCell(
    cellX: number,
    cellY: number,
    width: number,
    height: number,
    ignore: BaseComponent | null,
  ): { x: number; y: number } | null {
    if (isAreaFree(cellX, cellY, width, height, ignore)) return { x: cellX, y: cellY }
    const visited = new Set<string>([`${cellX},${cellY}`])
    const queue: Array<{ x: number; y: number }> = [{ x: cellX, y: cellY }]
    while (queue.length > 0) {
      const cell = queue.shift()
      if (cell === undefined) break
      const neighbors: Array<[number, number]> = [
        [cell.x + 1, cell.y],
        [cell.x - 1, cell.y],
        [cell.x, cell.y + 1],
        [cell.x, cell.y - 1],
      ]
      for (const [nx, ny] of neighbors) {
        const key = `${nx},${ny}`
        if (visited.has(key)) continue
        visited.add(key)
        if (isAreaFree(nx, ny, width, height, ignore)) return { x: nx, y: ny }
        queue.push({ x: nx, y: ny })
      }
    }
    return null
  }

  function tryPlaceAt(defId: string, cellX: number, cellY: number): void {
    const def = COMPONENT_DEFS.get(defId)
    if (def === undefined || !techTree.isComponentUnlocked(defId)) return
    if (!isAreaFree(cellX, cellY, def.width ?? 1, def.height ?? 1, null)) {
      const free = findNearestFreeCell(cellX, cellY, def.width ?? 1, def.height ?? 1, null)
      if (free === null) return
      cellX = free.x
      cellY = free.y
    }
    const price = settings.freePurchases ? 0 : sim.getComponentPrice(def)
    if (sim.economy.money < price) return
    sim.economy.money -= price
    sim.registerPurchase(def)
    const component = createComponentById(defId)
    component.x = cellX
    component.y = cellY
    sim.addComponent(component)
    refreshSnapshot()
  }

  const dragPlace = shallowRef<{ defId: string; cellX: number; cellY: number; px: number; py: number } | null>(null)
  const screenPlacing = ref(false)
  const pipePlacing = ref(false)
  let boardScreenToWorld: ((clientX: number, clientY: number) => { x: number; y: number } | null) | null = null

  function cancelScreenPlacement(): void {
    screenPlacing.value = false
  }

  function cancelPipePlacement(): void {
    pipePlacing.value = false
  }

  function placePipes(cells: Array<{ x: number; y: number }>): void {
    const def = COMPONENT_DEFS.get('pipe')
    if (def === undefined || !techTree.isComponentUnlocked('pipe') || cells.length === 0) return
    const placeable = cells.filter((cell) => isAreaFree(cell.x, cell.y, 1, 1, null))
    if (placeable.length === 0) {
      showToast('所选位置都已被占用')
      return
    }
    const price = (settings.freePurchases ? 0 : sim.getComponentPrice(def)) * placeable.length
    if (sim.economy.money < price) {
      showToast('资金不足')
      return
    }
    sim.economy.money -= price
    sim.registerPurchase(def)
    for (const cell of placeable) {
      const pipe = createComponentById('pipe')
      pipe.x = cell.x
      pipe.y = cell.y
      sim.addComponent(pipe)
    }
    refreshSnapshot()
  }

  function placePhotonScreen(rect: { x: number; y: number; width: number; height: number }): void {
    const def = COMPONENT_DEFS.get('photon_screen')
    if (def === undefined || !techTree.isComponentUnlocked('photon_screen')) return
    if (!isAreaFree(rect.x, rect.y, rect.width, rect.height, null)) {
      showToast('该区域已有其他元件')
      return
    }
    const unitPrice = settings.freePurchases ? 0 : sim.getComponentPrice(def)
    const price = unitPrice * rect.width * rect.height
    if (sim.economy.money < price) {
      showToast('资金不足')
      return
    }
    sim.economy.money -= price
    sim.registerPurchase(def)
    const component = createComponentById('photon_screen')
    component.width = rect.width
    component.height = rect.height
    component.x = rect.x
    component.y = rect.y
    sim.addComponent(component)
    screenPlacing.value = false
    refreshSnapshot()
  }

  function registerBoardRect(screenToWorld: ((clientX: number, clientY: number) => { x: number; y: number } | null) | null): void {
    boardScreenToWorld = screenToWorld
  }

  function startShopDrag(defId: string): void {
    screenPlacing.value = false
    pipePlacing.value = false
    if (defId === 'chain_drive') {
      startChainPlacement()
      return
    }
    if (defId === 'photon_screen') {
      screenPlacing.value = true
      return
    }
    if (defId === 'pipe') {
      pipePlacing.value = true
      return
    }
    const def = COMPONENT_DEFS.get(defId)
    if (def === undefined || !techTree.isComponentUnlocked(defId)) return
    if (!settings.freePurchases && sim.economy.money < sim.getComponentPrice(def)) return
    dragPlace.value = { defId, cellX: Number.NaN, cellY: Number.NaN, px: Number.NaN, py: Number.NaN }
  }

  function updateShopDrag(clientX: number, clientY: number): void {
    const drag = dragPlace.value
    if (drag === null || boardScreenToWorld === null) return
    const world = boardScreenToWorld(clientX, clientY)
    if (world === null) {
      dragPlace.value = { ...drag, cellX: Number.NaN, cellY: Number.NaN, px: Number.NaN, py: Number.NaN }
      return
    }
    dragPlace.value = {
      ...drag,
      cellX: Math.floor(world.x / CELL_SIZE),
      cellY: Math.floor(world.y / CELL_SIZE),
      px: world.x,
      py: world.y,
    }
  }

  function endShopDrag(): void {
    const drag = dragPlace.value
    dragPlace.value = null
    if (drag === null) return
    if (drag.defId === 'free_terminal') {
      if (Number.isFinite(drag.px)) placeFreeTerminal(drag.px, drag.py)
      return
    }
    if (!Number.isFinite(drag.cellX)) return
    tryPlaceAt(drag.defId, drag.cellX, drag.cellY)
  }

  function placeFreeTerminal(px: number, py: number): void {
    const def = COMPONENT_DEFS.get('free_terminal')
    if (def === undefined || !techTree.isComponentUnlocked('free_terminal')) return
    const price = settings.freePurchases ? 0 : sim.getComponentPrice(def)
    if (sim.economy.money < price) {
      showToast('资金不足')
      return
    }
    sim.economy.money -= price
    sim.registerPurchase(def)
    const terminal = createComponentById('free_terminal')
    if (!(terminal instanceof FreeTerminalComponent)) return
    terminal.setFreePosition(px, py)
    sim.addComponent(terminal)
    refreshSnapshot()
  }

  function moveFreeTerminal(component: BaseComponent, px: number, py: number): void {
    if (!(component instanceof FreeTerminalComponent)) return
    const dx = px - component.posX
    const dy = py - component.posY
    if (dx === 0 && dy === 0) return
    component.setFreePosition(px, py)
    translateLinkedAnchors(component, dx, dy)
    refreshSnapshot()
  }

  function translateLinkedAnchors(component: BaseComponent, dx: number, dy: number): void {
    for (const port of component.ports) {
      const linked = sim.graph.getLinkedPorts(port)
      for (const other of linked) {
        if (!(other.owner instanceof WireComponent)) continue
        const anchors = other.owner.getAnchors()
        if (other.index === 0) {
          other.owner.setAnchors({ x: anchors.a.x + dx, y: anchors.a.y + dy }, anchors.b)
        } else {
          other.owner.setAnchors(anchors.a, { x: anchors.b.x + dx, y: anchors.b.y + dy })
        }
      }
    }
  }

  function chainsIntersectAround(component: BaseComponent): boolean {
    for (const chain of sim.components) {
      if (!(chain instanceof ChainDriveComponent)) continue
      if (!chain.connectsGear(component)) continue
      for (const other of sim.components) {
        if (!(other instanceof ChainDriveComponent) || other === chain) continue
        if (segmentsIntersect2(chain.getEndpointA(), chain.getEndpointB(), other.getEndpointA(), other.getEndpointB())) {
          return true
        }
      }
    }
    return false
  }

  function moveComponent(component: BaseComponent, cellX: number, cellY: number): void {
    if (component.x === cellX && component.y === cellY) return
    if (!isAreaFree(cellX, cellY, component.width, component.height, component)) {
      const free = findNearestFreeCell(cellX, cellY, component.width, component.height, component)
      if (free === null) return
      cellX = free.x
      cellY = free.y
      if (component.x === cellX && component.y === cellY) return
    }
    const prevX = component.x
    const prevY = component.y
    const dx = (cellX - component.x) * CELL_SIZE
    const dy = (cellY - component.y) * CELL_SIZE
    translateLinkedAnchors(component, dx, dy)
    component.x = cellX
    component.y = cellY
    if (chainsIntersectAround(component)) {
      translateLinkedAnchors(component, -dx, -dy)
      component.x = prevX
      component.y = prevY
      showToast('移动被拒绝：链条会交叉')
    }
    sim.resyncAdjacencyFor(component)
    refreshSnapshot()
  }

  function onPortClick(component: BaseComponent, portIndex: number): void {
    const pending = wirePendingPort.value
    if (pending === null) {
      wirePendingPort.value = { owner: component, portIndex, color: null }
      return
    }
    if (pending.owner === component && pending.portIndex === portIndex) {
      wirePendingPort.value = null
      return
    }
    const portA = pending.owner.getPort(pending.portIndex)
    const portB = component.getPort(portIndex)
    const length = wireDistance(portA, portB)
    const materialId = preferredWireMaterial.value
    const wirePrice = settings.freePurchases ? 0 : getWireMaterial(materialId).price
    if (sim.economy.money < wirePrice) {
      wirePendingPort.value = null
      return
    }
    sim.economy.money -= wirePrice
    sim.registerPurchase(WIRE)
    const anchorA = portPosition(portA.owner, portA.index)
    const anchorB = portPosition(portB.owner, portB.index)
    const wire = createComponentById('wire', {
      wireMaterialId: materialId,
      wireLength: length,
      wireAnchorA: { x: anchorA.px, y: anchorA.py },
      wireAnchorB: { x: anchorB.px, y: anchorB.py },
    })
    if (!(wire instanceof WireComponent)) return
    sim.addComponent(wire)
    sim.connect(portA, wire.getPort(0))
    sim.connect(wire.getPort(1), portB)
    wire.visualColor = pending.color
    wirePendingPort.value = null
    refreshSnapshot()
  }

  function cancelWirePending(): void {
    wirePendingPort.value = null
  }

  function sellComponent(component: BaseComponent): void {
    const wires = new Set<WireComponent>()
    for (const port of component.ports) {
      for (const other of sim.graph.getLinkedPorts(port)) {
        if (other.owner instanceof WireComponent) wires.add(other.owner)
      }
    }
    for (const wire of wires) {
      sim.removeComponent(wire)
      sim.economy.money += getWireMaterial(wire.getMaterialId()).price * SELL_REFUND_RATIO
      sim.unregisterPurchase(wire.def)
    }
    const chain = sim.chainByGear.get(component)
    sim.removeComponent(component)
    sim.economy.money += component.def.price * SELL_REFUND_RATIO
    sim.unregisterPurchase(component.def)
    if (chain !== undefined) {
      sim.economy.money += chain.def.price * SELL_REFUND_RATIO
      sim.unregisterPurchase(chain.def)
    }
    const pending = wirePendingPort.value
    if (pending !== null && (pending.owner === component || wires.has(pending.owner as WireComponent))) {
      wirePendingPort.value = null
    }
    if (selectedComponent.value === component || (selectedComponent.value !== null && wires.has(selectedComponent.value as WireComponent))) {
      selectedComponent.value = null
      selectedInfo.value = null
    }
    refreshSnapshot()
  }

  function sellSelected(): void {
    const selected = selectedComponent.value
    if (selected !== null) sellComponent(selected)
  }

  function setWireMaterial(materialId: string): void {
    const selected = selectedComponent.value
    if (!(selected instanceof WireComponent)) return
    if (!techTree.isWireMaterialUnlocked(materialId)) return
    selected.setMaterialId(materialId)
    preferredWireMaterial.value = materialId
    localStorage.setItem(WIRE_MATERIAL_PREF_KEY, materialId)
    refreshSnapshot()
  }

  function setWireColor(color: string | null): void {
    const selected = selectedComponent.value
    if (!(selected instanceof WireComponent)) return
    selected.setVisualColor(color)
    refreshSnapshot()
  }

  function toggleSwitch(): void {
    const selected = selectedComponent.value
    if (selected instanceof SwitchComponent) {
      selected.closed = !selected.closed
      refreshSnapshot()
    }
  }

  function toggleMonitor(component?: BaseComponent): void {
    const target = component ?? selectedComponent.value
    if (target === null) return
    target.monitored = !target.monitored
    refreshSnapshot()
  }

  function randomizeBattery(): void {
    const selected = selectedComponent.value
    if (selected instanceof BatteryComponent) {
      selected.randomizeCellConfig()
      refreshSnapshot()
    }
  }

  function setElectronGunAim(angle: number): void {
    const selected = selectedComponent.value
    if (!(selected instanceof ElectronGunComponent)) return
    selected.aimAngle = Math.min(Math.PI * 2, Math.max(0, angle))
    refreshSnapshot()
  }

  function setElectronGunSpeed(speed: number): void {
    const selected = selectedComponent.value
    if (!(selected instanceof ElectronGunComponent)) return
    selected.launchSpeed = Math.min(700, Math.max(50, speed))
    refreshSnapshot()
  }

  function setPhotonScreenDirection(direction: PhotonPropagation): void {
    const selected = selectedComponent.value
    if (!(selected instanceof PhotonScreenComponent)) return
    selected.propagation = direction
    refreshSnapshot()
  }

  function renameFourthGenerator(name: string): void {
    const selected = selectedComponent.value
    if (!(selected instanceof FourthGeneratorComponent)) return
    const trimmed = name.trim()
    selected.customName = trimmed === '' ? selected.def.displayName : trimmed.slice(0, 24)
    lastGeneratorSync = ''
    refreshSnapshot()
  }

  function applyWsUrl(url: string): void {
    const trimmed = url.trim()
    if (trimmed === '' || fourthWall.getUrl() === trimmed) return
    fourthWall.changeUrl(trimmed)
    lastGeneratorSync = ''
    syncFourthGenerators()
  }

  function unlockedWireMaterials(): string[] {
    return [...WIRE_MATERIALS.keys()].filter((id) => techTree.isWireMaterialUnlocked(id))
  }

  function manualSave(): void {
    saver.save()
    saveMarker.value++
  }

  return {
    sim,
    techTree,
    money,
    incomePerSecond,
    clickCooldownRemaining,
    clickHeat,
    clickProgress,
    selectedComponent,
    selectedInfo,
    wirePendingPort,
    dragPlace,
    offlineGained,
    unlockedComponentsVersion,
    saveMarker,
    techTreeOpen,
    selectedTechId,
    techVersion,
    uidOf,
    shopItems,
    techNodeInfos,
    openTechTree,
    closeTechTree,
    selectTech,
    buyTechLevel,
    setTechNodePosition,
    setTechView,
    canvasBlankClick,
    cancelChainPlacement,
    chainPlacing,
    chainFirstGear,
    screenPlacing,
    cancelScreenPlacement,
    pipePlacing,
    cancelPipePlacement,
    placePipes,
    placePhotonScreen,
    moveFreeTerminal,
    toast,
    getClickProgress,
    registerBoardRect,
    startShopDrag,
    tryPlaceAt,
    moveComponent,
    selectComponent,
    onPortClick,
    cancelWirePending,
    sellComponent,
    sellSelected,
    setWireMaterial,
    setWireColor,
    toggleSwitch,
    toggleMonitor,
    randomizeBattery,
    setElectronGunAim,
    setElectronGunSpeed,
    setPhotonScreenDirection,
    addMoney,
    debugUnlockEnder,
    debugUnlockAllTech,
    renameFourthGenerator,
    applyWsUrl,
    unlockedWireMaterials,
    manualSave,
    CELL_SIZE,
  }
})
