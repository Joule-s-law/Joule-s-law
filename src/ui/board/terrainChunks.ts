import { terrainAt } from '../../core/world/terrain'
import { CELL_SIZE } from './boardMath'

const CHUNK_CELLS = 8
const MAX_CHUNKS = 512

const cache = new Map<string, HTMLCanvasElement>()

export function terrainChunkCanvas(seed: number, chunkX: number, chunkY: number): HTMLCanvasElement {
  const key = `${seed}:${chunkX}:${chunkY}`
  const hit = cache.get(key)
  if (hit !== undefined) {
    cache.delete(key)
    cache.set(key, hit)
    return hit
  }
  const canvas = document.createElement('canvas')
  canvas.width = CHUNK_CELLS * CELL_SIZE
  canvas.height = CHUNK_CELLS * CELL_SIZE
  const ctx = canvas.getContext('2d')
  if (ctx !== null) {
    for (let cy = 0; cy < CHUNK_CELLS; cy++) {
      for (let cx = 0; cx < CHUNK_CELLS; cx++) {
        ctx.fillStyle = terrainAt(seed, chunkX * CHUNK_CELLS + cx, chunkY * CHUNK_CELLS + cy).color
        ctx.fillRect(cx * CELL_SIZE, cy * CELL_SIZE, CELL_SIZE, CELL_SIZE)
      }
    }
  }
  if (cache.size >= MAX_CHUNKS) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, canvas)
  return canvas
}

export function clearTerrainChunkCache(): void {
  cache.clear()
}

export const TERRAIN_CHUNK_CELLS = CHUNK_CELLS
