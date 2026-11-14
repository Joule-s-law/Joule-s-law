import { CircuitGraph } from '../circuit/CircuitGraph'
import { MNASolver } from '../circuit/MNASolver'
import { MnaModel } from '../circuit/MnaModel'
import { Port } from '../circuit/Port'
import type { ComponentDefinition } from '../components/ComponentDefinition'
import type { BaseComponent } from '../components/BaseComponent'
import { FieldSensorComponent } from '../components/behaviors/FieldSensorComponent'
import { WireComponent } from '../components/behaviors/WireComponent'
import { ChainDriveComponent } from '../components/behaviors/ChainDriveComponent'
import { DiodeComponent } from '../components/behaviors/DiodeComponent'
import { FieldGrid } from '../fields/FieldGrid'
import { Economy } from '../economy/Economy'
import { EnergyLedger } from '../energy/EnergyLedger'
import { EnergyType } from '../energy/EnergyType'
import { RotationSystem } from '../rotation/RotationSystem'
import type { TickContext } from './TickContext'

export const OVERLOAD_TOLERANCE_DEFAULT = 1
export const DESTROY_REFUND_RATIO = 0.1

export interface EnergyEvent {
  type: EnergyType
  amount: number
  x: number
  y: number
}

export class Simulation {
  readonly economy = new Economy()
  readonly ledger = new EnergyLedger()
  readonly graph = new CircuitGraph()
  readonly fieldGrid = new FieldGrid(24, 14)
  readonly components: BaseComponent[] = []
  readonly chainByGear = new Map<BaseComponent, ChainDriveComponent>()
  readonly purchaseCounts = new Map<string, number>()
  private readonly adjacencyPairs: Array<[Port, Port]> = []
  private readonly energyEvents: EnergyEvent[] = []
  private readonly pendingDestroys = new Set<BaseComponent>()
  readonly rotation = new RotationSystem()
  kineticPool = 0
  ratedCurrentBoost = 1
  converterEfficiencyBoost = 0
  sensorEfficiencyBoost = 0
  lightEmissionBoost = 0
  gearBreakdownChance = 0.5
  dt = 0.1
  simTime = 0
  clickHeat = 1
  clickCooldown = 0.5
  lastIncome = 0
  incomePerSecond = 0
  private nextClickReadyTime = 0

  addComponent(component: BaseComponent): void {
    component.host = this
    this.components.push(component)
    this.graph.addComponent(component)
    if (component instanceof FieldSensorComponent) {
      component.bindFieldGrid(this.fieldGrid)
    }
    if (component instanceof ChainDriveComponent) {
      this.chainByGear.set(component.gearA, component)
      this.chainByGear.set(component.gearB, component)
    }
    this.resyncAdjacencyFor(component)
  }

  removeComponent(component: BaseComponent): void {
    const index = this.components.indexOf(component)
    if (index < 0) throw new Error(`component not in simulation: ${component.def.id}`)
    this.components.splice(index, 1)
    this.graph.removeAllLinks(component)
    this.removeAdjacencyFor(component)
    if (component instanceof ChainDriveComponent) {
      if (this.chainByGear.get(component.gearA) === component) this.chainByGear.delete(component.gearA)
      if (this.chainByGear.get(component.gearB) === component) this.chainByGear.delete(component.gearB)
    }
    const chain = this.chainByGear.get(component)
    if (chain !== undefined) {
      this.chainByGear.delete(component)
      const chainIndex = this.components.indexOf(chain)
      if (chainIndex >= 0) {
        this.components.splice(chainIndex, 1)
        if (this.chainByGear.get(chain.gearA) === chain) this.chainByGear.delete(chain.gearA)
        if (this.chainByGear.get(chain.gearB) === chain) this.chainByGear.delete(chain.gearB)
      }
    }
  }

  resyncAdjacencyFor(component: BaseComponent): void {
    this.removeAdjacencyFor(component)
    if (component.def.id === 'wire') return
    for (const port of component.ports) {
      const pos = component.getPortWorldPos(port.index)
      for (const other of this.components) {
        if (other === component || other.def.id === 'wire') continue
        for (const otherPort of other.ports) {
          const otherPos = other.getPortWorldPos(otherPort.index)
          if (Math.abs(pos.x - otherPos.x) > 0.01 || Math.abs(pos.y - otherPos.y) > 0.01) continue
          const alreadyLinked = this.graph.getLinkedPorts(port).has(otherPort)
          if (alreadyLinked) continue
          this.graph.connect(port, otherPort)
          this.adjacencyPairs.push([port, otherPort])
        }
      }
    }
  }

  private removeAdjacencyFor(component: BaseComponent): void {
    for (let i = this.adjacencyPairs.length - 1; i >= 0; i--) {
      const pair = this.adjacencyPairs[i]
      if (pair === undefined) continue
      if (pair[0].owner === component || pair[1].owner === component) {
        this.graph.disconnect(pair[0], pair[1])
        this.adjacencyPairs.splice(i, 1)
      }
    }
  }

