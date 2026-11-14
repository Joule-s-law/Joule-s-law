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
import { VoltageTransformerComponent } from '../../core/components/behaviors/VoltageTransformerComponent'
import { FourthWallClient } from '../../net/FourthWallClient'
import { useSettingsStore } from '../settings/useSettingsStore'
import { WIRE } from '../../core/components/registry/definitions'
import { WIRE_MATERIALS } from '../../core/components/registry/wireMaterials'
import { CELL_SIZE, GRID_COLS, GRID_ROWS, portPosition, wireDistance } from '../board/boardMath'

const SELL_REFUND_RATIO = 0.5
const TECH_LAYOUT_KEY = 'joules-law-tech-layout'

export interface ComponentInfo {
  uid: number
  displayName: string
  defId: string
  description: string
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
  fourthGenUuid: string
  fourthGenName: string
  externalEmf: number
  rotatable: boolean
  rotationSpeed: number
}

export interface TechNodeInfo {
  id: string
  displayName: string
  description: string
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
  const selectedTechId = ref<string | null>(null)
  const techVersion = ref(0)
  const clickProgress = ref(1)

  const uids = new WeakMap<BaseComponent, number>()
  let nextUid = 1
  const settings = useSettingsStore()

  const fourthWall = new FourthWallClient(settings.wsUrl, (totals) => {
    for (const component of sim.components) {
      if (!(component instanceof FourthGeneratorComponent)) continue
      component.externalEmf = totals[component.uuid] ?? 0
    }
  })
  let lastGeneratorSync = ''

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
      fourthGenUuid: component instanceof FourthGeneratorComponent ? component.uuid : '',
      fourthGenName: component instanceof FourthGeneratorComponent ? component.customName : '',
      externalEmf: component instanceof FourthGeneratorComponent ? component.externalEmf : 0,
      rotatable: component.def.behaviorTags['rotatable'] === '1',
      rotationSpeed: component.rotationSpeed,
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
      items.push({ def, price: sim.getComponentPrice(def), unlocked: techTree.isComponentUnlocked(def.id) })
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
        description: node.description,
        level: techTree.getLevel(node.id),
        maxLevel: node.maxLevel,
        cost: techTree.getCost(node.id),
        unlocked: techTree.isUnlocked(node.id),
        canBuy: techTree.canBuy(node.id) && techTree.getCost(node.id) <= sim.economy.money,
        parentName: parent?.displayName ?? null,
        x: layout.x,
        y: layout.y,
      })
    }
    return infos
  }

  const defaultNodeRows = new Map<string, number>()
  function defaultNodePosition(node: TechNode): { x: number; y: number } {
    let depth = 0
    let cursor: string | null = node.parentId
    while (cursor !== null) {
      depth++
      cursor = TECH_NODES.find((n) => n.id === cursor)?.parentId ?? null
    }
    const siblings = TECH_NODES.filter((n) => n.parentId === node.parentId)
    const rowIndex = defaultNodeRows.get(node.id) ?? siblings.indexOf(node)
    defaultNodeRows.set(node.id, rowIndex)
    return { x: 80 + depth * 260, y: 80 + rowIndex * 130 }
  }

  const techLayout = loadTechLayout()

  function loadTechLayout(): { positions: Record<string, { x: number; y: number }>; view: { x: number; y: number } } {
    try {
      const raw = localStorage.getItem(TECH_LAYOUT_KEY)
      if (raw !== null) return JSON.parse(raw) as { positions: Record<string, { x: number; y: number }>; view: { x: number; y: number } }
    } catch {
    }
    return { positions: {}, view: { x: 0, y: 0 } }
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
    techTree.buy(id)
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
    selectedComponent.value = component
    wirePendingPort.value = null
    selectedInfo.value = component !== null ? buildInfo(component) : null
  }

  function tryPlaceAt(defId: string, cellX: number, cellY: number): void {
    const def = COMPONENT_DEFS.get(defId)
    if (def === undefined || !techTree.isComponentUnlocked(defId)) return
    const price = sim.getComponentPrice(def)
    if (sim.economy.money < price) return
    sim.economy.money -= price
    sim.registerPurchase(def)
    const component = createComponentById(defId)
    component.x = cellX
    component.y = cellY
    sim.addComponent(component)
    refreshSnapshot()
  }

  const dragPlace = shallowRef<{ defId: string; cellX: number; cellY: number } | null>(null)
  let boardRectGetter: (() => DOMRect | null) | null = null

  function registerBoardRect(getter: () => DOMRect | null): void {
    boardRectGetter = getter
  }

  function startShopDrag(defId: string): void {
    const def = COMPONENT_DEFS.get(defId)
    if (def === undefined || !techTree.isComponentUnlocked(defId)) return
    if (sim.economy.money < sim.getComponentPrice(def)) return
    dragPlace.value = { defId, cellX: -1, cellY: -1 }
  }

  function updateShopDrag(clientX: number, clientY: number): void {
    const drag = dragPlace.value
    if (drag === null || boardRectGetter === null) return
    const rect = boardRectGetter()
    if (rect === null) return
    const scaleX = GRID_COLS * CELL_SIZE / Math.max(1, rect.width)
    const scaleY = GRID_ROWS * CELL_SIZE / Math.max(1, rect.height)
    const x = (clientX - rect.left) * scaleX
    const y = (clientY - rect.top) * scaleY
    const cellX = Math.floor(x / CELL_SIZE)
    const cellY = Math.floor(y / CELL_SIZE)
    if (cellX < 0 || cellX >= GRID_COLS || cellY < 0 || cellY >= GRID_ROWS) {
      dragPlace.value = { ...drag, cellX: -1, cellY: -1 }
      return
    }
    dragPlace.value = { ...drag, cellX, cellY }
  }

  function endShopDrag(): void {
    const drag = dragPlace.value
    dragPlace.value = null
    if (drag === null || drag.cellX < 0) return
    tryPlaceAt(drag.defId, drag.cellX, drag.cellY)
  }

  function moveComponent(component: BaseComponent, cellX: number, cellY: number): void {
    if (component.x === cellX && component.y === cellY) return
    const dx = (cellX - component.x) * CELL_SIZE
    const dy = (cellY - component.y) * CELL_SIZE
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
    component.x = cellX
    component.y = cellY
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
    if (sim.economy.money < WIRE.price) {
      wirePendingPort.value = null
      return
    }
    sim.economy.money -= WIRE.price
    sim.registerPurchase(WIRE)
    const anchorA = portPosition(portA.owner, portA.index)
    const anchorB = portPosition(portB.owner, portB.index)
    const wire = createComponentById('wire', {
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
      sim.economy.money += wire.def.price * SELL_REFUND_RATIO
      sim.unregisterPurchase(wire.def)
    }
    sim.removeComponent(component)
    sim.economy.money += component.def.price * SELL_REFUND_RATIO
    sim.unregisterPurchase(component.def)
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
    renameFourthGenerator,
    applyWsUrl,
    unlockedWireMaterials,
    manualSave,
    CELL_SIZE,
  }
})
