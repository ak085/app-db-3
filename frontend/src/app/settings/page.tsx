"use client"

import { useState, useEffect, useRef } from "react"
import {
  Save,
  RefreshCw,
  Wifi,
  Shield,
  ShieldOff,
  Upload,
  Trash2,
  Plus,
  X,
  Clock,
  Hash
} from "lucide-react"
import { getAllTimezones } from "@/lib/timezones"

interface Settings {
  mqtt: {
    broker: string
    port: number
    clientId: string
    username: string
    password: string
    keepAlive: number
    tlsEnabled: boolean
    tlsInsecure: boolean
    caCertPath: string | null
    topicPatterns: string[]
    qos: number
    enabled: boolean
    connectionStatus: string
  }
  system: {
    timezone: string
    retentionDays: number
  }
}

interface CertificateStatus {
  ca: {
    exists: boolean
    path: string | null
    filename: string | null
  }
}

interface Toast {
  message: string
  type: "success" | "error"
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [initialSettings, setInitialSettings] = useState<Settings | null>(null)
  const [certStatus, setCertStatus] = useState<CertificateStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const [newTopic, setNewTopic] = useState("")
  const [timezones, setTimezones] = useState<string[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Check if there are unsaved changes
  const hasUnsavedChanges = settings && initialSettings &&
    JSON.stringify(settings) !== JSON.stringify(initialSettings)

  // Load all IANA timezones
  useEffect(() => {
    setTimezones(getAllTimezones())
  }, [])

  // Load settings
  async function loadSettings() {
    try {
      const response = await fetch('/api/settings')
      if (!response.ok) throw new Error('Failed to load settings')
      const data = await response.json()
      setSettings(data)
      setInitialSettings(JSON.parse(JSON.stringify(data))) // Deep copy for comparison
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : 'Failed to load settings',
        type: 'error'
      })
    } finally {
      setLoading(false)
    }
  }

  // Load certificate status
  async function loadCertificateStatus() {
    try {
      const response = await fetch('/api/settings/certificates')
      if (!response.ok) throw new Error('Failed to load certificate status')
      const data = await response.json()
      setCertStatus(data.certificates)
    } catch (error) {
      console.error('Failed to load certificate status:', error)
    }
  }

  useEffect(() => {
    loadSettings()
    loadCertificateStatus()
  }, [])

  // Save settings
  async function saveSettings() {
    if (!settings) return

    setSaving(true)
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      if (!response.ok) throw new Error('Failed to save settings')

      setInitialSettings(JSON.parse(JSON.stringify(settings))) // Update baseline after save
      setToast({ message: 'Settings saved successfully', type: 'success' })
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : 'Failed to save settings',
        type: 'error'
      })
    } finally {
      setSaving(false)
    }
  }

  // Upload certificate
  async function uploadCertificate(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', 'ca')

    try {
      const response = await fetch('/api/settings/certificates', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'Failed to upload certificate')

      setToast({ message: 'Certificate uploaded successfully', type: 'success' })
      await loadCertificateStatus()

      // Update certificate path in settings
      if (data.path && settings) {
        setSettings(prev => prev ? {
          ...prev,
          mqtt: { ...prev.mqtt, caCertPath: data.path }
        } : null)
      }
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : 'Failed to upload certificate',
        type: 'error'
      })
    }
  }

  // Delete certificate
  async function deleteCertificate() {
    try {
      const response = await fetch('/api/settings/certificates?type=ca', {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete certificate')

      setToast({ message: 'Certificate deleted successfully', type: 'success' })
      await loadCertificateStatus()

      // Clear certificate path in settings
      if (settings) {
        setSettings(prev => prev ? {
          ...prev,
          mqtt: { ...prev.mqtt, caCertPath: null }
        } : null)
      }
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : 'Failed to delete certificate',
        type: 'error'
      })
    }
  }

  // Add topic pattern
  function addTopicPattern() {
    if (!newTopic.trim() || !settings) return

    setSettings(prev => prev ? {
      ...prev,
      mqtt: {
        ...prev.mqtt,
        topicPatterns: [...prev.mqtt.topicPatterns, newTopic.trim()]
      }
    } : null)
    setNewTopic("")
  }

  // Remove topic pattern
  function removeTopicPattern(index: number) {
    if (!settings) return

    setSettings(prev => prev ? {
      ...prev,
      mqtt: {
        ...prev.mqtt,
        topicPatterns: prev.mqtt.topicPatterns.filter((_, i) => i !== index)
      }
    } : null)
  }

  // Clear toast after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-red-600">Failed to load settings</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-lg shadow-lg ${
          toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-600">Configure MQTT connection and data storage</p>
        </div>
        <div className="flex items-center gap-4">
          {hasUnsavedChanges && (
            <span className="text-sm text-amber-600 font-medium bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              Unsaved changes
            </span>
          )}
          <button
            onClick={saveSettings}
            disabled={saving}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
              hasUnsavedChanges
                ? 'bg-amber-500 hover:bg-amber-600 text-white animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            <Save className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* MQTT Connection */}
        <div className="bg-white rounded-xl border-2 border-slate-300 shadow-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Wifi className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-slate-900">MQTT Connection</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Broker Address
              </label>
              <input
                type="text"
                value={settings.mqtt.broker}
                onChange={(e) => setSettings(prev => prev ? {
                  ...prev,
                  mqtt: { ...prev.mqtt, broker: e.target.value }
                } : null)}
                placeholder="e.g., 10.0.60.3"
                className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Port
                </label>
                <input
                  type="number"
                  value={settings.mqtt.port}
                  onChange={(e) => setSettings(prev => prev ? {
                    ...prev,
                    mqtt: { ...prev.mqtt, port: parseInt(e.target.value) || 1883 }
                  } : null)}
                  className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Client ID
                </label>
                <input
                  type="text"
                  value={settings.mqtt.clientId}
                  onChange={(e) => setSettings(prev => prev ? {
                    ...prev,
                    mqtt: { ...prev.mqtt, clientId: e.target.value }
                  } : null)}
                  className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Username
              </label>
              <input
                type="text"
                value={settings.mqtt.username}
                onChange={(e) => setSettings(prev => prev ? {
                  ...prev,
                  mqtt: { ...prev.mqtt, username: e.target.value }
                } : null)}
                placeholder="Optional"
                className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={settings.mqtt.password}
                onChange={(e) => setSettings(prev => prev ? {
                  ...prev,
                  mqtt: { ...prev.mqtt, password: e.target.value }
                } : null)}
                placeholder="Optional"
                className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="enabled"
                checked={settings.mqtt.enabled}
                onChange={(e) => setSettings(prev => prev ? {
                  ...prev,
                  mqtt: { ...prev.mqtt, enabled: e.target.checked }
                } : null)}
                className="rounded"
              />
              <label htmlFor="enabled" className="text-sm text-slate-700">
                Enable MQTT connection
              </label>
            </div>
          </div>
        </div>

        {/* TLS/SSL Settings */}
        <div className="bg-white rounded-xl border-2 border-slate-300 shadow-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            {settings.mqtt.tlsEnabled ? (
              <Shield className="w-5 h-5 text-emerald-600" />
            ) : (
              <ShieldOff className="w-5 h-5 text-slate-400" />
            )}
            <h2 className="text-lg font-semibold text-slate-900">TLS/SSL Security</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="tlsEnabled"
                checked={settings.mqtt.tlsEnabled}
                onChange={(e) => setSettings(prev => prev ? {
                  ...prev,
                  mqtt: { ...prev.mqtt, tlsEnabled: e.target.checked }
                } : null)}
                className="rounded"
              />
              <label htmlFor="tlsEnabled" className="text-sm text-slate-700">
                Enable TLS/SSL encryption
              </label>
            </div>

            {settings.mqtt.tlsEnabled && (
              <>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="tlsInsecure"
                    checked={settings.mqtt.tlsInsecure}
                    onChange={(e) => setSettings(prev => prev ? {
                      ...prev,
                      mqtt: { ...prev.mqtt, tlsInsecure: e.target.checked }
                    } : null)}
                    className="rounded"
                  />
                  <label htmlFor="tlsInsecure" className="text-sm text-slate-700">
                    Skip certificate verification (insecure)
                  </label>
                </div>

                {!settings.mqtt.tlsInsecure && (
                  <div className="pt-2 border-t border-slate-100">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      CA Certificate
                    </label>

                    {certStatus?.ca.exists ? (
                      <div className="flex items-center justify-between py-2 px-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <span className="text-sm text-emerald-700">
                          {certStatus.ca.filename}
                        </span>
                        <button
                          onClick={deleteCertificate}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <input
                          type="file"
                          ref={fileInputRef}
                          accept=".pem,.crt,.cer"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) uploadCertificate(file)
                          }}
                          className="hidden"
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-slate-300 rounded-lg hover:border-emerald-500 transition-colors"
                        >
                          <Upload className="w-4 h-4" />
                          Upload CA Certificate
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Topic Subscriptions */}
        <div className="bg-white rounded-xl border-2 border-slate-300 shadow-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Hash className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-slate-900">Topic Subscriptions</h2>
          </div>

          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                placeholder="e.g., bacnet/#"
                className="flex-1 px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-emerald-500 focus:outline-none font-mono text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addTopicPattern()
                }}
              />
              <button
                onClick={addTopicPattern}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            <div className="border border-slate-200 rounded-lg divide-y divide-slate-200">
              {settings.mqtt.topicPatterns.map((pattern, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between py-3 px-4 ${index % 2 === 0 ? 'bg-slate-50' : ''}`}
                >
                  <code className="text-sm text-slate-700 font-mono">{pattern}</code>
                  <button
                    onClick={() => removeTopicPattern(index)}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {settings.mqtt.topicPatterns.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4 px-4">
                  No topics configured. Add a topic pattern to start receiving data.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                QoS Level
              </label>
              <select
                value={settings.mqtt.qos}
                onChange={(e) => setSettings(prev => prev ? {
                  ...prev,
                  mqtt: { ...prev.mqtt, qos: parseInt(e.target.value) }
                } : null)}
                className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-emerald-500 focus:outline-none"
              >
                <option value={0}>0 - At most once</option>
                <option value={1}>1 - At least once</option>
                <option value={2}>2 - Exactly once</option>
              </select>
            </div>
          </div>
        </div>

        {/* System Settings */}
        <div className="bg-white rounded-xl border-2 border-slate-300 shadow-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-slate-900">System Settings</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Timezone
              </label>
              <select
                value={settings.system.timezone}
                onChange={(e) => setSettings(prev => prev ? {
                  ...prev,
                  system: { ...prev.system, timezone: e.target.value }
                } : null)}
                className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-emerald-500 focus:outline-none"
              >
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Data Retention (days)
              </label>
              <input
                type="number"
                value={settings.system.retentionDays}
                onChange={(e) => setSettings(prev => prev ? {
                  ...prev,
                  system: { ...prev.system, retentionDays: parseInt(e.target.value) || 30 }
                } : null)}
                min={1}
                max={365}
                className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-emerald-500 focus:outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">
                Data older than this will be automatically deleted
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
