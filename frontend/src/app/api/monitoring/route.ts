import { NextRequest, NextResponse } from 'next/server'
import { queryTimescale, getUniqueHaystackNames } from '@/lib/timescale'

export const dynamic = 'force-dynamic'

interface SensorReading {
  time: Date
  haystack_name: string
  dis: string
  value: number
  units: string
  device_id: number
  device_name: string
  quality: string
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Filters
    const haystackName = searchParams.get('haystack') || null
    const timeRange = searchParams.get('range') || '1h'  // 1h, 24h, 7d, 30d, custom
    const startTime = searchParams.get('start') || null
    const endTime = searchParams.get('end') || null

    // Build time filter
    let timeFilter = ''
    const params: (string | number | Date)[] = []
    let paramIndex = 1

    if (startTime && endTime) {
      timeFilter = `time >= $${paramIndex} AND time <= $${paramIndex + 1}`
      params.push(new Date(startTime), new Date(endTime))
      paramIndex += 2
    } else {
      const intervals: Record<string, string> = {
        '1h': '1 hour',
        '24h': '24 hours',
        '7d': '7 days',
        '30d': '30 days'
      }
      const interval = intervals[timeRange] || '1 hour'
      timeFilter = `time >= NOW() - INTERVAL '${interval}'`
    }

    // Build haystack filter
    let haystackFilter = ''
    if (haystackName) {
      haystackFilter = `AND haystack_name = $${paramIndex}`
      params.push(haystackName)
      paramIndex++
    }

    // Get total count
    const countSql = `
      SELECT COUNT(*) as count FROM sensor_readings
      WHERE ${timeFilter} ${haystackFilter}
    `
    const countResult = await queryTimescale<{ count: string }>(countSql, params)
    const totalCount = parseInt(countResult[0]?.count || '0')

    // Get data
    const dataSql = `
      SELECT
        time,
        haystack_name,
        dis,
        value,
        units,
        device_id,
        device_name,
        quality
      FROM sensor_readings
      WHERE ${timeFilter} ${haystackFilter}
      ORDER BY time DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `
    params.push(limit, offset)

    const readings = await queryTimescale<SensorReading>(dataSql, params)

    // Get available haystack names for filter dropdown
    const haystackNames = await getUniqueHaystackNames()

    return NextResponse.json({
      readings,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      },
      filters: {
        haystackNames,
        timeRange,
        haystackName
      }
    })
  } catch (error) {
    console.error('Monitoring API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch monitoring data' },
      { status: 500 }
    )
  }
}
