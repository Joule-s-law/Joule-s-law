class MemoryStorage implements Storage {
  private readonly map = new Map<string, string>()

  get length(): number {
    return this.map.size
  }

  clear(): void {
    this.map.clear()
  }

  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.map.delete(key)
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
}

const storage = new MemoryStorage()
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
const globalWindow = (globalThis as unknown as { window?: Record<string, unknown> }).window
if (globalWindow !== undefined) {
  Object.defineProperty(globalWindow, 'localStorage', { value: storage, configurable: true })
}

export {}
