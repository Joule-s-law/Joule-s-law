import { electricFieldAt } from './electricFieldView'
import type { ChargeSource, Point } from './electricFieldView'

export const LAUNCH_SPEED_MAX = 700
export const PARTICLE_TIME_SCALE = 0.25
const ACCEL_SCALE = 60
const SUBSTEPS = 4
const TRAIL_MIN_SPACING = 3
const TRAIL_MAX_POINTS = 1000

export class ChargedParticle {
  vx: number
  vy: number
  trail: Point[] = []
  constructor(
    public x: number,
    public y: number,
    vx: number,
    vy: number,
    public charge: number,
  ) {
    this.vx = vx
    this.vy = vy
  }
}

export function integrateParticles(particles: ChargedParticle[], sources: ChargeSource[], dt: number): void {
  const h = dt / SUBSTEPS
  for (const particle of particles) {
    for (let substep = 0; substep < SUBSTEPS; substep++) {
      const field = electricFieldAt(sources, particle.x, particle.y, particle)
      if (field === null) break
      particle.vx += field.ex * particle.charge * ACCEL_SCALE * h
      particle.vy += field.ey * particle.charge * ACCEL_SCALE * h
      particle.x += particle.vx * h
      particle.y += particle.vy * h
    }
    const last = particle.trail[particle.trail.length - 1]
    if (last === undefined || Math.hypot(particle.x - last.x, particle.y - last.y) >= TRAIL_MIN_SPACING) {
      particle.trail.push({ x: particle.x, y: particle.y })
      if (particle.trail.length > TRAIL_MAX_POINTS) particle.trail.shift()
    }
  }
}
