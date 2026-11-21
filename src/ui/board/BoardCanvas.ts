import type { BaseComponent } from '../../core/components/BaseComponent'
import { WireComponent } from '../../core/components/behaviors/WireComponent'
import { ChainDriveComponent } from '../../core/components/behaviors/ChainDriveComponent'
import { BatteryComponent } from '../../core/components/behaviors/BatteryComponent'
import { SwitchComponent } from '../../core/components/behaviors/SwitchComponent'
import { GearComponent } from '../../core/components/behaviors/GearComponent'
import { ClutchComponent } from '../../core/components/behaviors/ClutchComponent'
import { FreeTerminalComponent } from '../../core/components/behaviors/FreeTerminalComponent'
import { RheostatComponent } from '../../core/components/behaviors/RheostatComponent'
import { FourthGeneratorComponent } from '../../core/components/behaviors/FourthGeneratorComponent'
import { VoltageTransformerComponent } from '../../core/components/behaviors/VoltageTransformerComponent'
import { FieldSensorComponent } from '../../core/components/behaviors/FieldSensorComponent'
import { EnergyType } from '../../core/energy/EnergyType'
import type { EnergyEvent, ElectronLaunch, FluidEmission } from '../../core/sim/Simulation'
import type { PipeNetwork } from '../../core/fluids/pipeSystem'
import { getFluid } from '../../core/fluids/fluids'
import { PhotonScreenComponent } from '../../core/components/behaviors/PhotonScreenComponent'
import { ElectronGunComponent } from '../../core/components/behaviors/ElectronGunComponent'
import { PipeComponent } from '../../core/components/behaviors/PipeComponent'
import { TankComponent } from '../../core/components/behaviors/TankComponent'
import { CondenserComponent } from '../../core/components/behaviors/CondenserComponent'
import { SteamEngineComponent } from '../../core/components/behaviors/SteamEngineComponent'
import { TurbineComponent } from '../../core/components/behaviors/TurbineComponent'
import { FissionReactorComponent } from '../../core/components/behaviors/FissionReactorComponent'
import { MotorComponent } from '../../core/components/behaviors/MotorComponent'
import { FluidParticle, integrateFluidParticles, fluidReceptors } from './fluidParticles'
import { buildFluidLinks, interfaceCell, interfaceKey, interfaceWorldPos } from '../../core/fluids/fluidInterface'
import { CELL_SIZE, componentAt, portPosition } from './boardMath'
import { useSettingsStore, formatWithPrefix, formatAngularValue } from '../settings/useSettingsStore'
import { traceMagneticFieldLines, collectMagneticSources, magneticFieldVector } from './magneticFieldLines'
import { collectChargeSources, electricFieldAt, traceElectricFieldLines, computeIsolines } from './electricFieldView'
import type { ChargeSource, FieldLine, Isoline } from './electricFieldView'
import { ChargedParticle, integrateParticles, LAUNCH_SPEED_MAX, PARTICLE_TIME_SCALE } from './chargedParticles'

