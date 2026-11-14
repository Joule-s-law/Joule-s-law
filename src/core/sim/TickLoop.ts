import type { Simulation } from './Simulation'

export class TickLoop {
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly simulation: Simulation,
    private readonly intervalMs: number = 100,
  ) {}

  start(): void {
    if (this.timer !== null) return
    this.timer = setInterval(() => {
      this.simulation.tick()
    }, this.intervalMs)
  }

  stop(): void {
    if (this.timer === null) return
    clearInterval(this.timer)
    this.timer = null
  }
}
