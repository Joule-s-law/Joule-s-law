import type { ComponentDefinition } from '../ComponentDefinition'
import { paramNumber } from '../ComponentDefinition'
import { BaseComponent } from '../BaseComponent'
import type { MnaModel, MultiBranchOwner } from '../../circuit/MnaModel'
import { EnergyType } from '../../energy/EnergyType'
import type { TickContext } from '../../sim/TickContext'

const MIN_INPUT_RESISTANCE = 0.05
const MAX_INPUT_RESISTANCE = 1000000
const MIN_OUTPUT_POWER = 0.001

export class VoltageTransformerComponent extends BaseComponent implements MultiBranchOwner {
  readonly gain: number
  readonly efficiency: number
  private readonly outputResistance: number
  private branchIn = -1
  private branchOut = -1
  private inputVoltage = 0
  private inputCurrent = 0
  private outputPower = 0

  constructor(def: ComponentDefinition) {
    super(def)
    this.gain = paramNumber(def, 'gain', 2)
    this.efficiency = paramNumber(def, 'efficiency', 0.9)
    this.outputResistance = paramNumber(def, 'outputResistance', 0.5)
  }

  getResistance(): number {
    return this.inputResistance()
  }

  getInputVoltage(): number {
    return this.inputVoltage
  }

  getInputCurrent(): number {
    return this.inputCurrent
  }

  private inputResistance(): number {
    const target = (this.efficiency * this.inputVoltage * this.inputVoltage) / Math.max(this.outputPower, MIN_OUTPUT_POWER)
    return Math.min(MAX_INPUT_RESISTANCE, Math.max(MIN_INPUT_RESISTANCE, target))
  }

  buildCircuitModel(model: MnaModel): void {
    this.branchIn = model.addBranch(this.nodeOf(0), this.nodeOf(1), this.inputResistance(), 0, this)
    this.branchOut = model.addBranch(this.nodeOf(3), this.nodeOf(2), this.outputResistance, this.gain * this.inputVoltage, this)
  }

  noteBranchResult(index: number, current: number, voltage: number): void {
    if (index === this.branchIn) {
      this.inputCurrent = current
      this.inputVoltage = voltage
    } else if (index === this.branchOut) {
      this.current = current
      this.voltage = voltage
      this.outputPower = Math.max(0, Math.abs(voltage) * current)
    }
  }

  onTick(ctx: TickContext): void {
    const loss = Math.max(0, this.inputVoltage * this.inputCurrent - this.outputPower)
    if (loss <= 0.0001) return
    const heat = loss * ctx.dt
    ctx.ledger.add(EnergyType.HEAT, heat)
    if (ctx.host !== null) {
      ctx.host.emitEnergy(EnergyType.HEAT, heat, this.x + 0.5, this.y + 0.5)
    }
  }
}
