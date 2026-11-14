import { describe, expect, it, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGameStore } from '../src/ui/stores/useGameStore'
import { portPosition } from '../src/ui/board/boardMath'
import { WireComponent } from '../src/core/components/behaviors/WireComponent'
import type { BaseComponent } from '../src/core/components/BaseComponent'

describe('wire anchors', () => {
  beforeEach(() => {
    localStorage.removeItem('joules-law-save-v1')
    setActivePinia(createPinia())
  })

  it('wire created through ports anchors exactly at both port positions', () => {
    const store = useGameStore()
    store.sim.economy.money = 100
    store.tryPlaceAt('hand_crank', 3, 3)
    store.tryPlaceAt('resistor', 7, 6)
    const crank = store.sim.components.find((c) => c.def.id === 'hand_crank')
    const resistor = store.sim.components.find((c) => c.def.id === 'resistor')
    if (crank === undefined || resistor === undefined) throw new Error('components not placed')
    store.onPortClick(crank, 0)
    store.onPortClick(resistor, 1)
    const wires = store.sim.components.filter((c): c is WireComponent => c instanceof WireComponent)
    expect(wires.length).toBe(1)
    const wire = wires[0]!
    const anchors = wire.getAnchors()
    const expectedA = portPosition(crank as BaseComponent, 0)
    const expectedB = portPosition(resistor as BaseComponent, 1)
    expect(anchors.a.x).toBeCloseTo(expectedA.px, 6)
    expect(anchors.a.y).toBeCloseTo(expectedA.py, 6)
    expect(anchors.b.x).toBeCloseTo(expectedB.px, 6)
    expect(anchors.b.y).toBeCloseTo(expectedB.py, 6)
    store.sim.tick()
    expect(wire.getResistance()).toBeGreaterThan(0)

    const resistanceBefore = wire.getResistance()
    const lengthBefore = wire.getLengthCells()
    const cpsBefore = wire.getControlPoints()
    expect(cpsBefore.a.x).toBeCloseTo(expectedA.px + (expectedB.px - expectedA.px) * 0.45, 6)
    wire.setControlPoints({ x: 500, y: 200 }, cpsBefore.b)
    expect(wire.getControlPoints().a).toEqual({ x: 500, y: 200 })
    expect(wire.getAnchors().a).toEqual(anchors.a)
    expect(wire.getAnchors().b).toEqual(anchors.b)
    expect(wire.getResistance()).toBe(resistanceBefore)
    expect(wire.getLengthCells()).toBe(lengthBefore)
  })
})
