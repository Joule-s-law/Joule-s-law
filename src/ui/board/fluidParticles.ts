import { buoyancyVelocity, getFluid } from '../../core/fluids/fluids'
import { isFluidReceptor, type FluidReceptor } from '../../core/fluids/fluidInterface'
import type { BaseComponent } from '../../core/components/BaseComponent'
import { CELL_SIZE } from '../../shared/constants'

const SUBSTEPS = 2
const PARTICLE_AMOUNT = 0.2

export class FluidParticle {
  vx: number
  vy: number
  constructor(
    public x: number,
    public y: number,
    vx: number,
    vy: number,
    public fluidId: string,
  ) {
    this.vx = vx
    this.vy = vy
  }
}

export function fluidReceptors(components: BaseComponent[]): Array<{ component: BaseComponent; receptor: FluidReceptor; x: number; y: number; w: number; h: number }> {
  const list: Array<{ component: BaseComponent; receptor: FluidReceptor; x: number; y: number; w: number; h: number }> = []
  for (const component of components) {
    if (!isFluidReceptor(component)) continue
    list.push({
      component,
      receptor: component,
      x: component.x * CELL_SIZE - 6,
      y: component.y * CELL_SIZE - 6,
      w: component.width * CELL_SIZE + 12,
      h: component.height * CELL_SIZE + 12,
    })
  }
  return list
}

export function integrateFluidParticles(
  particles: FluidParticle[],
  receptors: Array<{ receptor: FluidReceptor; x: number; y: number; w: number; h: number }>,
  view: { x0: number; y0: number; x1: number; y1: number },
  dt: number,
): void {
  const h = dt / SUBSTEPS
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i]
    if (particle === undefined) continue
    const fluid = getFluid(particle.fluidId)
    const targetVy = buoyancyVelocity(fluid)
    for (let step = 0; step < SUBSTEPS; step++) {
      particle.vy += (targetVy - particle.vy) * Math.min(1, h * 4)
      particle.vx *= 1 - Math.min(0.9, h * 0.6)
      particle.x += particle.vx * h
      particle.y += particle.vy * h
    }
    let consumed = false
    for (const entry of receptors) {
      if (particle.x < entry.x || particle.x > entry.x + entry.w || particle.y < entry.y || particle.y > entry.y + entry.h) continue
      if (!entry.receptor.canReceiveFluid(particle.fluidId)) continue
      entry.receptor.receiveFluid(particle.fluidId, PARTICLE_AMOUNT, particle.x, particle.y)
      consumed = true
      break
    }
    if (consumed || particle.x < view.x0 - 60 || particle.x > view.x1 + 60 || particle.y < view.y0 - 60 || particle.y > view.y1 + 60) {
      particles.splice(i, 1)
    }
  }
}
