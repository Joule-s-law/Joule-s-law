import { Elysia } from 'elysia'
import type { ServerWebSocket } from 'bun'

interface RawSocket extends ServerWebSocket<Record<string, unknown>> {}

interface IncomingMessage {
  type?: string
  role?: string
  uuid?: string
  name?: string
  emf?: number
  max?: number
  generators?: { uuid?: string; name?: string }[]
}

interface Contribution {
  emf: number
  max: number
}

type Conn = RawSocket

const sockets = new Set<Conn>()
const gameSockets = new Set<Conn>()
const contributions = new Map<Conn, Map<string, Contribution>>()
const generators = new Map<string, string>()

function isGame(socket: Conn): boolean {
  return gameSockets.has(socket)
}

function totals(): { emf: Record<string, number>; max: Record<string, number> } {
  const emf: Record<string, number> = {}
  const max: Record<string, number> = {}
  for (const byUuid of contributions.values()) {
    for (const [uuid, contribution] of byUuid) {
      emf[uuid] = (emf[uuid] ?? 0) + contribution.emf
      max[uuid] = (max[uuid] ?? 0) + contribution.max
    }
  }
  for (const [uuid] of generators) {
    if (emf[uuid] === undefined) emf[uuid] = 0
    if (max[uuid] === undefined) max[uuid] = 0
  }
  return { emf, max }
}

function broadcast(message: Record<string, unknown>): void {
  const payload = JSON.stringify(message)
  for (const socket of sockets) {
    socket.send(payload)
  }
}

function broadcastGenerators(): void {
  broadcast({ type: 'generators', list: [...generators.entries()].map(([uuid, name]) => ({ uuid, name })) })
}

function broadcastEmf(): void {
  const { emf, max } = totals()
  broadcast({ type: 'emf', totals: emf, maxTotals: max })
}

function pruneUnknownUuids(): void {
  for (const byUuid of contributions.values()) {
    for (const uuid of [...byUuid.keys()]) {
      if (!generators.has(uuid)) byUuid.delete(uuid)
    }
  }
}

function parseMessage(raw: unknown): IncomingMessage | null {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as IncomingMessage
    } catch {
      return null
    }
  }
  if (raw instanceof Uint8Array) {
    try {
      return JSON.parse(new TextDecoder().decode(raw)) as IncomingMessage
    } catch {
      return null
    }
  }
  if (raw !== null && typeof raw === 'object') return raw as IncomingMessage
  return null
}

const app = new Elysia()
  .ws('/ws', {
    open(ws) {
      sockets.add(ws.raw as Conn)
    },
    message(ws, rawMessage) {
      const conn = ws.raw as Conn
      const data = parseMessage(rawMessage)
      if (data === null || typeof data !== 'object') return
      if (data.type === 'sync' && data.role === 'game') {
        gameSockets.add(conn)
        generators.clear()
        for (const entry of data.generators ?? []) {
          if (typeof entry.uuid === 'string' && typeof entry.name === 'string') {
            generators.set(entry.uuid, entry.name)
          }
        }
        pruneUnknownUuids()
        broadcastGenerators()
        broadcastEmf()
        return
      }
      if (data.type === 'list') {
        conn.send(JSON.stringify({ type: 'generators', list: [...generators.entries()].map(([uuid, name]) => ({ uuid, name })) }))
        const { emf, max } = totals()
        conn.send(JSON.stringify({ type: 'emf', totals: emf, maxTotals: max }))
        return
      }
      if (data.type === 'contribute' && typeof data.uuid === 'string' && typeof data.emf === 'number' && Number.isFinite(data.emf)) {
        if (isGame(conn)) return
        if (!generators.has(data.uuid)) return
        const max = typeof data.max === 'number' && Number.isFinite(data.max) && data.max > 0 ? data.max : 0
        let byUuid = contributions.get(conn)
        if (byUuid === undefined) {
          byUuid = new Map()
          contributions.set(conn, byUuid)
        }
        byUuid.set(data.uuid, { emf: data.emf, max })
        broadcastEmf()
      }
    },
    close(ws) {
      const conn = ws.raw as Conn
      sockets.delete(conn)
      gameSockets.delete(conn)
      contributions.delete(conn)
      broadcastEmf()
    },
  })
  .listen(25565)

console.log('[fourth-wall] ws://localhost:25565/ws listening')
