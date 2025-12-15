// TimescaleDB Connection Pool
// Direct connection to TimescaleDB for time-series queries

import { Pool } from 'pg'

const globalForPool = globalThis as unknown as {
  timescalePool: Pool | undefined
}

export const timescalePool = globalForPool.timescalePool ?? new Pool({
  host: process.env.TIMESCALE_HOST || 'timescaledb',
  port: parseInt(process.env.TIMESCALE_PORT || '5432'),
  database: process.env.TIMESCALE_DB || 'sensor_data',
  user: process.env.TIMESCALE_USER || 'timescale',
  password: process.env.TIMESCALE_PASSWORD || 'timescale123',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

// Store singleton to prevent connection pool exhaustion
globalForPool.timescalePool = timescalePool

// Helper to execute queries
export async function queryTimescale<T>(
  sql: string,
  params?: (string | number | boolean | null | Date)[]
): Promise<T[]> {
  const client = await timescalePool.connect()
  try {
    const result = await client.query(sql, params)
    return result.rows as T[]
  } finally {
    client.release()
  }
}

// Check TimescaleDB connection
export async function checkTimescaleConnection(): Promise<boolean> {
  try {
    const client = await timescalePool.connect()
    await client.query('SELECT 1')
    client.release()
    return true
  } catch {
    return false
  }
}

// Get total readings count
export async function getTotalReadings(): Promise<number> {
  try {
    const result = await queryTimescale<{ count: string }>(
      'SELECT COUNT(*) as count FROM sensor_readings'
    )
    return parseInt(result[0]?.count || '0')
  } catch {
    return 0
  }
}

// Get readings count for today
export async function getTodayReadings(): Promise<number> {
  try {
    const result = await queryTimescale<{ count: string }>(
      `SELECT COUNT(*) as count FROM sensor_readings
       WHERE time >= CURRENT_DATE`
    )
    return parseInt(result[0]?.count || '0')
  } catch {
    return 0
  }
}

// Get last data received timestamp
export async function getLastDataTime(): Promise<Date | null> {
  try {
    const result = await queryTimescale<{ time: Date }>(
      'SELECT time FROM sensor_readings ORDER BY time DESC LIMIT 1'
    )
    return result[0]?.time || null
  } catch {
    return null
  }
}

// Get unique haystack names
export async function getUniqueHaystackNames(): Promise<string[]> {
  try {
    const result = await queryTimescale<{ haystack_name: string }>(
      `SELECT DISTINCT haystack_name FROM sensor_readings
       WHERE haystack_name IS NOT NULL
       ORDER BY haystack_name`
    )
    return result.map(r => r.haystack_name)
  } catch {
    return []
  }
}
