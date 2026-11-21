export type TerrainType = 'ocean' | 'lake' | 'sand' | 'grass'

export interface TerrainTile {
  type: TerrainType
  color: string
}

const OCEAN_DEEP: [number, number, number] = [21, 66, 110]
const OCEAN_SHALLOW: [number, number, number] = [86, 156, 205]
const LAKE_COLOR: [number, number, number] = [120, 190, 226]
const SAND_COLOR: [number, number, number] = [240, 227, 168]
const GRASS_LIGHT: [number, number, number] = [156, 204, 101]
const GRASS_DARK: [number, number, number] = [46, 125, 50]

const OCEAN_LEVEL = 0.34
const LAKE_LEVEL = 0.4
const SAND_LEVEL = 0.45

function hash2(seed: number, x: number, y: number): number {
  let h = (seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t)
}

function valueNoise(seed: number, x: number, y: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = smooth(x - xi)
  const yf = smooth(y - yi)
  const a = hash2(seed, xi, yi)
  const b = hash2(seed, xi + 1, yi)
  const c = hash2(seed, xi, yi + 1)
  const d = hash2(seed, xi + 1, yi + 1)
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf
}

function fbm(seed: number, x: number, y: number, octaves: number): number {
  let sum = 0
  let amplitude = 1
  let total = 0
  let freq = 1
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(seed + i * 7919, x * freq, y * freq) * amplitude
    total += amplitude
    amplitude *= 0.5
    freq *= 2
  }
  return sum / total
}

function lerpColor(a: [number, number, number], b: [number, number, number], t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t)
  const g = Math.round(a[1] + (b[1] - a[1]) * t)
  const bl = Math.round(a[2] + (b[2] - a[2]) * t)
  return `rgb(${r}, ${g}, ${bl})`
}

export function terrainAt(seed: number, cellX: number, cellY: number): TerrainTile {
  const elevation = fbm(seed, cellX * 0.022, cellY * 0.022, 4)
  if (elevation < OCEAN_LEVEL) {
    const depth = Math.min(1, (OCEAN_LEVEL - elevation) / 0.2)
    return { type: 'ocean', color: lerpColor(OCEAN_SHALLOW, OCEAN_DEEP, depth) }
  }
  if (elevation < LAKE_LEVEL) {
    const depth = (LAKE_LEVEL - elevation) / (LAKE_LEVEL - OCEAN_LEVEL)
    return { type: 'lake', color: lerpColor(LAKE_COLOR, OCEAN_SHALLOW, depth * 0.55) }
  }
  if (elevation < SAND_LEVEL) {
    const shade = fbm(seed ^ 0x5eed, cellX * 0.09, cellY * 0.09, 2)
    return { type: 'sand', color: lerpColor(SAND_COLOR, [226, 208, 140], shade) }
  }
  const moisture = fbm(seed ^ 0x6ea5e5, cellX * 0.035, cellY * 0.035, 3)
  return { type: 'grass', color: lerpColor(GRASS_LIGHT, GRASS_DARK, Math.min(1, Math.max(0, (moisture - 0.2) / 0.6))) }
}

export function terrainTypeAt(seed: number, cellX: number, cellY: number): TerrainType {
  return terrainAt(seed, cellX, cellY).type
}
