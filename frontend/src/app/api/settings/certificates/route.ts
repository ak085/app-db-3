import { NextRequest, NextResponse } from 'next/server'
import { writeFile, unlink, mkdir, readdir, stat } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const CERTS_DIR = '/app/certs'

// GET - List certificates
export async function GET() {
  try {
    // Get current config to check certificate paths
    const config = await prisma.mqttConfig.findFirst({
      where: { id: 1 }
    })

    const certificates = {
      ca: {
        exists: false,
        path: config?.caCertPath || null,
        filename: null as string | null
      }
    }

    // Check if CA certificate exists
    if (config?.caCertPath && existsSync(config.caCertPath)) {
      certificates.ca.exists = true
      certificates.ca.filename = path.basename(config.caCertPath)
    }

    return NextResponse.json({ certificates })
  } catch (error) {
    console.error('Certificates GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch certificates' },
      { status: 500 }
    )
  }
}

// POST - Upload certificate
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const certType = formData.get('type') as string

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (certType !== 'ca') {
      return NextResponse.json(
        { error: 'Invalid certificate type' },
        { status: 400 }
      )
    }

    // Ensure certs directory exists
    if (!existsSync(CERTS_DIR)) {
      await mkdir(CERTS_DIR, { recursive: true })
    }

    // Save file
    const filename = `${certType}_cert.pem`
    const filePath = path.join(CERTS_DIR, filename)
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer, { mode: 0o644 })

    // Update database with certificate path
    await prisma.mqttConfig.upsert({
      where: { id: 1 },
      update: { caCertPath: filePath },
      create: { id: 1, caCertPath: filePath }
    })

    return NextResponse.json({
      success: true,
      path: filePath,
      message: 'Certificate uploaded successfully'
    })
  } catch (error) {
    console.error('Certificate upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload certificate' },
      { status: 500 }
    )
  }
}

// DELETE - Remove certificate
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const certType = searchParams.get('type')

    if (certType !== 'ca') {
      return NextResponse.json(
        { error: 'Invalid certificate type' },
        { status: 400 }
      )
    }

    // Get current config
    const config = await prisma.mqttConfig.findFirst({
      where: { id: 1 }
    })

    if (config?.caCertPath && existsSync(config.caCertPath)) {
      await unlink(config.caCertPath)
    }

    // Clear path in database
    await prisma.mqttConfig.update({
      where: { id: 1 },
      data: { caCertPath: null }
    })

    return NextResponse.json({
      success: true,
      message: 'Certificate deleted successfully'
    })
  } catch (error) {
    console.error('Certificate delete error:', error)
    return NextResponse.json(
      { error: 'Failed to delete certificate' },
      { status: 500 }
    )
  }
}
