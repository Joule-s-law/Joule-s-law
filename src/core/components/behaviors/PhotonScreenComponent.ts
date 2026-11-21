import { CELL_SIZE } from '../../../shared/constants'
import type { ComponentDefinition } from '../ComponentDefinition'
import { paramNumber } from '../ComponentDefinition'
import { ResistiveComponent } from './ResistiveComponent'

export type PhotonPropagation = 'up' | 'down' | 'left' | 'right'

export interface PhotonSpot {
  localX: number
  localY: number
  bornAt: number
  progress: number
}

export class PhotonScreenComponent extends ResistiveComponent {
  readonly spotDuration: number
  propagation: PhotonPropagation = 'right'
  spots: PhotonSpot[] = []

  constructor(def: ComponentDefinition) {
    super(def)
    this.spotDuration = paramNumber(def, 'spotDuration', 2)
  }

  addSpot(localX: number, localY: number, bornAt: number): void {
    this.spots.push({ localX, localY, bornAt, progress: 0 })
  }

  glideOffset(progress: number): { dx: number; dy: number } {
    const step = CELL_SIZE / 2
    if (this.propagation === 'up') return { dx: 0, dy: -step * progress }
    if (this.propagation === 'down') return { dx: 0, dy: step * progress }
    if (this.propagation === 'left') return { dx: -step * progress, dy: 0 }
    return { dx: step * progress, dy: 0 }
  }

  updateSpots(now: number, screenWidthPx: number, screenHeightPx: number): void {
    const step = CELL_SIZE / 2
    let dx = 0
    let dy = 0
    if (this.propagation === 'up') dy = -step
    else if (this.propagation === 'down') dy = step
    else if (this.propagation === 'left') dx = -step
    else dx = step
    const kept: PhotonSpot[] = []
    for (const spot of this.spots) {
      let localX = spot.localX
      let localY = spot.localY
      let bornAt = spot.bornAt
      while (now - bornAt >= this.spotDuration) {
        bornAt += this.spotDuration
        localX += dx
        localY += dy
      }
      const progress = Math.min(1, Math.max(0, (now - bornAt) / this.spotDuration))
      if (localX < 0 || localY < 0 || localX >= screenWidthPx || localY >= screenHeightPx) continue
      kept.push({ localX, localY, bornAt, progress })
    }
    this.spots = kept
  }
}
