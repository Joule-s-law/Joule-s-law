import type { BaseComponent } from '../../core/components/BaseComponent'
import { WireComponent } from '../../core/components/behaviors/WireComponent'
import { RheostatComponent } from '../../core/components/behaviors/RheostatComponent'
import { FourthGeneratorComponent } from '../../core/components/behaviors/FourthGeneratorComponent'
import { VoltageTransformerComponent } from '../../core/components/behaviors/VoltageTransformerComponent'
import { FieldSensorComponent } from '../../core/components/behaviors/FieldSensorComponent'
import { EnergyType } from '../../core/energy/EnergyType'
import type { EnergyEvent } from '../../core/sim/Simulation'
import { CELL_SIZE, GRID_COLS, GRID_ROWS, componentAt, portPosition } from './boardMath'
import { useSettingsStore, formatWithPrefix, formatAngularValue } from '../settings/useSettingsStore'
import { traceMagneticFieldLines } from './magneticFieldLines'

export interface BoardCallbacks {
  getComponents(): BaseComponent[]
  getDragGhost(): { cellX: number; cellY: number } | null
  getWirePending(): { owner: BaseComponent; portIndex: number; color: string | null } | null
  getSelected(): BaseComponent | null
  getClickProgress(): number
  drainEnergyEvents(): EnergyEvent[]
  getLockedComponents(): BaseComponent[]
  getSimTime(): number
  onComponentClick(component: BaseComponent): void
  onComponentMove(component: BaseComponent, cellX: number, cellY: number): void
  onPortClick(component: BaseComponent, portIndex: number): void
  onBlankClick(x: number, y: number): void
  onEscape(): void
}

const ENERGY_ICONS: Record<EnergyType, string> = {
  [EnergyType.HEAT]: '🔥',
  [EnergyType.CHEMICAL]: '⚡️',
  [EnergyType.KINETIC]: '🥊',
  [EnergyType.SOUND]: '🔊',
  [EnergyType.LIGHT]: '💡',
  [EnergyType.MAGNETIC]: '🧲',
}

const FLOAT_LIFETIME = 0.9

function formatEnergy(amount: number): string {
  if (amount >= 100) return Math.round(amount).toString()
  const fixed = amount.toFixed(1)
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed
}

interface FloatText {
  x: number
  y: number
  text: string
  born: number
}

const FIELD_COLORS: Record<string, string> = {
  light: '255, 220, 120',
  sound: '120, 180, 255',
  magnetic: '200, 140, 255',
}

const WIRE_PICK_COLORS = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db', '#9b59b6', '#e84393']

function randomWireColor(exclude: string): string {
  const options = WIRE_PICK_COLORS.filter((color) => color !== exclude)
  return options[Math.floor(Math.random() * options.length)] ?? '#e74c3c'
}

function boundsOverlap(
  a: Array<{ x: number; y: number }>,
  b: Array<{ x: number; y: number }>,
): boolean {
  let minAx = Number.POSITIVE_INFINITY
  let minAy = Number.POSITIVE_INFINITY
  let maxAx = Number.NEGATIVE_INFINITY
  let maxAy = Number.NEGATIVE_INFINITY
  for (const p of a) {
    minAx = Math.min(minAx, p.x)
    minAy = Math.min(minAy, p.y)
    maxAx = Math.max(maxAx, p.x)
    maxAy = Math.max(maxAy, p.y)
  }
  for (const p of b) {
    if (p.x < minAx || p.x > maxAx || p.y < minAy || p.y > maxAy) continue
    return true
  }
  return false
}

function crossValue(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax)
}

