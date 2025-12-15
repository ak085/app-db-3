"use client"

import { useState, useEffect, useCallback } from "react"
import {
  RefreshCw,
  Download,
  Clock,
  Filter,
  ChevronLeft,
  ChevronRight
} from "lucide-react"

interface SensorReading {
  time: string
  haystack_name: string
  dis: string
  value: number
  units: string
  device_id: number
  device_name: string
  quality: string
}

interface MonitoringData {
  readings: SensorReading[]
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
  }
  filters: {
    haystackNames: string[]
    timeRange: string
    haystackName: string | null
  }
}

export default function MonitoringPage() {
  const [data, setData] = useState<MonitoringData | null>(null)
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(false)

  // Filters
  const [page, setPage] = useState(1)
  const [timeRange, setTimeRange] = useState('1h')
  const [haystackFilter, setHaystackFilter] = useState('')

  const fetchData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        range: timeRange
      })

      if (haystackFilter) {
        params.set('haystack', haystackFilter)
      }

      const response = await fetch(`/api/monitoring?${params}`)
      if (!response.ok) throw new Error('Failed to fetch data')
      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error('Failed to fetch monitoring data:', error)
    } finally {
      setLoading(false)
    }
  }, [page, timeRange, haystackFilter])

  useEffect(() => {
    fetchData(true)
  }, [fetchData])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => fetchData(false), 10000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchData])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString()
  }

  const formatValue = (value: number) => {
    if (value === null || value === undefined) return '-'
    return typeof value === 'number' ? value.toFixed(2) : value
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Monitoring</h1>
          <p className="text-slate-600">View collected sensor data</p>
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

      {/* Filters */}
      <div className="bg-white rounded-xl border-2 border-slate-200 shadow-md p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <select
              value={timeRange}
              onChange={(e) => {
                setTimeRange(e.target.value)
                setPage(1)
              }}
              className="px-3 py-2 border border-slate-200 rounded-lg focus:border-emerald-500 focus:outline-none"
            >
              <option value="1h">Last 1 hour</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={haystackFilter}
              onChange={(e) => {
                setHaystackFilter(e.target.value)
                setPage(1)
              }}
              className="px-3 py-2 border border-slate-200 rounded-lg focus:border-emerald-500 focus:outline-none min-w-[200px]"
            >
              <option value="">All points</option>
              {data?.filters.haystackNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1" />

          <a
            href={`/api/export?format=csv&range=${timeRange}${haystackFilter ? `&haystack=${haystackFilter}` : ''}`}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </a>

          <a
            href={`/api/export?format=json&range=${timeRange}${haystackFilter ? `&haystack=${haystackFilter}` : ''}`}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export JSON
          </a>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl border-2 border-slate-200 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Time</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Haystack Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Display Name</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Value</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Units</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Device</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">Quality</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <RefreshCw className="w-6 h-6 animate-spin text-emerald-600 mx-auto" />
                  </td>
                </tr>
              ) : data?.readings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No data found for the selected filters
                  </td>
                </tr>
              ) : (
                data?.readings.map((reading, index) => (
                  <tr
                    key={index}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {formatDate(reading.time)}
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-sm text-slate-700 font-mono">
                        {reading.haystack_name || '-'}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {reading.dis || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-mono font-medium text-slate-900">
                      {formatValue(reading.value)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {reading.units || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {reading.device_name || `Device ${reading.device_id}`}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        reading.quality === 'good'
                          ? 'bg-emerald-100 text-emerald-700'
                          : reading.quality === 'uncertain'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {reading.quality || 'unknown'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
            <div className="text-sm text-slate-600">
              Showing {((page - 1) * 50) + 1} to {Math.min(page * 50, data.pagination.totalCount)} of {data.pagination.totalCount} entries
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              <span className="px-3 py-1 text-sm text-slate-600">
                Page {page} of {data.pagination.totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                disabled={page === data.pagination.totalPages}
                className="flex items-center gap-1 px-3 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
