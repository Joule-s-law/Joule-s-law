import { CELL_SIZE } from '../../../shared/constants'
import { ResistiveComponent } from './ResistiveComponent'
import type { TickContext } from '../../sim/TickContext'

const JITTER_RADIUS = 3

export class ElectronGunComponent extends ResistiveComponent {
  aimAngle = 0
  launchSpeed = 300
  emitAccum = 0

  onTick(ctx: TickContext): void {
    super.onTick(ctx)
    const frequency = Math.abs(this.voltage)
    if (frequency < 1e-6) {
      this.emitAccum = 0
      return
    }
    this.emitAccum += ctx.dt
    const interval = 1 / frequency
    const centerX = (this.x + 0.5) * CELL_SIZE
    const centerY = (this.y + 0.5) * CELL_SIZE
    while (this.emitAccum >= interval) {
      this.emitAccum -= interval
      const jitterX = (Math.random() - 0.5) * JITTER_RADIUS * 2
      const jitterY = (Math.random() - 0.5) * JITTER_RADIUS * 2
      ctx.host.emitElectron(centerX + jitterX, centerY + jitterY, Math.cos(this.aimAngle) * this.launchSpeed, Math.sin(this.aimAngle) * this.launchSpeed)
    }
  }
}
