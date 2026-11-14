import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type AngularUnit = 'deg' | 'rad' | 'rev'
export type MetricPrefix = 'k' | 'none' | 'm' | 'u' | 'n'

const STORAGE_KEY = 'joules-law-settings'
const DEFAULT_WS_URL = 'ws://localhost:25565/ws'

export const PREFIX_FACTORS: Record<MetricPrefix, number> = {
  k: 1e3,
  none: 1,
  m: 1e-3,
  u: 1e-6,
  n: 1e-9,
}

export const PREFIX_SYMBOLS: Record<MetricPrefix, string> = {
  k: 'k',
  none: '',
  m: 'm',
  u: 'µ',
  n: 'n',
}

export const PREFIX_NAMES: Record<MetricPrefix, string> = {
  k: '千X',
  none: 'X',
  m: '毫X',
  u: '微X',
  n: '纳X',
}

export const ANGULAR_UNITS: Array<{ id: AngularUnit; name: string; factor: number; symbol: string }> = [
  { id: 'deg', name: '度每秒', factor: 180 / Math.PI, symbol: '°/s' },
  { id: 'rad', name: '弧度每秒', factor: 1, symbol: 'rad/s' },
  { id: 'rev', name: '转每秒', factor: 1 / (Math.PI * 2), symbol: 'r/s' },
]

export function angularUnitById(id: AngularUnit) {
  return (
    ANGULAR_UNITS.find((entry) => entry.id === id) ?? { id: 'deg' as const, name: '度每秒', factor: 180 / Math.PI, symbol: '°/s' }
  )
}

export function formatAngularValue(radPerSec: number, unitId: AngularUnit): string {
  const unit = angularUnitById(unitId)
  const sign = radPerSec < 0 ? '-' : ''
  return `${sign}${(Math.abs(radPerSec) * unit.factor).toFixed(2)} ${unit.symbol}`
}

export function formatWithPrefix(value: number, prefix: MetricPrefix, unit: string, digits: number = 3): string {
  const scaled = value * PREFIX_FACTORS[prefix]
  const abs = Math.abs(scaled)
  let text: string
  if (abs !== 0 && abs < 0.001) text = scaled.toExponential(2)
  else if (abs >= 100) text = scaled.toFixed(Math.max(0, digits - 3))
  else if (abs >= 1) text = scaled.toFixed(Math.min(2, digits))
  else text = scaled.toFixed(digits)
  return `${text} ${PREFIX_SYMBOLS[prefix]}${unit}`
}

function loadPersisted(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return {}
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const persisted = loadPersisted()

  const wsUrl = ref(typeof persisted['wsUrl'] === 'string' ? (persisted['wsUrl'] as string) : DEFAULT_WS_URL)
  const angularUnit = ref<AngularUnit>(typeof persisted['angularUnit'] === 'string' ? (persisted['angularUnit'] as AngularUnit) : 'deg')
  const prefixCurrent = ref<MetricPrefix>((persisted['prefixCurrent'] as MetricPrefix) ?? 'none')
  const prefixVoltage = ref<MetricPrefix>((persisted['prefixVoltage'] as MetricPrefix) ?? 'none')
  const prefixResistance = ref<MetricPrefix>((persisted['prefixResistance'] as MetricPrefix) ?? 'none')
  const prefixFlux = ref<MetricPrefix>((persisted['prefixFlux'] as MetricPrefix) ?? 'none')
  const prefixFluxDensity = ref<MetricPrefix>((persisted['prefixFluxDensity'] as MetricPrefix) ?? 'none')
  const showFieldLines = ref(persisted['showFieldLines'] !== false)

  watch(
    [wsUrl, angularUnit, prefixCurrent, prefixVoltage, prefixResistance, prefixFlux, prefixFluxDensity, showFieldLines],
    () => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            wsUrl: wsUrl.value,
            angularUnit: angularUnit.value,
            prefixCurrent: prefixCurrent.value,
            prefixVoltage: prefixVoltage.value,
            prefixResistance: prefixResistance.value,
            prefixFlux: prefixFlux.value,
            prefixFluxDensity: prefixFluxDensity.value,
            showFieldLines: showFieldLines.value,
          }),
        )
      } catch {
        // 忽略持久化失败（隐私模式等）
      }
    },
  )

  return {
    wsUrl,
    angularUnit,
    prefixCurrent,
    prefixVoltage,
    prefixResistance,
    prefixFlux,
    prefixFluxDensity,
    showFieldLines,
  }
})
