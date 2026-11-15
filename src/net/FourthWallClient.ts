export interface GeneratorInfo {
  uuid: string
  name: string
}

export class FourthWallClient {
  private socket: WebSocket | null = null
  private reconnectTimer: number | null = null
  private pendingSync: GeneratorInfo[] | null = null

  constructor(
    private url: string,
    private readonly onTotals: (totals: Record<string, number>, maxTotals: Record<string, number>) => void,
  ) {}

  getUrl(): string {
    return this.url
  }

  changeUrl(url: string): void {
    if (url === this.url) return
    this.url = url
    this.pendingSync = null
    const socket = this.socket
    if (socket !== null) {
      this.socket = null
      socket.onclose = null
      socket.onerror = null
      try {
        socket.close()
      } catch {
        // 忽略关闭失败
      }
    }
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.connect()
  }

  connect(): void {
    if (this.socket !== null || this.reconnectTimer !== null) return
    let socket: WebSocket
    try {
      socket = new WebSocket(this.url)
    } catch {
      this.scheduleReconnect()
      return
    }
    this.socket = socket
    socket.onopen = () => {
      this.socket = socket
      if (this.pendingSync !== null) {
        this.sendSync(this.pendingSync)
      }
    }
    socket.onmessage = (event) => {
      let data: { type?: string; totals?: Record<string, number>; maxTotals?: Record<string, number> }
      try {
        data = JSON.parse(String(event.data)) as { type?: string; totals?: Record<string, number>; maxTotals?: Record<string, number> }
      } catch {
        return
      }
      if (data.type === 'emf' && data.totals !== undefined) {
        this.onTotals(data.totals, data.maxTotals ?? {})
      }
    }
    socket.onclose = () => {
      if (this.socket === socket) this.socket = null
      this.scheduleReconnect()
    }
    socket.onerror = () => {
      socket.close()
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, 3000)
  }

  sendSync(generators: GeneratorInfo[]): void {
    this.pendingSync = generators
    const socket = this.socket
    if (socket === null || socket.readyState !== WebSocket.OPEN) return
    socket.send(JSON.stringify({ type: 'sync', role: 'game', generators }))
  }
}
