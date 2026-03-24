import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Download,
  Loader2,
  Mic,
  MicOff,
  Send,
  Share2,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { employeeJourneyService } from '../api/services/employeeJourneyService'
import { assessmentService } from '../api/services/assessmentService'
import { assessmentEngineService } from '../api/services/assessmentEngineService'
import { useAuth } from '../auth/useAuth'

const toDateTimeLabel = (isoString) => {
  if (!isoString) return '-'
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

const clampScore = (score) => {
  const parsed = Number(score || 0)
  if (!Number.isFinite(parsed)) return '0.0'
  return Math.max(0, Math.min(5, parsed)).toFixed(1)
}

export default function EmployeeInterview() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [journey, setJourney] = useState(null)
  const [sessionId, setSessionId] = useState('')
  const [messages, setMessages] = useState([])
  const [canComplete, setCanComplete] = useState(false)
  const [draft, setDraft] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [loadingSession, setLoadingSession] = useState(true)
  const [sending, setSending] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [startedAt] = useState(Date.now())
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(true)
  const [shareState, setShareState] = useState('')
  const [feedbackState, setFeedbackState] = useState({ rating: 5, clarity: 5, fairness: 5, comments: '' })
  const [feedbackSaved, setFeedbackSaved] = useState(false)

  const transcriptContainerRef = useRef(null)
  const recognitionRef = useRef(null)
  const spokenMessageRef = useRef('')

  const displayName = useMemo(() => {
    return journey?.profile?.fullName || user?.fullName || 'Employee Candidate'
  }, [journey?.profile?.fullName, user?.fullName])

  useEffect(() => {
    let mounted = true
    const boot = async () => {
      try {
        setLoadingSession(true)
        setError('')
        const [journeyData, session] = await Promise.all([
          employeeJourneyService.getJourney(),
          employeeJourneyService.startInterviewSession(),
        ])
        if (!mounted) return
        const initialMessages = Array.isArray(session.messages) ? session.messages : []
        if (initialMessages.length === 0) {
          const retrySession = await employeeJourneyService.startInterviewSession()
          if (!mounted) return
          const retryMessages = Array.isArray(retrySession.messages) ? retrySession.messages : []
          setSessionId(retrySession.sessionId || '')
          setMessages(retryMessages)
          setCanComplete(Boolean(retrySession.canComplete))
          setJourney(journeyData)
          if (retryMessages.length === 0) {
            setError('Interview session opened but no prompt was returned. Refresh once and try again.')
          }
          return
        }
        setJourney(journeyData)
        setSessionId(session.sessionId || '')
        setMessages(initialMessages)
        setCanComplete(Boolean(session.canComplete))
      } catch (err) {
        if (!mounted) return
        setError(err?.message || 'Unable to start interview right now.')
      } finally {
        if (mounted) setLoadingSession(false)
      }
    }

    boot()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const container = transcriptContainerRef.current
    if (!container) return
    container.scrollTop = container.scrollHeight
  }, [messages, interimTranscript])

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSpeechSupported(false)
      return
    }
    setSpeechSupported(true)
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      setIsListening(true)
      setError('')
    }
    recognition.onerror = (event) => {
      setError(`Speech recognition issue: ${event?.error || 'unknown error'}`)
      setIsListening(false)
    }
    recognition.onend = () => {
      setIsListening(false)
    }
    recognition.onresult = (event) => {
      let finalText = ''
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const chunk = String(event.results[i][0]?.transcript || '').trim()
        if (!chunk) continue
        if (event.results[i].isFinal) finalText += `${chunk} `
        else interim += `${chunk} `
      }
      if (finalText.trim()) {
        setDraft((prev) => `${prev}${prev ? ' ' : ''}${finalText.trim()}`)
      }
      setInterimTranscript(interim.trim())
    }

    recognitionRef.current = recognition
    return () => {
      recognition.stop()
      recognitionRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!voiceOutputEnabled) return
    const lastAssistant = [...messages].reverse().find((item) => item.role === 'assistant')
    const text = String(lastAssistant?.text || '').trim()
    if (!text || text === spokenMessageRef.current) return
    if (!('speechSynthesis' in window)) return

    spokenMessageRef.current = text
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1
    utterance.pitch = 1
    utterance.volume = 1
    window.speechSynthesis.speak(utterance)
  }, [messages, voiceOutputEnabled])

  const currentDraft = `${draft}${interimTranscript ? `${draft ? ' ' : ''}${interimTranscript}` : ''}`.trim()
  const lastAssistantText = [...messages].reverse().find((item) => item.role === 'assistant')?.text || ''

  const toggleListening = () => {
    if (!speechSupported || !recognitionRef.current || sending || finishing) return
    if (isListening) recognitionRef.current.stop()
    else recognitionRef.current.start()
  }

  const replayLastPrompt = () => {
    if (!('speechSynthesis' in window) || !lastAssistantText) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(lastAssistantText)
    utterance.rate = 1
    utterance.pitch = 1
    utterance.volume = 1
    window.speechSynthesis.speak(utterance)
  }

  const handleSend = async () => {
    const message = currentDraft
    if (!message || !sessionId || sending || finishing) return
    if (isListening && recognitionRef.current) recognitionRef.current.stop()

    try {
      setSending(true)
      setError('')
      setDraft('')
      setInterimTranscript('')
      const response = await employeeJourneyService.sendInterviewMessage({ sessionId, message })
      setMessages(Array.isArray(response.messages) ? response.messages : [])
      setCanComplete(Boolean(response.canComplete))
    } catch (err) {
      setError(err?.message || 'Unable to send this answer.')
    } finally {
      setSending(false)
    }
  }

  const handleFinish = async () => {
    if (!sessionId || finishing) return
    try {
      setFinishing(true)
      setError('')
      const durationMinutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000))
      const completed = await employeeJourneyService.saveInterviewResult({
        answers: [],
        durationMinutes,
        sessionId,
      })
      setResult(completed)
    } catch (err) {
      setError(err?.message || 'Unable to generate result report right now.')
    } finally {
      setFinishing(false)
    }
  }

  const handleShare = async (reportId) => {
    if (!reportId) return
    try {
      const sharePayload = await assessmentService.createShareLink(reportId)
      const token = sharePayload?.token
      if (!token) {
        setShareState('Unable to generate share link.')
        return
      }
      const shareUrl = `${window.location.origin}/share/${token}`
      const title = 'Employee Interview Report'
      const text = 'View my interview results report.'

      if (navigator.share) {
        await navigator.share({ title, text, url: shareUrl })
        setShareState('Shared successfully.')
        return
      }
      await navigator.clipboard.writeText(shareUrl)
      setShareState('Report link copied to clipboard.')
    } catch {
      setShareState('Unable to share right now.')
    }
  }

  if (loadingSession) {
    return (
      <div className="rounded-3xl border border-white/10 bg-black/20 p-6 md:p-8">
        <div className="flex items-center gap-3 text-gray-300">
          <Loader2 className="w-5 h-5 animate-spin" />
          <p>Preparing your AI interview session...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-black/20 p-5 md:p-7">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-gray-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Interview Session</span>
            </div>
            <h1 className="mt-3 text-2xl md:text-3xl font-semibold text-white">{displayName} Interview</h1>
            <p className="mt-2 text-sm md:text-base text-gray-400">
              Answer naturally with project evidence, tradeoffs, and outcomes. Voice input and realtime transcript are enabled.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4 min-w-[220px]">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Session ID</p>
            <p className="mt-2 text-sm text-gray-200 break-all">{sessionId || '-'}</p>
            <p className="mt-2 text-xs text-gray-500">Resume: {journey?.resume?.fileName || 'Not attached'}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {!result ? (
        <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)] gap-4">
          <div className="rounded-3xl border border-white/10 bg-black/20 p-4 md:p-5 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Interview Status</p>
              <p className="mt-2 text-lg font-semibold text-white">{canComplete ? 'Ready to Finish' : 'In Progress'}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-gray-300">
              <p>Domains: {(journey?.domains || []).join(', ') || 'Not selected'}</p>
              <p className="mt-2">Skills selected: {journey?.skills?.length || 0}</p>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={toggleListening}
                disabled={!speechSupported || sending || finishing}
                className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                  isListening
                    ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                    : 'bg-white/10 text-white border border-white/15 hover:bg-white/20'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>{isListening ? 'Stop Listening' : 'Start Voice Input'}</span>
              </button>
              <button
                type="button"
                onClick={replayLastPrompt}
                disabled={!lastAssistantText}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold border border-white/15 bg-black/30 text-gray-300 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Volume2 className="w-4 h-4" />
                <span>Replay Last Question</span>
              </button>
              <button
                type="button"
                onClick={() => setVoiceOutputEnabled((prev) => !prev)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm border border-white/10 text-gray-400 hover:bg-white/5"
              >
                {voiceOutputEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                <span>{voiceOutputEnabled ? 'Voice Output On' : 'Voice Output Off'}</span>
              </button>
            </div>
            {!speechSupported && <p className="text-xs text-amber-300">Speech recognition is not supported in this browser.</p>}
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/20 p-3 md:p-4 flex flex-col gap-3">
            <div
              ref={transcriptContainerRef}
              className="h-[52vh] md:h-[58vh] overflow-y-auto rounded-2xl border border-white/10 bg-black/30 p-3 md:p-4 space-y-3"
            >
              {messages.length === 0 && <p className="text-sm text-gray-500">Waiting for the interviewer prompt...</p>}
              {messages.map((message) => {
                const fromUser = message.role === 'user'
                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`max-w-[92%] rounded-2xl px-3 py-2.5 md:px-4 md:py-3 border ${
                      fromUser
                        ? 'ml-auto border-blue-400/30 bg-blue-500/10'
                        : 'border-white/15 bg-gray-900/90'
                    }`}
                  >
                    <p className="text-xs uppercase tracking-[0.14em] text-gray-500">
                      {fromUser ? 'You' : 'AI Interviewer'}
                    </p>
                    <p className="mt-1 text-sm md:text-base text-gray-100 whitespace-pre-wrap break-words">{message.text}</p>
                    <p className="mt-2 text-[11px] text-gray-500">{toDateTimeLabel(message.createdAt)}</p>
                  </motion.div>
                )
              })}
              {isListening && interimTranscript && (
                <div className="max-w-[92%] ml-auto rounded-2xl px-4 py-3 border border-amber-400/30 bg-amber-500/10">
                  <p className="text-xs uppercase tracking-[0.14em] text-amber-300">Live Transcript</p>
                  <p className="mt-1 text-sm text-amber-100 break-words">{interimTranscript}</p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Answer with implementation details, tradeoffs, and measurable outcomes..."
                rows={4}
                className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm md:text-base text-white placeholder:text-gray-500 focus:outline-none focus:border-white/30"
              />
              <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                <p className="text-xs text-gray-500">Press Enter to send. Shift+Enter for a new line.</p>
                <div className="flex items-center gap-2">
                  {canComplete && (
                    <button
                      type="button"
                      onClick={handleFinish}
                      disabled={finishing || sending}
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      {finishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      <span>{finishing ? 'Finishing...' : 'Finish Interview'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!currentDraft || sending || finishing}
                    className="inline-flex items-center gap-2 rounded-xl bg-white text-black px-3.5 py-2 text-sm font-semibold hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    <span>{sending ? 'Sending...' : 'Send'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-3xl border border-emerald-500/25 bg-emerald-500/10 p-5">
            <p className="text-sm uppercase tracking-[0.18em] text-emerald-300">Interview Completed</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">AI assessment result is ready</h2>
            <p className="mt-3 text-gray-300">{result.summary}</p>
            {result?.id && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/employee/report/${result.id}`)}
                  className="inline-flex items-center gap-2 rounded-xl bg-white text-black px-4 py-2 text-sm font-semibold hover:bg-gray-200"
                >
                  <BarChart3 className="w-4 h-4" />
                  View Report
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setShareState('')
                    try {
                      await assessmentService.downloadPdf(result.id, `interview-report-${result.id}`)
                    } catch (error) {
                      setShareState(error.message || 'Unable to download report.')
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-black/40 px-4 py-2 text-sm text-gray-200 hover:bg-white/10"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => handleShare(result.id)}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-black/40 px-4 py-2 text-sm text-gray-200 hover:bg-white/10"
                >
                  <Share2 className="w-4 h-4" />
                  Share Results
                </button>
              </div>
            )}
            {shareState && <p className="mt-3 text-xs text-emerald-200">{shareState}</p>}
          </div>

          {result?.id && (
            <div className="rounded-3xl border border-white/10 bg-black/20 p-5 space-y-4">
              <h3 className="text-lg font-semibold text-white">Quick Feedback</h3>
              <p className="text-sm text-gray-400">Help us improve the interview experience.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { key: 'rating', label: 'Overall Experience' },
                  { key: 'clarity', label: 'Question Clarity' },
                  { key: 'fairness', label: 'Fairness' },
                ].map((item) => (
                  <label key={item.key} className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-gray-300">
                    <span className="block text-xs uppercase tracking-[0.16em] text-gray-500">{item.label}</span>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={feedbackState[item.key]}
                      onChange={(e) => setFeedbackState((prev) => ({ ...prev, [item.key]: Number(e.target.value) }))}
                      className="mt-3 w-full"
                    />
                    <p className="mt-2 text-white font-semibold">{feedbackState[item.key]}/5</p>
                  </label>
                ))}
              </div>
              <textarea
                value={feedbackState.comments}
                onChange={(e) => setFeedbackState((prev) => ({ ...prev, comments: e.target.value }))}
                rows={3}
                placeholder="Optional feedback..."
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    await assessmentEngineService.submitFeedback({
                      assessmentId: result.id,
                      responses: feedbackState,
                    })
                    setFeedbackSaved(true)
                  } catch (error) {
                    setShareState(error.message || 'Unable to save feedback.')
                  }
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-white text-black px-4 py-2 text-sm font-semibold"
              >
                <CheckCircle2 className="w-4 h-4" />
                {feedbackSaved ? 'Feedback Saved' : 'Submit Feedback'}
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-gray-500">Overall Score</p>
              <p className="mt-2 text-3xl font-semibold text-white">{clampScore(result.score)}/5</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-gray-500">Hiring Signal</p>
              <p className="mt-2 text-xl font-semibold text-white">{result.hiringSignal || '-'}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-gray-500">Confidence</p>
              <p className="mt-2 text-xl font-semibold text-white">{result.confidence || '-'}</p>
            </div>
          </div>

          {Array.isArray(result.perDomain) && result.perDomain.length > 0 && (
            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-white" />
                <h3 className="font-semibold text-white">Domain Breakdown</h3>
              </div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {result.perDomain.map((domain) => (
                  <div key={domain.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-white font-semibold">{domain.title}</p>
                      <p className="text-gray-300">{clampScore(domain.score)}/5</p>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">Gap level: {domain.gapLevel}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
