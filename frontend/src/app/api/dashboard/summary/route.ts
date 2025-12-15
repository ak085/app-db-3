import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  checkTimescaleConnection,
  getTotalReadings,
  getTodayReadings,
  getLastDataTime
} from '@/lib/timescale'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Get MQTT config and connection status
    const mqttConfig = await prisma.mqttConfig.findFirst({
      where: { id: 1 }
    })

    // Check TimescaleDB connection
    const timescaleConnected = await checkTimescaleConnection()

    // Get statistics from TimescaleDB
    const totalReadings = await getTotalReadings()
    const todayReadings = await getTodayReadings()
    const lastDataTime = await getLastDataTime()

    return NextResponse.json({
      mqtt: {
        broker: mqttConfig?.broker || '',
        port: mqttConfig?.port || 1883,
        connectionStatus: mqttConfig?.connectionStatus || 'disconnected',
        lastConnected: mqttConfig?.lastConnected,
        tlsEnabled: mqttConfig?.tlsEnabled || false,
        enabled: mqttConfig?.enabled !== false,
        topicPatterns: mqttConfig?.topicPatterns || ['bacnet/#']
      },
      timescale: {
        connected: timescaleConnected,
        totalReadings,
        todayReadings,
        lastDataTime
      }
    })
  } catch (error) {
    console.error('Dashboard summary error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    )
  }
}
