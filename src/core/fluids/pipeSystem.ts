import type { PipeComponent } from '../components/behaviors/PipeComponent'
import type { FluidLink } from './fluidInterface'
import { fluidCompatible } from './fluids'

export interface PipeNetwork {
  id: number
  pipes: PipeComponent[]
  fluidId: string | null
  volume: number
  flowRate: number
  flowAccum: number
  flowWindowStart: number
}

let nextNetworkId = 1

export class PipeSystem {
  private readonly networks: PipeNetwork[] = []
  private readonly byPipe = new Map<PipeComponent, PipeNetwork>()

  rebuild(pipes: PipeComponent[], links: FluidLink[]): void {
    this.networks.length = 0
    this.byPipe.clear()
    const pipeSet = new Set(pipes)
    const adjacency = new Map<PipeComponent, PipeComponent[]>()
    for (const link of links) {
      if (!(pipeSet.has(link.a.component) && pipeSet.has(link.b.component))) continue
      const a = adjacency.get(link.a.component) ?? []
      const b = adjacency.get(link.b.component) ?? []
      a.push(link.b.component)
      b.push(link.a.component)
      adjacency.set(link.a.component, a)
      adjacency.set(link.b.component, b)
    }
    const visited = new Set<PipeComponent>()
    for (const pipe of pipes) {
      if (visited.has(pipe)) continue
      const network: PipeNetwork = { id: nextNetworkId++, pipes: [], fluidId: null, volume: 0, flowRate: 0, flowAccum: 0, flowWindowStart: performance.now() }
      const queue: PipeComponent[] = [pipe]
      visited.add(pipe)
      while (queue.length > 0) {
        const current = queue.shift()
        if (current === undefined) break
        network.pipes.push(current)
        this.byPipe.set(current, network)
        for (const neighbor of adjacency.get(current) ?? []) {
          if (visited.has(neighbor)) continue
          visited.add(neighbor)
          queue.push(neighbor)
        }
      }
      this.networks.push(network)
    }
  }

  networkOf(pipe: PipeComponent): PipeNetwork | null {
    return this.byPipe.get(pipe) ?? null
  }

  pipeAt(x: number, y: number): PipeComponent | null {
    for (const network of this.networks) {
      for (const pipe of network.pipes) {
        if (pipe.x === x && pipe.y === y) return pipe
      }
    }
    return null
  }

  getNetworks(): PipeNetwork[] {
    return this.networks
  }

  private accumulateFlow(network: PipeNetwork, amount: number): void {
    const now = performance.now()
    if (now - network.flowWindowStart >= 1000) {
      network.flowRate = network.flowAccum
      network.flowAccum = 0
      network.flowWindowStart = now
    }
    network.flowAccum += amount
  }

  pushFluid(pipe: PipeComponent, fluidId: string, amount: number): number {
    const network = this.networkOf(pipe)
    if (network === null || amount <= 0) return 0
    if (!fluidCompatible(network.fluidId, fluidId)) return 0
    network.fluidId = fluidId
    network.volume += amount
    this.accumulateFlow(network, amount)
    return amount
  }

  pullFluid(pipe: PipeComponent, max: number, filter?: (fluidId: string) => boolean): { fluidId: string; amount: number } | null {
    const network = this.networkOf(pipe)
    if (network === null || network.volume <= 0 || network.fluidId === null) return null
    if (filter !== undefined && !filter(network.fluidId)) return null
    const take = Math.min(max, network.volume)
    network.volume -= take
    const fluidId = network.fluidId
    this.accumulateFlow(network, take)
    if (network.volume <= 1e-9) {
      network.volume = 0
      network.fluidId = null
    }
    return { fluidId, amount: take }
  }
}