function segmentsIntersect(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number },
): boolean {
  const d1 = crossValue(p3.x, p3.y, p4.x, p4.y, p1.x, p1.y)
  const d2 = crossValue(p3.x, p3.y, p4.x, p4.y, p2.x, p2.y)
  const d3 = crossValue(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y)
  const d4 = crossValue(p1.x, p1.y, p2.x, p2.y, p4.x, p4.y)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

export class BoardCanvas {
  private ctx: CanvasRenderingContext2D
  private readonly settings = useSettingsStore()
  private animationHandle = 0
  private mouseX = -1
  private mouseY = -1
  private time = 0
  private dragging: { wire: WireComponent; end: 'cpA' | 'cpB' } | null = null
  private dragComponent: { component: BaseComponent; grabDX: number; grabDY: number; lastCellX: number; lastCellY: number } | null = null
  private sliderDrag: RheostatComponent | null = null
  private heldCrank: BaseComponent | null = null
  private hoverComponent: BaseComponent | null = null
  private hoverCandidates: BaseComponent[] = []
  private hoverPickIndex = 0
  private floats: FloatText[] = []

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly callbacks: BoardCallbacks,
  ) {
    const context = canvas.getContext('2d')
    if (context === null) throw new Error('canvas 2d context unavailable')
    this.ctx = context
    canvas.width = GRID_COLS * CELL_SIZE
    canvas.height = GRID_ROWS * CELL_SIZE
    canvas.addEventListener('mousemove', this.handleMouseMove)
    canvas.addEventListener('mouseleave', this.handleMouseLeave)
    canvas.addEventListener('mousedown', this.handleMouseDown)
    canvas.addEventListener('contextmenu', this.handleContextMenu)
    canvas.addEventListener('wheel', this.handleWheel, { passive: false })
    window.addEventListener('mousemove', this.handleWindowMouseMove)
    window.addEventListener('mouseup', this.handleWindowMouseUp)
    window.addEventListener('keydown', this.handleKeyDown)
    this.start()
  }

  dispose(): void {
    this.stop()
    this.canvas.removeEventListener('mousemove', this.handleMouseMove)
    this.canvas.removeEventListener('mouseleave', this.handleMouseLeave)
    this.canvas.removeEventListener('mousedown', this.handleMouseDown)
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu)
    this.canvas.removeEventListener('wheel', this.handleWheel)
    window.removeEventListener('mousemove', this.handleWindowMouseMove)
    window.removeEventListener('mouseup', this.handleWindowMouseUp)
    window.removeEventListener('keydown', this.handleKeyDown)
  }

  private start(): void {
    const frame = (): void => {
      this.time += 1 / 60
      this.render()
      this.animationHandle = requestAnimationFrame(frame)
    }
    this.animationHandle = requestAnimationFrame(frame)
  }

  private stop(): void {
    cancelAnimationFrame(this.animationHandle)
  }

  private toCanvasCoords(event: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect()
    const scaleX = this.canvas.width / Math.max(1, rect.width)
    const scaleY = this.canvas.height / Math.max(1, rect.height)
    return { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY }
  }

  private handleMouseMove = (event: MouseEvent): void => {
    const coords = this.toCanvasCoords(event)
    this.mouseX = coords.x
    this.mouseY = coords.y
    const hit = this.hitTest()
    this.hoverComponent = hit.kind === 'component' ? hit.component : null
    this.updateHoverCandidates()
  }

  private updateHoverCandidates(): void {
    const busy = this.dragComponent !== null || this.dragging !== null || this.sliderDrag !== null || this.heldCrank !== null
    if (busy || this.mouseX < 0 || this.mouseY < 0) {
      this.hoverCandidates = []
      return
    }
    const candidates: BaseComponent[] = []
    const cell = this.mouseCell()
    if (cell.cellX >= 0 && cell.cellX < GRID_COLS && cell.cellY >= 0 && cell.cellY < GRID_ROWS) {
      const component = componentAt(this.callbacks.getComponents(), cell.cellX, cell.cellY)
      if (component !== null) candidates.push(component)
    }
    for (const wire of this.collectWireHits(this.callbacks.getComponents())) {
      if (!candidates.includes(wire)) candidates.push(wire)
    }
    const previous = this.hoverCandidates
    const sameSet = previous.length === candidates.length && previous.every((item, index) => item === candidates[index])
    this.hoverCandidates = candidates
    if (sameSet) {
      if (this.hoverPickIndex >= candidates.length) this.hoverPickIndex = 0
    } else {
      this.hoverPickIndex = 0
    }
  }

  private handleWheel = (event: WheelEvent): void => {
    if (this.hoverCandidates.length < 2) return
    event.preventDefault()
    const count = this.hoverCandidates.length
    const step = event.deltaY > 0 ? 1 : -1
    this.hoverPickIndex = (this.hoverPickIndex + step + count) % count
  }

  private collectWireHits(components: BaseComponent[]): WireComponent[] {
    const hits: WireComponent[] = []
    for (const component of components) {
      if (!(component instanceof WireComponent)) continue
      const anchors = component.getAnchors()
      const cps = component.getControlPoints()
      const steps = 24
      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        const point = this.cubicBezierPoint(anchors.a, cps.a, cps.b, anchors.b, t)
        if (Math.hypot(point.x - this.mouseX, point.y - this.mouseY) <= 8) {
          hits.push(component)
          break
        }
      }
    }
    return hits
  }

  private handleMouseLeave = (): void => {
    this.hoverComponent = null
  }

  private handleWindowMouseMove = (event: MouseEvent): void => {
    const coords = this.toCanvasCoords(event)
    this.mouseX = coords.x
    this.mouseY = coords.y
    if (this.dragging !== null) {
      this.applyDrag()
      return
    }
    if (this.sliderDrag !== null) {
      this.applySliderDrag()
      return
    }
    if (this.dragComponent !== null) {
      const drag = this.dragComponent
      const cellX = Math.round((this.mouseX - drag.grabDX) / CELL_SIZE)
      const cellY = Math.round((this.mouseY - drag.grabDY) / CELL_SIZE)
      if (cellX >= 0 && cellX < GRID_COLS && cellY >= 0 && cellY < GRID_ROWS && (cellX !== drag.lastCellX || cellY !== drag.lastCellY)) {
        drag.lastCellX = cellX
        drag.lastCellY = cellY
        this.callbacks.onComponentMove(drag.component, cellX, cellY)
        this.revalidateWireColors(drag.component)
      }
    }
  }

  private handleWindowMouseUp = (): void => {
    this.dragging = null
    this.sliderDrag = null
    if (this.heldCrank !== null) {
      this.heldCrank.rotationDrive = 0
      this.heldCrank = null
    }
    if (this.dragComponent !== null) {
      this.dragComponent = null
    }
  }

  private applyDrag(): void {
    const drag = this.dragging
    if (drag === null) return
    const cps = drag.wire.getControlPoints()
    if (drag.end === 'cpA') {
      drag.wire.setControlPoints({ x: this.mouseX, y: this.mouseY }, cps.b)
    } else {
      drag.wire.setControlPoints(cps.a, { x: this.mouseX, y: this.mouseY })
    }
  }

  private handleMouseDown = (event: MouseEvent): void => {
    if (event.button !== 0 && event.button !== 2) return
    const coords = this.toCanvasCoords(event)
    this.mouseX = coords.x
    this.mouseY = coords.y
    this.updateHoverCandidates()
    const dragHit = this.wireControlPointHit()
    if (dragHit !== null) {
      this.dragging = dragHit
      this.applyDrag()
      return
    }
    if (event.button === 0) {
      const sliderHit = this.rheostatSliderHit()
      if (sliderHit !== null) {
        this.sliderDrag = sliderHit
        this.applySliderDrag()
        this.callbacks.onComponentClick(sliderHit)
        return
      }
    }
    const hit = this.hitTest()
    if (event.button === 2) {
      if (hit.kind === 'component' && hit.component.def.behaviorTags['holdable'] === '1') {
        this.heldCrank = hit.component
        hit.component.rotationDrive = 1
      }
      return
    }
    if (hit.kind === 'port') {
      this.callbacks.onPortClick(hit.component, hit.portIndex)
      return
    }
    if (event.button === 0 && this.hoverCandidates.length > 0) {
      const picked = this.hoverCandidates[this.hoverPickIndex] ?? this.hoverCandidates[0]
      if (picked === undefined) {
        this.callbacks.onBlankClick(this.mouseX / CELL_SIZE, this.mouseY / CELL_SIZE)
        return
      }
      this.callbacks.onComponentClick(picked)
      if (!(picked instanceof WireComponent)) {
        if (picked.def.behaviorTags['holdable'] === '1') {
          this.heldCrank = picked
          picked.rotationDrive = -1
        }
        const cellX = picked.x * CELL_SIZE
        const cellY = picked.y * CELL_SIZE
        this.dragComponent = {
          component: picked,
          grabDX: this.mouseX - cellX,
          grabDY: this.mouseY - cellY,
          lastCellX: picked.x,
          lastCellY: picked.y,
        }
      }
      return
    }
    this.callbacks.onBlankClick(this.mouseX / CELL_SIZE, this.mouseY / CELL_SIZE)
  }

  private handleContextMenu = (event: MouseEvent): void => {
    event.preventDefault()
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      this.callbacks.onEscape()
    }
  }

  private mouseCell(): { cellX: number; cellY: number } {
    return {
      cellX: Math.floor(this.mouseX / CELL_SIZE),
      cellY: Math.floor(this.mouseY / CELL_SIZE),
    }
  }

  private wireControlPointHit(): { wire: WireComponent; end: 'cpA' | 'cpB' } | null {
    const selected = this.callbacks.getSelected()
    if (!(selected instanceof WireComponent)) return null
    const cps = selected.getControlPoints()
    if (Math.hypot(cps.a.x - this.mouseX, cps.a.y - this.mouseY) <= 14) {
      return { wire: selected, end: 'cpA' }
    }
    if (Math.hypot(cps.b.x - this.mouseX, cps.b.y - this.mouseY) <= 14) {
      return { wire: selected, end: 'cpB' }
    }
    return null
  }

  private hitTest():
    | { kind: 'port'; component: BaseComponent; portIndex: number }
    | { kind: 'component'; component: BaseComponent }
    | { kind: 'wire'; wire: WireComponent }
    | { kind: 'none' } {
    if (this.mouseX < 0 || this.mouseY < 0) return { kind: 'none' }
    const components = this.callbacks.getComponents()
    for (const component of components) {
      for (let index = 0; index < component.ports.length; index++) {
        const pos = portPosition(component, index)
        if (Math.hypot(pos.px - this.mouseX, pos.py - this.mouseY) <= 14) {
          return { kind: 'port', component, portIndex: index }
        }
      }
    }
    const cell = this.mouseCell()
    if (cell.cellX >= 0 && cell.cellX < GRID_COLS && cell.cellY >= 0 && cell.cellY < GRID_ROWS) {
      const component = componentAt(components, cell.cellX, cell.cellY)
      if (component !== null) return { kind: 'component', component }
    }
    const wire = this.wireCurveHit(components)
    if (wire !== null) return { kind: 'wire', wire }
    return { kind: 'none' }
  }

  private wireCurveHit(components: BaseComponent[]): WireComponent | null {
    for (const component of components) {
      if (!(component instanceof WireComponent)) continue
      const anchors = component.getAnchors()
      const cps = component.getControlPoints()
      const steps = 24
      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        const point = this.cubicBezierPoint(anchors.a, cps.a, cps.b, anchors.b, t)
        if (Math.hypot(point.x - this.mouseX, point.y - this.mouseY) <= 8) {
          return component
        }
      }
    }
    return null
  }

  private cubicBezierPoint(
    p0: { x: number; y: number },
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p3: { x: number; y: number },
    t: number,
  ): { x: number; y: number } {
    const u = 1 - t
    const w0 = u * u * u
    const w1 = 3 * u * u * t
    const w2 = 3 * u * t * t
    const w3 = t * t * t
    return {
      x: w0 * p0.x + w1 * p1.x + w2 * p2.x + w3 * p3.x,
      y: w0 * p0.y + w1 * p1.y + w2 * p2.y + w3 * p3.y,
    }
  }

  private render(): void {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    ctx.fillStyle = '#10141b'
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    this.drawGrid()
    this.drawFields()
    this.drawWires()
    this.drawComponents()
    this.drawPorts()
    this.drawWireHandles()
    this.drawPendingWire()
    this.drawDragGhost()
    this.drawClickCooldownRing()
    this.updateFloats()
    this.drawFloats()
    this.drawHoverTooltip()
    this.drawIntersectionPanel()
  }

  private updateFloats(): void {
    for (const event of this.callbacks.drainEnergyEvents()) {
      const icon = ENERGY_ICONS[event.type]
      if (icon === undefined) continue
      const x = event.x * CELL_SIZE
      const y = event.y * CELL_SIZE
      const clampedX = Math.max(20, Math.min(this.canvas.clientWidth - 20, x))
      const clampedY = Math.max(20, Math.min(this.canvas.clientHeight - 20, y))
      this.floats.push({ x: clampedX, y: clampedY, text: `${icon}+${formatEnergy(event.amount)}J`, born: this.time })
    }
    while (this.floats.length > 40) this.floats.shift()
    this.floats = this.floats.filter((float) => this.time - float.born < FLOAT_LIFETIME)
  }

  private drawFloats(): void {
    const ctx = this.ctx
    ctx.font = 'bold 13px system-ui, sans-serif'
    ctx.textAlign = 'center'
    for (const float of this.floats) {
      const age = this.time - float.born
      const progress = age / FLOAT_LIFETIME
      ctx.globalAlpha = progress < 0.7 ? 1 : 1 - (progress - 0.7) / 0.3
      ctx.fillStyle = '#1b2230'
      const drawY = float.y - 18 - progress * 22
      ctx.fillText(float.text, float.x + 1, drawY + 1)
      ctx.fillStyle = '#fff8e1'
      ctx.fillText(float.text, float.x, drawY)
    }
    ctx.globalAlpha = 1
  }

  private drawClickCooldownRing(): void {
    const progress = this.callbacks.getClickProgress()
    if (progress >= 1 || this.mouseX < 0 || this.mouseY < 0) return
    const ctx = this.ctx
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
    ctx.beginPath()
    ctx.arc(this.mouseX, this.mouseY, 12, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = '#4fc3f7'
    ctx.beginPath()
    ctx.arc(this.mouseX, this.mouseY, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.beginPath()
    ctx.arc(this.mouseX, this.mouseY, 2, 0, Math.PI * 2)
    ctx.fill()
  }

  private drawGrid(): void {
    const ctx = this.ctx
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
    ctx.lineWidth = 1
    for (let col = 0; col <= GRID_COLS; col++) {
      ctx.beginPath()
      ctx.moveTo(col * CELL_SIZE, 0)
      ctx.lineTo(col * CELL_SIZE, GRID_ROWS * CELL_SIZE)
      ctx.stroke()
    }
    for (let row = 0; row <= GRID_ROWS; row++) {
      ctx.beginPath()
      ctx.moveTo(0, row * CELL_SIZE)
      ctx.lineTo(GRID_COLS * CELL_SIZE, row * CELL_SIZE)
      ctx.stroke()
    }
  }

  private drawFields(): void {
    const ctx = this.ctx
    for (const component of this.callbacks.getComponents()) {
      const emission = component.getFieldEmission(0)
      if (emission === null || emission.type === 'magnetic') continue
      const color = FIELD_COLORS[emission.type]
      if (color === undefined) continue
      const cx = emission.x * CELL_SIZE + CELL_SIZE / 2
      const cy = emission.y * CELL_SIZE + CELL_SIZE / 2
      const alpha = Math.min(0.3, emission.strength / 60)
      if (alpha <= 0.01) continue
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 130)
      gradient.addColorStop(0, `rgba(${color}, ${alpha})`)
      gradient.addColorStop(1, `rgba(${color}, 0)`)
      ctx.fillStyle = gradient
      ctx.fillRect(cx - 130, cy - 130, 260, 260)
    }
    if (this.settings.showFieldLines) this.drawMagneticFieldLines()
  }

  private drawMagneticFieldLines(): void {
    const ctx = this.ctx
    const lines = traceMagneticFieldLines(this.callbacks.getComponents(), this.canvas.width, this.canvas.height)
    ctx.lineWidth = 1.4
    ctx.lineCap = 'round'
    for (const line of lines) {
      ctx.strokeStyle = `rgba(200, 140, 255, ${line.alpha})`
      ctx.beginPath()
      let started = false
      for (const point of line.points) {
        if (!started) {
          ctx.moveTo(point.x, point.y)
          started = true
        } else {
          ctx.lineTo(point.x, point.y)
        }
      }
      ctx.stroke()
      this.drawFieldArrows(line.points, line.alpha)
    }
    ctx.lineCap = 'butt'
  }

  private drawFieldArrows(points: { x: number; y: number }[], alpha: number): void {
    const ctx = this.ctx
    const spacing = 90
    ctx.strokeStyle = `rgba(200, 140, 255, ${Math.min(0.85, alpha + 0.2)})`
    ctx.lineWidth = 1.4
    let distance = 0
    let next = spacing
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]
      const cur = points[i]
      if (prev === undefined || cur === undefined) continue
      const seg = Math.hypot(cur.x - prev.x, cur.y - prev.y)
      if (seg < 0.0001) continue
      distance += seg
      if (distance < next) continue
      next += spacing
      const ux = (cur.x - prev.x) / seg
      const uy = (cur.y - prev.y) / seg
      ctx.beginPath()
      ctx.moveTo(cur.x - ux * 7 - uy * 4, cur.y - uy * 7 + ux * 4)
      ctx.lineTo(cur.x, cur.y)
      ctx.lineTo(cur.x - ux * 7 + uy * 4, cur.y - uy * 7 - ux * 4)
      ctx.stroke()
    }
  }

  private drawWires(): void {
    const ctx = this.ctx
    for (const component of this.callbacks.getComponents()) {
      if (!(component instanceof WireComponent)) continue
      const anchors = component.getAnchors()
      const cps = component.getControlPoints()
      const a = anchors.a
      const b = anchors.b
      const color = component.getVisualColor()
      ctx.strokeStyle = color
      ctx.lineWidth = 3
      if (component.current !== 0) {
        ctx.setLineDash([8, 6])
        ctx.lineDashOffset = -this.time * 60 * Math.sign(component.current)
      } else {
        ctx.setLineDash([])
      }
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.bezierCurveTo(cps.a.x, cps.a.y, cps.b.x, cps.b.y, b.x, b.y)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  private drawWireHandles(): void {
    const selected = this.callbacks.getSelected()
    if (!(selected instanceof WireComponent)) return
    const ctx = this.ctx
    const anchors = selected.getAnchors()
    const cps = selected.getControlPoints()
    const handles = [
      { anchor: anchors.a, cp: cps.a },
      { anchor: anchors.b, cp: cps.b },
    ]
    ctx.strokeStyle = 'rgba(79, 195, 247, 0.55)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([5, 5])
    for (const handle of handles) {
      ctx.beginPath()
      ctx.moveTo(handle.anchor.x, handle.anchor.y)
      ctx.lineTo(handle.cp.x, handle.cp.y)
      ctx.stroke()
    }
    ctx.setLineDash([])
    for (const handle of handles) {
      ctx.fillStyle = 'rgba(79, 195, 247, 0.25)'
      ctx.beginPath()
      ctx.arc(handle.cp.x, handle.cp.y, 9, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = '#4fc3f7'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(handle.cp.x, handle.cp.y, 5.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
  }

  private drawComponents(): void {
    const ctx = this.ctx
    const selected = this.callbacks.getSelected()
    const lockedSet = new Set<BaseComponent>()
    for (const locked of this.callbacks.getLockedComponents()) {
      lockedSet.add(locked)
    }
    for (const component of this.callbacks.getComponents()) {
      if (component instanceof WireComponent) continue
      const x = component.x * CELL_SIZE
      const y = component.y * CELL_SIZE
      const w = component.width * CELL_SIZE
      const h = component.height * CELL_SIZE
      const tolerance = component.def.behaviorParams['overloadTolerance'] ?? 1
      const overloadRatio = Math.min(1, component.overloadSeconds / tolerance)
      let fill = '#2f3640'
      if (overloadRatio > 0.66) fill = '#e74c3c'
      else if (overloadRatio > 0.33) fill = '#e67e22'
      else if (overloadRatio > 0) fill = '#f1c40f'
      else if (component instanceof FieldSensorComponent && Math.abs(component.lastEmf) > 0.001) fill = 'rgba(200, 140, 255, 0.45)'
      const isGear = component.def.behaviorId === 'gear'
      const isRotatable = component.def.behaviorTags['rotatable'] === '1'
      if (isRotatable) this.drawRealGear(component, x, y, w, h)
      if (!isGear) {
        const inset = isRotatable ? 13 : 4
        ctx.fillStyle = fill
        ctx.beginPath()
        ctx.roundRect(x + inset, y + inset, w - inset * 2, h - inset * 2, 6)
        ctx.fill()
      }
      this.strokeState(component, x, y, w, h, selected, lockedSet)
      ctx.fillStyle = '#ecf0f1'
      ctx.font = '11px system-ui, sans-serif'
      ctx.textAlign = 'center'
      const isDiode = component.def.behaviorId === 'diode'
      const isFourth = component instanceof FourthGeneratorComponent
      if (isFourth) {
        this.drawFittedText(component.customName, x + w / 2, y + 15, w - 8)
        ctx.strokeStyle = '#b388ff'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(x + 6, y + h / 2)
        ctx.lineTo(x + w * 0.34, y + h / 2)
        ctx.lineTo(x + w * 0.44, y + h * 0.28)
        ctx.lineTo(x + w * 0.56, y + h * 0.72)
        ctx.lineTo(x + w * 0.66, y + h / 2)
        ctx.lineTo(x + w - 6, y + h / 2)
        ctx.stroke()
      } else {
        this.drawFittedText(component.def.displayName, x + w / 2, isDiode ? y + 15 : y + h / 2 + 4, w - 8)
      }
      if (isDiode) this.drawDiodeSymbol(x, y, w, h)
      if (component instanceof RheostatComponent) this.drawRheostatSlider(component)
      if (component.def.portCount === 4) {
        const gain = component.def.behaviorParams['gain'] ?? 2
        ctx.fillStyle = '#ffd54f'
        ctx.font = '10px system-ui, sans-serif'
        ctx.fillText(gain === 0.5 ? '×½' : '×' + gain, x + w / 2, y + 14)
        ctx.fillStyle = '#90a4ae'
        ctx.fillText('入 ▸ 出', x + w / 2, y + h - 20)
      }
      const current = Math.abs(component.current)
      if (current > 0.0005 && !isFourth) {
        ctx.fillStyle = '#4fc3f7'
        ctx.font = '9px system-ui, sans-serif'
        ctx.fillText(current.toFixed(2) + 'A', x + w / 2, y + h - 8)
      }
    }
    this.drawLockedWarnings()
  }

  private drawHoverTooltip(): void {
    const drag = this.dragComponent
    const slider = this.sliderDrag
    const pinned = drag !== null || slider !== null
    const component = drag !== null ? drag.component : slider !== null ? slider : this.hoverComponent
    if (component === null) return
    if (!pinned && this.hoverCandidates.length > 1) return
    if (!pinned && !component.occupies(Math.floor(this.mouseX / CELL_SIZE), Math.floor(this.mouseY / CELL_SIZE))) {
      this.hoverComponent = null
      return
    }
    const ctx = this.ctx
    const lines: string[] = [component instanceof FourthGeneratorComponent ? component.customName : component.def.displayName]
    const isRotatable = component.def.behaviorTags['rotatable'] === '1'
    if (component.def.portCount > 0) {
      lines.push('R = ' + this.formatResistanceDisplay(component.getResistance()))
      lines.push('I = ' + formatWithPrefix(Math.abs(component.current), this.settings.prefixCurrent, 'A'))
      lines.push('V = ' + (component.voltage >= 0 ? '' : '-') + formatWithPrefix(Math.abs(component.voltage), this.settings.prefixVoltage, 'V'))
      if (component.def.behaviorTags['sensorField'] === 'magnetic') {
        lines.push('B = ' + formatWithPrefix(component.getSensedFluxDensity() * 1e-3, this.settings.prefixFluxDensity, 'T'))
        lines.push('Φ = ' + formatWithPrefix(component.getSensedFlux() * 1e-3, this.settings.prefixFlux, 'Wb'))
      }
      if (component instanceof VoltageTransformerComponent) {
        lines.push('输入 V = ' + formatWithPrefix(component.getInputVoltage(), this.settings.prefixVoltage, 'V'))
        lines.push('输入 I = ' + formatWithPrefix(Math.abs(component.getInputCurrent()), this.settings.prefixCurrent, 'A'))
      }
    } else {
      lines.push('不接电的机械元件')
    }
    if (isRotatable) {
      lines.push('转速 = ' + formatAngularValue(component.rotationSpeed, this.settings.angularUnit))
    }
    ctx.font = '11px system-ui, sans-serif'
    let width = 0
    for (const line of lines) {
      width = Math.max(width, ctx.measureText(line).width)
    }
    const boxW = width + 18
    const boxH = lines.length * 16 + 10
    let px: number
    let py: number
    if (pinned) {
      px = this.canvas.width / 2 - boxW / 2
      py = this.canvas.height / 2 - boxH / 2
    } else {
      px = this.mouseX + 14
      py = this.mouseY + 14
      if (px + boxW > this.canvas.clientWidth) px = this.mouseX - boxW - 10
      if (py + boxH > this.canvas.clientHeight) py = this.mouseY - boxH - 10
    }
    ctx.fillStyle = 'rgba(20, 26, 38, 0.92)'
    ctx.strokeStyle = '#3a4a63'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(px, py, boxW, boxH, 6)
    ctx.fill()
    ctx.stroke()
    ctx.textAlign = 'left'
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? ''
      if (i === 0 && component instanceof WireComponent) {
        ctx.fillStyle = component.getVisualColor()
      } else {
        ctx.fillStyle = i === 0 ? '#4fc3f7' : '#cfd8dc'
      }
      ctx.fillText(line, px + 9, py + 17 + i * 16)
    }
  }

  private drawIntersectionPanel(): void {
    if (this.hoverCandidates.length < 2) return
    if (this.dragComponent !== null || this.dragging !== null || this.sliderDrag !== null) return
    const ctx = this.ctx
    ctx.font = '11px system-ui, sans-serif'
    const rows = this.hoverCandidates.map((candidate) =>
      candidate instanceof WireComponent ? '导线' : candidate.def.displayName,
    )
    let width = 0
    for (const row of rows) width = Math.max(width, ctx.measureText(row).width)
    width = Math.max(width, ctx.measureText('滚轮切换 · 点击选中').width)
    const boxW = width + 26
    const boxH = rows.length * 18 + 30
    let px = this.mouseX + 16
    let py = this.mouseY + 16
    if (px + boxW > this.canvas.clientWidth) px = this.mouseX - boxW - 12
    if (py + boxH > this.canvas.clientHeight) py = this.mouseY - boxH - 12
    ctx.fillStyle = 'rgba(20, 26, 38, 0.94)'
    ctx.strokeStyle = '#3a4a63'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(px, py, boxW, boxH, 6)
    ctx.fill()
    ctx.stroke()
    ctx.textAlign = 'left'
    for (let i = 0; i < rows.length; i++) {
      const candidate = this.hoverCandidates[i]
      const row = rows[i] ?? ''
      const rowY = py + 8 + i * 18
      if (i === this.hoverPickIndex) {
        ctx.fillStyle = 'rgba(79, 195, 247, 0.22)'
        ctx.beginPath()
        ctx.roundRect(px + 4, rowY, boxW - 8, 17, 4)
        ctx.fill()
      }
      const textX = px + 10 + (i === this.hoverPickIndex ? 10 : 0)
      if (candidate instanceof WireComponent) {
        ctx.fillStyle = candidate.getVisualColor()
      } else {
        ctx.fillStyle = i === this.hoverPickIndex ? '#4fc3f7' : '#cfd8dc'
      }
      ctx.fillText((i === this.hoverPickIndex ? '▶ ' : '') + row, textX, rowY + 13)
    }
    ctx.fillStyle = '#78909c'
    ctx.fillText('滚轮切换 · 点击选中', px + 10, py + boxH - 9)
  }

  private formatResistanceDisplay(value: number): string {
    if (value === Number.POSITIVE_INFINITY) return '∞（断开）'
    return formatWithPrefix(value, this.settings.prefixResistance, 'Ω')
  }

  private drawRealGear(component: BaseComponent, x: number, y: number, w: number, h: number): void {
    const ctx = this.ctx
    const cx = x + w / 2
    const cy = y + h / 2
    const radius = Math.min(w, h) / 2
    const teeth = component.teeth
    const elapsed = Math.min(0.25, Math.max(0, (performance.now() - component.rotationAngleAt) / 1000))
    const angle = component.rotationAngle + component.rotationSpeed * elapsed
    const tipRadius = radius + 3
    const rootRadius = radius - 5
    const toothHalf = (Math.PI / teeth) * 0.42
    ctx.fillStyle = '#4d5a64'
    ctx.beginPath()
    ctx.arc(cx, cy, rootRadius, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#5d6d78'
    for (let i = 0; i < teeth; i++) {
      const a = angle + (i * Math.PI * 2) / teeth
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a - toothHalf) * rootRadius, cy + Math.sin(a - toothHalf) * rootRadius)
      ctx.arc(cx, cy, tipRadius, a - toothHalf, a + toothHalf)
      ctx.lineTo(cx + Math.cos(a + toothHalf) * rootRadius, cy + Math.sin(a + toothHalf) * rootRadius)
      ctx.closePath()
      ctx.fill()
    }
    ctx.strokeStyle = '#8fa1ad'
    ctx.lineWidth = 2
    for (let i = 0; i < 3; i++) {
      const spoke = angle + (i * Math.PI * 2) / 3
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(spoke) * rootRadius * 0.18, cy + Math.sin(spoke) * rootRadius * 0.18)
      ctx.lineTo(cx + Math.cos(spoke) * rootRadius * 0.92, cy + Math.sin(spoke) * rootRadius * 0.92)
      ctx.stroke()
    }
    ctx.fillStyle = '#37424b'
    ctx.beginPath()
    ctx.arc(cx, cy, Math.max(4, rootRadius * 0.22), 0, Math.PI * 2)
    ctx.fill()
  }

  private strokeState(
    component: BaseComponent,
    x: number,
    y: number,
    w: number,
    h: number,
    selected: BaseComponent | null,
    lockedSet: Set<BaseComponent>,
  ): void {
    const ctx = this.ctx
    ctx.beginPath()
    ctx.roundRect(x + 3, y + 3, w - 6, h - 6, 6)
    if (lockedSet.has(component)) {
      ctx.strokeStyle = '#e74c3c'
      ctx.lineWidth = 3
      ctx.stroke()
      return
    }
    if (component.rotationDrive !== 0) {
      ctx.strokeStyle = '#4caf50'
      ctx.lineWidth = 2.5
      ctx.stroke()
      return
    }
    if (component === selected) {
      ctx.strokeStyle = '#4fc3f7'
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }

  private drawLockedWarnings(): void {
    const locked = this.callbacks.getLockedComponents()
    if (locked.length === 0) return
    const ctx = this.ctx
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    for (const component of locked) {
      minX = Math.min(minX, component.x)
      minY = Math.min(minY, component.y)
      maxX = Math.max(maxX, (component.x + component.width) * CELL_SIZE)
    }
    const centerX = (minX * CELL_SIZE + maxX) / 2
    const textY = Math.max(14, minY * CELL_SIZE - 10)
    ctx.font = 'bold 12px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(231, 76, 60, 0.85)'
    ctx.fillText('⚠ 传动系统已锁死，请检查传动结构', centerX, textY)
  }

  private drawFittedText(text: string, centerX: number, y: number, maxWidth: number): void {
    const ctx = this.ctx
    let fontSize = 11
    while (fontSize > 7) {
      ctx.font = fontSize + 'px system-ui, sans-serif'
      if (ctx.measureText(text).width <= maxWidth) break
      fontSize -= 1
    }
    let display = text
    if (ctx.measureText(display).width > maxWidth) {
      while (display.length > 1 && ctx.measureText(display + '…').width > maxWidth) {
        display = display.slice(0, -1)
      }
      display += '…'
    }
    ctx.fillText(display, centerX, y)
  }

  private drawPorts(): void {
    const ctx = this.ctx
    const pending = this.callbacks.getWirePending()
    for (const component of this.callbacks.getComponents()) {
      if (component instanceof WireComponent) continue
      const polarity = this.portPolarity(component)
      for (let index = 0; index < component.ports.length; index++) {
        const pos = portPosition(component, index)
        ctx.fillStyle = '#94a3b8'
        ctx.beginPath()
        ctx.arc(pos.px, pos.py, 5.5, 0, Math.PI * 2)
        ctx.fill()
        if (pending !== null && pending.owner === component && pending.portIndex === index) {
          ctx.strokeStyle = '#f1c40f'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(pos.px, pos.py, 8, 0, Math.PI * 2)
          ctx.stroke()
        }
        const mark = polarity[index]
        if (mark !== undefined) {
          ctx.fillStyle = mark === '+' ? '#e74c3c' : '#4fc3f7'
          ctx.font = 'bold 11px system-ui, sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(mark, pos.px, pos.py - 9)
        }
      }
    }
  }

  private portPolarity(component: BaseComponent): Record<number, string> {
    if (component.def.portCount === 4) {
      return { 0: '+', 1: '-', 2: '+', 3: '-' }
    }
    if (component.def.portCount !== 2) return {}
    if (component.def.behaviorId === 'battery') {
      return { 0: '-', 1: '+' }
    }
    if (component.def.behaviorId === 'diode') {
      if (Math.abs(component.voltage) > 0.0005) {
        return component.voltage > 0 ? { 0: '+', 1: '-' } : { 0: '-', 1: '+' }
      }
      return { 0: '▶', 1: '|' }
    }
    if (Math.abs(component.voltage) > 0.0005) {
      return component.voltage > 0 ? { 0: '+', 1: '-' } : { 0: '-', 1: '+' }
    }
    return {}
  }

  private drawDiodeSymbol(x: number, y: number, w: number, h: number): void {
    const ctx = this.ctx
    const cy = y + h / 2 + 7
    ctx.fillStyle = '#4fc3f7'
    ctx.strokeStyle = '#4fc3f7'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x + w / 2 - 11, cy - 6)
    ctx.lineTo(x + w / 2 - 11, cy + 6)
    ctx.lineTo(x + w / 2 + 1, cy)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(x + w / 2 + 4, cy - 8)
    ctx.lineTo(x + w / 2 + 4, cy + 8)
    ctx.stroke()
  }

  private sliderTrackGeom(component: RheostatComponent): { trackX: number; trackY: number; trackW: number } {
    const x = component.x * CELL_SIZE
    const y = component.y * CELL_SIZE
    const w = component.width * CELL_SIZE
    const trackY = y - 6 < 2 ? y + 6 : y - 4
    return { trackX: x + 6, trackY, trackW: w - 12 }
  }

  private drawRheostatSlider(component: RheostatComponent): void {
    const ctx = this.ctx
    const geom = this.sliderTrackGeom(component)
    ctx.strokeStyle = '#78909c'
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(geom.trackX, geom.trackY)
    ctx.lineTo(geom.trackX + geom.trackW, geom.trackY)
    ctx.stroke()
    ctx.lineCap = 'butt'
    const knobX = geom.trackX + geom.trackW * component.sliderPosition
    ctx.fillStyle = '#ffd54f'
    ctx.beginPath()
    ctx.arc(knobX, geom.trackY, 5.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#10141b'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  private rheostatSliderHit(): RheostatComponent | null {
    for (const component of this.callbacks.getComponents()) {
      if (!(component instanceof RheostatComponent)) continue
      const geom = this.sliderTrackGeom(component)
      const knobX = geom.trackX + geom.trackW * component.sliderPosition
      if (Math.hypot(knobX - this.mouseX, geom.trackY - this.mouseY) <= 9) return component
    }
    return null
  }

  private applySliderDrag(): void {
    const drag = this.sliderDrag
    if (drag === null) return
    const geom = this.sliderTrackGeom(drag)
    drag.setSliderPosition((this.mouseX - geom.trackX) / geom.trackW)
  }

  private drawPendingWire(): void {
    const pending = this.callbacks.getWirePending()
    if (pending === null || this.mouseX < 0) return
    const ctx = this.ctx
    const start = portPosition(pending.owner, pending.portIndex)
    const startXY = { x: start.px, y: start.py }
    const end = { x: this.mouseX, y: this.mouseY }
    for (const component of this.callbacks.getComponents()) {
      if (!(component instanceof WireComponent)) continue
      if (this.segmentHitsWire(startXY, end, component)) {
        if (pending.color === null) {
          const index = Math.floor(Math.random() * WIRE_PICK_COLORS.length)
          pending.color = WIRE_PICK_COLORS[index] ?? '#e74c3c'
        }
        break
      }
    }
    ctx.strokeStyle = '#f1c40f'
    ctx.lineWidth = 2
    ctx.setLineDash([6, 6])
    ctx.beginPath()
    ctx.moveTo(start.px, start.py)
    ctx.lineTo(this.mouseX, this.mouseY)
    ctx.stroke()
    ctx.setLineDash([])
  }

  private segmentHitsWire(a: { x: number; y: number }, b: { x: number; y: number }, wire: WireComponent): boolean {
    const points = this.bezierPoints(wire)
    let prev = points[0]
    if (prev === undefined) return false
    for (let i = 1; i < points.length; i++) {
      const cur = points[i]
      if (cur === undefined) break
      if (segmentsIntersect(a, b, prev, cur)) return true
      prev = cur
    }
    return false
  }

  private bezierPoints(wire: WireComponent): Array<{ x: number; y: number }> {
    const anchors = wire.getAnchors()
    const cps = wire.getControlPoints()
    const steps = 24
    const points: Array<{ x: number; y: number }> = []
    for (let i = 0; i <= steps; i++) {
      points.push(this.cubicBezierPoint(anchors.a, cps.a, cps.b, anchors.b, i / steps))
    }
    return points
  }

  private curvesIntersect(a: WireComponent, b: WireComponent): boolean {
    const pointsA = this.bezierPoints(a)
    const pointsB = this.bezierPoints(b)
    if (!boundsOverlap(pointsA, pointsB)) return false
    for (let i = 1; i < pointsA.length; i++) {
      const prevA = pointsA[i - 1]
      const curA = pointsA[i]
      if (prevA === undefined || curA === undefined) break
      for (let j = 1; j < pointsB.length; j++) {
        const prevB = pointsB[j - 1]
        const curB = pointsB[j]
        if (prevB === undefined || curB === undefined) break
        if (segmentsIntersect(prevA, curA, prevB, curB)) return true
      }
    }
    return false
  }

  private wireTouchesComponent(wire: WireComponent, component: BaseComponent): boolean {
    const anchors = wire.getAnchors()
    const left = component.x * CELL_SIZE
    const top = component.y * CELL_SIZE
    const right = left + component.width * CELL_SIZE
    const bottom = top + component.height * CELL_SIZE
    for (const anchor of [anchors.a, anchors.b]) {
      const dx = Math.max(left - anchor.x, 0, anchor.x - right)
      const dy = Math.max(top - anchor.y, 0, anchor.y - bottom)
      if (Math.hypot(dx, dy) <= CELL_SIZE * 0.75) return true
    }
    return false
  }

  private revalidateWireColors(moved: BaseComponent): void {
    const components = this.callbacks.getComponents()
    for (const wire of components) {
      if (!(wire instanceof WireComponent)) continue
      if (!this.wireTouchesComponent(wire, moved)) continue
      for (const other of components) {
        if (!(other instanceof WireComponent) || other === wire) continue
        if (!this.curvesIntersect(wire, other)) continue
        if (wire.getVisualColor() === other.getVisualColor()) {
          wire.setVisualColor(randomWireColor(wire.getVisualColor()))
          break
        }
      }
    }
  }

  private drawDragGhost(): void {
    const ghost = this.callbacks.getDragGhost()
    if (ghost === null || ghost.cellX < 0 || ghost.cellY < 0) return
    const ctx = this.ctx
    ctx.fillStyle = 'rgba(79, 195, 247, 0.25)'
    ctx.fillRect(ghost.cellX * CELL_SIZE, ghost.cellY * CELL_SIZE, CELL_SIZE, CELL_SIZE)
  }
}
