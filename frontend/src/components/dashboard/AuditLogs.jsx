import { motion } from 'framer-motion'
import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { auditLogService } from '../../api/services/auditLogService'

export default function AuditLogs() {
  const [logs, setLogs] = useState([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async (searchQuery = '') => {
    setLoading(true)
    setError('')
    try {
      const data = await auditLogService.list(searchQuery)
      setLogs(data)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl font-bold text-white">Audit Logs</h1>
        <p className="text-gray-400 mt-2">Track platform events from managers and employees in real time.</p>
      </motion.div>

      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search actor, action, target..."
              className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-gray-600"
            />
          </div>
          <button
            type="button"
            onClick={() => load(query)}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-200 hover:bg-gray-800"
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => {
              setQuery('')
              load('')
            }}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-200 hover:bg-gray-800"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}

      <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between">
          <p className="text-white font-semibold">Log stream</p>
          <p className="text-sm text-gray-400">{loading ? 'Loading...' : `${logs.length} entries`}</p>
        </div>
        <div className="max-h-[72vh] overflow-y-auto">
          {logs.map((log) => {
            const isManager = String(log.actorRole || '').toLowerCase() === 'manager'
            return (
              <div key={log.id} className="px-5 py-4 border-b border-gray-800">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        isManager
                          ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      }`}
                    >
                      {isManager ? 'Manager' : 'Employee'}
                    </span>
                    <p className="text-white font-medium">{log.actorName || 'Unknown user'}</p>
                  </div>
                  <p className="text-xs text-gray-500">{log.timestamp ? new Date(log.timestamp).toLocaleString() : 'No timestamp'}</p>
                </div>
                <p className="text-sm text-gray-300 mt-2">
                  <span className="font-semibold text-gray-100">{log.action}</span>
                  <span className="text-gray-500">{' -> '}</span>
                  <span>{log.target}</span>
                </p>
              </div>
            )
          })}
          {!loading && logs.length === 0 && (
            <div className="px-5 py-8 text-center text-gray-400">No audit logs found.</div>
          )}
        </div>
      </div>
    </div>
  )
}
