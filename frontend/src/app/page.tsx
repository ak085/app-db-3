"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Database,
  Wifi,
  WifiOff,
  RefreshCw,
  Clock,
  BarChart3,
  Calendar,
  Shield,
  ShieldOff,
  Hash
} from "lucide-react"
import Link from "next/link"

interface DashboardData {
  mqtt: {
    broker: string
    port: number
    connectionStatus: string
    lastConnected: string | null
    tlsEnabled: boolean
    enabled: boolean
    topicPatterns: string[]
  }
  timescale: {
    connected: boolean
    totalReadings: number
    todayReadings: number
    lastDataTime: string | null
  }
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)
    try {
      const response = await fetch('/api/dashboard/summary')
      if (!response.ok) throw new Error('Failed to fetch data')
      const result = await response.json()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(true)
  }, [fetchData])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => fetchData(false), 10000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchData])

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num)
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    const date = new Date(dateStr)
    return date.toLocaleString()
  }

  if (loading && !data) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      </div>
    )
  }

  const mqttConnected = data?.mqtt.connectionStatus === 'connected'

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600">MQTT to TimescaleDB data collection status</p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh
          </label>
          <button
            onClick={() => fetchData(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {/* MQTT Connection Status */}
        <div className="bg-white rounded-xl border-2 border-slate-200 shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-500">MQTT Broker</h3>
            {mqttConnected ? (
              <Wifi className="w-5 h-5 text-emerald-500" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-500" />
            )}
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-3 h-3 rounded-full ${mqttConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className="text-lg font-semibold">
              {mqttConnected ? 'Connected' : data?.mqtt.connectionStatus || 'Disconnected'}
            </span>
          </div>
          <p className="text-sm text-slate-500">
            {data?.mqtt.broker ? `${data.mqtt.broker}:${data.mqtt.port}` : 'Not configured'}
          </p>
        </div>

        {/* TimescaleDB Status */}
        <div className="bg-white rounded-xl border-2 border-slate-200 shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-500">TimescaleDB</h3>
            <Database className={`w-5 h-5 ${data?.timescale.connected ? 'text-emerald-500' : 'text-red-500'}`} />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-3 h-3 rounded-full ${data?.timescale.connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className="text-lg font-semibold">
              {data?.timescale.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <p className="text-sm text-slate-500">Time-series storage</p>
        </div>

        {/* Total Readings */}
        <div className="bg-white rounded-xl border-2 border-slate-200 shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-500">Total Readings</h3>
            <BarChart3 className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {formatNumber(data?.timescale.totalReadings || 0)}
          </p>
          <p className="text-sm text-slate-500">All time</p>
        </div>

        {/* Today's Readings */}
        <div className="bg-white rounded-xl border-2 border-slate-200 shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-500">Today&apos;s Readings</h3>
            <Calendar className="w-5 h-5 text-purple-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {formatNumber(data?.timescale.todayReadings || 0)}
          </p>
          <p className="text-sm text-slate-500">Since midnight</p>
        </div>
      </div>

      {/* Detail Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* MQTT Configuration */}
        <div className="bg-white rounded-xl border-2 border-slate-200 shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">MQTT Configuration</h3>
            <Link
              href="/settings"
              className="text-sm text-emerald-600 hover:text-emerald-700"
            >
              Configure
            </Link>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-600">Broker</span>
              <span className="font-medium">
                {data?.mqtt.broker || 'Not configured'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-600">Port</span>
              <span className="font-medium">{data?.mqtt.port}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-600">TLS/SSL</span>
              <span className="flex items-center gap-2">
                {data?.mqtt.tlsEnabled ? (
                  <>
                    <Shield className="w-4 h-4 text-emerald-500" />
                    <span className="text-emerald-600 font-medium">Enabled</span>
                  </>
                ) : (
                  <>
                    <ShieldOff className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-500">Disabled</span>
                  </>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-600">Enabled</span>
              <span className={`font-medium ${data?.mqtt.enabled ? 'text-emerald-600' : 'text-slate-500'}`}>
                {data?.mqtt.enabled ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-slate-600">Last Connected</span>
              <span className="text-sm text-slate-500">
                {formatDate(data?.mqtt.lastConnected || null)}
              </span>
            </div>
          </div>
        </div>

        {/* Topic Subscriptions */}
        <div className="bg-white rounded-xl border-2 border-slate-200 shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Topic Subscriptions</h3>
            <Hash className="w-5 h-5 text-slate-400" />
          </div>

          <div className="space-y-2">
            {data?.mqtt.topicPatterns?.length ? (
              data.mqtt.topicPatterns.map((pattern, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 py-2 px-3 bg-slate-50 rounded-lg"
                >
                  <code className="text-sm text-slate-700 font-mono">
                    {pattern}
                  </code>
                </div>
              ))
            ) : (
              <p className="text-slate-500 text-sm">No topics configured</p>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Last Data Received</span>
              <span className="flex items-center gap-2 text-slate-500">
                <Clock className="w-4 h-4" />
                {formatDate(data?.timescale.lastDataTime || null)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6 bg-white rounded-xl border-2 border-slate-200 shadow-md p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-4">
          <Link
            href="/monitoring"
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <BarChart3 className="w-4 h-4" />
            View Data
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <Wifi className="w-4 h-4" />
            Configure MQTT
          </Link>
          <Link
            href="/api/export?format=csv"
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            target="_blank"
          >
            <Database className="w-4 h-4" />
            Export CSV
          </Link>
        </div>
      </div>
    </div>
  )
}
