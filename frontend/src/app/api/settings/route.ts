import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET - Fetch current settings
export async function GET() {
  try {
    // Get or create MQTT config
    let mqttConfig = await prisma.mqttConfig.findFirst({
      where: { id: 1 }
    })

    if (!mqttConfig) {
      mqttConfig = await prisma.mqttConfig.create({
        data: { id: 1 }
      })
    }

    // Get or create system settings
    let systemSettings = await prisma.systemSettings.findFirst({
      where: { id: 1 }
    })

    if (!systemSettings) {
      systemSettings = await prisma.systemSettings.create({
        data: { id: 1 }
      })
    }

    return NextResponse.json({
      mqtt: {
        broker: mqttConfig.broker,
        port: mqttConfig.port,
        clientId: mqttConfig.clientId,
        username: mqttConfig.username,
        password: mqttConfig.password,
        keepAlive: mqttConfig.keepAlive,
        tlsEnabled: mqttConfig.tlsEnabled,
        tlsInsecure: mqttConfig.tlsInsecure,
        caCertPath: mqttConfig.caCertPath,
        topicPatterns: mqttConfig.topicPatterns,
        qos: mqttConfig.qos,
        enabled: mqttConfig.enabled,
        connectionStatus: mqttConfig.connectionStatus
      },
      system: {
        timezone: systemSettings.timezone,
        retentionDays: systemSettings.retentionDays
      }
    })
  } catch (error) {
    console.error('Settings GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

// POST - Update settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mqtt, system } = body

    // Update MQTT config
    if (mqtt) {
      await prisma.mqttConfig.upsert({
        where: { id: 1 },
        update: {
          broker: mqtt.broker,
          port: mqtt.port,
          clientId: mqtt.clientId,
          username: mqtt.username,
          password: mqtt.password,
          keepAlive: mqtt.keepAlive,
          tlsEnabled: mqtt.tlsEnabled,
          tlsInsecure: mqtt.tlsInsecure,
          topicPatterns: mqtt.topicPatterns,
          qos: mqtt.qos,
          enabled: mqtt.enabled
        },
        create: {
          id: 1,
          broker: mqtt.broker,
          port: mqtt.port,
          clientId: mqtt.clientId,
          username: mqtt.username,
          password: mqtt.password,
          keepAlive: mqtt.keepAlive,
          tlsEnabled: mqtt.tlsEnabled,
          tlsInsecure: mqtt.tlsInsecure,
          topicPatterns: mqtt.topicPatterns,
          qos: mqtt.qos,
          enabled: mqtt.enabled
        }
      })
    }

    // Update system settings
    if (system) {
      await prisma.systemSettings.upsert({
        where: { id: 1 },
        update: {
          timezone: system.timezone,
          retentionDays: system.retentionDays
        },
        create: {
          id: 1,
          timezone: system.timezone,
          retentionDays: system.retentionDays
        }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Settings POST error:', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}
