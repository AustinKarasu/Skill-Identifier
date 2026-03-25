import { motion } from 'framer-motion'
import { Users, TrendingUp, Target, Award, AlertTriangle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'
import { dashboardService } from '../../api/services/dashboardService'
import { assessmentService } from '../../api/services/assessmentService'
import { reportService } from '../../api/services/reportService'

const CHART_COLORS = ['#60a5fa', '#34d399', '#f59e0b', '#f87171', '#a78bfa', '#22d3ee']

const normalizeSignal = (value) => {
  const raw = String(value || '').trim().toLowerCase()
  if (raw.includes('strong')) return 'Strong'
  if (raw.includes('potential') || raw.includes('promising')) return 'Promising'
  if (raw.includes('excellent')) return 'Excellent'
  if (raw.includes('need')) return 'Needs Development'
  return 'Promising'
}

export default function DashboardOverview() {
  const [statsCards, setStatsCards] = useState([])
  const [skillGapData, setSkillGapData] = useState([])
  const [skillDistribution, setSkillDistribution] = useState([])
  const [assessments, setAssessments] = useState([])
  const [reportSummary, setReportSummary] = useState({ trendData: [], skillReport: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    const loadSummary = async () => {
      setLoading(true)
      setError('')
      try {
        const [summary, assessmentRows, reports] = await Promise.all([
          dashboardService.getSummary(),
          assessmentService.list(),
          reportService.getSummary(),
        ])
        if (!mounted) return

        setStatsCards(
          summary.statsCards.map((card) => ({
            ...card,
            icon:
              {
                Users,
                TrendingUp,
                Target,
                Award,
              }[card.icon] || Users,
          }))
        )
        setSkillGapData(summary.skillGapData || [])
        setSkillDistribution(summary.skillDistribution || [])
        setAssessments(Array.isArray(assessmentRows) ? assessmentRows : [])
        setReportSummary(reports || { trendData: [], skillReport: [] })
      } catch (loadError) {
        if (!mounted) return
        setError(loadError.message)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadSummary()
    return () => {
      mounted = false
    }
  }, [])

  const completedAssessments = useMemo(() => {
    return assessments
      .filter((item) => Number(item.score) > 0)
      .map((item) => {
        const perDomain = Array.isArray(item.perDomain)
          ? item.perDomain.map((domain) => {
              const score = Number(domain?.score) || 0
              return {
                title: domain?.title || domain?.domain || domain?.id || item.focusArea || 'General',
                score,
                gapLevel:
                  String(domain?.gapLevel || '').trim() ||
                  (score < 3 ? 'high' : score < 4 ? 'medium' : 'low'),
              }
            })
          : []
        return {
          ...item,
          perDomain,
          hiringSignal: normalizeSignal(item.hiringSignal),
        }
      })
  }, [assessments])

  const domainGapData = useMemo(() => {
    const map = new Map()
    for (const item of completedAssessments) {
      const perDomain = Array.isArray(item.perDomain) && item.perDomain.length > 0
        ? item.perDomain
        : [{ title: item.focusArea || 'General', score: Number(item.score) || 0 }]
      for (const domain of perDomain) {
        const key = domain.title || domain.domain || domain.id || 'Unknown'
        const bucket = map.get(key) || { domain: key, totalGap: 0, count: 0 }
        const score = Number(domain.score) || 0
        bucket.totalGap += Math.max(0, 5 - score)
        bucket.count += 1
        map.set(key, bucket)
      }
    }
    return Array.from(map.values())
      .map((row) => ({
        domain: row.domain,
        gap: Number((row.totalGap / Math.max(row.count, 1)).toFixed(2)),
      }))
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 8)
  }, [completedAssessments])

  const hiringSignalData = useMemo(() => {
    const counts = { Excellent: 0, Strong: 0, Promising: 0, 'Needs Development': 0 }
    for (const item of completedAssessments) {
      const signal = normalizeSignal(item.hiringSignal)
      if (!(signal in counts)) counts[signal] = 0
      counts[signal] += 1
    }
    return Object.entries(counts)
      .filter(([, value]) => value > 0)
      .map(([name, value], index) => ({
        name,
        value,
        color: CHART_COLORS[index % CHART_COLORS.length],
      }))
  }, [completedAssessments])

  const employeeRiskData = useMemo(() => {
    const map = new Map()
    for (const item of completedAssessments) {
      const key = item.employee || 'Unknown'
      const entry = map.get(key) || {
        employee: key,
        total: 0,
        count: 0,
        highGapCount: 0,
      }
      entry.total += Number(item.score) || 0
      entry.count += 1
      const domainRows = Array.isArray(item.perDomain) && item.perDomain.length > 0
        ? item.perDomain
        : [{ score: Number(item.score) || 0, gapLevel: Number(item.score) < 3 ? 'high' : 'low' }]
      entry.highGapCount += domainRows.filter((domain) => {
        const gapLevel = String(domain.gapLevel || '').toLowerCase()
        return gapLevel === 'high' || Number(domain.score) < 3
      }).length
      map.set(key, entry)
    }
    return Array.from(map.values())
      .map((item) => ({
        employee: item.employee,
        avgScore: Number((item.total / Math.max(item.count, 1)).toFixed(2)),
        highGapCount: item.highGapCount,
      }))
      .sort((a, b) => a.avgScore - b.avgScore)
      .slice(0, 6)
  }, [completedAssessments])

  const trendSeries = useMemo(() => {
    const summaryRows = Array.isArray(reportSummary.trendData) ? reportSummary.trendData : []
    if (summaryRows.length > 0) return summaryRows

    const monthMap = new Map()
    for (const item of completedAssessments) {
      const month = String(item.date || '').slice(0, 7) || 'Unknown'
      const bucket = monthMap.get(month) || { month, scores: [], completed: 0 }
      bucket.scores.push(Number(item.score) || 0)
      bucket.completed += 1
      monthMap.set(month, bucket)
    }
    return Array.from(monthMap.values())
      .sort((a, b) => String(a.month).localeCompare(String(b.month)))
      .map((row) => ({
        month: row.month,
        avgScore: Number((row.scores.reduce((sum, value) => sum + value, 0) / Math.max(row.scores.length, 1)).toFixed(1)),
        completed: row.completed,
      }))
  }, [completedAssessments, reportSummary.trendData])

  const chartBox = 'bg-gray-900 border border-gray-700 rounded-lg p-6 backdrop-blur-xl'

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-2">Manager intelligence view for team skills, risk, and readiness.</p>
      </motion.div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {statsCards.map(({ title, value, change, icon: Icon }, index) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
            whileHover={{ scale: 1.03 }}
            className={chartBox}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-gray-400 text-sm font-medium">{title}</p>
                <p className="text-3xl font-bold text-white mt-2">{value}</p>
              </div>
              <Icon className="w-10 h-10 text-white opacity-60" />
            </div>
            <p className="text-green-400 text-sm font-medium">{change} from baseline</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className={chartBox}>
          <h3 className="text-lg font-bold text-white mb-6">Skill Gap Analysis (Current vs Target)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={skillGapData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(107, 114, 128, 0.2)" />
              <XAxis dataKey="skill" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" />
              <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid rgba(107,114,128,0.3)', borderRadius: '8px' }} />
              <Legend />
              <Bar dataKey="current" fill="#ffffff" name="Current Level" />
              <Bar dataKey="target" fill="#60a5fa" name="Target Level" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className={chartBox}>
          <h3 className="text-lg font-bold text-white mb-6">Hiring Signal Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid rgba(107,114,128,0.3)', borderRadius: '8px' }} />
              <Pie data={hiringSignalData} dataKey="value" cx="50%" cy="50%" labelLine={false} label>
                {hiringSignalData.map((entry, index) => (
                  <Cell key={`signal-${entry.name}-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {hiringSignalData.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></span>
                  <span className="text-gray-400 text-sm">{item.name}</span>
                </div>
                <span className="text-white font-semibold">{item.value}</span>
              </div>
            ))}
            {hiringSignalData.length === 0 && <p className="text-sm text-gray-500">No completed interview signals yet.</p>}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={chartBox}>
          <h3 className="text-lg font-bold text-white mb-6">Top Domain Gap Severity</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={domainGapData} layout="vertical" margin={{ top: 10, right: 20, left: 30, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(107, 114, 128, 0.2)" />
              <XAxis type="number" stroke="#9ca3af" />
              <YAxis type="category" dataKey="domain" stroke="#9ca3af" width={130} fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid rgba(107,114,128,0.3)', borderRadius: '8px' }} />
              <Bar dataKey="gap" fill="#f59e0b" name="Avg Gap" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={chartBox}>
          <h3 className="text-lg font-bold text-white mb-6">Employee Risk Watchlist</h3>
          <div className="space-y-3">
            {employeeRiskData.map((item) => (
              <div key={item.employee} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-white font-semibold">{item.employee}</p>
                  <span className="inline-flex items-center gap-1 text-amber-300 text-xs">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {item.highGapCount} high-gap domain(s)
                  </span>
                </div>
                <p className="text-sm text-gray-400 mt-1">Average score: <span className="text-gray-200 font-medium">{item.avgScore}/5</span></p>
              </div>
            ))}
            {employeeRiskData.length === 0 && <p className="text-sm text-gray-500">No completed assessments yet for risk analysis.</p>}
          </div>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={chartBox}>
        <h3 className="text-lg font-bold text-white mb-6">Team Skill Trend (Monthly)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trendSeries} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(107, 114, 128, 0.2)" />
            <XAxis dataKey="month" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid rgba(107,114,128,0.3)', borderRadius: '8px' }} />
            <Legend />
            <Line type="monotone" dataKey="avgScore" stroke="#34d399" strokeWidth={2} name="Average Score" dot={{ r: 3 }} />
            <Line type="monotone" dataKey="completed" stroke="#60a5fa" strokeWidth={2} name="Completed Assessments" dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
        {loading && <p className="text-sm text-gray-500 mt-3">Loading dashboard analytics...</p>}
      </motion.div>
    </div>
  )
}