  destroyComponent(component: BaseComponent): void {
    const wires = new Set<WireComponent>()
    for (const port of component.ports) {
      for (const linked of this.graph.getLinkedPorts(port)) {
        const owner = linked.owner
        if (owner instanceof WireComponent && this.components.includes(owner)) {
          wires.add(owner)
        }
      }
    }
    const chain = this.chainByGear.get(component)
    this.removeComponent(component)
    this.economy.money += component.def.price * DESTROY_REFUND_RATIO
    for (const wire of wires) {
      this.removeComponent(wire)
      this.economy.money += wire.def.price * DESTROY_REFUND_RATIO
    }
    if (chain !== undefined) {
      this.economy.money += chain.def.price * DESTROY_REFUND_RATIO
    }
  }

  connect(portA: Port, portB: Port): void {
    this.graph.connect(portA, portB)
  }

  disconnect(portA: Port, portB: Port): void {
    this.graph.disconnect(portA, portB)
  }

  getComponentPrice(def: ComponentDefinition): number {
    const count = this.purchaseCounts.get(def.id) ?? 0
    return def.price * Math.pow(def.priceScaling, count)
  }

  registerPurchase(def: ComponentDefinition): void {
    this.purchaseCounts.set(def.id, (this.purchaseCounts.get(def.id) ?? 0) + 1)
  }

  unregisterPurchase(def: ComponentDefinition): void {
    this.purchaseCounts.set(def.id, Math.max(0, (this.purchaseCounts.get(def.id) ?? 0) - 1))
  }

  tick(): void {
    this.rotation.update(this.dt, this.components)
    if (this.components.length === 0) {
      this.lastIncome = 0
      this.incomePerSecond = this.incomePerSecond * 0.9
      this.simTime += this.dt
      return
    }
    const nodeCount = this.graph.assignNodeIds()
    if (nodeCount > 0) {
      const diodes = this.components.filter((component): component is DiodeComponent => component instanceof DiodeComponent)
      for (let iteration = 0; iteration < 4; iteration++) {
        const model = new MnaModel()
        model.reserveNodes(nodeCount)
        this.fieldGrid.update(this.components, this.dt)
        for (const component of this.components) {
          component.buildCircuitModel(model)
        }
        new MNASolver().solve(model)
        let changed = false
        for (const diode of diodes) {
          if (diode.updateConduction()) changed = true
        }
        if (!changed) break
      }
    }
    const ctx: TickContext = { dt: this.dt, simTime: this.simTime, ledger: this.ledger, host: this }
    const destroyed = this.collectDestroyed()
    for (const component of this.components) {
      component.onTick(ctx)
    }
    for (const component of destroyed) {
      this.destroyComponent(component)
    }
    for (const component of this.pendingDestroys) {
      if (this.components.includes(component)) {
        this.destroyComponent(component)
      }
    }
    this.pendingDestroys.clear()
    this.lastIncome = this.economy.settle(this.ledger)
    const rate = this.lastIncome / this.dt
    this.incomePerSecond = this.incomePerSecond * 0.9 + rate * 0.1
    this.simTime += this.dt
  }

  click(x = 0, y = 0): boolean {
    if (this.simTime < this.nextClickReadyTime) return false
    this.nextClickReadyTime = this.simTime + this.clickCooldown
    this.ledger.add(EnergyType.HEAT, this.clickHeat)
    this.economy.settle(this.ledger)
    this.emitEnergy(EnergyType.HEAT, this.clickHeat, x, y)
    return true
  }

  emitEnergy(type: EnergyType, amount: number, x: number, y: number): void {
    if (this.energyEvents.length >= 64) return
    this.energyEvents.push({ type, amount, x, y })
  }

  drainEnergyEvents(): EnergyEvent[] {
    return this.energyEvents.splice(0, this.energyEvents.length)
  }

  clickReadyIn(): number {
    return Math.max(0, this.nextClickReadyTime - this.simTime)
  }

  requestDestroy(component: BaseComponent): void {
    this.pendingDestroys.add(component)
  }

  private collectDestroyed(): BaseComponent[] {
    const destroyed: BaseComponent[] = []
    for (const component of this.components) {
      const tolerance = component.def.behaviorParams['overloadTolerance'] ?? OVERLOAD_TOLERANCE_DEFAULT
      const effectiveRated = component.def.ratedCurrent * this.ratedCurrentBoost
      if (Math.abs(component.current) > effectiveRated) {
        component.overloadSeconds += this.dt
        if (component.overloadSeconds >= tolerance) {
          destroyed.push(component)
        }
      } else if (component.overloadSeconds > 0) {
        component.overloadSeconds = Math.max(0, component.overloadSeconds - this.dt * 2)
      }
    }
    return destroyed
  }
}
