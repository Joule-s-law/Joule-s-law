import type { ComponentDefinition } from '../ComponentDefinition'
import { paramNumber } from '../ComponentDefinition'
import { BaseComponent } from '../BaseComponent'
import { PipeComponent } from './PipeComponent'
import type { MnaModel } from '../../circuit/MnaModel'
import { allEdgeInterfaces, isFluidSupplier, modeAdmits, type FluidInterface, type FluidReceptor } from '../../fluids/fluidInterface'
import type { TickContext } from '../../sim/TickContext'
import { CELL_SIZE } from '../../../shared/constants'
import { EnergyType } from '../../energy/EnergyType'

export class TurbineComponent extends BaseComponent implements FluidReceptor {
  private readonly emfMax: number
  private readonly steamRate: number
  steamPower = 0
  spinAngle = 0
  spinAngleAt = 0
  private steamBuffer = 0

  constructor(def: ComponentDefinition) {
    super(def)
    this.emfMax = paramNumber(def, 'emfMax', 10)
    this.steamRate = paramNumber(def, 'steamRate', 6)
  }

  getResistance(): number {
    return this.def.resistance
  }

  buildCircuitModel(model: MnaModel): void {
    const emf = this.emfMax * this.steamPower
    model.addBranch(this.nodeOf(0), this.nodeOf(1), this.def.resistance, emf, this)
  }

  canReceiveFluid(fluidId: string): boolean {
    return fluidId === 'steam'
  }

  receiveFluid(fluidId: string, amount: number, _px: number, _py: number): number {
    if (fluidId !== 'steam') return 0
    this.steamBuffer += amount
    return amount
  }

  onTick(ctx: TickContext): void {
    let want = this.steamRate * ctx.dt
    const linkedNetworks = new Set<number>()
    const linkedComponents = new Set<BaseComponent>()
    let pulled = this.steamBuffer
    this.steamBuffer = 0
    for (const neighbor of ctx.host.fluidLinksOf(this)) {
      if (want <= 0) break
      if (!modeAdmits(neighbor.selfIface.mode, 'in') || !modeAdmits(neighbor.partnerIface.mode, 'out')) continue
      if (neighbor.partner instanceof PipeComponent) {
        const networkId = ctx.host.pipeNetworkId(neighbor.partner)
        if (networkId === null || linkedNetworks.has(networkId)) continue
        const draw = ctx.host.pullPipeFluid(neighbor.partner, want, (id) => id === 'steam')
        if (draw !== null) {
          pulled += draw.amount
          want -= draw.amount
          linkedNetworks.add(networkId)
        }
      } else if (isFluidSupplier(neighbor.partner)) {
        if (linkedComponents.has(neighbor.partner)) continue
        const draw = neighbor.partner.provideFluid(want, (id) => id === 'steam')
        if (draw !== null) {
          pulled += draw.amount
          want -= draw.amount
          linkedComponents.add(neighbor.partner)
        }
      }
    }
    if (pulled > 0) {
      const consumed = pulled * 0.1
      const released = pulled - consumed
      const efficiency = Math.min(0.95, 0.85 + ctx.host.converterEfficiencyBoost)
      const energy = consumed * this.emfMax * efficiency
      ctx.ledger.add(EnergyType.KINETIC, energy)
      ctx.host.emitEnergy(EnergyType.KINETIC, energy, this.x + 0.5, this.y + 0.5)
      const target = Math.min(1, pulled / (this.steamRate * ctx.dt))
      this.steamPower += (target - this.steamPower) * Math.min(1, ctx.dt * 3)
      const px = (this.x + this.width / 2) * CELL_SIZE
      const py = (this.y + this.height / 2) * CELL_SIZE
      const count = Math.max(1, Math.ceil(released * 3))
      for (let i = 0; i < count; i++) {
        ctx.host.emitFluid(px + (Math.random() - 0.5) * CELL_SIZE * 0.6, py, 'steam', (Math.random() - 0.5) * 30, 0, 1)
      }
    } else {
      this.steamPower = Math.max(0, this.steamPower - ctx.dt * 0.5)
    }
    this.spinAngle += this.steamPower * Math.PI * 4 * ctx.dt
    this.spinAngleAt = performance.now()
  }

  getFluidInterfaces(): FluidInterface[] {
    return allEdgeInterfaces('in', this.width, this.height)
  }
}
