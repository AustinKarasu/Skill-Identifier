import { motion } from 'framer-motion'
import { CalendarDays, Download, ExternalLink, Mail, MessageCircle, PencilLine, RotateCcw, Save, Search, Send, Sparkles, UserRound, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { managerOpsService } from '../../api/services/managerOpsService'

const toneClasses = {
  strong: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  steady: 'border-blue-500/30 bg-blue-500/10 text-blue-200',
  watch: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
}

const formatDateTime = (value) => {
  if (!value) return 'Not available'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

const buildDefaultScheduleInput = () => {
  const next = new Date()
  next.setDate(next.getDate() + 1)
  next.setHours(11, 0, 0, 0)
  const local = new Date(next.getTime() - next.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

const buildComposeDefaults = (candidate, channel) => ({
  subject: channel === 'email' ? candidate?.templates?.emailSubject || '' : '',
  message: channel === 'email' ? candidate?.templates?.emailBody || '' : candidate?.templates?.whatsappBody || '',
  recipient: candidate?.contact?.email || '',
  phoneNumber: candidate?.contact?.phone || '',
  countryCode: '',
})

const buildEditDefaults = (candidate) => ({
  fullName: candidate?.candidateName || '',
  email: candidate?.contact?.email || '',
  role: candidate?.role || '',
  department: candidate?.department || '',
  location: candidate?.contact?.location || '',
  yearsExperience: candidate?.profile?.yearsExperience || '',
  phone: candidate?.contact?.phone || '',
  portfolioUrl: candidate?.profile?.portfolioUrl || '',
  githubUrl: candidate?.profile?.githubUrl || '',
  linkedinUrl: candidate?.profile?.linkedinUrl || '',
})

export default function ManagerOps() {
  const [data, setData] = useState({ summary: {}, candidates: [], storage: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [composeChannel, setComposeChannel] = useState('email')
  const [compose, setCompose] = useState(buildComposeDefaults(null, 'email'))
  const [scheduleForm, setScheduleForm] = useState({
    title: '',
    startAt: buildDefaultScheduleInput(),
    durationMinutes: 45,
    meetingMode: 'Virtual',
    location: '',
    notes: '',
    sendEmail: true,
    sendWhatsApp: false,
    phoneNumber: '',
    countryCode: '',
  })
  const [sending, setSending] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [enhancing, setEnhancing] = useState(false)
  const [lastEnhancerSource, setLastEnhancerSource] = useState('')
  const [editing, setEditing] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [editForm, setEditForm] = useState(buildEditDefaults(null))

  const loadWorkbench = async () => {
    setLoading(true)
    try {
      const response = await managerOpsService.getWorkbench()
      setData(response)
      setSelectedId((current) => current || response.candidates?.[0]?.employeeId || '')
      setError('')
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWorkbench()
  }, [])

  const filteredCandidates = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return data.candidates || []
    return (data.candidates || []).filter((candidate) => {
      const bag = [
        candidate.candidateName,
        candidate.role,
        candidate.department,
        candidate.contact?.email,
      ]
        .join(' ')
        .toLowerCase()
      return bag.includes(query)
    })
  }, [data.candidates, search])

  const selectedCandidate = useMemo(
    () =>
      (data.candidates || []).find((candidate) => candidate.employeeId === selectedId) ||
      filteredCandidates[0] ||
      data.candidates?.[0] ||
      null,
    [data.candidates, filteredCandidates, selectedId]
  )

  useEffect(() => {
    if (!selectedCandidate) return
    setCompose(buildComposeDefaults(selectedCandidate, composeChannel))
    setScheduleForm({
      title: selectedCandidate.scheduleTemplateTitle || `${selectedCandidate.role || 'Role'} manager interview`,
      startAt: buildDefaultScheduleInput(),
      durationMinutes: 45,
      meetingMode: 'Virtual',
      location: '',
      notes: selectedCandidate.whyThisCandidate?.nextSteps?.[0] || '',
      sendEmail: true,
      sendWhatsApp: false,
      phoneNumber: selectedCandidate.contact?.phone || '',
      countryCode: '',
    })
    setEditForm(buildEditDefaults(selectedCandidate))
  }, [selectedCandidate])

  useEffect(() => {
    if (!selectedCandidate) return
    setCompose(buildComposeDefaults(selectedCandidate, composeChannel))
    setLastEnhancerSource('')
  }, [composeChannel, selectedCandidate])

  const handleSendCommunication = async () => {
    if (!selectedCandidate || sending) return
    setSending(true)
    setError('')
    setStatus('')
    try {
      const response = await managerOpsService.sendCommunication({
        employeeId: selectedCandidate.employeeId,
        channel: composeChannel,
        subject: compose.subject,
        message: compose.message,
        recipient: compose.recipient,
        phoneNumber: compose.phoneNumber,
        countryCode: compose.countryCode,
      })
      await loadWorkbench()
      setStatus(composeChannel === 'whatsapp' ? 'WhatsApp message opened and saved to backend history.' : 'Email communication saved.')
      if (response.communication?.launchUrl) {
        window.open(response.communication.launchUrl, '_blank', 'noopener,noreferrer')
      }
    } catch (sendError) {
      setError(sendError.message)
    } finally {
      setSending(false)
    }
  }

  const handleScheduleInterview = async () => {
    if (!selectedCandidate || scheduling) return
    setScheduling(true)
    setError('')
    setStatus('')
    try {
      const response = await managerOpsService.scheduleInterview({
        employeeId: selectedCandidate.employeeId,
        title: scheduleForm.title,
        startAt: new Date(scheduleForm.startAt).toISOString(),
        durationMinutes: Number(scheduleForm.durationMinutes || 45),
        meetingMode: scheduleForm.meetingMode,
        location: scheduleForm.location,
        notes: scheduleForm.notes,
        sendEmail: scheduleForm.sendEmail,
        sendWhatsApp: scheduleForm.sendWhatsApp,
        phoneNumber: scheduleForm.phoneNumber,
        countryCode: scheduleForm.countryCode,
      })
      await loadWorkbench()
      setStatus('Interview scheduled successfully.')
      if (response.whatsAppLaunchUrl) {
        window.open(response.whatsAppLaunchUrl, '_blank', 'noopener,noreferrer')
      }
    } catch (scheduleError) {
      setError(scheduleError.message)
    } finally {
      setScheduling(false)
    }
  }

  const handleEnhanceCommunication = async () => {
    if (!selectedCandidate || enhancing) return
    setEnhancing(true)
    setError('')
    setStatus('')
    try {
      const response = await managerOpsService.enhanceCommunication({
        employeeId: selectedCandidate.employeeId,
        channel: composeChannel,
        subject: compose.subject,
        message: compose.message,
      })
      const enhanced = response.enhanced || {}
      setCompose((current) => ({
        ...current,
        subject: composeChannel === 'email' ? enhanced.subject || current.subject : '',
        message: enhanced.message || current.message,
      }))
      setLastEnhancerSource(enhanced.provider || 'builtin')
      if ((enhanced.provider || 'builtin') === 'builtin') {
        setStatus(composeChannel === 'whatsapp' ? 'WhatsApp text enhanced with the built-in backend enhancer.' : 'Email draft enhanced with the built-in backend enhancer.')
      } else {
        setStatus(composeChannel === 'whatsapp' ? `WhatsApp text enhanced with ${enhanced.provider}.` : `Email draft enhanced with ${enhanced.provider}.`)
      }
    } catch (enhanceError) {
      setError(enhanceError.message)
    } finally {
      setEnhancing(false)
    }
  }

  const handleResetFilters = () => {
    setSearch('')
    setSelectedId(data.candidates?.[0]?.employeeId || '')
    setStatus('Selection reset to the default candidate list.')
    setError('')
  }

  const handleResetWorkspace = () => {
    if (!selectedCandidate) return
    setCompose(buildComposeDefaults(selectedCandidate, composeChannel))
    setScheduleForm({
      title: selectedCandidate.scheduleTemplateTitle || `${selectedCandidate.role || 'Role'} manager interview`,
      startAt: buildDefaultScheduleInput(),
      durationMinutes: 45,
      meetingMode: 'Virtual',
      location: '',
      notes: selectedCandidate.whyThisCandidate?.nextSteps?.[0] || '',
      sendEmail: true,
      sendWhatsApp: false,
      phoneNumber: selectedCandidate.contact?.phone || '',
      countryCode: '',
    })
    setEditForm(buildEditDefaults(selectedCandidate))
    setLastEnhancerSource('')
    setStatus('Workspace drafts reset for the selected candidate.')
    setError('')
  }

  const handleOpenEdit = () => {
    if (!selectedCandidate) return
    setEditForm(buildEditDefaults(selectedCandidate))
    setEditing(true)
  }

  const handleSaveProfile = async () => {
    if (!selectedCandidate || savingProfile) return
    setSavingProfile(true)
    setError('')
    setStatus('')
    try {
      await managerOpsService.updateCandidateProfile(selectedCandidate.employeeId, editForm)
      await loadWorkbench()
      setSelectedId(selectedCandidate.employeeId)
      setEditing(false)
      setStatus('Candidate profile updated successfully.')
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSavingProfile(false)
    }
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-white">Manager Ops</h1>
          <p className="text-gray-400 mt-2">A backend-powered manager cockpit for outreach, scheduling, and explainable candidate review.</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ['Candidates', data.summary?.totalCandidates || 0],
            ['Interviewed', data.summary?.interviewReady || 0],
            ['Strong Matches', data.summary?.strongMatches || 0],
            ['Scheduled', data.summary?.scheduled || 0],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-gray-700 bg-gray-900 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{label}</p>
              <p className="text-2xl font-semibold text-white mt-2">{value}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
      {status && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{status}</div>}
      {data.storage?.databaseMode && (
        <div className={`rounded-xl px-4 py-3 text-sm border ${data.storage.isRemoteDatabase ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-200'}`}>
          Storage mode: <span className="font-semibold">{data.storage.databaseMode}</span> · Manager scheduling and communication data is persisted in <span className="font-semibold">{data.storage.persistence || 'backend storage'}</span>.
          {!data.storage.isRemoteDatabase && ' Configure SUPABASE_DB_URL or DATABASE_URL to move this from local backend SQLite to a remote database.'}
        </div>
      )}

      <div className="grid xl:grid-cols-[340px_1fr] gap-6">
        <div className="rounded-xl border border-gray-700 bg-gray-900 p-4 space-y-4">
          <div className="rounded-xl border border-gray-700 bg-black/20 p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Employee Selection</p>
                <p className="text-sm text-gray-300 mt-1">Choose a candidate directly or narrow the list with search.</p>
              </div>
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-200 hover:bg-gray-800"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>
            <select
              value={selectedCandidate?.employeeId || ''}
              onChange={(event) => setSelectedId(event.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:outline-none focus:border-gray-600"
            >
              {(data.candidates || []).map((candidate) => (
                <option key={candidate.employeeId} value={candidate.employeeId}>
                  {candidate.candidateName} - {candidate.role || 'Role not set'}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search candidate or role..."
              className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-gray-600"
            />
          </div>

          <div className="max-h-[78vh] overflow-y-auto space-y-2">
            {loading && <p className="text-sm text-gray-400">Loading manager workspace...</p>}
            {!loading && filteredCandidates.map((candidate) => {
              const active = selectedCandidate?.employeeId === candidate.employeeId
              return (
                <button
                  key={candidate.employeeId}
                  type="button"
                  onClick={() => setSelectedId(candidate.employeeId)}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${
                    active ? 'bg-white text-black border-white' : 'bg-gray-800 border-gray-700 hover:border-gray-600 text-gray-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`font-semibold ${active ? 'text-black' : 'text-white'}`}>{candidate.candidateName}</p>
                      <p className={`text-sm mt-1 ${active ? 'text-gray-700' : 'text-gray-400'}`}>{candidate.role || 'Role not set'}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full border ${active ? 'border-black/20 text-gray-700' : 'border-gray-600 text-gray-300'}`}>
                      {candidate.jobMatch?.score ? `${candidate.jobMatch.score}% fit` : 'No JD match'}
                    </span>
                  </div>
                  <p className={`text-xs mt-3 ${active ? 'text-gray-700' : 'text-gray-500'}`}>
                    Interview: {candidate.interview?.score ? `${candidate.interview.score}/5` : 'Pending'}
                  </p>
                </button>
              )
            })}
            {!loading && filteredCandidates.length === 0 && <p className="text-sm text-gray-400">No candidates match this search.</p>}
          </div>
        </div>

        <div className="space-y-6">
          {!selectedCandidate ? (
            <div className="rounded-xl border border-gray-700 bg-gray-900 p-6 text-gray-400">Select a candidate to open the workspace.</div>
          ) : (
            <>
              <div className="rounded-2xl border border-gray-700 bg-gray-900 p-5">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl border border-gray-700 bg-gray-800 flex items-center justify-center text-gray-300">
                      <UserRound className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Candidate command card</p>
                      <h2 className="text-3xl font-semibold text-white mt-2">{selectedCandidate.candidateName}</h2>
                      <p className="text-sm text-gray-400 mt-2">{selectedCandidate.role || 'Role not set'} · {selectedCandidate.department || 'Department not set'}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-300">
                        <span className="px-3 py-1.5 rounded-full border border-gray-700 bg-black/20">{selectedCandidate.contact?.email || 'No email'}</span>
                        <span className="px-3 py-1.5 rounded-full border border-gray-700 bg-black/20">{selectedCandidate.contact?.phone || 'No phone'}</span>
                        <span className="px-3 py-1.5 rounded-full border border-gray-700 bg-black/20">{selectedCandidate.contact?.location || 'Location not set'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleResetWorkspace}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Reset Drafts</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenEdit}
                        className="inline-flex items-center gap-2 rounded-lg bg-white text-black font-semibold px-3 py-2 hover:bg-gray-200"
                      >
                        <PencilLine className="w-4 h-4" />
                        <span>Edit Candidate</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 min-w-[280px]">
                    {(selectedCandidate.whyThisCandidate?.sourceSignals || []).map((signal) => (
                      <div key={signal.label} className={`rounded-xl border px-3 py-3 ${toneClasses[signal.tone] || toneClasses.steady}`}>
                        <p className="text-[11px] uppercase tracking-[0.16em] opacity-80">{signal.label}</p>
                        <p className="text-lg font-semibold mt-1">{signal.value}</p>
                      </div>
                    ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-700 bg-gray-900 p-5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-white" />
                  <h3 className="text-xl font-semibold text-white">Why This Candidate</h3>
                </div>
                <p className="text-gray-300 mt-4">{selectedCandidate.whyThisCandidate?.headline}</p>
                <div className="mt-4 inline-flex items-center rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-white">
                  {selectedCandidate.whyThisCandidate?.recommendation}
                </div>
                <div className="grid xl:grid-cols-2 gap-4 mt-5">
                  {[
                    ['Fit reasons', selectedCandidate.whyThisCandidate?.fitReasons || [], 'text-gray-200'],
                    ['Interview evidence', selectedCandidate.whyThisCandidate?.interviewEvidence || [], 'text-gray-200'],
                    ['Concerns', selectedCandidate.whyThisCandidate?.concerns || [], 'text-amber-200'],
                    ['Recommended next steps', selectedCandidate.whyThisCandidate?.nextSteps || [], 'text-gray-200'],
                  ].map(([title, items, bodyClass]) => (
                    <div key={title} className="rounded-xl border border-gray-700 bg-black/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{title}</p>
                      <div className={`mt-3 space-y-2 text-sm ${bodyClass}`}>
                        {items.map((item) => <p key={item}>{item}</p>)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid xl:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-gray-700 bg-gray-900 p-5 space-y-5">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-white" />
                    <h3 className="text-xl font-semibold text-white">Calendar Integration</h3>
                  </div>
                  <div className="grid gap-4">
                    <input value={scheduleForm.title} onChange={(event) => setScheduleForm((current) => ({ ...current, title: event.target.value }))} placeholder="Interview title" className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:border-gray-600" />
                    <div className="grid md:grid-cols-2 gap-4">
                      <input type="datetime-local" value={scheduleForm.startAt} onChange={(event) => setScheduleForm((current) => ({ ...current, startAt: event.target.value }))} className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:outline-none focus:border-gray-600" />
                      <input type="number" min="15" max="240" value={scheduleForm.durationMinutes} onChange={(event) => setScheduleForm((current) => ({ ...current, durationMinutes: event.target.value }))} className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:outline-none focus:border-gray-600" />
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <select value={scheduleForm.meetingMode} onChange={(event) => setScheduleForm((current) => ({ ...current, meetingMode: event.target.value }))} className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:outline-none focus:border-gray-600">
                        <option>Virtual</option>
                        <option>In Person</option>
                        <option>Hybrid</option>
                      </select>
                      <input value={scheduleForm.location} onChange={(event) => setScheduleForm((current) => ({ ...current, location: event.target.value }))} placeholder="Meeting link or location" className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:border-gray-600" />
                    </div>
                    <textarea rows={4} value={scheduleForm.notes} onChange={(event) => setScheduleForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Notes or interview focus" className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:border-gray-600" />
                    <div className="grid md:grid-cols-[120px_1fr] gap-4">
                      <input value={scheduleForm.countryCode} onChange={(event) => setScheduleForm((current) => ({ ...current, countryCode: event.target.value }))} placeholder="+91" className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:border-gray-600" />
                      <input value={scheduleForm.phoneNumber} onChange={(event) => setScheduleForm((current) => ({ ...current, phoneNumber: event.target.value }))} placeholder="WhatsApp number for reminder" className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:border-gray-600" />
                    </div>
                    <p className="text-xs text-gray-500 -mt-2">Use full international format or add the country code separately so the WhatsApp reminder opens correctly.</p>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300">
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={scheduleForm.sendEmail} onChange={(event) => setScheduleForm((current) => ({ ...current, sendEmail: event.target.checked }))} className="rounded border-gray-600 bg-gray-800" />
                        <span>Send email invite</span>
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={scheduleForm.sendWhatsApp} onChange={(event) => setScheduleForm((current) => ({ ...current, sendWhatsApp: event.target.checked }))} className="rounded border-gray-600 bg-gray-800" />
                        <span>Create WhatsApp reminder</span>
                      </label>
                    </div>
                    <button type="button" onClick={handleScheduleInterview} disabled={scheduling} className="inline-flex items-center justify-center gap-2 rounded-lg bg-white text-black font-semibold px-4 py-2 hover:bg-gray-200 disabled:opacity-60">
                      <CalendarDays className="w-4 h-4" />
                      <span>{scheduling ? 'Scheduling...' : 'Schedule Interview'}</span>
                    </button>
                  </div>

                  <div className="rounded-xl border border-gray-700 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Upcoming schedule history</p>
                    <div className="mt-4 space-y-3">
                      {(selectedCandidate.schedules || []).slice(0, 5).map((schedule) => (
                        <div key={schedule.id} className="rounded-lg border border-gray-700 bg-gray-900/70 p-3">
                          <p className="font-medium text-white">{schedule.title}</p>
                          <p className="text-sm text-gray-400 mt-1">{formatDateTime(schedule.startAt)} · {schedule.meetingMode}</p>
                          <p className="text-xs text-gray-500 mt-1">{schedule.location || 'Location pending'}</p>
                          <div className="flex flex-wrap gap-2 mt-3">
                            <a href={managerOpsService.getScheduleIcsUrl(schedule.id)} className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800">
                              <Download className="w-4 h-4" />
                              <span>ICS</span>
                            </a>
                            {schedule.googleCalendarUrl && (
                              <a href={schedule.googleCalendarUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800">
                                <ExternalLink className="w-4 h-4" />
                                <span>Google Calendar</span>
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                      {(!selectedCandidate.schedules || selectedCandidate.schedules.length === 0) && <p className="text-sm text-gray-400">No interview scheduled yet for this candidate.</p>}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-700 bg-gray-900 p-5 space-y-5">
                  <div className="flex items-center gap-2">
                    <Send className="w-5 h-5 text-white" />
                    <h3 className="text-xl font-semibold text-white">Email / WhatsApp Communication</h3>
                  </div>
                  <div className="inline-flex rounded-xl border border-gray-700 bg-black/20 p-1">
                    {[
                      ['email', 'Email', Mail],
                      ['whatsapp', 'WhatsApp', MessageCircle],
                    ].map(([value, label, Icon]) => (
                      <button key={value} type="button" onClick={() => setComposeChannel(value)} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${composeChannel === value ? 'bg-white text-black' : 'text-gray-300 hover:bg-gray-800'}`}>
                        <Icon className="w-4 h-4" />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-4">
                    {composeChannel === 'email' && <input value={compose.subject} onChange={(event) => setCompose((current) => ({ ...current, subject: event.target.value }))} placeholder="Email subject" className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:border-gray-600" />}
                    {composeChannel === 'email' ? (
                      <input value={compose.recipient} onChange={(event) => setCompose((current) => ({ ...current, recipient: event.target.value }))} placeholder="Recipient email" className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:border-gray-600" />
                    ) : (
                      <div className="grid md:grid-cols-[120px_1fr] gap-4">
                        <input value={compose.countryCode} onChange={(event) => setCompose((current) => ({ ...current, countryCode: event.target.value }))} placeholder="+91" className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:border-gray-600" />
                        <input value={compose.phoneNumber} onChange={(event) => setCompose((current) => ({ ...current, phoneNumber: event.target.value }))} placeholder="Recipient WhatsApp number" className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:border-gray-600" />
                      </div>
                    )}
                    {composeChannel === 'whatsapp' && <p className="text-xs text-gray-500 -mt-2">Add a country code like `+1` or `+91`, or paste the full WhatsApp number in the main field.</p>}
                    <textarea rows={8} value={compose.message} onChange={(event) => setCompose((current) => ({ ...current, message: event.target.value }))} placeholder={composeChannel === 'email' ? 'Write your email...' : 'Write your WhatsApp message...'} className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:border-gray-600" />
                    {lastEnhancerSource && (
                      <p className="text-xs text-gray-500 -mt-2">
                        Last enhancement source: <span className="text-gray-300 font-medium">{lastEnhancerSource}</span>
                      </p>
                    )}
                    <div className="grid md:grid-cols-2 gap-3">
                      <button type="button" onClick={handleEnhanceCommunication} disabled={enhancing} className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-700 text-gray-100 px-4 py-2 hover:bg-gray-800 disabled:opacity-60">
                        <Sparkles className="w-4 h-4" />
                        <span>{enhancing ? 'Enhancing...' : 'AI Enhance Text'}</span>
                      </button>
                      <button type="button" onClick={handleSendCommunication} disabled={sending} className="inline-flex items-center justify-center gap-2 rounded-lg bg-white text-black font-semibold px-4 py-2 hover:bg-gray-200 disabled:opacity-60">
                        <Send className="w-4 h-4" />
                        <span>{sending ? 'Sending...' : composeChannel === 'email' ? 'Send Email' : 'Open WhatsApp Message'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-700 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Communication history</p>
                    <div className="mt-4 space-y-3 max-h-[340px] overflow-y-auto pr-1">
                      {(selectedCandidate.communications || []).map((item) => (
                        <div key={item.id} className="rounded-lg border border-gray-700 bg-gray-900/70 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-white">{item.channel === 'email' ? 'Email' : 'WhatsApp'} · {item.deliveryStatus}</p>
                              <p className="text-xs text-gray-500 mt-1">{formatDateTime(item.createdAt)}</p>
                            </div>
                            {item.launchUrl && <a href={item.launchUrl} target="_blank" rel="noreferrer" className="text-xs text-gray-300 hover:text-white">Open</a>}
                          </div>
                          {item.subject && <p className="text-sm text-gray-300 mt-3">{item.subject}</p>}
                          <p className="text-sm text-gray-400 mt-2 whitespace-pre-wrap">{item.message}</p>
                        </div>
                      ))}
                      {(!selectedCandidate.communications || selectedCandidate.communications.length === 0) && <p className="text-sm text-gray-400">No communication history yet for this candidate.</p>}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/70 p-4 flex items-center justify-center" onClick={() => setEditing(false)}>
          <div
            className="w-full max-w-3xl rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-700 p-5">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Edit Candidate</p>
                <h3 className="text-2xl font-semibold text-white mt-2">Update employee profile professionally</h3>
                <p className="text-sm text-gray-400 mt-2">These edits update the backend candidate profile used across the manager workspace.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-lg border border-gray-700 p-2 text-gray-300 hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-4 p-5">
              {[
                ['fullName', 'Full name', 'Austin Karasu'],
                ['email', 'Email', 'candidate@company.com'],
                ['role', 'Role', 'Polyglot Developer'],
                ['department', 'Department', 'Engineering'],
                ['location', 'Location', 'Bengaluru, India'],
                ['yearsExperience', 'Years experience', '4'],
                ['phone', 'Phone', '+91 9876543210'],
                ['portfolioUrl', 'Portfolio URL', 'https://portfolio.dev'],
                ['githubUrl', 'GitHub URL', 'https://github.com/username'],
                ['linkedinUrl', 'LinkedIn URL', 'https://linkedin.com/in/username'],
              ].map(([field, label, placeholder]) => (
                <label key={field} className={field.includes('Url') ? 'md:col-span-2' : ''}>
                  <span className="text-sm text-gray-300">{label}</span>
                  <input
                    value={editForm[field]}
                    onChange={(event) => setEditForm((current) => ({ ...current, [field]: event.target.value }))}
                    placeholder={placeholder}
                    className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:border-gray-600"
                  />
                </label>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-700 p-5">
              <button
                type="button"
                onClick={() => setEditForm(buildEditDefaults(selectedCandidate))}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-200 hover:bg-gray-800"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset Changes</span>
              </button>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-200 hover:bg-gray-800"
                >
                  <X className="w-4 h-4" />
                  <span>Cancel</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="inline-flex items-center gap-2 rounded-lg bg-white text-black font-semibold px-4 py-2 hover:bg-gray-200 disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingProfile ? 'Saving...' : 'Save Candidate'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
