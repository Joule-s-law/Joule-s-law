export interface WireMaterial {
	id: string
	displayName: string
	resistivity: number
	color: string
	price: number
}

export const DEFAULT_WIRE_MATERIAL_ID = 'platinum'

const WIRE_MATERIAL_LIST: WireMaterial[] = [
	{ id: 'platinum', displayName: '铂导线', resistivity: 1.06e-7, color: '#d8d8dc', price: 1 },
	{ id: 'iron', displayName: '铁导线', resistivity: 9.71e-8, color: '#8d99a6', price: 3 },
	{ id: 'tungsten', displayName: '钨导线', resistivity: 5.65e-8, color: '#a89f91', price: 9 },
	{ id: 'copper', displayName: '铜导线', resistivity: 1.68e-8, color: '#b87333', price: 27 },
	{ id: 'silver', displayName: '银导线', resistivity: 1.59e-8, color: '#c0c0c0', price: 81 },
	{ id: 'superconductor', displayName: '超导体', resistivity: 0, color: '#6ee7b7', price: 243 },
]

export function wireMaterialColor(id: string): string {
	return WIRE_MATERIALS.get(id)?.color ?? '#d8d8dc'
}

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
