import type { ComponentDefinition } from './ComponentDefinition'
import { paramNumber } from './ComponentDefinition'
import type { MnaModel } from '../circuit/MnaModel'
import { Port } from '../circuit/Port'
import type { SimulationHost, TickContext } from '../sim/TickContext'
import type { FieldEmission } from '../fields/FieldGrid'
import { CELL_SIZE } from '../../shared/constants'
import type { FluidInterface } from '../fluids/fluidInterface'

const SENSOR_AREA_M2 = 0.01

export abstract class BaseComponent {
  readonly def: ComponentDefinition
  readonly ports: Port[]
  width: number
  height: number
  readonly teeth: number
  current = 0
  voltage = 0
  overloadSeconds = 0
  x = 0
  y = 0
  host: SimulationHost | null = null
  rotationDrive = 0
  rotationSpeed = 0
  rotationAngle = 0
  rotationAngleAt = 0
  rotationZ = 0
  monitored = false

  constructor(def: ComponentDefinition) {
    this.def = def
    this.width = def.width ?? 1
    this.height = def.height ?? 1
    this.teeth = paramNumber(def, 'teeth', 8)
    this.rotationZ = paramNumber(def, 'rotationZ', 0)
    this.ports = []
    for (let i = 0; i < def.portCount; i++) {
      this.ports.push(new Port(this, i))
    }
  }

  getPort(index: number): Port {
    const port = this.ports[index]
    if (port === undefined) throw new Error(`port index out of range: ${index}`)
    return port
  }

  abstract getResistance(): number

  getAngularAcceleration(): number {
    return 0
  }

  getDamping(): number {
    return paramNumber(this.def, 'damping', 0)
  }

  getInertia(): number {
    return this.teeth * this.teeth * paramNumber(this.def, 'inertia', 1)
  }

  getMaxOmega(): number {
    return Number.POSITIVE_INFINITY
  }

  getFluidInterfaces(): FluidInterface[] {
    return []
  }

  abstract buildCircuitModel(model: MnaModel): void

  abstract onTick(ctx: TickContext): void

  protected nodeOf(index: number): number {
    const port = this.getPort(index)
    if (port.nodeId < 0) throw new Error(`node ids not assigned for component: ${this.def.id}`)
    return port.nodeId
  }

  getFieldEmission(_dt: number): FieldEmission | null {
    return null
  }

  getSensedFluxDensity(): number {
    return 0
  }

  getSensedFlux(): number {
    return this.getSensedFluxDensity() * SENSOR_AREA_M2
  }

  getPortWorldPos(index: number): { x: number; y: number } {
    const top = this.y * CELL_SIZE
    const height = this.height * CELL_SIZE
    if (this.def.portCount === 4) {
      if (this.def.portLayout === 'rows') {
        const left = this.x * CELL_SIZE
        const w = this.width * CELL_SIZE
        if (index === 0) return { x: left + w * 0.25, y: top }
        if (index === 1) return { x: left + w * 0.75, y: top }
        if (index === 2) return { x: left + w * 0.25, y: top + height }
        return { x: left + w * 0.75, y: top + height }
      }
      if (index === 0) return { x: this.x * CELL_SIZE, y: top + height * 0.25 }
      if (index === 1) return { x: this.x * CELL_SIZE, y: top + height * 0.75 }
      if (index === 2) return { x: (this.x + this.width) * CELL_SIZE, y: top + height * 0.25 }
      return { x: (this.x + this.width) * CELL_SIZE, y: top + height * 0.75 }
    }
    if (this.def.portLayout === 'vertical') {
      const centerX = this.x * CELL_SIZE + (this.width * CELL_SIZE) / 2
      return index === 0
        ? { x: centerX, y: top }
        : { x: centerX, y: top + height }
    }
    const baseY = top + height / 2
    return index === 0
      ? { x: this.x * CELL_SIZE, y: baseY }
      : { x: (this.x + this.width) * CELL_SIZE, y: baseY }
  }

  occupies(cellX: number, cellY: number): boolean {
    return cellX >= this.x && cellX < this.x + this.width && cellY >= this.y && cellY < this.y + this.height
  }
}
