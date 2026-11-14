import type { BaseComponent } from '../components/BaseComponent'
import { paramTag } from '../components/ComponentDefinition'
import { ChainDriveComponent } from '../components/behaviors/ChainDriveComponent'

const FRICTION_ALPHA = Math.PI

interface RotationEdge {
  to: BaseComponent
  sign: number
  ratio: number
}

interface BlockMember {
  component: BaseComponent
  ratio: number
  sign: number
}

export class RotationSystem {
  readonly lockedComponents = new Set<BaseComponent>()
  private readonly adjacency = new Map<BaseComponent, RotationEdge[]>()

  update(dt: number, components: BaseComponent[]): void {
    this.lockedComponents.clear()
    this.adjacency.clear()
    const rotatables = components.filter((component) => paramTag(component.def, 'rotatable', '') === '1')
    this.buildAdjacency(rotatables, components)
    const visited = new Set<BaseComponent>()
    for (const component of rotatables) {
      if (visited.has(component)) continue
      const block = this.collectBlock(component, visited)
      if (block.inconsistent) {
        for (const member of block.members) {
          this.lockedComponents.add(member.component)
          member.component.rotationSpeed = 0
        }
        continue
      }
      this.integrateBlock(block.members, dt)
    }
    for (const component of rotatables) {
      component.rotationAngle += component.rotationSpeed * dt
      component.rotationAngleAt = performance.now()
    }
  }

  private collectBlock(
    source: BaseComponent,
    visited: Set<BaseComponent>,
  ): { members: BlockMember[]; inconsistent: boolean } {
    const root: BlockMember = { component: source, ratio: 1, sign: 1 }
    const members: BlockMember[] = [root]
    const byComponent = new Map<BaseComponent, BlockMember>([[source, root]])
    visited.add(source)
    const queue: BlockMember[] = [root]
    let inconsistent = false
    while (queue.length > 0) {
      const member = queue.shift()
      if (member === undefined) break
      const edges = this.adjacency.get(member.component) ?? []
      for (const edge of edges) {
        const neighbor = edge.to
        const ratio = member.ratio * edge.ratio
        const sign = member.sign * edge.sign
        const existing = byComponent.get(neighbor)
        if (existing !== undefined) {
          if (existing.sign !== sign || Math.abs(existing.ratio - ratio) > 1e-9) {
            inconsistent = true
          }
          continue
        }
        visited.add(neighbor)
        const next: BlockMember = { component: neighbor, ratio, sign }
        byComponent.set(neighbor, next)
        members.push(next)
        queue.push(next)
      }
    }
    return { members, inconsistent }
  }

  private integrateBlock(block: BlockMember[], dt: number): void {
    const reference = block[0]
    if (reference === undefined) return
    let hasDrive = false
    let drivePos = false
    let driveNeg = false
    let alphaRef = 0
    for (const member of block) {
      if (member.component.rotationDrive === 0) continue
      hasDrive = true
      const projected = member.sign * member.component.rotationDrive
      if (projected > 0) drivePos = true
      else driveNeg = true
      alphaRef += projected * member.ratio * Math.abs(member.component.getAngularAcceleration())
    }
    if (drivePos && driveNeg) {
      for (const member of block) {
        this.lockedComponents.add(member.component)
        member.component.rotationSpeed = 0
      }
      return
    }
    let omegaRef = reference.component.rotationSpeed
    if (hasDrive) {
      omegaRef += alphaRef * dt
    } else {
      const decay = FRICTION_ALPHA * dt
      omegaRef = omegaRef > 0 ? Math.max(0, omegaRef - decay) : Math.min(0, omegaRef + decay)
    }
    for (const member of block) {
      member.component.rotationSpeed = omegaRef * member.ratio * member.sign
    }
  }

  private buildAdjacency(rotatables: BaseComponent[], allComponents: BaseComponent[]): void {
    for (const a of rotatables) {
      const edges: RotationEdge[] = []
      for (const b of rotatables) {
        if (a !== b && this.rectsAdjacent(a, b)) {
          edges.push({ to: b, sign: -1, ratio: a.teeth / b.teeth })
        }
      }
      this.adjacency.set(a, edges)
    }
    for (const component of allComponents) {
      if (!(component instanceof ChainDriveComponent)) continue
      const a = this.adjacency.get(component.gearA)
      const b = this.adjacency.get(component.gearB)
      a?.push({ to: component.gearB, sign: 1, ratio: 1 })
      b?.push({ to: component.gearA, sign: 1, ratio: 1 })
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
}
