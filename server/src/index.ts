import { Elysia } from 'elysia'
import type { ServerWebSocket } from 'bun'

interface RawSocket extends ServerWebSocket<Record<string, unknown>> {}

interface IncomingMessage {
  type?: string
  role?: string
  uuid?: string
  name?: string
  emf?: number
  generators?: { uuid?: string; name?: string }[]
}

type Conn = RawSocket

const sockets = new Set<Conn>()
const gameSockets = new Set<Conn>()
const contributions = new Map<Conn, Map<string, number>>()
const generators = new Map<string, string>()

function isGame(socket: Conn): boolean {
  return gameSockets.has(socket)
}

function totals(): Record<string, number> {
  const result: Record<string, number> = {}
  for (const byUuid of contributions.values()) {
    for (const [uuid, emf] of byUuid) {
      result[uuid] = (result[uuid] ?? 0) + emf
    }
  }
  for (const [uuid] of generators) {
    if (result[uuid] === undefined) result[uuid] = 0
  }
  return result
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
  broadcast({ type: 'emf', totals: totals() })
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
        conn.send(JSON.stringify({ type: 'emf', totals: totals() }))
        return
      }
      if (data.type === 'contribute' && typeof data.uuid === 'string' && typeof data.emf === 'number' && Number.isFinite(data.emf)) {
        if (isGame(conn)) return
        if (!generators.has(data.uuid)) return
        let byUuid = contributions.get(conn)
        if (byUuid === undefined) {
          byUuid = new Map()
          contributions.set(conn, byUuid)
        }
        byUuid.set(data.uuid, data.emf)
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
