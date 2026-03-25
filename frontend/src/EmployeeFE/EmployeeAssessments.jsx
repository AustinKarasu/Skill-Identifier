import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ClipboardList, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { assessmentEngineService } from '../api/services/assessmentEngineService'

export default function EmployeeAssessments() {
  const [templates, setTemplates] = useState([])
  const [active, setActive] = useState(null)
  const [attempt, setAttempt] = useState(null)
  const [answers, setAnswers] = useState([])
  const [state, setState] = useState({ status: 'loading', message: '' })
  const [result, setResult] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await assessmentEngineService.listEmployeeAssessments()
        setTemplates(data)
        setState({ status: 'ready', message: '' })
      } catch (error) {
        setState({ status: 'error', message: error.message })
      }
    }
    load()
  }, [])

  const startAssessment = async (template) => {
    setState({ status: 'loading', message: '' })
    try {
      const response = await assessmentEngineService.startEmployeeAssessment(template.id)
      setActive(response.template)
      setAttempt(response.attempt)
      setAnswers((response.template.questions || []).map((q) => ({ id: q.id, answer: q.type === 'mcq' ? 0 : '' })))
      setResult(null)
      setState({ status: 'ready', message: '' })
    } catch (error) {
      setState({ status: 'error', message: error.message })
    }
  }

  const submitAssessment = async () => {
    if (!attempt) return
    setState({ status: 'loading', message: '' })
    try {
      const response = await assessmentEngineService.submitEmployeeAssessment(attempt.id, answers)
      setResult(response.attempt)
      setState({ status: 'ready', message: '' })
    } catch (error) {
      setState({ status: 'error', message: error.message })
    }
  }

  if (state.status === 'loading') {
    return (
      <div className="rounded-3xl border border-white/10 bg-black/20 p-6 md:p-8">
        <div className="flex items-center gap-3 text-gray-300">
          <Loader2 className="w-5 h-5 animate-spin" />
          <p>Loading assessment...</p>
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 md:p-8 text-red-200">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5" />
          <p>{state.message}</p>
        </div>
      </div>
    )
  }

  if (active && attempt) {
    return (
      <div className="space-y-5">
        <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
          <div className="flex items-center gap-2 text-gray-300">
            <ClipboardList className="w-4 h-4" />
            <p className="font-semibold">{active.title}</p>
          </div>
          <p className="mt-2 text-sm text-gray-400">{active.description}</p>
        </div>

        <div className="space-y-4">
          {(active.questions || []).map((question, index) => (
            <div key={question.id} className="rounded-3xl border border-white/10 bg-black/30 p-5 space-y-3">
              <p className="text-sm text-gray-500">Question {index + 1}</p>
              <p className="text-base text-white">{question.prompt}</p>
              {question.type === 'mcq' ? (
                <div className="space-y-2">
                  {(question.options || []).map((opt, optIndex) => (
                    <label key={optIndex} className="flex items-center gap-2 text-sm text-gray-200">
                      <input
                        type="radio"
                        name={`q-${question.id}`}
                        checked={answers[index]?.answer === optIndex}
                        onChange={() => {
                          const next = [...answers]
                          next[index] = { id: question.id, answer: optIndex }
                          setAnswers(next)
                        }}
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <textarea
                  value={answers[index]?.answer || ''}
                  onChange={(e) => {
                    const next = [...answers]
                    next[index] = { id: question.id, answer: e.target.value }
                    setAnswers(next)
                  }}
                  rows={4}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                />
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={submitAssessment}
          className="inline-flex items-center gap-2 rounded-xl bg-white text-black px-4 py-2 text-sm font-semibold"
        >
          <CheckCircle2 className="w-4 h-4" />
          Submit Assessment
        </button>

        {result && (
          <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-emerald-200">
            Assessment submitted successfully.
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-semibold text-white">Skills Assessments</h1>
        <p className="mt-2 text-sm text-gray-400">Complete structured assessments to validate your competencies.</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((template) => (
          <div key={template.id} className="rounded-3xl border border-white/10 bg-black/30 p-5">
            <h2 className="text-lg font-semibold text-white">{template.title}</h2>
            <p className="mt-2 text-sm text-gray-400">{template.description}</p>
            <p className="mt-2 text-xs text-gray-500">Questions: {template.questions?.length || 0}</p>
            <button
              type="button"
              onClick={() => startAssessment(template)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white text-black px-4 py-2 text-sm font-semibold"
            >
              Start Assessment
            </button>
          </div>
        ))}
        {templates.length === 0 && (
          <div className="rounded-3xl border border-white/10 bg-black/30 p-8 text-center text-gray-400">
            No assessments available yet.
          </div>
        )}
      </div>
    </div>
  )
}
