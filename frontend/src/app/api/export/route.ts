import { NextRequest, NextResponse } from 'next/server'
import { queryTimescale } from '@/lib/timescale'

export const dynamic = 'force-dynamic'

interface SensorReading {
  time: Date
  haystack_name: string
  dis: string
  value: number
  units: string
  device_id: number
  device_name: string
  device_ip: string
  object_type: string
  object_instance: number
  quality: string
  site_id: string
  equipment_type: string
  equipment_id: string
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Parameters
    const format = searchParams.get('format') || 'csv'
    const timeRange = searchParams.get('range') || '24h'
    const haystackName = searchParams.get('haystack') || null
    const startTime = searchParams.get('start') || null
    const endTime = searchParams.get('end') || null

    // Build time filter
    let timeFilter = ''
    const params: (string | Date)[] = []
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
      const interval = intervals[timeRange] || '24 hours'
      timeFilter = `time >= NOW() - INTERVAL '${interval}'`
    }

    // Build haystack filter
    let haystackFilter = ''
    if (haystackName) {
      haystackFilter = `AND haystack_name = $${paramIndex}`
      params.push(haystackName)
    }

    // Query data
    const sql = `
      SELECT
        time,
        haystack_name,
        dis,
        value,
        units,
        device_id,
        device_name,
        device_ip,
        object_type,
        object_instance,
        quality,
        site_id,
        equipment_type,
        equipment_id
      FROM sensor_readings
      WHERE ${timeFilter} ${haystackFilter}
      ORDER BY time DESC
      LIMIT 100000
    `

    const readings = await queryTimescale<SensorReading>(sql, params)

    if (format === 'json') {
      // Return JSON
      const filename = `sensor_data_${new Date().toISOString().split('T')[0]}.json`

      return new NextResponse(JSON.stringify(readings, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      })
    } else {
      // Return CSV
      const filename = `sensor_data_${new Date().toISOString().split('T')[0]}.csv`

      // CSV header
      const headers = [
        'time',
        'haystack_name',
        'display_name',
        'value',
        'units',
        'device_id',
        'device_name',
        'device_ip',
        'object_type',
        'object_instance',
        'quality',
        'site_id',
        'equipment_type',
        'equipment_id'
      ]

      // Build CSV content
      const csvRows = [headers.join(',')]

      for (const reading of readings) {
        const row = [
          new Date(reading.time).toISOString(),
          escapeCSV(reading.haystack_name),
          escapeCSV(reading.dis),
          reading.value,
          escapeCSV(reading.units),
          reading.device_id,
          escapeCSV(reading.device_name),
          escapeCSV(reading.device_ip),
          escapeCSV(reading.object_type),
          reading.object_instance,
          escapeCSV(reading.quality),
          escapeCSV(reading.site_id),
          escapeCSV(reading.equipment_type),
          escapeCSV(reading.equipment_id)
        ]
        csvRows.push(row.join(','))
      }

      const csvContent = csvRows.join('\n')

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      })
    }
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    )
  }
}

// Helper to escape CSV values
function escapeCSV(value: string | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}
