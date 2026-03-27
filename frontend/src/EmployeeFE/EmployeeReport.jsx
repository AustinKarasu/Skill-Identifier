import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BarChart3, Download, Share2, ArrowLeft, AlertTriangle, Loader2, CheckCircle2, Mic, ScanFace, Eye, Activity, ShieldAlert } from 'lucide-react'
import { assessmentService } from '../api/services/assessmentService'

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

export default function EmployeeReport() {
  const { assessmentId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [state, setState] = useState({ status: 'loading', message: '', data: null })
  const [shareState, setShareState] = useState('')
  const [downloadState, setDownloadState] = useState('')

  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        const data = await assessmentService.getById(assessmentId)
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
  }, [assessmentId])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('print') === '1' && state.status === 'ready') {
      window.setTimeout(() => window.print(), 350)
    }
  }, [location.search, state.status])

  const report = state.data
  const score = clampScore(report?.score)
  const scorePct = Math.round((score / 5) * 100)
  const strengths = Array.isArray(report?.strengths) ? report.strengths : []
  const gaps = Array.isArray(report?.gaps) ? report.gaps : []
  const recommendations = Array.isArray(report?.recommendations) ? report.recommendations : []
  const perDomain = Array.isArray(report?.perDomain) ? report.perDomain : []
  const selectedSkills = Array.isArray(report?.selectedSkills) ? report.selectedSkills : []
  const behavioralSignals = report?.behavioralSignals && typeof report.behavioralSignals === 'object' ? report.behavioralSignals : {}
  const integritySignals = report?.integritySignals && typeof report.integritySignals === 'object' ? report.integritySignals : {}

  const scoreRing = useMemo(() => {
    const radius = 56
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (scorePct / 100) * circumference
    return { radius, circumference, offset }
  }, [scorePct])

  const handleShare = async () => {
    if (!report) return
    try {
      const sharePayload = await assessmentService.createShareLink(assessmentId)
      const token = sharePayload?.token
      if (!token) {
        setShareState('Unable to generate share link.')
        return
      }
      const shareUrl = `${window.location.origin}/share/${token}`
      const title = `Interview Report: ${report.title}`
      const text = `My interview score: ${score.toFixed(1)}/5. Hiring signal: ${report.hiringSignal || 'Pending'}.`

      if (navigator.share) {
        await navigator.share({ title, text, url: shareUrl })
        setShareState('Shared successfully.')
        return
      }
      await navigator.clipboard.writeText(shareUrl)
      setShareState('Report link copied to clipboard.')
    } catch (error) {
      setShareState(error.message || 'Unable to share right now.')
    }
  }

  if (state.status === 'loading') {
    return (
      <div className="rounded-3xl border border-white/10 bg-black/20 p-6 md:p-8">
        <div className="flex items-center gap-3 text-gray-300">
          <Loader2 className="w-5 h-5 animate-spin" />
          <p>Loading report...</p>
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 md:p-8 text-red-200">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5" />
          <p>{state.message || 'Unable to load report.'}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/employee/interview')}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-red-500/40 px-4 py-2 text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to interview
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-card { border: 1px solid #e2e8f0 !important; background: #ffffff !important; color: #0f172a !important; }
          .print-muted { color: #64748b !important; }
        }
      `}</style>

      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-black/30 p-6 md:p-8">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-gray-300">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Professional Interview Report</span>
            </div>
            <h1 className="mt-3 text-2xl md:text-3xl font-semibold text-white">{report?.title || 'Interview Assessment'}</h1>
            <p className="mt-2 text-sm md:text-base text-gray-400">Generated on {formatDate(report?.date)}</p>
          </div>
          <div className="no-print flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate('/employee/interview')}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-black/40 px-4 py-2 text-sm text-gray-200 hover:bg-white/10"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <button
              type="button"
              onClick={async () => {
                setDownloadState('Preparing PDF...')
                try {
                  await assessmentService.downloadPdf(assessmentId, `interview-report-${assessmentId}`)
                  setDownloadState('Download started.')
                } catch (error) {
                  setDownloadState(error.message)
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
              Share Results
            </button>
          </div>
        </div>
        {(shareState || downloadState) && (
          <p className="mt-3 text-xs text-emerald-300 no-print">{shareState || downloadState}</p>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-6">
        <div className="space-y-4">
          <div className="print-card rounded-3xl border border-white/10 bg-black/30 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500 print-muted">Overall Score</p>
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
                  <p className="text-xs text-gray-400 print-muted">out of 5</p>
                </div>
              </div>
            </div>
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-300">Hiring Signal</p>
              <p className="mt-1 text-lg font-semibold text-white">{report?.hiringSignal || 'Pending'}</p>
              <p className="mt-2 text-xs text-gray-500 print-muted">Confidence: {report?.confidence || 'Medium'}</p>
            </div>
          </div>

          <div className="print-card rounded-3xl border border-white/10 bg-black/30 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500 print-muted">Strengths vs Gaps</p>
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
                <p className="text-xs text-gray-500 print-muted">Focus areas are summarized from the AI evaluation.</p>
              </div>
            </div>
          </div>

          <div className="print-card rounded-3xl border border-white/10 bg-black/30 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500 print-muted">Key Stats</p>
            <div className="mt-3 space-y-3 text-sm text-gray-300">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 print-muted">Employee</span>
                <span>{report?.employee || 'Employee'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 print-muted">Duration</span>
                <span>{report?.duration || '-'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 print-muted">Interviewer</span>
                <span>{report?.interviewer || 'AI Interviewer'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 print-muted">Focus Area</span>
                <span>{report?.focusArea || '-'}</span>
              </div>
            </div>
          </div>

          <div className="print-card rounded-3xl border border-white/10 bg-black/30 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500 print-muted">Integrity Review</p>
            <div className="mt-3 space-y-2 text-sm text-gray-300">
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500 print-muted">Cheating Risk</span>
                <span className={integritySignals?.cheatingRisk === 'Low' ? 'text-emerald-300' : integritySignals?.cheatingRisk === 'Medium' ? 'text-amber-300' : 'text-red-300'}>
                  {integritySignals?.cheatingRisk || 'Pending'}
                </span>
              </div>
              <p className="text-xs text-gray-500 print-muted">{integritySignals?.summary || 'Interview integrity checks were not captured for this report.'}</p>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="print-card rounded-3xl border border-white/10 bg-black/30 p-5">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-white" />
              <h2 className="text-lg font-semibold text-white">Domain Performance</h2>
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
                    <p className="mt-2 text-xs text-gray-500 print-muted">Gap level: {domain.gapLevel || 'Balanced'}</p>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="print-card rounded-3xl border border-white/10 bg-black/30 p-5 lg:col-span-2">
              <p className="text-sm font-semibold text-white">Professional Interview Signals</p>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {[
                  { key: 'communication', label: 'Communication Skills', icon: Mic, payload: behavioralSignals?.communication },
                  { key: 'posture', label: 'Posture Confidence', icon: ScanFace, payload: behavioralSignals?.posture },
                  { key: 'eyeMovement', label: 'Eye Movement', icon: Eye, payload: behavioralSignals?.eyeMovement },
                  { key: 'movement', label: 'Movement Control', icon: Activity, payload: behavioralSignals?.movement },
                ].map((item) => {
                  const Icon = item.icon
                  const scoreValue = clampScore(item.payload?.score)
                  return (
                    <div key={item.key} className="rounded-2xl border border-white/10 bg-black/40 p-4">
                      <div className="flex items-center gap-2 text-gray-400">
                        <Icon className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-[0.14em]">{item.label}</span>
                      </div>
                      <p className="mt-3 text-2xl font-semibold text-white">{scoreValue.toFixed(1)}/5</p>
                      <p className="mt-1 text-sm text-gray-300">{item.payload?.confidence || item.payload?.label || 'Pending'}</p>
                      <p className="mt-2 text-xs text-gray-500 print-muted">{item.payload?.summary || 'No summary available.'}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="print-card rounded-3xl border border-white/10 bg-black/30 p-5">
              <p className="text-sm font-semibold text-white">Top Strengths</p>
              <ul className="mt-3 space-y-2 text-sm text-gray-300">
                {(strengths.length ? strengths : ['Consistent communication', 'Structured thinking']).map((item) => (
                  <li key={item} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="print-card rounded-3xl border border-white/10 bg-black/30 p-5">
              <p className="text-sm font-semibold text-white">Key Flaws</p>
              <ul className="mt-3 space-y-2 text-sm text-gray-300">
                {(gaps.length ? gaps : ['Needs deeper system design practice', 'Strengthen SQL optimization']).map((item) => (
                  <li key={item} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="print-card rounded-3xl border border-white/10 bg-black/30 p-5">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-white" />
              <p className="text-sm font-semibold text-white">Integrity Flags</p>
            </div>
            <div className="mt-3 space-y-2">
              {(Array.isArray(integritySignals?.flags) && integritySignals.flags.length ? integritySignals.flags : ['No major integrity flags were recorded.']).map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-black/40 p-3 text-sm text-gray-300">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="print-card rounded-3xl border border-white/10 bg-black/30 p-5">
            <p className="text-sm font-semibold text-white">Skills Highlight</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(selectedSkills.length ? selectedSkills : ['Communication', 'Problem Solving', 'Architecture']).map((skill) => (
                <span key={skill} className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-gray-200">
                  {skill}
                </span>
              ))}
            </div>
          </div>

          <div className="print-card rounded-3xl border border-white/10 bg-black/30 p-5">
            <p className="text-sm font-semibold text-white">Recommended Next Steps</p>
            <div className="mt-3 space-y-3">
              {(recommendations.length ? recommendations : ['Schedule focused mock interview', 'Review core system design patterns', 'Build a performance optimization plan']).map((item, index) => (
                <div key={`${item}-${index}`} className="rounded-2xl border border-white/10 bg-black/40 p-3 text-sm text-gray-300">
                  {typeof item === 'string' ? item : item.title || item.name || 'Recommendation'}
                  {item?.priority && <span className="ml-2 text-xs text-amber-300">Priority: {item.priority}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
