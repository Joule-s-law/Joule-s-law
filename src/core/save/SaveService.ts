import type { BaseComponent } from '../components/BaseComponent'
import { WireComponent } from '../components/behaviors/WireComponent'
import { BatteryComponent } from '../components/behaviors/BatteryComponent'
import { SwitchComponent } from '../components/behaviors/SwitchComponent'
import { FourthGeneratorComponent } from '../components/behaviors/FourthGeneratorComponent'
import { createComponentById } from '../components/registry/componentRegistry'
import type { Simulation } from '../sim/Simulation'
import type { TechTree } from '../tech/TechTree'

const SAVE_KEY = 'joules-law-save-v1'
const SAVE_VERSION = 1
const OFFLINE_CAP_SECONDS = 4 * 3600
const OFFLINE_EFFICIENCY = 0.5

interface SavedComponent {
  defId: string
  x: number
  y: number
  wireMaterialId?: string
  wireLength?: number
  wireAnchorA?: { x: number; y: number }
  wireAnchorB?: { x: number; y: number }
  wireControlPointA?: { x: number; y: number }
  wireControlPointB?: { x: number; y: number }
  batterySoc?: number
  batteryCell?: { pairIndex: number; electrolyteIndex: number; membrane: 'none' | 'cation' | 'anion'; flipped: boolean }
  switchClosed?: boolean
  fourthGenUuid?: string
  fourthGenName?: string
}

interface SavedLink {
  a: [number, number]
  b: [number, number]
}

interface SaveData {
  version: number
  money: number
  simTime: number
  kineticPool: number
  incomePerSecond: number
  savedAtRealMs: number
  purchaseCounts: Record<string, number>
  multipliers: Record<string, number>
  techLevels: Record<string, number>
  components: SavedComponent[]
  links: SavedLink[]
}

export interface LoadResult {
  offlineGained: number
  offlineSeconds: number
}

function getStorage(): Storage | null {
  const global = globalThis as { window?: { localStorage?: Storage }; localStorage?: Storage }
  const candidate = global.window?.localStorage ?? global.localStorage
  if (candidate !== undefined && candidate !== null && typeof candidate.setItem === 'function') {
    return candidate
  }
  return null
}

export class SaveService {
  constructor(
    private readonly sim: Simulation,
    private readonly techTree: TechTree,
  ) {}

  save(): void {
    const storage = getStorage()
    if (storage === null) return
    const data = this.serialize()
    storage.setItem(SAVE_KEY, JSON.stringify(data))
  }

  load(): LoadResult | null {
    const storage = getStorage()
    if (storage === null) return null
    const raw = storage.getItem(SAVE_KEY)
    if (raw === null) return null
    let data: SaveData
    try {
      data = JSON.parse(raw) as SaveData
    } catch {
      return null
    }
    if (data.version !== SAVE_VERSION) return null
    return this.deserialize(data)
  }

  clear(): void {
    const storage = getStorage()
    if (storage === null) return
    storage.removeItem(SAVE_KEY)
  }

