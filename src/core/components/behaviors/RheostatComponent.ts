import type { ComponentDefinition } from '../ComponentDefinition'
import { paramNumber } from '../ComponentDefinition'
import { ResistiveComponent } from './ResistiveComponent'
import type { MnaModel, MultiBranchOwner } from '../../circuit/MnaModel'
import { EnergyType } from '../../energy/EnergyType'
import type { TickContext } from '../../sim/TickContext'

const ROD_RESISTANCE = 0.01

export class RheostatComponent extends ResistiveComponent implements MultiBranchOwner {
  sliderPosition = 1
  private readonly maxResistance: number
  private sectionLeft = 0
  private sectionRight = 0
  private branchLeft = -1
  private branchRight = -1
  private branchRod = -1
  private branchCurrentLeft = 0
  private branchCurrentRight = 0
  private branchCurrentRod = 0
  private branchVoltageLeft = 0
  private branchVoltageRight = 0
  private branchVoltageRod = 0

  constructor(def: ComponentDefinition) {
    super(def)
    this.maxResistance = paramNumber(def, 'maxResistance', 50)
  }

  getResistance(): number {
    if (Math.abs(this.current) > 1e-9) {
      return (Math.abs(this.branchVoltageLeft) + Math.abs(this.branchVoltageRight) + Math.abs(this.branchVoltageRod)) / Math.abs(this.current)
    }
    return this.sectionLeft
  }

  setSliderPosition(value: number): void {
    this.sliderPosition = Math.min(1, Math.max(0, value))
  }

  buildCircuitModel(model: MnaModel): void {
    this.sectionLeft = this.sliderPosition * this.maxResistance
    this.sectionRight = (1 - this.sliderPosition) * this.maxResistance
    this.branchLeft = model.addBranch(this.nodeOf(2), this.nodeOf(0), this.sectionLeft, 0, this)
    this.branchRight = model.addBranch(this.nodeOf(3), this.nodeOf(1), this.sectionRight, 0, this)
    this.branchRod = model.addBranch(this.nodeOf(0), this.nodeOf(1), ROD_RESISTANCE, 0, this)
  }

  noteBranchResult(index: number, current: number, voltage: number): void {
    if (index === this.branchLeft) {
      this.branchCurrentLeft = current
      this.branchVoltageLeft = voltage
    } else if (index === this.branchRight) {
      this.branchCurrentRight = current
      this.branchVoltageRight = voltage
    } else if (index === this.branchRod) {
      this.branchCurrentRod = current
      this.branchVoltageRod = voltage
    }
    const magnitudeLeft = Math.abs(this.branchCurrentLeft)
    const magnitudeRight = Math.abs(this.branchCurrentRight)
    const magnitudeRod = Math.abs(this.branchCurrentRod)
    if (magnitudeLeft >= magnitudeRight && magnitudeLeft >= magnitudeRod) {
      this.current = this.branchCurrentLeft
      this.voltage = this.branchVoltageLeft
    } else if (magnitudeRight >= magnitudeRod) {
      this.current = this.branchCurrentRight
      this.voltage = this.branchVoltageRight
    } else {
      this.current = this.branchCurrentRod
      this.voltage = this.branchVoltageRod
    }
  }

  onTick(ctx: TickContext): void {
    const heat = this.branchCurrentLeft * this.branchCurrentLeft * this.sectionLeft
      + this.branchCurrentRight * this.branchCurrentRight * this.sectionRight
    ctx.ledger.add(EnergyType.HEAT, heat)
    if (heat > 0.001 && ctx.host !== null) {
      ctx.host.emitEnergy(EnergyType.HEAT, heat, this.x + 0.5, this.y + 1)
    }
  }
}
