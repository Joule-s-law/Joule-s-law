export interface Fluid {
  id: string
  displayName: string
  color: string
  density: number
  viscosity: number
  isGas: boolean
}

export const AIR_DENSITY = 1.2

const STEAM: Fluid = { id: 'steam', displayName: '蒸汽', color: '#cfd8dc', density: 0.4, viscosity: 0.08, isGas: true }
const WATER: Fluid = { id: 'water', displayName: '水', color: '#4fc3f7', density: 60, viscosity: 0.45, isGas: false }

export const FLUIDS = new Map<string, Fluid>([
  [STEAM.id, STEAM],
  [WATER.id, WATER],
])

export function getFluid(id: string): Fluid {
  return FLUIDS.get(id) ?? STEAM
}

export function fluidCompatible(existing: string | null, incoming: string): boolean {
  return existing === null || existing === incoming
}

const DOWN_SPEED_PER_DENSITY = 2.2
const UP_SPEED = 60

export function buoyancyVelocity(fluid: Fluid): number {
  if (fluid.isGas || fluid.density < AIR_DENSITY) {
    return -UP_SPEED / (0.5 + fluid.viscosity)
  }
  return ((fluid.density - AIR_DENSITY) * DOWN_SPEED_PER_DENSITY) / (0.5 + fluid.viscosity)
}