  serialize(): SaveData {
    const components: SavedComponent[] = this.sim.components.map((component) => ({
      defId: component.def.id,
      x: component.x,
      y: component.y,
      ...(component instanceof WireComponent
        ? {
            wireMaterialId: component.getMaterialId(),
            wireLength: component.getLengthCells(),
            wireAnchorA: component.getAnchors().a,
            wireAnchorB: component.getAnchors().b,
            wireControlPointA: component.getControlPoints().a,
            wireControlPointB: component.getControlPoints().b,
          }
        : {}),
      ...(component instanceof BatteryComponent
        ? {
            batterySoc: component.stateOfCharge,
            batteryCell: {
              pairIndex: component.cellConfig.pairIndex,
              electrolyteIndex: component.cellConfig.electrolyteIndex,
              membrane: component.cellConfig.membrane,
              flipped: component.cellConfig.flipped,
            },
          }
        : {}),
      ...(component instanceof SwitchComponent ? { switchClosed: component.closed } : {}),
      ...(component instanceof FourthGeneratorComponent
        ? { fourthGenUuid: component.uuid, fourthGenName: component.customName }
        : {}),
    }))
    const componentIndex = new Map<BaseComponent, number>(this.sim.components.map((component, index) => [component, index]))
    const links: SavedLink[] = []
    const seen = new Set<string>()
    for (const component of this.sim.components) {
      for (const port of component.ports) {
        const linked = this.sim.graph.getLinkedPorts(port)
        for (const other of linked) {
          const otherIndex = componentIndex.get(other.owner)
          const ownIndex = componentIndex.get(component)
          if (otherIndex === undefined || ownIndex === undefined) continue
          const key = ownIndex < otherIndex ? `${ownIndex}:${port.index}|${otherIndex}:${other.index}` : `${otherIndex}:${other.index}|${ownIndex}:${port.index}`
          if (seen.has(key)) continue
          seen.add(key)
          links.push(ownIndex < otherIndex
            ? { a: [ownIndex, port.index], b: [otherIndex, other.index] }
            : { a: [otherIndex, other.index], b: [ownIndex, port.index] })
        }
      }
    }
    const purchaseCounts: Record<string, number> = {}
    for (const [id, count] of this.sim.purchaseCounts) {
      purchaseCounts[id] = count
    }
    return {
      version: SAVE_VERSION,
      money: this.sim.economy.money,
      simTime: this.sim.simTime,
      kineticPool: this.sim.kineticPool,
      incomePerSecond: this.sim.incomePerSecond,
      savedAtRealMs: Date.now(),
      purchaseCounts,
      multipliers: this.sim.economy.exportMultipliers(),
      techLevels: this.techTree.exportLevels(),
      components,
      links,
    }
  }

  private deserialize(data: SaveData): LoadResult | null {
    for (const component of [...this.sim.components]) {
      this.sim.removeComponent(component)
    }
    this.techTree.applyLevels(data.techLevels ?? {})
    this.sim.economy.money = data.money
    this.sim.simTime = data.simTime
    this.sim.kineticPool = data.kineticPool
    this.sim.incomePerSecond = data.incomePerSecond
    this.sim.purchaseCounts.clear()
    for (const [id, count] of Object.entries(data.purchaseCounts)) {
      this.sim.purchaseCounts.set(id, count)
    }
    this.sim.economy.importMultipliers(data.multipliers ?? {})
    const components: BaseComponent[] = []
    for (const saved of data.components) {
      let component: BaseComponent
      try {
        component = createComponentById(saved.defId, {
          wireMaterialId: saved.wireMaterialId,
          wireLength: saved.wireLength,
          wireAnchorA: saved.wireAnchorA,
          wireAnchorB: saved.wireAnchorB,
          wireControlPointA: saved.wireControlPointA,
          wireControlPointB: saved.wireControlPointB,
          batteryStateOfCharge: saved.batterySoc,
          batteryCell: saved.batteryCell,
          switchClosed: saved.switchClosed,
          fourthGenUuid: saved.fourthGenUuid,
          fourthGenName: saved.fourthGenName,
        })
      } catch {
        continue
      }
      component.x = saved.x
      component.y = saved.y
      this.sim.addComponent(component)
      components.push(component)
    }
    for (const link of data.links) {
      const a = components[link.a[0]]
      const b = components[link.b[0]]
      if (a === undefined || b === undefined) continue
      const portA = a.ports[link.a[1]]
      const portB = b.ports[link.b[1]]
      if (portA === undefined || portB === undefined) continue
      this.sim.connect(portA, portB)
    }
    const elapsedSeconds = Math.min(OFFLINE_CAP_SECONDS, Math.max(0, (Date.now() - data.savedAtRealMs) / 1000))
    const offlineGained = data.incomePerSecond * elapsedSeconds * OFFLINE_EFFICIENCY
    this.sim.economy.money += offlineGained
    return { offlineGained, offlineSeconds: elapsedSeconds }
  }
}
