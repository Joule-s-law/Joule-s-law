import type { BaseComponent } from '../components/BaseComponent'
import { Port } from './Port'

export class CircuitGraph {
  private readonly components: BaseComponent[] = []
  private readonly links = new Map<Port, Set<Port>>()

  addComponent(component: BaseComponent): void {
    this.components.push(component)
  }

  connect(portA: Port, portB: Port): void {
    this.linkSet(portA).add(portB)
    this.linkSet(portB).add(portA)
  }

  disconnect(portA: Port, portB: Port): void {
    this.linkSet(portA).delete(portB)
    this.linkSet(portB).delete(portA)
  }

  removeAllLinks(component: BaseComponent): void {
    for (const port of component.ports) {
      const linked = this.links.get(port)
      if (linked === undefined) continue
      for (const other of linked) {
        this.linkSet(other).delete(port)
      }
      this.links.delete(port)
    }
  }

  getLinkedPorts(port: Port): ReadonlySet<Port> {
    return this.links.get(port) ?? new Set<Port>()
  }

  assignNodeIds(): number {
    const parent = new Map<Port, Port>()
    const find = (port: Port): Port => {
      const root = parent.get(port)
      if (root === undefined) throw new Error('port not registered')
      if (root === port) return port
      const ancestor = find(root)
      parent.set(port, ancestor)
      return ancestor
    }
    const union = (a: Port, b: Port): void => {
      const rootA = find(a)
      const rootB = find(b)
      if (rootA !== rootB) parent.set(rootA, rootB)
    }
    for (const component of this.components) {
      for (const port of component.ports) {
        parent.set(port, port)
      }
    }
    for (const [port, linked] of this.links) {
      for (const other of linked) {
        union(port, other)
      }
    }
    const ids = new Map<Port, number>()
    for (const component of this.components) {
      for (const port of component.ports) {
        const root = find(port)
        let id = ids.get(root)
        if (id === undefined) {
          id = ids.size
          ids.set(root, id)
        }
        port.nodeId = id
      }
    }
    return ids.size
  }

  private linkSet(port: Port): Set<Port> {
    let set = this.links.get(port)
    if (set === undefined) {
      set = new Set()
      this.links.set(port, set)
    }
    return set
  }
}
