export type BehaviorId = 'voltageSource' | 'resistive' | 'wire' | 'converter' | 'motor' | 'battery' | 'switch' | 'fieldSensor' | 'gear' | 'diode' | 'rheostat' | 'voltageTransformer' | 'fourthGenerator' | 'chainDrive' | 'photonScreen' | 'electronGun' | 'clutch' | 'freeTerminal' | 'steamSource' | 'steamTurbine' | 'pipe' | 'tank' | 'condenser' | 'fissionReactor' | 'waterPump' | 'turbineRotor'

export interface ComponentDefinition {
  id: string
  displayName: string
  description: string
  loreDescription?: string
  labels?: string[]
  price: number
  priceScaling: number
  portCount: number
  resistance: number
  ratedCurrent: number
  behaviorId: BehaviorId
  behaviorParams: Record<string, number>
  behaviorTags: Record<string, string>
  width?: number
  height?: number
  portLayout?: 'rows' | 'vertical'
}

export function paramNumber(def: ComponentDefinition, key: string, fallback: number): number {
  const value = def.behaviorParams[key]
  return value ?? fallback
}

export function paramTag(def: ComponentDefinition, key: string, fallback: string): string {
  const value = def.behaviorTags[key]
  return value ?? fallback
}
