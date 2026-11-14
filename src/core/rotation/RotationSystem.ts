import type { BaseComponent } from '../components/BaseComponent'
import { paramTag } from '../components/ComponentDefinition'

const TWO_PI = Math.PI * 2
const CRANK_RAMP_SECONDS = 2

interface DriveState {
  dir: number
  speed: number
}

export class RotationSystem {
  readonly lockedComponents = new Set<BaseComponent>()
  private readonly adjacency = new Map<BaseComponent, BaseComponent[]>()

  update(dt: number, components: BaseComponent[]): void {
    this.lockedComponents.clear()
    this.adjacency.clear()
    const rotatables = components.filter((component) => paramTag(component.def, 'rotatable', '') === '1')
    this.buildAdjacency(rotatables)
    for (const component of rotatables) {
      if (paramTag(component.def, 'holdable', '') === '1') {
        this.driveCrank(component, dt)
      }
    }
    const visited = new Set<BaseComponent>()
    const conflictBlocks: BaseComponent[][] = []
    for (const component of rotatables) {
      if (paramTag(component.def, 'holdable', '') !== '1') continue
      if (visited.has(component)) continue
      const conflict = this.propagate(component, visited)
      if (conflict !== null) conflictBlocks.push(conflict)
    }
    for (const component of rotatables) {
      if (visited.has(component)) continue
      component.rotationSpeed = paramTag(component.def, 'holdable', '') === '1' ? component.rotationSpeed : 0
    }
    for (const component of rotatables) {
      component.rotationAngle += component.rotationSpeed * dt
      component.rotationAngleAt = performance.now()
    }
    for (const block of conflictBlocks) {
      for (const component of block) {
        this.lockedComponents.add(component)
        if (paramTag(component.def, 'holdable', '') !== '1') {
          component.rotationSpeed = 0
        }
      }
    }
  }

  private buildAdjacency(rotatables: BaseComponent[]): void {
    for (const a of rotatables) {
      const neighbors: BaseComponent[] = []
      for (const b of rotatables) {
        if (a !== b && this.rectsAdjacent(a, b)) neighbors.push(b)
      }
      this.adjacency.set(a, neighbors)
    }
  }

  private rectsAdjacent(a: BaseComponent, b: BaseComponent): boolean {
    const cellsA = new Set<string>()
    for (let dx = 0; dx < a.width; dx++) {
      for (let dy = 0; dy < a.height; dy++) {
        cellsA.add(`${a.x + dx},${a.y + dy}`)
      }
    }
    for (let dx = 0; dx < b.width; dx++) {
      for (let dy = 0; dy < b.height; dy++) {
        const bx = b.x + dx
        const by = b.y + dy
        if (
          cellsA.has(`${bx - 1},${by}`) ||
          cellsA.has(`${bx + 1},${by}`) ||
          cellsA.has(`${bx},${by - 1}`) ||
          cellsA.has(`${bx},${by + 1}`)
        ) {
          return true
        }
      }
    }
    return false
  }

  private driveCrank(component: BaseComponent, dt: number): void {
    const target = component.rotationDrive * TWO_PI
    const rate = (TWO_PI / CRANK_RAMP_SECONDS) * dt
    if (component.rotationSpeed < target) {
      component.rotationSpeed = Math.min(target, component.rotationSpeed + rate)
    } else {
      component.rotationSpeed = Math.max(target, component.rotationSpeed - rate)
    }
  }

  private propagate(source: BaseComponent, visited: Set<BaseComponent>): BaseComponent[] | null {
    const states = new Map<BaseComponent, DriveState>()
    const queue: Array<{ component: BaseComponent; dir: number; speed: number }> = []
    const sourceDir = source.rotationSpeed >= 0 ? 1 : -1
    states.set(source, { dir: sourceDir, speed: Math.abs(source.rotationSpeed) })
    queue.push({ component: source, dir: sourceDir, speed: Math.abs(source.rotationSpeed) })
    let conflict = false
    while (queue.length > 0) {
      const entry = queue.pop()
      if (entry === undefined) break
      const neighbors = this.adjacency.get(entry.component) ?? []
      for (const neighbor of neighbors) {
        const nextDir = -entry.dir
        const nextSpeed = entry.speed * (entry.component.teeth / neighbor.teeth)
        const existing = states.get(neighbor)
        if (existing !== undefined) {
          if (existing.dir !== nextDir && (existing.speed !== 0 || nextSpeed !== 0)) {
            conflict = true
          }
          if (nextSpeed > existing.speed) existing.speed = nextSpeed
          continue
        }
        states.set(neighbor, { dir: nextDir, speed: nextSpeed })
        queue.push({ component: neighbor, dir: nextDir, speed: nextSpeed })
      }
    }
    for (const [component, state] of states) {
      visited.add(component)
      if (!conflict) {
        component.rotationSpeed = state.dir * state.speed
      }
    }
    if (!conflict) return null
    return [...states.keys()]
  }
}