export interface BoardCallbacks {
  getComponents(): BaseComponent[]
  getDragGhost(): { defId: string; cellX: number; cellY: number; px: number; py: number } | null
  getWirePending(): { owner: BaseComponent; portIndex: number; color: string | null } | null
  getChainPlacement(): { first: { x: number; y: number } | null } | null
  getSelected(): BaseComponent | null
  getClickProgress(): number
  drainEnergyEvents(): EnergyEvent[]
  drainElectronLaunches(): ElectronLaunch[]
  getScreenPlacing(): boolean
  onScreenPlace(rect: { x: number; y: number; width: number; height: number }): void
  getPipePlacing(): boolean
  onPipePlace(cells: Array<{ x: number; y: number }>): void
  getPipeNetworks(): PipeNetwork[]
  getPipeNetwork(pipe: PipeComponent): PipeNetwork | null
  getContamination(): { x: number; y: number; radius: number } | null
  drainFluidEmissions(): FluidEmission[]
  onFreeTerminalMove(component: BaseComponent, px: number, py: number): void
  getLockedComponents(): BaseComponent[]
  getSimTime(): number
  onComponentClick(component: BaseComponent): void
  onComponentMove(component: BaseComponent, cellX: number, cellY: number): void
  onComponentDropAtScreen(clientX: number, clientY: number, component: BaseComponent): void
  onPortClick(component: BaseComponent, portIndex: number): void
  onToggleMonitor(component: BaseComponent): void
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

const LORENTZ_THRESHOLD = 0.001

const ZOOM_MIN = 0.3
const ZOOM_MAX = 3
const VIEWPORT_MARGIN = 120

const ELECTRODE_COLORS: Record<string, string> = {
  '铅 Pb': '#546e7a',
  '二氧化铅 PbO₂': '#3e2723',
  '镉 Cd': '#607d8b',
  '氢氧化镍 NiOOH': '#263238',
  '石墨嵌锂 LiC₆': '#37474f',
  '钴酸锂 LiCoO₂': '#1a237e',
}

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

function pointSegmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const lengthSq = dx * dx + dy * dy
  if (lengthSq <= 1e-9) return Math.hypot(px - ax, py - ay)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
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
  private mouseInside = false
  private panX = 0
  private panY = 0
  private zoom = 1
  private panning: { startCssX: number; startCssY: number; startPanX: number; startPanY: number; moved: boolean } | null = null
  private screenRectDrag: { startX: number; startY: number } | null = null
  private screenRectPreview: { x: number; y: number; width: number; height: number } | null = null
  private terminalDrag: { component: FreeTerminalComponent; grabDX: number; grabDY: number; moved: boolean } | null = null
  private pipePathDrag: { startX: number; startY: number } | null = null
  private pipePathPreview: Array<{ x: number; y: number }> | null = null
  private readonly fluidParticles: FluidParticle[] = []
  private resizeObserver: ResizeObserver | null = null
  private time = 0
  private dragging: { wire: WireComponent; end: 'cpA' | 'cpB' } | null = null
  private dragComponent: { component: BaseComponent; grabDX: number; grabDY: number; lastCellX: number; lastCellY: number; moved: boolean } | null = null
  private sliderDrag: RheostatComponent | null = null
  private heldCrank: BaseComponent | null = null
  private hoverComponent: BaseComponent | null = null
  private hoverCandidates: BaseComponent[] = []
  private hoverPickIndex = 0
  private tabHeld = false
  private spaceKeyHeld = false
  private spaceLocked = false
  private lastSpaceDown = 0
  private mouseCharge = 5
  private charging: { progress: number } | null = null
  private aiming: { pressX: number; pressY: number } | null = null
  private launchAngle = 0
  private particles: ChargedParticle[] = []
  private chargeBarTimer = 0
  private frameCount = 0
  private cachedSources: ChargeSource[] = []
  private cachedFieldLines: FieldLine[] = []
  private cachedIsolines: Isoline[] = []
  private floats: FloatText[] = []

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly callbacks: BoardCallbacks,
  ) {
    const context = canvas.getContext('2d')
    if (context === null) throw new Error('canvas 2d context unavailable')
    this.ctx = context
    this.resizeCanvas()
    this.resizeObserver = new ResizeObserver(() => this.resizeCanvas())
    this.resizeObserver.observe(canvas)
    canvas.addEventListener('mousemove', this.handleMouseMove)
    canvas.addEventListener('mouseleave', this.handleMouseLeave)
    canvas.addEventListener('mousedown', this.handleMouseDown)
    canvas.addEventListener('contextmenu', this.handleContextMenu)
    canvas.addEventListener('wheel', this.handleWheel, { passive: false })
    window.addEventListener('mousemove', this.handleWindowMouseMove)
    window.addEventListener('mouseup', this.handleWindowMouseUp)
    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
    window.addEventListener('blur', this.handleWindowBlur)
    this.start()
  }

  dispose(): void {
    this.stop()
    if (this.resizeObserver !== null) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }
    this.canvas.removeEventListener('mousemove', this.handleMouseMove)
    this.canvas.removeEventListener('mouseleave', this.handleMouseLeave)
    this.canvas.removeEventListener('mousedown', this.handleMouseDown)
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu)
    this.canvas.removeEventListener('wheel', this.handleWheel)
    window.removeEventListener('mousemove', this.handleWindowMouseMove)
    window.removeEventListener('mouseup', this.handleWindowMouseUp)
    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)
    window.removeEventListener('blur', this.handleWindowBlur)
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

  private resizeCanvas(): void {
    const rect = this.canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const width = Math.max(1, Math.round(rect.width * dpr))
    const height = Math.max(1, Math.round(rect.height * dpr))
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
    }
  }

  private devicePixelRatio(): number {
    return window.devicePixelRatio || 1
  }

  screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect()
    return {
      x: (clientX - rect.left - this.panX) / this.zoom,
      y: (clientY - rect.top - this.panY) / this.zoom,
    }
  }

  private worldView(): { x0: number; y0: number; x1: number; y1: number } {
    const dpr = this.devicePixelRatio()
    const cssW = this.canvas.width / dpr
    const cssH = this.canvas.height / dpr
    return {
      x0: -this.panX / this.zoom,
      y0: -this.panY / this.zoom,
      x1: (cssW - this.panX) / this.zoom,
      y1: (cssH - this.panY) / this.zoom,
    }
  }

  private toCanvasCoords(event: MouseEvent): { x: number; y: number } {
    return this.screenToWorld(event.clientX, event.clientY)
  }

  private handleMouseMove = (event: MouseEvent): void => {
    const coords = this.toCanvasCoords(event)
    this.mouseX = coords.x
    this.mouseY = coords.y
    this.mouseInside = true
    const hit = this.hitTest()
    this.hoverComponent = hit.kind === 'component' ? hit.component : null
    this.updateHoverCandidates()
  }

  private get spaceHeld(): boolean {
    return this.spaceKeyHeld || this.settings.electricFieldMode
  }

  private updateHoverCandidates(): void {
    const busy = this.dragComponent !== null || this.dragging !== null || this.sliderDrag !== null || this.heldCrank !== null || this.spaceHeld
    if (busy || !this.mouseInside) {
      this.hoverCandidates = []
      return
    }
    const candidates: BaseComponent[] = []
    const cell = this.mouseCell()
    {
      const component = componentAt(this.callbacks.getComponents(), cell.cellX, cell.cellY)
      if (component !== null) candidates.push(component)
    }
    for (const wire of this.collectWireHits(this.callbacks.getComponents())) {
      if (!candidates.includes(wire)) candidates.push(wire)
    }
    for (const chain of this.collectChainHits(this.callbacks.getComponents())) {
      if (!candidates.includes(chain)) candidates.push(chain)
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
    if (this.spaceHeld) {
      event.preventDefault()
      const step = event.deltaY > 0 ? -1 : 1
      this.mouseCharge = Math.min(15, Math.max(-15, this.mouseCharge + step))
      this.chargeBarTimer = 2.2
      return
    }
    if (this.hoverCandidates.length >= 2) {
      event.preventDefault()
      const count = this.hoverCandidates.length
      const step = event.deltaY > 0 ? 1 : -1
      this.hoverPickIndex = (this.hoverPickIndex + step + count) % count
      return
    }
    if (event.deltaY === 0) return
    event.preventDefault()
    const rect = this.canvas.getBoundingClientRect()
    const cssX = event.clientX - rect.left
    const cssY = event.clientY - rect.top
    const worldX = (cssX - this.panX) / this.zoom
    const worldY = (cssY - this.panY) / this.zoom
    const factor = event.deltaY > 0 ? 0.9 : 1.1
    this.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this.zoom * factor))
    this.panX = cssX - worldX * this.zoom
    this.panY = cssY - worldY * this.zoom
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
    this.mouseInside = false
    this.hoverComponent = null
  }

  private handleWindowMouseMove = (event: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect()
    const cssX = event.clientX - rect.left
    const cssY = event.clientY - rect.top
    this.mouseInside = cssX >= 0 && cssY >= 0 && cssX <= rect.width && cssY <= rect.height
    const coords = this.screenToWorld(event.clientX, event.clientY)
    this.mouseX = coords.x
    this.mouseY = coords.y
    if (this.panning !== null) {
      const pan = this.panning
      const dx = cssX - pan.startCssX
      const dy = cssY - pan.startCssY
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) pan.moved = true
      this.panX = pan.startPanX + dx
      this.panY = pan.startPanY + dy
      return
    }
    if (this.screenRectDrag !== null) {
      this.updateScreenRectPreview()
      return
    }
    if (this.terminalDrag !== null) {
      const drag = this.terminalDrag
      const px = this.mouseX - drag.grabDX
      const py = this.mouseY - drag.grabDY
      if (Math.hypot(px - drag.component.posX, py - drag.component.posY) > 3) drag.moved = true
      if (drag.moved) this.callbacks.onFreeTerminalMove(drag.component, px, py)
      return
    }
    if (this.pipePathDrag !== null) {
      this.updatePipePathPreview()
      return
    }
    if (this.aiming !== null) {
      const dx = this.mouseX - this.aiming.pressX
      const dy = this.mouseY - this.aiming.pressY
      if (Math.hypot(dx, dy) > 6) this.launchAngle = Math.atan2(dy, dx)
    }
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
      if (cellX !== drag.lastCellX || cellY !== drag.lastCellY) {
        drag.lastCellX = cellX
        drag.lastCellY = cellY
        drag.moved = true
        this.callbacks.onComponentMove(drag.component, cellX, cellY)
        this.revalidateWireColors(drag.component)
      }
    }
  }

  private handleWindowMouseUp = (event: MouseEvent): void => {
    if (this.terminalDrag !== null) {
      const drag = this.terminalDrag
      this.terminalDrag = null
      if (!drag.moved) this.callbacks.onPortClick(drag.component, 0)
      return
    }
    if (this.screenRectDrag !== null) {
      const preview = this.screenRectPreview
      this.screenRectDrag = null
      this.screenRectPreview = null
      if (preview !== null && this.callbacks.getScreenPlacing()) this.callbacks.onScreenPlace(preview)
      return
    }
    if (this.pipePathDrag !== null) {
      const cells = this.pipePathPreview
      this.pipePathDrag = null
      this.pipePathPreview = null
      if (cells !== null && cells.length > 0 && this.callbacks.getPipePlacing()) this.callbacks.onPipePlace(cells)
      return
    }
    if (this.panning !== null) {
      const pan = this.panning
      this.panning = null
      this.canvas.style.cursor = ''
      if (!pan.moved) {
        this.callbacks.onBlankClick(this.mouseX / CELL_SIZE, this.mouseY / CELL_SIZE)
      }
      return
    }
    if (this.aiming !== null) this.aiming = null
    if (this.charging !== null) {
      this.launchParticle(this.charging.progress)
      this.charging = null
    }
    this.dragging = null
    this.sliderDrag = null
    if (this.heldCrank !== null) {
      this.heldCrank.rotationDrive = 0
      this.heldCrank = null
    }
    if (this.dragComponent !== null) {
      const drag = this.dragComponent
      this.dragComponent = null
      if (!drag.moved && drag.component instanceof SwitchComponent) {
        drag.component.closed = !drag.component.closed
      } else if (drag.moved) {
        this.callbacks.onComponentDropAtScreen(event.clientX, event.clientY, drag.component)
      }
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

  private startPan(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect()
    this.panning = {
      startCssX: event.clientX - rect.left,
      startCssY: event.clientY - rect.top,
      startPanX: this.panX,
      startPanY: this.panY,
      moved: false,
    }
    this.canvas.style.cursor = 'grabbing'
  }

  private updateScreenRectPreview(): void {
    const drag = this.screenRectDrag
    if (drag === null) return
    const startX = Math.floor(drag.startX / CELL_SIZE)
    const startY = Math.floor(drag.startY / CELL_SIZE)
    const endX = Math.floor(this.mouseX / CELL_SIZE)
    const endY = Math.floor(this.mouseY / CELL_SIZE)
    this.screenRectPreview = {
      x: Math.min(startX, endX),
      y: Math.min(startY, endY),
      width: Math.abs(endX - startX) + 1,
      height: Math.abs(endY - startY) + 1,
    }
  }

  private drawScreenPreview(): void {
    const rect = this.screenRectPreview
    if (rect === null) return
    const ctx = this.ctx
    const x = rect.x * CELL_SIZE
    const y = rect.y * CELL_SIZE
    const w = rect.width * CELL_SIZE
    const h = rect.height * CELL_SIZE
    ctx.fillStyle = 'rgba(255, 213, 79, 0.16)'
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, 6)
    ctx.fill()
    ctx.strokeStyle = '#ffd54f'
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 4])
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = '#ffd54f'
    ctx.font = 'bold 12px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`${rect.width}×${rect.height}`, x + w / 2, y - 8)
    ctx.textAlign = 'start'
  }

  private handleMouseDown = (event: MouseEvent): void => {
    if (event.button !== 0 && event.button !== 2) return
    event.preventDefault()
    const coords = this.toCanvasCoords(event)
    this.mouseX = coords.x
    this.mouseY = coords.y
    if (this.spaceHeld) {
      if (event.button === 0) this.charging = { progress: 0 }
      if (event.button === 2) this.aiming = { pressX: coords.x, pressY: coords.y }
      return
    }
    if (event.button === 0 && this.callbacks.getScreenPlacing()) {
      this.screenRectDrag = { startX: this.mouseX, startY: this.mouseY }
      this.screenRectPreview = null
      this.updateScreenRectPreview()
      return
    }
    if (event.button === 0 && this.callbacks.getPipePlacing()) {
      this.pipePathDrag = { startX: this.mouseX, startY: this.mouseY }
      this.updatePipePathPreview()
      return
    }
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
        if (this.tabHeld) {
          this.callbacks.onToggleMonitor(sliderHit)
          return
        }
        this.sliderDrag = sliderHit
        this.applySliderDrag()
        this.callbacks.onComponentClick(sliderHit)
        return
      }
    }
    if (event.button === 0) {
      const terminal = this.freeTerminalHit(this.callbacks.getComponents())
      if (terminal !== null) {
        if (this.callbacks.getWirePending() !== null) {
          this.callbacks.onPortClick(terminal, 0)
          return
        }
        this.callbacks.onComponentClick(terminal)
        this.terminalDrag = {
          component: terminal,
          grabDX: this.mouseX - terminal.posX,
          grabDY: this.mouseY - terminal.posY,
          moved: false,
        }
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
        this.startPan(event)
        return
      }
      if (this.tabHeld) {
        this.callbacks.onToggleMonitor(picked)
        return
      }
      this.callbacks.onComponentClick(picked)
      if (!(picked instanceof WireComponent) && !(picked instanceof ChainDriveComponent)) {
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
          moved: false,
        }
      }
      return
    }
    this.startPan(event)
  }

  private handleContextMenu = (event: MouseEvent): void => {
    event.preventDefault()
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      this.callbacks.onEscape()
    }
    if (event.key === 'Tab') {
      event.preventDefault()
      this.tabHeld = true
    }
    if (event.key === ' ') {
      event.preventDefault()
      if (event.repeat) return
      const now = performance.now()
      if (this.spaceLocked) {
        this.spaceLocked = false
        this.spaceKeyHeld = false
      } else if (now - this.lastSpaceDown < 300) {
        this.spaceLocked = true
        this.spaceKeyHeld = true
      } else {
        this.spaceKeyHeld = true
      }
      this.lastSpaceDown = now
    }
  }

  private handleKeyUp = (event: KeyboardEvent): void => {
    if (event.key === 'Tab') this.tabHeld = false
    if (event.key === ' ' && !this.spaceLocked) this.spaceKeyHeld = false
  }

  private handleWindowBlur = (): void => {
    this.tabHeld = false
    if (!this.spaceLocked) this.spaceKeyHeld = false
    this.charging = null
    this.aiming = null
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
    if (!this.mouseInside) return { kind: 'none' }
    const components = this.callbacks.getComponents()
    for (const component of components) {
      if (component instanceof WireComponent || component instanceof FreeTerminalComponent) continue
      for (let index = 0; index < component.ports.length; index++) {
        const pos = portPosition(component, index)
        if (Math.hypot(pos.px - this.mouseX, pos.py - this.mouseY) <= 14) {
          return { kind: 'port', component, portIndex: index }
        }
      }
    }
    const terminal = this.freeTerminalHit(components)
    if (terminal !== null) return { kind: 'component', component: terminal }
    const cell = this.mouseCell()
    {
      const component = componentAt(components, cell.cellX, cell.cellY)
      if (component !== null) return { kind: 'component', component }
    }
    const wire = this.wireCurveHit(components)
    if (wire !== null) return { kind: 'wire', wire }
    return { kind: 'none' }
  }

  private freeTerminalHit(components: BaseComponent[]): FreeTerminalComponent | null {
    for (const component of components) {
      if (!(component instanceof FreeTerminalComponent)) continue
      if (Math.hypot(component.posX - this.mouseX, component.posY - this.mouseY) <= 12) return component
    }
    return null
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
    this.frameCount++
    const ctx = this.ctx
    const dpr = this.devicePixelRatio()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    ctx.fillStyle = '#10141b'
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    ctx.setTransform(dpr * this.zoom, 0, 0, dpr * this.zoom, dpr * this.panX, dpr * this.panY)
    this.drawGrid()
    this.drawFields()
    this.spawnElectrons()
    if (this.spaceHeld || this.particles.length > 0) {
      this.cachedSources = collectChargeSources(this.callbacks.getComponents(), this.particles)
    }
    if (this.spaceHeld) this.drawElectricFieldLayer()
    this.drawWires()
    this.drawComponents()
    this.drawPorts()
    this.drawFluidInterfaces()
    this.drawContamination()
    this.drawChains()
    this.drawWireHandles()
    this.drawPendingWire()
    this.drawChainPreview()
    this.drawDragGhost()
    this.drawScreenPreview()
    this.drawPipePathPreview()
    this.drawPipeFlowAnimation()
    this.drawClickCooldownRing()
    this.updateFloats()
    this.drawFloats()
    this.updateParticles()
    this.drawParticles()
    this.updateFluidParticles(1 / 60)
    this.drawFluidParticles()
    this.drawHoverTooltip()
    this.drawMonitoredTooltips()
    this.drawIntersectionPanel()
    if (this.spaceHeld) this.drawElectricOverlay()
    if (this.charging !== null) this.charging.progress = Math.min(1, this.charging.progress + 1.2 / 60)
    if (this.chargeBarTimer > 0) this.chargeBarTimer = Math.max(0, this.chargeBarTimer - 1 / 60)
  }

  private spawnElectrons(): void {
    for (const launch of this.callbacks.drainElectronLaunches()) {
      if (this.particles.length >= 80) this.particles.shift()
      this.particles.push(new ChargedParticle(launch.x, launch.y, launch.vx, launch.vy, -1))
    }
  }

  private updateParticles(): void {
    if (this.particles.length === 0) return
    integrateParticles(this.particles, this.cachedSources, (1 / 60) * PARTICLE_TIME_SCALE)
    const view = this.worldView()
    const x0 = view.x0 - VIEWPORT_MARGIN
    const y0 = view.y0 - VIEWPORT_MARGIN
    const x1 = view.x1 + VIEWPORT_MARGIN
    const y1 = view.y1 + VIEWPORT_MARGIN
    this.particles = this.particles.filter((particle) => particle.x > x0 && particle.x < x1 && particle.y > y0 && particle.y < y1)
    if (this.particles.length === 0) return
    const screens: PhotonScreenComponent[] = []
    for (const component of this.callbacks.getComponents()) {
      if (component instanceof PhotonScreenComponent) screens.push(component)
    }
    if (screens.length === 0) return
    this.particles = this.particles.filter((particle) => {
      for (const screen of screens) {
        const sx = screen.x * CELL_SIZE
        const sy = screen.y * CELL_SIZE
        const sw = screen.width * CELL_SIZE
        const sh = screen.height * CELL_SIZE
        if (particle.x <= sx || particle.x >= sx + sw || particle.y <= sy || particle.y >= sy + sh) continue
        screen.addSpot(particle.x - sx, particle.y - sy, this.time)
        return false
      }
      return true
    })
  }

  private launchParticle(progress: number): void {
    if (this.mouseCharge === 0) return
    const speed = progress * LAUNCH_SPEED_MAX
    const particle = new ChargedParticle(
      this.mouseX,
      this.mouseY,
      Math.cos(this.launchAngle) * speed,
      Math.sin(this.launchAngle) * speed,
      this.mouseCharge,
    )
    if (this.particles.length >= 80) this.particles.shift()
    this.particles.push(particle)
  }

  private drawParticles(): void {
    if (this.particles.length === 0) return
    const ctx = this.ctx
    const magneticSources = collectMagneticSources(this.callbacks.getComponents())
    if (this.spaceHeld) {
      ctx.lineWidth = 1
      for (const particle of this.particles) {
        if (particle.trail.length < 2) continue
        ctx.strokeStyle = particle.charge > 0 ? 'rgba(239, 83, 80, 0.4)' : 'rgba(66, 165, 245, 0.4)'
        ctx.beginPath()
        let started = false
        for (const point of particle.trail) {
          if (!started) {
            ctx.moveTo(point.x, point.y)
            started = true
          } else {
            ctx.lineTo(point.x, point.y)
          }
        }
        ctx.stroke()
      }
    }
    for (const particle of this.particles) {
      const radius = 3.5 + Math.min(4, Math.abs(particle.charge) * 0.25)
      ctx.fillStyle = particle.charge > 0 ? '#ef5350' : '#42a5f5'
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#10141b'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 8px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(particle.charge > 0 ? '+' : '-', particle.x, particle.y + 3)
      const field = magneticFieldVector(magneticSources, particle.x, particle.y)
      const crossZ = particle.charge * (particle.vy * field.bx - particle.vx * field.by)
      if (Math.abs(crossZ) >= LORENTZ_THRESHOLD) {
        ctx.strokeStyle = '#ffd54f'
        ctx.lineWidth = 1.5
        if (crossZ > 0) {
          ctx.beginPath()
          ctx.arc(particle.x, particle.y, (radius + 3.5) * 2, 0, Math.PI * 2)
          ctx.stroke()
        } else {
          const s = 16
          ctx.beginPath()
          ctx.moveTo(particle.x - s, particle.y - s)
          ctx.lineTo(particle.x + s, particle.y + s)
          ctx.moveTo(particle.x + s, particle.y - s)
          ctx.lineTo(particle.x - s, particle.y + s)
          ctx.stroke()
        }
      }
    }
    ctx.textAlign = 'start'
  }

  private drawElectricFieldLayer(): void {
    if (this.frameCount % 2 === 0) {
      const bounds = this.worldView()
      this.cachedFieldLines = traceElectricFieldLines(this.cachedSources, bounds)
      this.cachedIsolines = computeIsolines(this.cachedSources, bounds)
    }
    const ctx = this.ctx
    ctx.lineCap = 'round'
    ctx.lineWidth = 1.2
    for (const line of this.cachedFieldLines) {
      ctx.strokeStyle = `rgba(110, 220, 200, ${line.alpha})`
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
      this.drawFieldArrows(line.points, line.alpha, '110, 220, 200')
    }
    ctx.lineWidth = 1
    for (const isoline of this.cachedIsolines) {
      ctx.strokeStyle = isoline.positive ? 'rgba(255, 90, 90, 0.38)' : 'rgba(90, 140, 255, 0.38)'
      ctx.beginPath()
      for (let i = 0; i + 1 < isoline.segments.length; i += 2) {
        const a = isoline.segments[i]
        const b = isoline.segments[i + 1]
        if (a === undefined || b === undefined) continue
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
      }
      ctx.stroke()
    }
    ctx.lineCap = 'butt'
  }

  private drawElectricOverlay(): void {
    const ctx = this.ctx
    const charge = this.mouseCharge
    if (charge !== 0) {
      const field = electricFieldAt(this.cachedSources, this.mouseX, this.mouseY)
      if (field !== null) {
        const fx = field.ex * charge
        const fy = field.ey * charge
        const magnitude = Math.hypot(fx, fy)
        if (magnitude > 1e-6) {
          const length = 14 + 30 * Math.log10(1 + magnitude / 0.3)
          const ux = fx / magnitude
          const uy = fy / magnitude
          const endX = this.mouseX + ux * length
          const endY = this.mouseY + uy * length
          ctx.strokeStyle = charge > 0 ? 'rgba(255, 120, 120, 0.95)' : 'rgba(120, 160, 255, 0.95)'
          ctx.lineWidth = 2.5
          ctx.beginPath()
          ctx.moveTo(this.mouseX + ux * 8, this.mouseY + uy * 8)
          ctx.lineTo(endX, endY)
          ctx.stroke()
          ctx.beginPath()
          ctx.moveTo(endX - ux * 9 - uy * 5, endY - uy * 9 + ux * 5)
          ctx.lineTo(endX, endY)
          ctx.lineTo(endX - ux * 9 + uy * 5, endY - uy * 9 - ux * 5)
          ctx.stroke()
        }
      }
    }
    if (this.charging !== null) {
      ctx.strokeStyle = '#ffd54f'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.arc(this.mouseX, this.mouseY, 26, -Math.PI / 2, -Math.PI / 2 + this.charging.progress * Math.PI * 2)
      ctx.stroke()
    }
    const aimLength = 64
    const aimUx = Math.cos(this.launchAngle)
    const aimUy = Math.sin(this.launchAngle)
    const aimEndX = this.mouseX + aimUx * aimLength
    const aimEndY = this.mouseY + aimUy * aimLength
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(this.mouseX + aimUx * 30, this.mouseY + aimUy * 30)
    ctx.lineTo(aimEndX, aimEndY)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(aimEndX - aimUx * 8 - aimUy * 4, aimEndY - aimUy * 8 + aimUx * 4)
    ctx.lineTo(aimEndX, aimEndY)
    ctx.lineTo(aimEndX - aimUx * 8 + aimUy * 4, aimEndY - aimUy * 8 - aimUx * 4)
    ctx.stroke()
    if (this.chargeBarTimer > 0) this.drawChargeBar()
  }

  private drawChargeBar(): void {
    const ctx = this.ctx
    const barW = 12
    const barH = 120
    const barX = this.mouseX + 34
    const barY = this.mouseY - barH / 2
    ctx.fillStyle = 'rgba(20, 26, 38, 0.9)'
    ctx.strokeStyle = '#3a4a63'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(barX - 2, barY - 2, barW + 4, barH + 4, 4)
    ctx.fill()
    ctx.stroke()
    const centerY = barY + barH / 2
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(barX, centerY)
    ctx.lineTo(barX + barW, centerY)
    ctx.stroke()
    const valueY = centerY - (this.mouseCharge / 15) * (barH / 2)
    ctx.strokeStyle = this.mouseCharge >= 0 ? '#ef5350' : '#42a5f5'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(barX + barW / 2, centerY)
    ctx.lineTo(barX + barW / 2, valueY)
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(barX + barW / 2, valueY, 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ecf0f1'
    ctx.font = 'bold 11px system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(`${this.mouseCharge > 0 ? '+' : ''}${this.mouseCharge}e`, barX + barW + 8, centerY + 4)
    ctx.textAlign = 'start'
  }

  private updateFloats(): void {
    for (const event of this.callbacks.drainEnergyEvents()) {
      const icon = ENERGY_ICONS[event.type]
      if (icon === undefined) continue
      const x = event.x * CELL_SIZE
      const y = event.y * CELL_SIZE
      const view = this.worldView()
      const clampedX = Math.max(view.x0 + 20, Math.min(view.x1 - 20, x))
      const clampedY = Math.max(view.y0 + 20, Math.min(view.y1 - 20, y))
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
    if (progress >= 1 || !this.mouseInside) return
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
    const view = this.worldView()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
    ctx.lineWidth = 1 / this.zoom
    const col0 = Math.floor(view.x0 / CELL_SIZE)
    const col1 = Math.ceil(view.x1 / CELL_SIZE)
    for (let col = col0; col <= col1; col++) {
      const x = col * CELL_SIZE
      ctx.beginPath()
      ctx.moveTo(x, view.y0)
      ctx.lineTo(x, view.y1)
      ctx.stroke()
    }
    const row0 = Math.floor(view.y0 / CELL_SIZE)
    const row1 = Math.ceil(view.y1 / CELL_SIZE)
    for (let row = row0; row <= row1; row++) {
      const y = row * CELL_SIZE
      ctx.beginPath()
      ctx.moveTo(view.x0, y)
      ctx.lineTo(view.x1, y)
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
    const bounds = this.worldView()
    const lines = traceMagneticFieldLines(this.callbacks.getComponents(), bounds)
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
      this.drawFieldArrows(line.points, line.alpha, '200, 140, 255')
    }
    ctx.lineCap = 'butt'
  }

  private drawFieldArrows(points: { x: number; y: number }[], alpha: number, color: string): void {
    const ctx = this.ctx
    const spacing = 90
    ctx.strokeStyle = `rgba(${color}, ${Math.min(0.85, alpha + 0.2)})`
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

  private collectChainHits(components: BaseComponent[]): ChainDriveComponent[] {
    const hits: ChainDriveComponent[] = []
    for (const component of components) {
      if (!(component instanceof ChainDriveComponent)) continue
      const a = component.getEndpointA()
      const b = component.getEndpointB()
      if (pointSegmentDistance(this.mouseX, this.mouseY, a.x, a.y, b.x, b.y) <= 10) hits.push(component)
    }
    return hits
  }

  private drawChains(): void {
    const locked = new Set(this.callbacks.getLockedComponents())
    const ctx = this.ctx
    for (const component of this.callbacks.getComponents()) {
      if (!(component instanceof ChainDriveComponent)) continue
      const a = component.getEndpointA()
      const b = component.getEndpointB()
      ctx.lineCap = 'round'
      ctx.strokeStyle = locked.has(component) ? '#c0392b' : '#3a4148'
      ctx.lineWidth = 10
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
      ctx.strokeStyle = '#10141b'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
      ctx.lineCap = 'butt'
    }
  }

  private drawChainPreview(): void {
    const placement = this.callbacks.getChainPlacement()
    if (placement === null) return
    const ctx = this.ctx
    if (placement.first === null) return
    const first = placement.first
    ctx.strokeStyle = 'rgba(241, 196, 15, 0.9)'
    ctx.lineWidth = 2
    ctx.setLineDash([6, 6])
    ctx.beginPath()
    ctx.moveTo(first.x, first.y)
    ctx.lineTo(this.mouseX, this.mouseY)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.strokeStyle = '#f1c40f'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(first.x, first.y, 12, 0, Math.PI * 2)
    ctx.stroke()
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
      if (component instanceof ChainDriveComponent) continue
      if (component instanceof FreeTerminalComponent) {
        this.drawFreeTerminal(component, selected)
        continue
      }
      if (component instanceof PipeComponent) {
        this.drawPipe(component)
        continue
      }
      if (component instanceof TankComponent) {
        this.drawTank(component, selected)
        continue
      }
      if (component instanceof CondenserComponent) {
        this.drawCondenser(component, selected)
        continue
      }
      if (component instanceof FissionReactorComponent) {
        this.drawFissionReactor(component, selected)
        continue
      }
      if (component instanceof TurbineComponent) {
        this.drawTurbine(component)
        continue
      }
      if (component instanceof SteamEngineComponent) {
        this.drawSteamEngine(component)
        continue
      }
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
      else if (component instanceof SwitchComponent) fill = component.closed ? '#1e8e4e' : '#c0392b'
      const isGear = component.def.behaviorId === 'gear'
      const isRotatable = component.def.behaviorTags['rotatable'] === '1'
      if (component instanceof MotorComponent) this.drawMotor(component, x, y, w, h)
      else if (isRotatable) this.drawRealGear(component, x, y, w, h)
      if (component instanceof ClutchComponent) this.drawClutch(component, x, y, w, h)
      if (component.def.id === 'flywheel') this.drawFlywheelHub(x, y, w, h)
      if (!isGear) {
        const inset = isRotatable ? 13 : 4
        ctx.fillStyle = fill
        ctx.beginPath()
        ctx.roundRect(x + inset, y + inset, w - inset * 2, h - inset * 2, 6)
        ctx.fill()
      }
      if (component instanceof PhotonScreenComponent) this.drawPhotonScreen(component, x, y, w, h)
      this.strokeState(component, x, y, w, h, selected, lockedSet)
      ctx.fillStyle = '#ecf0f1'
      ctx.font = '11px system-ui, sans-serif'
      ctx.textAlign = 'center'
      const isDiode = component.def.behaviorId === 'diode'
      const isFourth = component instanceof FourthGeneratorComponent
      const isMeter = component.def.id === 'ammeter' || component.def.id === 'voltmeter'
      if (isFourth) {
        this.drawFittedText(component.customName, x + w / 2, y + 15, w - 8)
        this.drawFourthDial(component, x, y, w, h)
      } else {
        const isRheostat = component instanceof RheostatComponent
        const isBattery = component instanceof BatteryComponent
        this.drawFittedText(component.def.displayName, x + w / 2, isDiode || isMeter || component instanceof ElectronGunComponent || component instanceof PhotonScreenComponent ? y + 10 : isRheostat || isBattery ? y + 14 : y + h / 2 + 4, w - 8)
      }
      if (isDiode) this.drawDiodeSymbol(x, y, w, h)
      if (isMeter) this.drawMeterDial(component, x, y, w, h)
      if (component instanceof BatteryComponent) this.drawBatteryCell(component, x, y, w, h)
      if (component instanceof RheostatComponent) this.drawRheostatSlider(component)
      if (component instanceof ElectronGunComponent) this.drawElectronGun(component, x, y, w, h)
      if (component instanceof VoltageTransformerComponent) {
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

  private buildTooltipLines(component: BaseComponent): string[] {
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
      if (component instanceof TurbineComponent) {
        lines.push('蒸汽功率 = ' + (component.steamPower * 100).toFixed(0) + '%')
      }
    } else {
      lines.push('不接电的机械元件')
      if (component instanceof PipeComponent) {
        const network = this.callbacks.getPipeNetwork(component)
        if (network !== null) {
          lines.push('流体 = ' + (network.fluidId === null ? '空' : getFluid(network.fluidId).displayName))
          lines.push('流速 = ' + network.flowRate.toFixed(1) + '/s')
        }
      }
    }
    if (isRotatable) {
      lines.push('转速 = ' + formatAngularValue(component.rotationSpeed, this.settings.angularUnit))
    }
    return lines
  }

  private tooltipSize(lines: string[]): { boxW: number; boxH: number } {
    this.ctx.font = '11px system-ui, sans-serif'
    let width = 0
    for (const line of lines) {
      width = Math.max(width, this.ctx.measureText(line).width)
    }
    return { boxW: width + 18, boxH: lines.length * 16 + 10 }
  }

  private drawTooltipAt(lines: string[], px: number, py: number, wireColor: string | null): void {
    const { boxW, boxH } = this.tooltipSize(lines)
    const ctx = this.ctx
    ctx.fillStyle = 'rgba(20, 26, 38, 0.92)'
    ctx.strokeStyle = '#3a4a63'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(px, py, boxW, boxH, 6)
    ctx.fill()
    ctx.stroke()
    ctx.textAlign = 'left'
    ctx.font = '11px system-ui, sans-serif'
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? ''
      if (i === 0 && wireColor !== null) {
        ctx.fillStyle = wireColor
      } else {
        ctx.fillStyle = i === 0 ? '#4fc3f7' : '#cfd8dc'
      }
      ctx.fillText(line, px + 9, py + 17 + i * 16)
    }
  }

  private drawMonitoredTooltips(): void {
    for (const component of this.callbacks.getComponents()) {
      if (!component.monitored) continue
      const lines = this.buildTooltipLines(component)
      const { boxW, boxH } = this.tooltipSize(lines)
      const centerX = (component.x + component.width / 2) * CELL_SIZE
      const top = component.y * CELL_SIZE
      let px = centerX - boxW / 2
      let py = top - boxH - 10
      if (py < 4) py = top + component.height * CELL_SIZE + 10
      const view = this.worldView()
      px = Math.max(view.x0 + 4, Math.min(view.x1 - boxW - 4, px))
      this.drawTooltipAt(lines, px, py, component instanceof WireComponent ? component.getVisualColor() : null)
    }
  }

  private drawHoverTooltip(): void {
    if (this.spaceHeld) return
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
    const lines = this.buildTooltipLines(component)
    const { boxW, boxH } = this.tooltipSize(lines)
    let px: number
    let py: number
    if (pinned) {
      const view = this.worldView()
      px = (view.x0 + view.x1) / 2 - boxW / 2
      py = (view.y0 + view.y1) / 2 - boxH / 2
    } else {
      const view = this.worldView()
      px = this.mouseX + 14
      py = this.mouseY + 14
      if (px + boxW > view.x1) px = this.mouseX - boxW - 10
      if (py + boxH > view.y1) py = this.mouseY - boxH - 10
    }
    this.drawTooltipAt(lines, px, py, component instanceof WireComponent ? component.getVisualColor() : null)
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
    width = Math.max(width, ctx.measureText('Shift+滚轮切换 · 点击选中').width)
    const boxW = width + 26
    const boxH = rows.length * 18 + 30
    let px = this.mouseX + 16
    let py = this.mouseY + 16
    const view = this.worldView()
    if (px + boxW > view.x1) px = this.mouseX - boxW - 12
    if (py + boxH > view.y1) py = this.mouseY - boxH - 12
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

  private drawFourthDial(component: FourthGeneratorComponent, x: number, y: number, w: number, h: number): void {
    const ctx = this.ctx
    const cx = x + w / 2
    const cy = y + h / 2 + 8
    const radius = Math.min(w, h) / 2 - 22
    const progress = component.externalMaxEmf > 0
      ? Math.min(Math.max(component.externalEmf / component.externalMaxEmf, 0), 1)
      : 0
    const startAngle = Math.PI * 0.75
    const sweep = Math.PI * 1.5
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#2c3648'
    ctx.lineWidth = 11
    ctx.beginPath()
    ctx.arc(cx, cy, radius, startAngle, startAngle + sweep)
    ctx.stroke()
    if (progress > 0) {
      ctx.strokeStyle = component.externalEmf > component.externalMaxEmf ? '#ef5350' : '#b388ff'
      ctx.beginPath()
      ctx.arc(cx, cy, radius, startAngle, startAngle + sweep * progress)
      ctx.stroke()
    }
    const needleAngle = startAngle + sweep * progress
    ctx.strokeStyle = '#ecf0f1'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(cx - Math.cos(needleAngle) * 10, cy - Math.sin(needleAngle) * 10)
    ctx.lineTo(cx + Math.cos(needleAngle) * (radius - 8), cy + Math.sin(needleAngle) * (radius - 8))
    ctx.stroke()
    ctx.fillStyle = '#ecf0f1'
    ctx.beginPath()
    ctx.arc(cx, cy, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#b388ff'
    ctx.font = 'bold 12px system-ui, sans-serif'
    ctx.fillText((progress * 100).toFixed(1) + '%', cx, cy + radius - 4)
    ctx.fillStyle = '#78909c'
    ctx.font = '9px system-ui, sans-serif'
    ctx.fillText(`${component.externalEmf >= 0 ? '+' : ''}${component.externalEmf.toFixed(2)} / ${component.externalMaxEmf.toFixed(1)} V`, cx, cy + radius + 12)
    ctx.lineCap = 'butt'
  }

  private drawMeterDial(component: BaseComponent, x: number, y: number, w: number, h: number): void {
    const ctx = this.ctx
    const cx = x + w / 2
    const cy = y + h / 2 + 4
    const radius = Math.min(w, h) / 2 - 7
    ctx.fillStyle = '#f4f4ec'
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#2c3648'
    ctx.lineWidth = 2
    ctx.stroke()
    const isAmmeter = component.def.id === 'ammeter'
    const value = isAmmeter ? Math.abs(component.current) : Math.abs(component.voltage)
    const text = isAmmeter
      ? formatWithPrefix(value, this.settings.prefixCurrent, 'A')
      : formatWithPrefix(value, this.settings.prefixVoltage, 'V')
    ctx.fillStyle = '#10141b'
    ctx.font = '9px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(text, cx, cy + 3)
  }

  private readonly clutchLift = new WeakMap<ClutchComponent, number>()

  private drawClutch(component: ClutchComponent, x: number, y: number, w: number, h: number): void {
    const ctx = this.ctx
    const target = component.engaged ? 0 : 1
    const current = this.clutchLift.get(component) ?? 1
    const lift = current + (target - current) * 0.2
    this.clutchLift.set(component, lift)
    if (lift < 0.02) return
    const cx = x + w / 2
    const cy = y + h / 2 - lift * 3
    const bodyRadius = Math.min(w, h) / 2 - 9
    ctx.save()
    ctx.shadowColor = `rgba(0, 0, 0, ${0.5 * lift})`
    ctx.shadowBlur = 9 * lift
    ctx.shadowOffsetY = 5 * lift
    ctx.fillStyle = '#37474f'
    ctx.beginPath()
    ctx.arc(cx, cy, bodyRadius, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    ctx.strokeStyle = component.engaged ? '#26a69a' : '#b0bec5'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, cy, bodyRadius - 3, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = component.engaged ? '#80cbc4' : '#78909c'
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4
      ctx.fillRect(cx + Math.cos(a) * (bodyRadius + 2) - 1.5, cy + Math.sin(a) * (bodyRadius + 2) - 1.5, 3, 3)
    }
  }

  private drawFlywheelHub(x: number, y: number, w: number, h: number): void {
    const ctx = this.ctx
    const cx = x + w / 2
    const cy = y + h / 2
    ctx.fillStyle = '#ffd54f'
    ctx.beginPath()
    ctx.arc(cx, cy, Math.min(w, h) / 2 - 13, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#2f3640'
    ctx.beginPath()
    ctx.arc(cx, cy, Math.min(w, h) / 2 - 19, 0, Math.PI * 2)
    ctx.fill()
  }

  private drawFreeTerminal(component: FreeTerminalComponent, selected: BaseComponent | null): void {
    const ctx = this.ctx
    const x = component.posX
    const y = component.posY
    ctx.fillStyle = '#37474f'
    ctx.beginPath()
    ctx.arc(x, y, 9, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#b0bec5'
    ctx.beginPath()
    ctx.arc(x, y, 5.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#78909c'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(x, y, 9, 0, Math.PI * 2)
    ctx.stroke()
    if (selected === component) {
      ctx.strokeStyle = '#f1c40f'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(x, y, 13, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.fillStyle = '#ecf0f1'
    ctx.font = '10px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('接线柱', x, y + 22)
    ctx.textAlign = 'start'
  }

  private drawPipe(pipe: PipeComponent): void {
    const ctx = this.ctx
    const cx = pipe.x * CELL_SIZE + CELL_SIZE / 2
    const cy = pipe.y * CELL_SIZE + CELL_SIZE / 2
    ctx.fillStyle = '#455a64'
    ctx.beginPath()
    ctx.arc(cx, cy, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#78909c'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  private drawFluidInterfaces(): void {
    const components = this.callbacks.getComponents()
    const links = buildFluidLinks(components)
    if (links.length === 0) return
    const linked = new Set<string>()
    for (const link of links) {
      linked.add(interfaceKey(link.a.component, link.a.iface))
      linked.add(interfaceKey(link.b.component, link.b.iface))
    }
    const ctx = this.ctx
    ctx.strokeStyle = '#607d8b'
    ctx.lineWidth = 9
    ctx.beginPath()
    for (const component of components) {
      for (const iface of component.getFluidInterfaces()) {
        if (!linked.has(interfaceKey(component, iface))) continue
        const pos = interfaceWorldPos(component, iface)
        if (component instanceof PipeComponent) {
          const cell = interfaceCell(component, iface)
          ctx.moveTo((cell.x + 0.5) * CELL_SIZE, (cell.y + 0.5) * CELL_SIZE)
          ctx.lineTo(pos.x, pos.y)
        } else {
          const cell = interfaceCell(component, iface)
          const ccx = (cell.x + 0.5) * CELL_SIZE
          const ccy = (cell.y + 0.5) * CELL_SIZE
          const len = Math.hypot(ccx - pos.x, ccy - pos.y)
          if (len <= 1) continue
          const ux = (ccx - pos.x) / len
          const uy = (ccy - pos.y) / len
          ctx.moveTo(pos.x, pos.y)
          ctx.lineTo(pos.x + ux * 9, pos.y + uy * 9)
        }
      }
    }
    ctx.stroke()
    ctx.strokeStyle = '#263238'
    ctx.lineWidth = 5
    ctx.beginPath()
    for (const component of components) {
      for (const iface of component.getFluidInterfaces()) {
        if (!linked.has(interfaceKey(component, iface))) continue
        const pos = interfaceWorldPos(component, iface)
        if (component instanceof PipeComponent) {
          const cell = interfaceCell(component, iface)
          ctx.moveTo((cell.x + 0.5) * CELL_SIZE, (cell.y + 0.5) * CELL_SIZE)
          ctx.lineTo(pos.x, pos.y)
        } else {
          const cell = interfaceCell(component, iface)
          const ccx = (cell.x + 0.5) * CELL_SIZE
          const ccy = (cell.y + 0.5) * CELL_SIZE
          const len = Math.hypot(ccx - pos.x, ccy - pos.y)
          if (len <= 1) continue
          const ux = (ccx - pos.x) / len
          const uy = (ccy - pos.y) / len
          ctx.moveTo(pos.x, pos.y)
          ctx.lineTo(pos.x + ux * 9, pos.y + uy * 9)
        }
      }
    }
    ctx.stroke()
    ctx.fillStyle = '#455a64'
    ctx.strokeStyle = '#90a4ae'
    ctx.lineWidth = 1.5
    for (const component of components) {
      for (const iface of component.getFluidInterfaces()) {
        if (!linked.has(interfaceKey(component, iface))) continue
        const pos = interfaceWorldPos(component, iface)
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, 4.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
    }
  }

  private drawTank(tank: TankComponent, selected: BaseComponent | null): void {
    const ctx = this.ctx
    const x = tank.x * CELL_SIZE
    const y = tank.y * CELL_SIZE
    const w = tank.width * CELL_SIZE
    const h = tank.height * CELL_SIZE
    ctx.fillStyle = '#263238'
    ctx.fillRect(x + 4, y + 4, w - 8, h - 8)
    const fill = tank.storedFluidId !== null ? getFluid(tank.storedFluidId).color : '#37474f'
    const ratio = tank.capacity > 0 ? Math.min(1, tank.storedAmount / tank.capacity) : 0
    const fillH = (h - 16) * ratio
    ctx.fillStyle = fill
    ctx.globalAlpha = 0.85
    ctx.fillRect(x + 8, y + h - 8 - fillH, w - 16, fillH)
    ctx.globalAlpha = 1
    ctx.strokeStyle = selected === tank ? '#f1c40f' : '#78909c'
    ctx.lineWidth = 2
    ctx.strokeRect(x + 4, y + 4, w - 8, h - 8)
    ctx.fillStyle = '#eceff1'
    ctx.font = '10px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('储罐', x + w / 2, y + h / 2 - (h - 16) * 0.5 * ratio + 4)
    ctx.fillText(`${(tank.storedAmount).toFixed(1)}`, x + w / 2, y + h / 2 + 14)
    ctx.textAlign = 'start'
  }

  private drawCondenser(condenser: CondenserComponent, selected: BaseComponent | null): void {
    const ctx = this.ctx
    const x = condenser.x * CELL_SIZE
    const y = condenser.y * CELL_SIZE
    const w = condenser.width * CELL_SIZE
    const h = condenser.height * CELL_SIZE
    ctx.fillStyle = '#1f2a36'
    ctx.fillRect(x + 2, y + 10, w - 4, h - 20)
    ctx.fillStyle = '#4a6572'
    for (let i = 0; i < condenser.width; i++) {
      ctx.fillRect(x + i * CELL_SIZE + 6, y + 14, CELL_SIZE - 12, h - 28)
    }
    ctx.fillStyle = '#90caf9'
    ctx.globalAlpha = 0.35
    ctx.fillRect(x + 2, y + 10, w - 4, 5)
    ctx.globalAlpha = 1
    ctx.strokeStyle = selected === condenser ? '#f1c40f' : '#607d8b'
    ctx.lineWidth = 2
    ctx.strokeRect(x + 2, y + 10, w - 4, h - 20)
    ctx.fillStyle = '#b0bec5'
    ctx.font = '10px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('冷凝板', x + w / 2, y - 6)
    ctx.textAlign = 'start'
  }

  private drawContamination(): void {
    const zone = this.callbacks.getContamination()
    if (zone === null) return
    const ctx = this.ctx
    const pulse = 0.1 + 0.04 * Math.sin(this.time * 2)
    ctx.save()
    ctx.fillStyle = `rgba(226, 208, 116, ${pulse.toFixed(3)})`
    ctx.beginPath()
    ctx.arc((zone.x + 0.5) * CELL_SIZE, (zone.y + 0.5) * CELL_SIZE, zone.radius * CELL_SIZE, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 213, 79, 0.5)'
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.restore()
    const view = this.worldView()
    const centerX = (view.x0 + view.x1) / 2
    const centerY = (view.y0 + view.y1) / 2
    if (Math.hypot(centerX - (zone.x + 0.5) * CELL_SIZE, centerY - (zone.y + 0.5) * CELL_SIZE) > zone.radius * CELL_SIZE) return
    const dpr = this.devicePixelRatio()
    const cssW = this.canvas.width / dpr
    ctx.save()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.font = 'bold 14px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(255, 213, 79, 0.92)'
    ctx.fillText('☢ 此处为核辐射区：做功 ×10%，收入 ×25%', cssW / 2, 34)
    ctx.textAlign = 'start'
    ctx.restore()
  }

  private drawFissionReactor(reactor: FissionReactorComponent, selected: BaseComponent | null): void {
    const ctx = this.ctx
    const x = reactor.x * CELL_SIZE
    const y = reactor.y * CELL_SIZE
    const w = reactor.width * CELL_SIZE
    const h = reactor.height * CELL_SIZE
    ctx.fillStyle = '#263238'
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4)
    const tempRatio = Math.max(0, Math.min(1, (reactor.coreTempK - 300) / 900))
    const coreColor = `rgb(${Math.round(90 + 165 * tempRatio)}, ${Math.round(140 - 60 * tempRatio)}, ${Math.round(180 - 140 * tempRatio)})`
    ctx.fillStyle = coreColor
    const coreW = w - 60
    ctx.fillRect(x + 30, y + 22, coreW, h - 44)
    ctx.fillStyle = 'rgba(10, 14, 18, 0.85)'
    const rodTop = y + 6
    const rodBottom = rodTop + (h - 12) * reactor.controlRatio
    for (const rx of [x + 52, x + w / 2, x + w - 52]) {
      ctx.fillRect(rx - 4, rodTop, 8, rodBottom - rodTop)
    }
    ctx.strokeStyle = selected === reactor ? '#f1c40f' : '#546e7a'
    ctx.lineWidth = 2
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4)
    if (reactor.melted) {
      ctx.fillStyle = '#ff5252'
    } else if (reactor.reactivity > 0) {
      ctx.fillStyle = '#69f0ae'
    } else {
      ctx.fillStyle = '#90a4ae'
    }
    ctx.font = '10px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(reactor.melted ? '熔毁' : reactor.running ? '运行中' : '停机', x + w / 2, y + h / 2 - 8)
    ctx.fillText(`${reactor.coreTempK.toFixed(0)}K`, x + w / 2, y + h / 2 + 6)
    ctx.fillText(`控制棒 ${(reactor.controlRatio * 100).toFixed(0)}%`, x + w / 2, y + h / 2 + 20)
    ctx.textAlign = 'start'
  }

  private drawTurbine(turbine: TurbineComponent): void {
    const ctx = this.ctx
    const cx = (turbine.x + turbine.width / 2) * CELL_SIZE
    const cy = (turbine.y + turbine.height / 2) * CELL_SIZE
    const elapsed = Math.min(0.25, Math.max(0, (performance.now() - turbine.spinAngleAt) / 1000))
    const angle = turbine.spinAngle + turbine.steamPower * Math.PI * 4 * elapsed
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(angle)
    ctx.fillStyle = '#546e7a'
    for (let i = 0; i < 6; i++) {
      ctx.rotate(Math.PI / 3)
      ctx.beginPath()
      ctx.moveTo(6, 0)
      ctx.lineTo(24, -7)
      ctx.lineTo(24, 7)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
    ctx.fillStyle = '#37474f'
    ctx.beginPath()
    ctx.arc(cx, cy, 11, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = turbine.steamPower > 0.02 ? '#80deea' : '#78909c'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  private drawSteamEngine(engine: SteamEngineComponent): void {
    const ctx = this.ctx
    const x = engine.x * CELL_SIZE
    const y = engine.y * CELL_SIZE
    const w = engine.width * CELL_SIZE
    const h = engine.height * CELL_SIZE
    ctx.fillStyle = '#3e2723'
    ctx.fillRect(x + 4, y + 6, w - 8, h - 10)
    ctx.fillStyle = '#5d4037'
    ctx.fillRect(x + 8, y + 10, w - 16, h - 18)
    ctx.fillStyle = '#212121'
    ctx.fillRect(x + w / 2 - 5, y - 4, 10, 10)
    const powered = Math.abs(engine.current) > 0.05
    if (powered) {
      ctx.fillStyle = '#ffb74d'
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this.time * 12)
      ctx.beginPath()
      ctx.arc(x + w / 2, y + h / 2, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
    ctx.strokeStyle = powered ? '#ffcc80' : '#78909c'
    ctx.lineWidth = 1.5
    ctx.strokeRect(x + 4, y + 6, w - 8, h - 10)
  }

  private drawPipePathPreview(): void {
    const cells = this.pipePathPreview
    if (cells === null) return
    const ctx = this.ctx
    ctx.fillStyle = 'rgba(79, 195, 247, 0.3)'
    ctx.strokeStyle = '#4fc3f7'
    ctx.lineWidth = 1.5
    for (const cell of cells) {
      ctx.fillRect(cell.x * CELL_SIZE + 6, cell.y * CELL_SIZE + 6, CELL_SIZE - 12, CELL_SIZE - 12)
      ctx.strokeRect(cell.x * CELL_SIZE + 6, cell.y * CELL_SIZE + 6, CELL_SIZE - 12, CELL_SIZE - 12)
    }
  }

  private updatePipePathPreview(): void {
    const drag = this.pipePathDrag
    if (drag === null) return
    const startCellX = Math.floor(drag.startX / CELL_SIZE)
    const startCellY = Math.floor(drag.startY / CELL_SIZE)
    const endCellX = Math.floor(this.mouseX / CELL_SIZE)
    const endCellY = Math.floor(this.mouseY / CELL_SIZE)
    const cells: Array<{ x: number; y: number }> = []
    if (Math.abs(endCellX - startCellX) >= Math.abs(endCellY - startCellY)) {
      const stepX = endCellX >= startCellX ? 1 : -1
      for (let x = startCellX; x !== endCellX + stepX; x += stepX) {
        cells.push({ x, y: startCellY })
      }
    } else {
      const stepY = endCellY >= startCellY ? 1 : -1
      for (let y = startCellY; y !== endCellY + stepY; y += stepY) {
        cells.push({ x: startCellX, y })
      }
    }
    this.pipePathPreview = cells
  }

  private updateFluidParticles(dt: number): void {
    const components = this.callbacks.getComponents()
    for (const emission of this.callbacks.drainFluidEmissions()) {
      for (let i = 0; i < emission.count; i++) {
        if (this.fluidParticles.length >= 120) this.fluidParticles.shift()
        this.fluidParticles.push(
          new FluidParticle(
            emission.x + (Math.random() - 0.5) * 14,
            emission.y + (Math.random() - 0.5) * 14,
            emission.vx + (Math.random() - 0.5) * 16,
            emission.vy,
            emission.fluidId,
          ),
        )
      }
    }
    if (this.fluidParticles.length === 0) return
    const view = this.worldView()
    integrateFluidParticles(this.fluidParticles, fluidReceptors(components), view, dt)
  }

  private drawFluidParticles(): void {
    if (this.fluidParticles.length === 0) return
    const ctx = this.ctx
    for (const particle of this.fluidParticles) {
      const fluid = getFluid(particle.fluidId)
      ctx.fillStyle = fluid.color
      ctx.globalAlpha = fluid.isGas ? 0.45 : 0.85
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, fluid.isGas ? 5 : 3.5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  private drawPipeFlowAnimation(): void {
    const networks = this.callbacks.getPipeNetworks()
    if (networks.length === 0) return
    const ctx = this.ctx
    const links = buildFluidLinks(this.callbacks.getComponents())
    for (const network of networks) {
      if (network.volume <= 0 || network.fluidId === null) continue
      const fluid = getFluid(network.fluidId)
      ctx.strokeStyle = fluid.color
      ctx.globalAlpha = 0.5
      ctx.lineWidth = 4
      ctx.setLineDash([6, 10])
      ctx.lineDashOffset = -this.time * 30
      ctx.beginPath()
      const pipeSet = new Set(network.pipes)
      for (const pipe of network.pipes) {
        const cx = pipe.x * CELL_SIZE + CELL_SIZE / 2
        const cy = pipe.y * CELL_SIZE + CELL_SIZE / 2
        for (const link of links) {
          let selfIface = null
          let partner = null
          if (link.a.component === pipe) {
            selfIface = link.a.iface
            partner = link.b
          } else if (link.b.component === pipe) {
            selfIface = link.b.iface
            partner = link.a
          } else {
            continue
          }
          ctx.moveTo(cx, cy)
          if (partner.component instanceof PipeComponent && pipeSet.has(partner.component)) {
            ctx.lineTo(partner.component.x * CELL_SIZE + CELL_SIZE / 2, partner.component.y * CELL_SIZE + CELL_SIZE / 2)
          } else {
            const pos = interfaceWorldPos(pipe, selfIface)
            ctx.lineTo(pos.x, pos.y)
          }
        }
      }
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1
    }
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
    if (component instanceof GearComponent && component.overSpeed) {
      ctx.save()
      ctx.globalAlpha = Math.max(0, 0.45 + Math.sin(this.time * 8) * 0.4)
      ctx.fillStyle = '#e74c3c'
      ctx.fillRect(x, y, w, h)
      ctx.restore()
    }
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

  private drawMotor(component: MotorComponent, x: number, y: number, w: number, h: number): void {
    const ctx = this.ctx
    const cx = x + w / 2
    const cy = y + h / 2
    const radius = Math.min(w, h) / 2
    const powered = Math.abs(component.current) > 0.05
    const elapsed = Math.min(0.25, Math.max(0, (performance.now() - component.rotationAngleAt) / 1000))
    const angle = component.rotationAngle + component.rotationSpeed * elapsed
    const rootRadius = radius - 5
    const tipRadius = radius + 3
    const toothHalf = (Math.PI / 8) * 0.42
    if (powered) {
      ctx.save()
      ctx.strokeStyle = '#22d3ee'
      ctx.lineWidth = 3
      ctx.globalAlpha = 0.55 + Math.sin(this.time * 6) * 0.25
      ctx.beginPath()
      ctx.arc(cx, cy, tipRadius + 3, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
    ctx.fillStyle = powered ? '#3b6e8f' : '#4d5a64'
    ctx.beginPath()
    ctx.arc(cx, cy, rootRadius, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = powered ? '#4f8aa8' : '#5d6d78'
    for (let i = 0; i < 8; i++) {
      const a = angle + (i * Math.PI * 2) / 8
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a - toothHalf) * rootRadius, cy + Math.sin(a - toothHalf) * rootRadius)
      ctx.arc(cx, cy, tipRadius, a - toothHalf, a + toothHalf)
      ctx.lineTo(cx + Math.cos(a + toothHalf) * rootRadius, cy + Math.sin(a + toothHalf) * rootRadius)
      ctx.closePath()
      ctx.fill()
    }
    ctx.strokeStyle = powered ? '#7ddcf0' : '#8fa1ad'
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
    if (component.def.portLayout === 'rows') return {}
    if (component.def.portCount === 4) {
      return { 0: '+', 1: '-', 2: '+', 3: '-' }
    }
    if (component.def.portCount !== 2) return {}
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

  private drawBatteryCell(component: BatteryComponent, x: number, y: number, w: number, h: number): void {
    const ctx = this.ctx
    const config = component.cellConfig
    const panelW = 46
    const solutionX = x + panelW
    const solutionW = w - panelW * 2
    const solutionY = y + 26
    const solutionH = h - 48
    ctx.fillStyle = config.solutionColor
    ctx.globalAlpha = 0.6
    ctx.fillRect(solutionX, solutionY, solutionW, solutionH)
    ctx.globalAlpha = 1
    if (config.membrane !== 'none') {
      const membraneX = solutionX + solutionW * 0.5
      ctx.strokeStyle = '#eceff1'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      ctx.beginPath()
      ctx.moveTo(membraneX, solutionY)
      ctx.lineTo(membraneX, solutionY + solutionH)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#eceff1'
      ctx.font = '8px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(config.membrane === 'cation' ? '阳离子交换膜' : '阴离子交换膜', membraneX, solutionY - 5)
    }
    for (const ion of component.ions) {
      const px = solutionX + ion.nx * solutionW
      const py = solutionY + ion.ny * solutionH
      ctx.fillStyle = ion.cation ? config.cationColor : config.anionColor
      ctx.beginPath()
      ctx.arc(px, py, 3, 0, Math.PI * 2)
      ctx.fill()
    }
    const leftName = config.flipped ? config.positiveName : config.negativeName
    const rightName = config.flipped ? config.negativeName : config.positiveName
    const leftColor = config.flipped ? ELECTRODE_COLORS[config.positiveName] : ELECTRODE_COLORS[config.negativeName]
    const rightColor = config.flipped ? ELECTRODE_COLORS[config.negativeName] : ELECTRODE_COLORS[config.positiveName]
    const panelBodyW = panelW - 14
    ctx.fillStyle = leftColor ?? '#546e7a'
    ctx.fillRect(x + 8, solutionY, panelBodyW, solutionH)
    ctx.fillStyle = rightColor ?? '#546e7a'
    ctx.fillRect(x + w - panelW + 6, solutionY, panelBodyW, solutionH)
    ctx.fillStyle = '#eceff1'
    ctx.font = '9px system-ui, sans-serif'
    ctx.textAlign = 'center'
    this.drawFittedText(leftName, x + 8 + panelBodyW / 2, solutionY + solutionH / 2 + 3, panelBodyW - 6)
    this.drawFittedText(rightName, x + w - panelW + 6 + panelBodyW / 2, solutionY + solutionH / 2 + 3, panelBodyW - 6)
    ctx.textAlign = 'start'
  }

  private sliderTrackGeom(component: RheostatComponent): { trackX: number; trackY: number; trackW: number } {
    const x = component.x * CELL_SIZE
    const y = component.y * CELL_SIZE
    const w = component.width * CELL_SIZE
    const h = component.height * CELL_SIZE
    return { trackX: x + 6, trackY: y + h / 2, trackW: w - 12 }
  }

  private drawRheostatSlider(component: RheostatComponent): void {
    const ctx = this.ctx
    const geom = this.sliderTrackGeom(component)
    ctx.strokeStyle = '#90a4ae'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(geom.trackX, geom.trackY)
    ctx.lineTo(geom.trackX + geom.trackW, geom.trackY)
    ctx.stroke()
    ctx.strokeStyle = '#546e7a'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(geom.trackX + geom.trackW / 2, geom.trackY + 10, 9, 0, Math.PI * 2)
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

  private drawPhotonScreen(component: PhotonScreenComponent, x: number, y: number, w: number, h: number): void {
    const ctx = this.ctx
    component.updateSpots(this.time, w, h)
    ctx.fillStyle = '#141b28'
    ctx.beginPath()
    ctx.roundRect(x + 4, y + 4, w - 8, h - 8, 4)
    ctx.fill()
    ctx.strokeStyle = '#4a5568'
    ctx.lineWidth = 1
    ctx.stroke()
    for (const spot of component.spots) {
      const glide = component.glideOffset(spot.progress)
      const spotX = x + spot.localX + glide.dx
      const spotY = y + spot.localY + glide.dy
      ctx.globalAlpha = 0.35
      ctx.fillStyle = '#ffd54f'
      ctx.beginPath()
      ctx.arc(spotX, spotY, 8, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.beginPath()
      ctx.arc(spotX, spotY, 4, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  private drawElectronGun(component: ElectronGunComponent, x: number, y: number, w: number, h: number): void {
    const ctx = this.ctx
    const cx = x + w / 2
    const cy = y + h / 2 + 6
    ctx.fillStyle = '#37474f'
    ctx.beginPath()
    ctx.arc(cx, cy, Math.min(w, h) / 2 - 10, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#90a4ae'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.strokeStyle = '#ffd54f'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(component.aimAngle) * 6, cy + Math.sin(component.aimAngle) * 6)
    ctx.lineTo(cx + Math.cos(component.aimAngle) * (w / 2 - 2), cy + Math.sin(component.aimAngle) * (h / 2 - 2))
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
    if (pending === null || !this.mouseInside) return
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
    if (ghost === null) return
    const ctx = this.ctx
    if (ghost.defId === 'free_terminal') {
      if (!Number.isFinite(ghost.px)) return
      ctx.fillStyle = 'rgba(79, 195, 247, 0.35)'
      ctx.beginPath()
      ctx.arc(ghost.px, ghost.py, 9, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#4fc3f7'
      ctx.lineWidth = 1.5
      ctx.stroke()
      return
    }
    if (!Number.isFinite(ghost.cellX) || !Number.isFinite(ghost.cellY)) return
    ctx.fillStyle = 'rgba(79, 195, 247, 0.25)'
    ctx.fillRect(ghost.cellX * CELL_SIZE, ghost.cellY * CELL_SIZE, CELL_SIZE, CELL_SIZE)
  }
}
