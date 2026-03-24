import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Download, Share2, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react'
import { assessmentService } from '../../api/services/assessmentService'

const clampScore = (score) => {
  const parsed = Number(score || 0)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.min(5, parsed))
}

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

const buildPieStyle = (strengthCount, gapCount) => {
  const total = Math.max(strengthCount + gapCount, 1)
  const strengthPct = Math.round((strengthCount / total) * 100)
  const gapPct = 100 - strengthPct
  return {
    background: `conic-gradient(#10b981 0% ${strengthPct}%, #f59e0b ${strengthPct}% ${strengthPct + gapPct}%)`,
  }
}

export default function ShareReport() {
  const { token } = useParams()
  const [state, setState] = useState({ status: 'loading', message: '', data: null })
  const [shareState, setShareState] = useState('')

  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        const data = await assessmentService.getShared(token)
        if (!mounted) return
        setState({ status: 'ready', message: '', data })
      } catch (error) {
        if (!mounted) return
        setState({ status: 'error', message: error.message, data: null })
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [token])

  const report = state.data
  const score = clampScore(report?.score)
  const scorePct = Math.round((score / 5) * 100)
  const strengths = Array.isArray(report?.strengths) ? report.strengths : []
  const gaps = Array.isArray(report?.gaps) ? report.gaps : []
  const perDomain = Array.isArray(report?.perDomain) ? report.perDomain : []

  const scoreRing = useMemo(() => {
    const radius = 56
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (scorePct / 100) * circumference
    return { radius, circumference, offset }
  }, [scorePct])

  const handleShare = async () => {
    if (!report) return
    const shareUrl = window.location.href
    const title = `Interview Report: ${report.title}`
    const text = `Interview score: ${score.toFixed(1)}/5. Hiring signal: ${report.hiringSignal || 'Pending'}.`

    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: shareUrl })
        setShareState('Shared successfully.')
        return
      }
      await navigator.clipboard.writeText(shareUrl)
      setShareState('Share link copied to clipboard.')
    } catch {
      setShareState('Unable to share right now.')
    }
  }

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen bg-[#0b0f1a] text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-300">
          <Loader2 className="w-5 h-5 animate-spin" />
          <p>Loading shared report...</p>
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="min-h-screen bg-[#0b0f1a] text-white flex items-center justify-center p-6">
        <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-red-200 max-w-lg">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5" />
            <p>{state.message || 'Shared report not found.'}</p>
          </div>
          <Link to="/login/employee" className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm">
            Go to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-black/40 p-6 md:p-8">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-gray-300">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Shared Interview Report</span>
              </div>
              <h1 className="mt-3 text-2xl md:text-3xl font-semibold text-white">{report?.title || 'Interview Assessment'}</h1>
              <p className="mt-2 text-sm text-gray-400">Generated on {formatDate(report?.date)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await assessmentService.downloadSharedPdf(token, `shared-report-${report?.id || 'assessment'}`)
                    setShareState('PDF download started.')
                  } catch (error) {
                    setShareState(error.message || 'Unable to download PDF.')
                  }
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-white text-black px-4 py-2 text-sm font-semibold hover:bg-gray-200"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-black/40 px-4 py-2 text-sm text-gray-200 hover:bg-white/10"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
            </div>
          </div>
          {shareState && <p className="mt-3 text-xs text-emerald-300">{shareState}</p>}
        </motion.div>

        <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-6">
          <div className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Overall Score</p>
              <div className="mt-4 flex items-center justify-center">
                <div className="relative h-36 w-36">
                  <svg className="h-36 w-36 -rotate-90" viewBox="0 0 140 140">
                    <circle cx="70" cy="70" r={scoreRing.radius} stroke="#1f2937" strokeWidth="12" fill="none" />
                    <circle
                      cx="70"
                      cy="70"
                      r={scoreRing.radius}
                      stroke="#10b981"
                      strokeWidth="12"
                      fill="none"
                      strokeDasharray={scoreRing.circumference}
                      strokeDashoffset={scoreRing.offset}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-3xl font-semibold text-white">{score.toFixed(1)}</p>
                    <p className="text-xs text-gray-400">out of 5</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-300">Hiring Signal</p>
                <p className="mt-1 text-lg font-semibold text-white">{report?.hiringSignal || 'Pending'}</p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Strengths vs Gaps</p>
              <div className="mt-4 flex items-center gap-4">
                <div className="h-24 w-24 rounded-full" style={buildPieStyle(strengths.length, gaps.length)} />
                <div className="space-y-2 text-sm text-gray-300">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    <span>Strengths: {strengths.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    <span>Skill Gaps: {gaps.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold">Domain Performance</span>
              </div>
              <div className="mt-4 space-y-3">
                {(perDomain.length ? perDomain : [{ id: 'overall', title: report?.focusArea || 'Overall', score }]).map((domain) => {
                  const domainScore = clampScore(domain.score)
                  const percent = Math.round((domainScore / 5) * 100)
                  return (
                    <div key={domain.id || domain.title} className="rounded-2xl border border-white/10 bg-black/40 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-white font-semibold">{domain.title || 'General'}</p>
                        <p className="text-sm text-gray-300">{domainScore.toFixed(1)}/5</p>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-white/10">
                        <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
                <p className="text-sm font-semibold text-white">Strengths</p>
                <ul className="mt-3 space-y-2 text-sm text-gray-300">
                  {(strengths.length ? strengths : ['Clear communication', 'Structured thinking']).map((item) => (
                    <li key={item} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
                <p className="text-sm font-semibold text-white">Flaws to Improve</p>
                <ul className="mt-3 space-y-2 text-sm text-gray-300">
                  {(gaps.length ? gaps : ['Deepen architecture fundamentals', 'Sharpen SQL tuning']).map((item) => (
                    <li key={item} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
