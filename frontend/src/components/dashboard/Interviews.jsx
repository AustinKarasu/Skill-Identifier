import { motion } from 'framer-motion'
import { BrainCircuit, Clock3, Search, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { assessmentService } from '../../api/services/assessmentService'

const RETENTION_OPTIONS = [
  { value: '24h', label: '24h' },
  { value: '48h', label: '48hr' },
  { value: '1week', label: '1 week' },
  { value: '1month', label: '1 month' },
  { value: '3month', label: '3 months' },
]

export default function Interviews() {
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [retentionEnabled, setRetentionEnabled] = useState(false)
  const [retentionWindow, setRetentionWindow] = useState('1month')
  const [savingRetention, setSavingRetention] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const loadRows = useCallback(async () => {
    const data = await assessmentService.list()
    const interviews = data
      .filter((item) => (item.source === 'employee-interview' || item.answers?.length) && item.employeeId)
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    setRows(interviews)
    if (!selectedId && interviews[0]?.id) {
      setSelectedId(interviews[0].id)
    }
  }, [selectedId])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const [retention] = await Promise.all([assessmentService.getInterviewRetention()])
        if (!mounted) return
        setRetentionEnabled(Boolean(retention.enabled))
        setRetentionWindow(retention.window || '1month')
        await loadRows()
      } catch (loadError) {
        if (!mounted) return
        setError(loadError.message)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [loadRows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((item) => {
      const name = String(item.employee || '').toLowerCase()
      const domains = String((item.perDomain || []).map((d) => d.title).join(' ')).toLowerCase()
      const skills = String((item.selectedSkills || []).join(' ')).toLowerCase()
      const answers = String((item.answers || []).map((answer) => answer.answer || '').join(' ')).toLowerCase()
      return name.includes(q) || domains.includes(q) || skills.includes(q) || answers.includes(q)
    })
  }, [rows, search])

  const selected = filtered.find((item) => item.id === selectedId) || filtered[0] || null
  const profile = selected?.profile || {}

  const handleDelete = async () => {
    if (!selected?.id || deleting) return
    setDeleting(true)
    setError('')
    setStatus('')
    try {
      await assessmentService.deleteAssessment(selected.id)
      window.location.reload()
    } catch (deleteError) {
      setError(deleteError.message)
    } finally {
      setDeleting(false)
    }
  }

  const handleSaveRetention = async () => {
    setSavingRetention(true)
    setError('')
    setStatus('')
    try {
      const response = await assessmentService.updateInterviewRetention({
        enabled: retentionEnabled,
        window: retentionWindow,
      })
      await loadRows()
      setStatus(
        response.deletedLogs
          ? `Auto-delete saved. ${response.deletedLogs} old interview log(s) removed.`
          : 'Auto-delete policy saved.'
      )
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSavingRetention(false)
    }
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl font-bold text-white">Interview</h1>
        <p className="text-gray-400 mt-2">Manager workspace for interview logs, answers, score signals, and profile review.</p>
      </motion.div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
      {status && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{status}</div>}

      <div className="rounded-xl border border-gray-700 bg-gray-900 p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Auto delete interview logs</p>
            <p className="text-sm text-gray-400 mt-1">Automatically remove old interview records by selected retention window.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={retentionEnabled}
                onChange={(event) => setRetentionEnabled(event.target.checked)}
                className="rounded border-gray-600 bg-gray-800 text-white"
              />
              <span>Enable</span>
            </label>
            <select
              value={retentionWindow}
              onChange={(event) => setRetentionWindow(event.target.value)}
              disabled={!retentionEnabled}
              className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              {RETENTION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleSaveRetention}
              disabled={savingRetention}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-60"
            >
              <Clock3 className="w-4 h-4" />
              <span>{savingRetention ? 'Saving...' : 'Save Policy'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-[360px_1fr] gap-6">
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search interview, skill, answer..."
              className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-gray-600"
            />
          </div>

          <div className="max-h-[72vh] overflow-y-auto space-y-2">
            {filtered.map((item) => {
              const active = selected?.id === item.id
              const chatName = `${item.employee || 'Employee'} Interview`
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${
                    active ? 'bg-white text-black border-white' : 'bg-gray-800 border-gray-700 text-gray-100 hover:border-gray-600'
                  }`}
                >
                  <p className={`font-semibold ${active ? 'text-black' : 'text-white'}`}>{chatName}</p>
                  <p className={`text-xs mt-1 ${active ? 'text-gray-700' : 'text-gray-500'}`}>
                    {item.date ? new Date(item.date).toLocaleString() : 'No date'}
                  </p>
                  <p className={`text-xs mt-2 ${active ? 'text-gray-700' : 'text-gray-400'}`}>
                    Score: {item.score}/5 | {item.hiringSignal || 'Pending'}
                  </p>
                </button>
              )
            })}
            {filtered.length === 0 && <p className="text-sm text-gray-400">No interview records match your search.</p>}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 space-y-5">
          {!selected ? (
            <p className="text-gray-400">Select an interview to review details.</p>
          ) : (
            <>
              <div className="rounded-2xl border border-gray-700 bg-black/20 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Chat name</p>
                    <h2 className="text-2xl font-semibold text-white mt-2">{`${selected.employee || 'Employee'} Interview`}</h2>
                    <p className="text-sm text-gray-400 mt-1">{profile.role || 'Role not set'} · {profile.department || 'Department not set'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="rounded-xl border border-gray-700 bg-gray-900 p-3 min-w-[120px]">
                      <p className="text-xs text-gray-500 uppercase tracking-[0.2em]">Overall</p>
                      <p className="text-2xl font-semibold text-white mt-1">{selected.score}/5</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 text-red-300 px-3 py-2 hover:bg-red-500/10 disabled:opacity-60"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>{deleting ? 'Deleting...' : 'Delete Log'}</span>
                    </button>
                  </div>
                </div>
                <p className="text-gray-300 text-sm mt-4">{selected.summary}</p>
              </div>

              <div className="rounded-xl border border-gray-700 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-gray-300">
                  <BrainCircuit className="w-4 h-4" />
                  <p className="font-semibold text-white">Employee full profile</p>
                </div>
                <div className="mt-4 flex items-start gap-4">
                  <div className="w-16 h-16 rounded-xl border border-gray-700 bg-gray-800 overflow-hidden flex items-center justify-center">
                    {profile.photoData ? (
                      <img src={profile.photoData} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm text-gray-400">
                        {String(selected.employee || 'EM')
                          .split(' ')
                          .map((part) => part[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="grid md:grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-300">
                    <p><span className="text-gray-500">Name:</span> {selected.employee || 'Not set'}</p>
                    <p><span className="text-gray-500">Email:</span> {profile.email || 'Not set'}</p>
                    <p><span className="text-gray-500">Employee ID:</span> {profile.employeeId || selected.employeeId || 'Not set'}</p>
                    <p><span className="text-gray-500">Role:</span> {profile.role || 'Not set'}</p>
                    <p><span className="text-gray-500">Department:</span> {profile.department || 'Not set'}</p>
                    <p><span className="text-gray-500">Experience:</span> {profile.yearsExperience ? `${profile.yearsExperience} years` : 'Not set'}</p>
                    <p><span className="text-gray-500">Location:</span> {profile.location || 'Not set'}</p>
                    <p><span className="text-gray-500">Portfolio:</span> {profile.portfolioUrl || 'Not set'}</p>
                    <p><span className="text-gray-500">GitHub:</span> {profile.githubUrl || 'Not set'}</p>
                    <p><span className="text-gray-500">LinkedIn:</span> {profile.linkedinUrl || 'Not set'}</p>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-gray-700 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Selected domains</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(selected.perDomain || []).map((item) => (
                      <span key={item.id} className="px-3 py-1.5 rounded-full text-xs border border-gray-700 bg-gray-900 text-gray-200">
                        {item.title} ({item.score}/5)
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-gray-700 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Skills / gaps</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(selected.selectedSkills || []).slice(0, 12).map((skill) => (
                      <span key={skill} className="px-3 py-1.5 rounded-full text-xs border border-gray-700 bg-gray-900 text-gray-200">
                        {skill}
                      </span>
                    ))}
                    {(selected.gaps || []).slice(0, 4).map((gap) => (
                      <span key={gap} className="px-3 py-1.5 rounded-full text-xs border border-red-500/30 bg-red-500/10 text-red-300">
                        {gap}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-700 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-gray-300">
                  <BrainCircuit className="w-4 h-4" />
                  <p className="font-semibold text-white">Interview answers</p>
                </div>
                <div className="mt-4 space-y-3 max-h-[42vh] overflow-y-auto pr-1">
                  {(selected.answers || []).map((answer, index) => (
                    <div key={`${answer.questionId || index}-${index}`} className="rounded-lg border border-gray-700 bg-gray-900/60 p-3">
                      <p className="text-sm text-gray-200 font-medium">{answer.question || 'Interview question'}</p>
                      <p className="text-sm text-gray-400 mt-2 whitespace-pre-wrap break-all">{answer.answer || 'No answer captured.'}</p>
                    </div>
                  ))}
                  {(!selected.answers || selected.answers.length === 0) && (
                    <p className="text-sm text-gray-400">No answers captured for this interview record.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
