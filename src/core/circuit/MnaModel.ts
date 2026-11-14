import type { BaseComponent } from '../components/BaseComponent'

export interface CircuitBranch {
  index: number
  nodeA: number
  nodeB: number
  resistance: number
  emf: number
  owner: BaseComponent | null
}

export interface MultiBranchOwner {
  noteBranchResult(index: number, current: number, voltage: number): void
}

export class MnaModel {
  nodeCount = 0
  readonly branches: CircuitBranch[] = []

  addBranch(nodeA: number, nodeB: number, resistance: number, emf: number, owner: BaseComponent | null): number {
    const index = this.branches.length
    this.branches.push({ index, nodeA, nodeB, resistance, emf, owner })
    return index
  }

  reserveNodes(count: number): void {
    this.nodeCount = Math.max(this.nodeCount, count)
  }
}
