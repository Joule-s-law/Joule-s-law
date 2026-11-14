import type { BaseComponent } from '../components/BaseComponent'

export class Port {
  nodeId = -1

  constructor(
    public readonly owner: BaseComponent,
    public readonly index: number,
  ) {}
}
