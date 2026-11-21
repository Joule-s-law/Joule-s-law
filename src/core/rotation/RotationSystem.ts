import type { BaseComponent } from '../components/BaseComponent'
import { paramTag } from '../components/ComponentDefinition'
import { ChainDriveComponent } from '../components/behaviors/ChainDriveComponent'

interface RotationEdge {
  to: BaseComponent
  sign: number
  ratio: number
  key: string
}

interface BlockMember {
  component: BaseComponent
  ratio: number
  sign: number
}

export class RotationSystem {
  readonly lockedComponents = new Set<BaseComponent>()
  private readonly adjacency = new Map<BaseComponent, RotationEdge[]>()
  private readonly lastEdgeKeys = new Set<string>()

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
      this.integrateBlock(block.members, block.hasNewEdge, dt)
    }
    for (const component of rotatables) {
      component.rotationAngle += component.rotationSpeed * dt
      component.rotationAngleAt = performance.now()
    }
    this.refreshEdgeKeys()
  }

  private collectBlock(
    source: BaseComponent,
    visited: Set<BaseComponent>,
  ): { members: BlockMember[]; inconsistent: boolean; hasNewEdge: boolean } {
    const root: BlockMember = { component: source, ratio: 1, sign: 1 }
    const members: BlockMember[] = [root]
    const byComponent = new Map<BaseComponent, BlockMember>([[source, root]])
    visited.add(source)
    const queue: BlockMember[] = [root]
    let inconsistent = false
    let hasNewEdge = false
    while (queue.length > 0) {
      const member = queue.shift()
      if (member === undefined) break
      const edges = this.adjacency.get(member.component) ?? []
      for (const edge of edges) {
        if (!this.lastEdgeKeys.has(edge.key)) hasNewEdge = true
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
    return { members, inconsistent, hasNewEdge }
  }

  private integrateBlock(block: BlockMember[], hasNewEdge: boolean, dt: number): void {
    const reference = block[0]
    if (reference === undefined) return
    let hasDrive = false
    let drivePos = false
    let driveNeg = false
    let alphaRef = 0
    let inertiaSum = 0
    let dampTorque = 0
    let posCap = Number.POSITIVE_INFINITY
    let negCap = Number.POSITIVE_INFINITY
    for (const member of block) {
      const arm = member.sign * member.ratio
      const inertia = member.component.getInertia()
      inertiaSum += inertia * arm * arm
      dampTorque += inertia * member.component.getDamping() * arm * arm
      if (member.component.rotationDrive !== 0) {
        hasDrive = true
        const drive = member.sign * member.component.rotationDrive
        if (drive > 0) drivePos = true
        else driveNeg = true
        alphaRef += drive * member.ratio * Math.abs(member.component.getAngularAcceleration())
        const cap = member.component.getMaxOmega() / Math.abs(arm)
        if (drive > 0) posCap = Math.min(posCap, cap)
        else negCap = Math.min(negCap, cap)
      }
    }
    const dampingAlpha = inertiaSum > 0 ? dampTorque / inertiaSum : 0
    if (drivePos && driveNeg) {
      for (const member of block) {
        this.lockedComponents.add(member.component)
        member.component.rotationSpeed = 0
      }
      return
    }
    let omegaRef: number
    if (hasNewEdge) {
      let momentum = 0
      let inertiaRef = 0
      for (const member of block) {
        const arm = member.sign * member.ratio
        momentum += member.component.getInertia() * member.component.rotationSpeed * arm
        inertiaRef += member.component.getInertia() * arm * arm
      }
      omegaRef = inertiaRef > 0 ? momentum / inertiaRef : 0
    } else {
      omegaRef = reference.component.rotationSpeed
    }
    const netAlpha = omegaRef !== 0
      ? alphaRef - dampingAlpha * Math.sign(omegaRef)
      : alphaRef - (hasDrive ? dampingAlpha * Math.sign(alphaRef) : 0)
    omegaRef += netAlpha * dt
    if (omegaRef > posCap) omegaRef = posCap
    if (omegaRef < -negCap) omegaRef = -negCap
    if (dampingAlpha > 0 && Math.abs(alphaRef) <= dampingAlpha && Math.abs(omegaRef) <= dampingAlpha * dt) {
      omegaRef = 0
    }
    for (const member of block) {
      const speed = omegaRef * member.ratio * member.sign
      member.component.rotationSpeed = speed === 0 ? 0 : speed
    }
  }

  private buildAdjacency(rotatables: BaseComponent[], allComponents: BaseComponent[]): void {
    for (const a of rotatables) {
      const edges: RotationEdge[] = []
      for (const b of rotatables) {
        if (a === b || a.rotationZ !== b.rotationZ) continue
        if (this.rectsAdjacent(a, b)) {
          edges.push({ to: b, sign: -1, ratio: a.teeth / b.teeth, key: this.edgeKey(a, b) })
        }
      }
      this.adjacency.set(a, edges)
    }
    for (const component of allComponents) {
      if (!(component instanceof ChainDriveComponent)) continue
      if (component.gearA.rotationZ !== component.gearB.rotationZ) continue
      const a = this.adjacency.get(component.gearA)
      const b = this.adjacency.get(component.gearB)
      a?.push({ to: component.gearB, sign: 1, ratio: 1, key: this.edgeKey(component.gearA, component.gearB) })
      b?.push({ to: component.gearA, sign: 1, ratio: 1, key: this.edgeKey(component.gearA, component.gearB) })
    }
  }

  private edgeKey(a: BaseComponent, b: BaseComponent): string {
    const first = a.x * 1000 + a.y
    const second = b.x * 1000 + b.y
    return first < second ? `${first}:${second}` : `${second}:${first}`
  }

  private refreshEdgeKeys(): void {
    this.lastEdgeKeys.clear()
    for (const edges of this.adjacency.values()) {
      for (const edge of edges) {
        this.lastEdgeKeys.add(edge.key)
      }
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
