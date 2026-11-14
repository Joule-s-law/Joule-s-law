import type { EnergyType } from './EnergyType'

export class EnergyLedger {
  private readonly amounts = new Map<EnergyType, number>()

  add(type: EnergyType, amount: number): void {
    this.amounts.set(type, (this.amounts.get(type) ?? 0) + amount)
  }

  peek(type: EnergyType): number {
    return this.amounts.get(type) ?? 0
  }

  drain(): Map<EnergyType, number> {
    const snapshot = new Map(this.amounts)
    this.amounts.clear()
    return snapshot
  }
}
