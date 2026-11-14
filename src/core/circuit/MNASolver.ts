import type { BaseComponent } from '../components/BaseComponent'
import type { MnaModel, MultiBranchOwner } from './MnaModel'

class UnionFind {
  private readonly parent: number[]

  constructor(size: number) {
    this.parent = []
    for (let i = 0; i < size; i++) {
      this.parent.push(i)
    }
  }

  find(x: number): number {
    const p = this.parent[x]
    if (p === undefined) throw new Error(`node index out of range: ${x}`)
    if (p === x) return x
    const root = this.find(p)
    this.parent[x] = root
    return root
  }

  union(a: number, b: number): void {
    const rootA = this.find(a)
    const rootB = this.find(b)
    if (rootA !== rootB) this.parent[rootA] = rootB
  }
}

export class MNASolver {
  solve(model: MnaModel): void {
    const uf = new UnionFind(model.nodeCount)
    for (const branch of model.branches) {
      if (branch.resistance === 0 && branch.emf === 0) {
        uf.union(branch.nodeA, branch.nodeB)
      } else if (branch.resistance === 0) {
        throw new Error('ideal voltage source without internal resistance is not supported')
      }
    }
    const rootToGroup = new Map<number, number>()
    for (let i = 0; i < model.nodeCount; i++) {
      const root = uf.find(i)
      if (!rootToGroup.has(root)) rootToGroup.set(root, rootToGroup.size)
    }
    const nodeGroup = this.mapNodeGroups(model, uf, rootToGroup)
    const groundGroup = nodeGroup[0]
    if (groundGroup === undefined) throw new Error('circuit has no nodes')

    const activeGroups = new Set<number>()
    for (const branch of model.branches) {
      const groupA = nodeGroup[branch.nodeA]
      const groupB = nodeGroup[branch.nodeB]
      if (groupA === undefined || groupB === undefined) throw new Error('unmapped node group')
      if (groupA !== groupB) {
        activeGroups.add(groupA)
        activeGroups.add(groupB)
      }
    }
    const clusterUF = new UnionFind(rootToGroup.size)
    for (const branch of model.branches) {
      const groupA = nodeGroup[branch.nodeA]
      const groupB = nodeGroup[branch.nodeB]
      if (groupA === undefined || groupB === undefined) throw new Error('unmapped node group')
      if (groupA !== groupB) clusterUF.union(groupA, groupB)
    }
    const referenceGroups = new Set<number>()
    for (let group = 0; group < rootToGroup.size; group++) {
      if (clusterUF.find(group) === group) referenceGroups.add(group)
    }
    const groupToRow = new Map<number, number>()
    for (const group of [...activeGroups].sort((a, b) => a - b)) {
      if (referenceGroups.has(group)) continue
      groupToRow.set(group, groupToRow.size)
    }

    const unknownCount = groupToRow.size
    const matrix = new Float64Array(unknownCount * unknownCount)
    const rhs = new Float64Array(unknownCount)

    for (const branch of model.branches) {
      const groupA = nodeGroup[branch.nodeA]
      const groupB = nodeGroup[branch.nodeB]
      if (groupA === undefined || groupB === undefined) throw new Error('unmapped node group')
      if (groupA === groupB) continue
      const conductance = 1 / branch.resistance
      const rowA = groupToRow.get(groupA)
      const rowB = groupToRow.get(groupB)
      if (rowA === undefined && rowB === undefined) continue
      if (rowA !== undefined) {
        this.matrixAdd(matrix, rowA, rowA, conductance, unknownCount)
        if (branch.emf !== 0) this.rhsAdd(rhs, rowA, -branch.emf * conductance)
      }
      if (rowB !== undefined) {
        this.matrixAdd(matrix, rowB, rowB, conductance, unknownCount)
        if (branch.emf !== 0) this.rhsAdd(rhs, rowB, branch.emf * conductance)
      }
      if (rowA !== undefined && rowB !== undefined) {
        this.matrixAdd(matrix, rowA, rowB, -conductance, unknownCount)
        this.matrixAdd(matrix, rowB, rowA, -conductance, unknownCount)
      }
    }

    this.solveLinear(matrix, rhs, unknownCount)

    const groupVoltage = new Float64Array(rootToGroup.size)
    for (const [group, row] of groupToRow) {
      const value = rhs[row]
      if (value === undefined) throw new Error('solver output missing')
      groupVoltage[group] = value
    }

    for (const branch of model.branches) {
      const groupA = nodeGroup[branch.nodeA]
      const groupB = nodeGroup[branch.nodeB]
      if (groupA === undefined || groupB === undefined) throw new Error('unmapped node group')
      let current = 0
      let terminal = 0
      if (groupA !== groupB) {
        const voltageA = groupVoltage[groupA]
        const voltageB = groupVoltage[groupB]
        if (voltageA === undefined || voltageB === undefined) throw new Error('solver output missing')
        current = (voltageA - voltageB + branch.emf) / branch.resistance
        terminal = voltageA - voltageB
      }
      if (branch.owner !== null) {
        const multi = branch.owner as BaseComponent & Partial<MultiBranchOwner>
        if (typeof multi.noteBranchResult === 'function') {
          multi.noteBranchResult(branch.index, current, terminal)
        } else {
          branch.owner.current = current
          branch.owner.voltage = terminal
        }
      }
    }
  }

