import { EnergyType } from '../energy/EnergyType'
import type { EnergyLedger } from '../energy/EnergyLedger'

export class Economy {
  money = 0
  globalMultiplier = 1
  private readonly multipliers = new Map<EnergyType, number>()

  constructor() {
    for (const type of Object.values(EnergyType)) {
      this.multipliers.set(type, 1)
    }
  }

  getMultiplier(type: EnergyType): number {
    return this.multipliers.get(type) ?? 1
  }

  setMultiplier(type: EnergyType, value: number): void {
    this.multipliers.set(type, value)
  }

  settle(ledger: EnergyLedger): number {
    let income = 0
    for (const [type, amount] of ledger.drain()) {
      income += amount * this.getMultiplier(type)
    }
    income *= this.globalMultiplier
    this.money += income
    return income
  }

  exportMultipliers(): Record<string, number> {
    const result: Record<string, number> = {}
    for (const [type, value] of this.multipliers) {
      result[type] = value
    }
    return result
  }

  importMultipliers(data: Record<string, number>): void {
    for (const [type, value] of Object.entries(data)) {
      this.multipliers.set(type as EnergyType, value)
    }
  }
}
