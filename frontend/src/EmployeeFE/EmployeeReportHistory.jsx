import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, Download, Share2, AlertTriangle, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { employeeJourneyService } from '../api/services/employeeJourneyService'
import { assessmentService } from '../api/services/assessmentService'

const clampScore = (score) => {
  const parsed = Number(score || 0)
  if (!Number.isFinite(parsed)) return '0.0'
  return Math.max(0, Math.min(5, parsed)).toFixed(1)
}

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

export default function EmployeeReportHistory() {
  const navigate = useNavigate()
  const [state, setState] = useState({ status: 'loading', message: '', data: [] })
  const [shareState, setShareState] = useState('')

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const results = await employeeJourneyService.getInterviewResults()
        if (!mounted) return
        setState({ status: 'ready', message: '', data: results })
      } catch (error) {
        if (!mounted) return
        setState({ status: 'error', message: error.message, data: [] })
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  if (state.status === 'loading') {
    return (
      <div className="rounded-3xl border border-white/10 bg-black/20 p-6 md:p-8">
        <div className="flex items-center gap-3 text-gray-300">
          <Loader2 className="w-5 h-5 animate-spin" />
          <p>Loading report history...</p>
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 md:p-8 text-red-200">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5" />
          <p>{state.message || 'Unable to load report history.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-semibold text-white">Report History</h1>
        <p className="mt-2 text-sm text-gray-400">Download, share, or review your past interview reports.</p>
        {shareState && <p className="mt-3 text-xs text-emerald-300">{shareState}</p>}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {state.data.map((report) => (
          <div key={report.id} className="rounded-3xl border border-white/10 bg-black/30 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">{formatDate(report.date)}</p>
                <h2 className="text-lg font-semibold text-white">{report.title || 'Interview Assessment'}</h2>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Score</p>
                <p className="text-2xl font-semibold text-white">{clampScore(report.score)}</p>
              </div>
            </div>
            <p className="text-sm text-gray-300">{report.summary}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigate(`/employee/report/${report.id}`)}
                className="inline-flex items-center gap-2 rounded-xl bg-white text-black px-3 py-2 text-xs font-semibold hover:bg-gray-200"
              >
                <BarChart3 className="w-4 h-4" />
                View Report
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await assessmentService.downloadPdf(report.id, `interview-report-${report.id}`)
                  } catch (error) {
                    setShareState(error.message || 'Unable to download report.')
                  }
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-gray-200 hover:bg-white/10"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const sharePayload = await assessmentService.createShareLink(report.id)
                    const token = sharePayload?.token
                    if (!token) {
                      setShareState('Unable to generate share link.')
                      return
                    }
                    const url = `${window.location.origin}/share/${token}`
                    await navigator.clipboard.writeText(url)
                    setShareState('Share link copied to clipboard.')
                  } catch (error) {
                    setShareState(error.message || 'Unable to share report.')
                  }
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-gray-200 hover:bg-white/10"
              >
                <Share2 className="w-4 h-4" />
                Share Link
              </button>
            </div>
          </div>
        ))}
        {state.data.length === 0 && (
          <div className="rounded-3xl border border-white/10 bg-black/30 p-8 text-center text-gray-400">
            No interview reports yet. Complete an interview to see your history.
          </div>
        )}
      </div>
    </div>
  )
}