  private mapNodeGroups(model: MnaModel, uf: UnionFind, rootToGroup: Map<number, number>): number[] {
    const nodeGroup: number[] = []
    for (let i = 0; i < model.nodeCount; i++) {
      const group = rootToGroup.get(uf.find(i))
      if (group === undefined) throw new Error('unmapped node group')
      nodeGroup.push(group)
    }
    return nodeGroup
  }

  private matrixAdd(matrix: Float64Array, row: number, col: number, value: number, width: number): void {
    const index = row * width + col
    const current = matrix[index]
    matrix[index] = (current ?? 0) + value
  }

  private rhsAdd(rhs: Float64Array, row: number, value: number): void {
    const current = rhs[row]
    rhs[row] = (current ?? 0) + value
  }

  private solveLinear(matrix: Float64Array, rhs: Float64Array, n: number): void {
    for (let col = 0; col < n; col++) {
      let pivotRow = col
      let pivotValue = this.abs(this.read(matrix, col, col, n))
      for (let row = col + 1; row < n; row++) {
        const value = this.abs(this.read(matrix, row, col, n))
        if (value > pivotValue) {
          pivotValue = value
          pivotRow = row
        }
      }
      if (pivotValue < 1e-14) throw new Error('singular circuit matrix')
      if (pivotRow !== col) {
        this.swapMatrixRows(matrix, col, pivotRow, n)
        this.swapValues(rhs, col, pivotRow)
      }
      const pivot = this.read(matrix, col, col, n)
      for (let row = col + 1; row < n; row++) {
        const factor = this.read(matrix, row, col, n) / pivot
        if (factor === 0) continue
        for (let k = col; k < n; k++) {
          const target = this.read(matrix, row, k, n)
          const source = this.read(matrix, col, k, n)
          this.write(matrix, row, k, target - factor * source, n)
        }
        const rhsTarget = rhs[row]
        const rhsSource = rhs[col]
        if (rhsTarget === undefined || rhsSource === undefined) throw new Error('rhs index out of range')
        rhs[row] = rhsTarget - factor * rhsSource
      }
    }
    for (let row = n - 1; row >= 0; row--) {
      let sum = 0
      for (let col = row + 1; col < n; col++) {
        sum += this.read(matrix, row, col, n) * this.read(rhs, col, 0, 1)
      }
      const diag = this.read(matrix, row, row, n)
      const rhsValue = rhs[row]
      if (diag === undefined || rhsValue === undefined) throw new Error('matrix index out of range')
      rhs[row] = (rhsValue - sum) / diag
    }
  }

  private read(data: Float64Array, row: number, col: number, width: number): number {
    const value = data[row * width + col]
    if (value === undefined) throw new Error('matrix index out of range')
    return value
  }

  private write(data: Float64Array, row: number, col: number, value: number, width: number): void {
    data[row * width + col] = value
  }

  private swapMatrixRows(matrix: Float64Array, rowA: number, rowB: number, width: number): void {
    for (let col = 0; col < width; col++) {
      const a = this.read(matrix, rowA, col, width)
      const b = this.read(matrix, rowB, col, width)
      this.write(matrix, rowA, col, b, width)
      this.write(matrix, rowB, col, a, width)
    }
  }

  private swapValues(data: Float64Array, indexA: number, indexB: number): void {
    const a = data[indexA]
    const b = data[indexB]
    if (a === undefined || b === undefined) throw new Error('array index out of range')
    data[indexA] = b
    data[indexB] = a
  }

  private abs(value: number): number {
    return value < 0 ? -value : value
  }
}
