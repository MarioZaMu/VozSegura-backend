// Alert persistence in Upstash Redis. The alert is a hash so concurrent requests (location,
// audio, AI) update different fields without overwriting each other.
import { Redis } from '@upstash/redis'
import type { AlertRecord, ChunkRecord, LocationFix } from './alertModel.js'
import { requireEnv } from './env.js'

const TTL_SECONDS = 60 * 60 * 24 * 30 // alerts are kept 30 days
const MAX_LOCATIONS = 100

let client: Redis | null = null

function redis(): Redis {
  client ??= new Redis({ url: requireEnv('KV_REST_API_URL'), token: requireEnv('KV_REST_API_TOKEN') })
  return client
}

const keys = {
  alert: (id: string) => `alert:${id}`,
  flags: (id: string) => `alert:${id}:flags`,
  locations: (id: string) => `alert:${id}:locations`,
  chunks: (id: string) => `alert:${id}:chunks`,
}

async function touch(...names: string[]) {
  await Promise.all(names.map((name) => redis().expire(name, TTL_SECONDS)))
}

/** Stores a new alert. Returns false when it already existed (retries are idempotent). */
export async function createAlert(record: AlertRecord): Promise<boolean> {
  const created = await redis().hsetnx(keys.alert(record.id), 'id', record.id)
  if (created !== 1) return false
  await redis().hset(keys.alert(record.id), record)
  await touch(keys.alert(record.id))
  return true
}

export async function getAlert(id: string): Promise<AlertRecord | null> {
  const record = await redis().hgetall<AlertRecord>(keys.alert(id))
  return record && record.id ? record : null
}

export async function updateAlert(id: string, patch: Partial<AlertRecord>): Promise<void> {
  await redis().hset(keys.alert(id), patch)
}

/** Atomically claims a one-time action (e.g. "first location sent"); true only once. */
export async function claimOnce(id: string, flag: string): Promise<boolean> {
  const claimed = (await redis().hsetnx(keys.flags(id), flag, Date.now())) === 1
  if (claimed) await touch(keys.flags(id))
  return claimed
}

export async function addLocation(id: string, fix: LocationFix): Promise<void> {
  await redis().lpush(keys.locations(id), fix)
  await redis().ltrim(keys.locations(id), 0, MAX_LOCATIONS - 1)
  await updateAlert(id, { lastLocation: fix })
  await touch(keys.locations(id))
}

/** Newest first. */
export async function getLocations(id: string, count = 20): Promise<LocationFix[]> {
  return redis().lrange<LocationFix>(keys.locations(id), 0, count - 1)
}

export async function saveChunk(id: string, chunk: ChunkRecord): Promise<void> {
  await redis().hset(keys.chunks(id), { [String(chunk.index)]: chunk })
  await touch(keys.chunks(id))
}

export async function getChunk(id: string, index: number): Promise<ChunkRecord | null> {
  return redis().hget<ChunkRecord>(keys.chunks(id), String(index))
}

export async function getChunks(id: string): Promise<ChunkRecord[]> {
  const all = await redis().hgetall<Record<string, ChunkRecord>>(keys.chunks(id))
  return all ? Object.values(all).sort((a, b) => a.index - b.index) : []
}

/** Saves a summary unless a newer one (covering more chunks) is already stored. */
export async function saveSummaryIfNewer(id: string, summary: string, coveredChunks: number): Promise<void> {
  const current = await redis().hget<number>(keys.alert(id), 'summaryChunks')
  if ((current ?? 0) > coveredChunks) return
  await updateAlert(id, { summary, summaryChunks: coveredChunks, summaryStatus: 'ready', summaryUpdatedAt: Date.now() })
}
