import { motion } from 'framer-motion'
import { Download, Filter, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { reportService } from '../../api/services/reportService'

export default function Reports() {
  const [showFilter, setShowFilter] = useState(false)
  const [selectedSkill, setSelectedSkill] = useState(null)
  const [filters, setFilters] = useState({
    dateRange: 'all',
    skillLevel: 'all',
    department: 'all',
  })
  const [trendData, setTrendData] = useState([])
  const [skillReport, setSkillReport] = useState([])

  const reportStats = useMemo(() => {
    const avgScore =
      skillReport.length > 0
        ? (skillReport.reduce((sum, item) => sum + item.avgScore, 0) / skillReport.length).toFixed(1)
        : '0.0'
    const trackedSkills = skillReport.length
    const activeGaps = skillReport.filter((item) => item.gap >= 1).length
    const scoreTrend =
      trendData.length > 1
        ? trendData[trendData.length - 1].avgScore - trendData[0].avgScore
        : 0

    return [
      { label: 'Avg Team Score', value: `${avgScore}/5` },
      { label: 'Tracked Skills', value: String(trackedSkills) },
      { label: 'Active Skill Gaps', value: String(activeGaps) },
      { label: 'Score Trend', value: `${scoreTrend >= 0 ? '+' : ''}${scoreTrend.toFixed(1)}` },
    ]
  }, [skillReport, trendData])

  useEffect(() => {
    let mounted = true

    const loadReports = async () => {
      const summary = await reportService.getSummary()
      if (!mounted) return
      setTrendData(summary.trendData)
      setSkillReport(summary.skillReport)
    }

    loadReports()

    return () => {
      mounted = false
    }
  }, [])

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    setFilters((prev) => ({ ...prev, [name]: value }))
  }

  const handleExport = (format) => {
    const data = {
      filters,
      skillReport,
      trendData,
      exportedAt: new Date().toISOString(),
    }

    const content = format === 'JSON' ? JSON.stringify(data, null, 2) : formatForExport(data, format)

    const element = document.createElement('a')
    const file = new Blob([content], { type: 'text/plain' })
    element.href = URL.createObjectURL(file)
    element.download = `skill-report-${format.toLowerCase()}.${format === 'JSON' ? 'json' : format === 'CSV' ? 'csv' : 'txt'}`
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  const formatForExport = (data, format) => {
    if (format === 'CSV') {
      let csv = 'Skill,Employees,Avg Score,Gap,Trend\n'
      data.skillReport.forEach((row) => {
        csv += `${row.skill},${row.employees},${row.avgScore},${row.gap},+10%\n`
      })
      return csv
    }
    return JSON.stringify(data, null, 2)
  }

  const resetFilters = () => {
    setFilters({ dateRange: 'all', skillLevel: 'all', department: 'all' })
  }

  const closeDetails = () => setSelectedSkill(null)

  const formatDateLabel = (value) => {
    if (!value) return '—'
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value
    return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const gapLabel = (gap) => {
    if (gap >= 2) return { label: 'High gap', tone: 'text-red-300 bg-red-500/10 border-red-500/30' }
    if (gap >= 1) return { label: 'Moderate', tone: 'text-amber-300 bg-amber-500/10 border-amber-500/30' }
    return { label: 'On track', tone: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-white">Reports & Analytics</h1>
          <p className="text-gray-400 mt-2">Detailed insights into your team's skill development</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilter(!showFilter)}
            className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition-all flex items-center space-x-2"
          >
            <Filter className="w-4 h-4" />
            <span>Filter</span>
          </button>
          <button
            onClick={() => handleExport('CSV')}
            className="px-4 py-2 rounded-lg bg-white text-black hover:bg-gray-200 transition-all flex items-center space-x-2 font-semibold"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {showFilter && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-900 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Filters</h3>
            <button onClick={() => setShowFilter(false)} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Date Range</label>
              <select name="dateRange" value={filters.dateRange} onChange={handleFilterChange} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-gray-600 focus:outline-none">
                <option value="all">All Time</option>
                <option value="lastMonth">Last Month</option>
                <option value="last3Months">Last 3 Months</option>
                <option value="last6Months">Last 6 Months</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Skill Level</label>
              <select name="skillLevel" value={filters.skillLevel} onChange={handleFilterChange} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-gray-600 focus:outline-none">
                <option value="all">All Levels</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Department</label>
              <select name="department" value={filters.department} onChange={handleFilterChange} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-gray-600 focus:outline-none">
                <option value="all">All Departments</option>
                <option value="engineering">Engineering</option>
                <option value="design">Design</option>
                <option value="product">Product</option>
              </select>
            </div>
          </div>
          <button onClick={resetFilters} className="mt-4 px-4 py-2 text-sm text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors">
            Reset Filters
          </button>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {reportStats.map(({ label, value }) => (
          <motion.div key={label} whileHover={{ scale: 1.05 }} className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-center">
            <p className="text-gray-400 text-sm mb-2">{label}</p>
            <p className="text-3xl font-bold text-white">{value}</p>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="bg-gray-900 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-bold text-white mb-6">Team Development Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trendData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(107, 114, 128, 0.2)" />
            <XAxis dataKey="month" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid rgba(107, 114, 128, 0.3)', borderRadius: '8px' }} />
            <Legend />
            <Line type="monotone" dataKey="avgScore" stroke="#ffffff" strokeWidth={2} dot={{ fill: '#ffffff', r: 5 }} name="Avg Score" />
          </LineChart>
        </ResponsiveContainer>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-gray-900 border border-gray-700 rounded-lg p-6 overflow-x-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <div>
            <h3 className="text-lg font-bold text-white">Skills Report</h3>
            <p className="text-sm text-gray-400">Benchmarked performance per skill with gap analysis and employee insights.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="px-2 py-1 rounded-full border border-gray-700 bg-gray-800">Updated live</span>
            <span className="px-2 py-1 rounded-full border border-gray-700 bg-gray-800">Data source: Interview assessments</span>
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-4 px-4 text-gray-300 font-semibold text-sm">Skill</th>
              <th className="text-center py-4 px-4 text-gray-300 font-semibold text-sm">Employees</th>
              <th className="text-center py-4 px-4 text-gray-300 font-semibold text-sm">Avg Score</th>
              <th className="text-center py-4 px-4 text-gray-300 font-semibold text-sm">Gap</th>
              <th className="text-center py-4 px-4 text-gray-300 font-semibold text-sm">Trend</th>
              <th className="text-center py-4 px-4 text-gray-300 font-semibold text-sm">Details</th>
            </tr>
          </thead>
          <tbody>
            {skillReport.map((row, i) => {
              const gapInfo = gapLabel(row.gap)
              const progress = Math.max(0, Math.min(100, (row.avgScore / 5) * 100))
              return (
                <motion.tr key={row.skill} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} className="border-b border-gray-800 hover:bg-gray-800 transition-colors">
                  <td className="py-4 px-4 text-white font-medium">
                    <div className="flex flex-col">
                      <span>{row.skill}</span>
                      <span className="text-xs text-gray-500">Focus area insights</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center text-gray-300">{row.employees}</td>
                  <td className="py-4 px-4 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <span className="px-3 py-1 text-sm font-semibold bg-white text-black rounded-lg">{row.avgScore}/5.0</span>
                      <div className="w-24 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                        <div className="h-full bg-white" style={{ width: `${progress}%` }}></div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold ${gapInfo.tone}`}>
                      {row.gap}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${gapInfo.tone}`}>{gapInfo.label}</span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <button
                      type="button"
                      onClick={() => setSelectedSkill(row)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-600 text-gray-200 hover:bg-gray-700 transition-colors"
                    >
                      View
                    </button>
                  </td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>
      </motion.div>

      {selectedSkill && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-3xl bg-gray-900 border border-gray-700 rounded-2xl shadow-xl">
            <div className="flex items-start justify-between border-b border-gray-700 px-6 py-4">
              <div>
                <p className="text-xs text-gray-400">Skill Detail</p>
                <h3 className="text-xl font-bold text-white">{selectedSkill.skill}</h3>
              </div>
              <button onClick={closeDetails} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-4">
                  <p className="text-xs text-gray-400">Avg Score</p>
                  <p className="text-2xl font-bold text-white">{selectedSkill.avgScore}/5</p>
                </div>
                <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-4">
                  <p className="text-xs text-gray-400">Employees</p>
                  <p className="text-2xl font-bold text-white">{selectedSkill.employees}</p>
                </div>
                <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-4">
                  <p className="text-xs text-gray-400">Gap</p>
                  <p className="text-2xl font-bold text-white">{selectedSkill.gap}</p>
                </div>
              </div>

              <div className="rounded-xl border border-gray-700 overflow-hidden">
                <div className="px-4 py-3 bg-gray-800/60 border-b border-gray-700 text-sm font-semibold text-gray-200">
                  Employee Details
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {selectedSkill.employeeDetails?.length ? (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-900/70">
                        <tr className="text-gray-400">
                          <th className="text-left px-4 py-3 font-semibold">Employee Name</th>
                          <th className="text-left px-4 py-3 font-semibold">Employee ID</th>
                          <th className="text-center px-4 py-3 font-semibold">Score</th>
                          <th className="text-right px-4 py-3 font-semibold">Last Assessment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSkill.employeeDetails.map((detail) => (
                          <tr key={`${detail.employeeId || detail.name}`} className="border-t border-gray-800 text-gray-200">
                            <td className="px-4 py-3 font-medium">{detail.name}</td>
                            <td className="px-4 py-3 text-gray-400">{detail.employeeId || '—'}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="px-2 py-1 rounded-full bg-white text-black text-xs font-semibold">{detail.score}/5</span>
                            </td>
                            <td className="px-4 py-3 text-right text-gray-400">{formatDateLabel(detail.date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="px-4 py-6 text-center text-sm text-gray-400">No employee detail available yet.</div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-700">
              <button onClick={closeDetails} className="px-4 py-2 rounded-lg border border-gray-600 text-gray-200 hover:bg-gray-800 transition-colors">
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
