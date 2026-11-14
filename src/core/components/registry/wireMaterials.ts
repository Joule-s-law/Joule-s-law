export interface WireMaterial {
  id: string
  displayName: string
  resistivity: number
}

export const DEFAULT_WIRE_MATERIAL_ID = 'copper'

const WIRE_MATERIAL_LIST: WireMaterial[] = [
  { id: 'copper', displayName: '铜导线', resistivity: 1e-8 },
  { id: 'silver', displayName: '银导线', resistivity: 1e-9 },
  { id: 'superconductor', displayName: '超导体', resistivity: 0 },
]

export const WIRE_MATERIALS: ReadonlyMap<string, WireMaterial> = new Map(
  WIRE_MATERIAL_LIST.map((material) => [material.id, material]),
)

export function hasWireMaterial(id: string): boolean {
  return WIRE_MATERIALS.has(id)
}

export function getWireMaterial(id: string): WireMaterial {
  const material = WIRE_MATERIALS.get(id)
  if (material === undefined) throw new Error(`unknown wire material: ${id}`)
  return material
}
