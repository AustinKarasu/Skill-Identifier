import { motion } from 'framer-motion'
import { Clock, CheckCircle, AlertCircle, CalendarDays, User, X, FileText, Search, BrainCircuit, Download, Pencil, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { assessmentService } from '../../api/services/assessmentService'

export default function Assessments() {
  const [selectedAssessment, setSelectedAssessment] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [assessmentRecords, setAssessmentRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [resumeState, setResumeState] = useState({ status: 'idle', message: '' })
  const [editMode, setEditMode] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingAssessmentId, setDeletingAssessmentId] = useState('')
  const [editForm, setEditForm] = useState({
    title: '',
    status: 'completed',
    score: '',
    summary: '',
    focusArea: '',
    duration: '',
    hiringSignal: '',
    confidence: '',
  })

  const loadAssessments = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const items = await assessmentService.list()
      setAssessmentRecords(items)
    } catch (error) {
      setLoadError(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true

    const load = async () => {
      setLoading(true)
      setLoadError('')
      try {
        const items = await assessmentService.list()
        if (!mounted) return
        setAssessmentRecords(items)
      } catch (error) {
        if (!mounted) return
        setLoadError(error.message)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [])

  const assessmentStats = useMemo(() => {
    const completed = assessmentRecords.filter((item) => item.status === 'completed').length
    const inProgress = assessmentRecords.filter((item) => item.status === 'in-progress').length
    const pending = assessmentRecords.filter((item) => item.status === 'pending').length

    return [
      { label: 'Total Assessments', value: String(assessmentRecords.length), color: 'bg-white' },
      { label: 'Completed', value: String(completed), color: 'bg-green-500' },
      { label: 'In Progress', value: String(inProgress), color: 'bg-blue-500' },
      { label: 'Pending', value: String(pending), color: 'bg-amber-500' },
    ]
  }, [assessmentRecords])

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'in-progress':
        return <Clock className="w-5 h-5 text-blue-400" />
      case 'pending':
        return <AlertCircle className="w-5 h-5 text-amber-400" />
      default:
        return null
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/10 text-green-400 border-green-500/30'
      case 'in-progress':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30'
      case 'pending':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30'
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/30'
    }
  }

  const getStatusLabel = (status) => {
    return status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')
  }

  const formatAssessmentDate = (date) =>
    new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

  const filteredAssessments = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return assessmentRecords

    return assessmentRecords.filter(
      ({ title, employee, status, focusArea, profile }) =>
        title.toLowerCase().includes(query) ||
        employee.toLowerCase().includes(query) ||
        status.toLowerCase().includes(query) ||
        focusArea.toLowerCase().includes(query) ||
        profile?.role?.toLowerCase().includes(query)
    )
  }, [assessmentRecords, searchTerm])

  useEffect(() => {
    if (!selectedAssessment) return undefined

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [selectedAssessment])

  const handleResumeDownload = async () => {
    if (!selectedAssessment?.employeeId || !selectedAssessment?.resume?.fileName) {
      setResumeState({ status: 'error', message: 'No downloadable resume is attached to this assessment yet.' })
      return
    }

    setResumeState({ status: 'loading', message: 'Preparing resume download...' })

    try {
      await assessmentService.downloadResume(selectedAssessment.employeeId, selectedAssessment.resume.fileName)
      setResumeState({ status: 'success', message: 'Resume download started.' })
    } catch (error) {
      setResumeState({ status: 'error', message: error.message })
    }
  }

  const buildEditForm = (record) => ({
    title: record?.title || '',
    status: record?.status || 'completed',
    score: Number(record?.score || 0) > 0 ? String(record.score) : '',
    summary: record?.summary || '',
    focusArea: record?.focusArea || '',
    duration: record?.duration || '',
    hiringSignal: record?.hiringSignal || '',
    confidence: record?.confidence || '',
  })

  const openAssessment = (record, startEdit = false) => {
    setResumeState({ status: 'idle', message: '' })
    setSelectedAssessment(record)
    setEditForm(buildEditForm(record))
    setEditMode(startEdit)
  }

  const handleDeleteAssessment = async (record) => {
    if (!record?.id || deletingAssessmentId) return
    if (!window.confirm(`Delete assessment "${record.title}" for ${record.employee}?`)) return
    setDeletingAssessmentId(record.id)
    setLoadError('')
    try {
      await assessmentService.deleteAssessment(record.id)
      window.location.reload()
    } catch (error) {
      setLoadError(error.message)
    } finally {
      setDeletingAssessmentId('')
    }
  }

  const handleSaveEdit = async () => {
    if (!selectedAssessment || savingEdit) return
    setSavingEdit(true)
    setLoadError('')
    try {
      const payload = {
        title: editForm.title,
        status: editForm.status,
        summary: editForm.summary,
        focusArea: editForm.focusArea,
        duration: editForm.duration,
        hiringSignal: editForm.hiringSignal,
        confidence: editForm.confidence,
      }
      if (String(editForm.score).trim()) {
        payload.score = Number(editForm.score)
      }
      const updated = await assessmentService.updateAssessment(selectedAssessment.id, payload)
      setAssessmentRecords((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setSelectedAssessment(updated)
      setEditForm(buildEditForm(updated))
      setEditMode(false)
    } catch (error) {
      setLoadError(error.message)
    } finally {
      setSavingEdit(false)
    }
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl font-bold text-white">Assessments</h1>
        <p className="text-gray-400 mt-2">Track real employee AI interview assessments from the backend.</p>
      </motion.div>

      {loadError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {assessmentStats.map(({ label, value, color }, index) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.05 }}
            className="bg-gray-900 border border-gray-700 rounded-lg p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">{label}</p>
                <p className="text-3xl font-bold text-white mt-2">{value}</p>
              </div>
              <div className={`w-12 h-12 rounded-lg ${color} opacity-20`}></div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by employee, role, status, or focus area..."
            className="w-full pl-12 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-gray-600 focus:outline-none transition-colors"
          />
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-gray-900 border border-gray-700 rounded-lg p-6 overflow-x-auto"
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-6">
          <h3 className="text-lg font-bold text-white">Assessment Records</h3>
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-400">
              {loading ? 'Loading assessments...' : `Showing ${filteredAssessments.length} of ${assessmentRecords.length} assessments`}
            </p>
            <button
              type="button"
              onClick={loadAssessments}
              className="text-xs rounded-lg border border-gray-700 px-3 py-1.5 text-gray-300 hover:bg-gray-800"
            >
              Refresh
            </button>
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-4 px-4 text-gray-300 font-semibold text-sm">Assessment</th>
              <th className="text-left py-4 px-4 text-gray-300 font-semibold text-sm">Employee</th>
              <th className="text-center py-4 px-4 text-gray-300 font-semibold text-sm">Status</th>
              <th className="text-center py-4 px-4 text-gray-300 font-semibold text-sm">Score</th>
              <th className="text-center py-4 px-4 text-gray-300 font-semibold text-sm">Date</th>
              <th className="text-center py-4 px-4 text-gray-300 font-semibold text-sm">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredAssessments.map((record, index) => (
              <motion.tr
                key={`${record.id}-${record.employee}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 + index * 0.05 }}
                className="border-b border-gray-800 hover:bg-gray-800 transition-colors"
              >
                <td className="py-4 px-4">
                  <div className="flex items-start gap-3">
                    {record.source === 'employee-interview' && <BrainCircuit className="w-4 h-4 text-white mt-1" />}
                    <div>
                      <p className="text-white font-medium">{record.title}</p>
                      {record.source === 'employee-interview' && (
                        <p className="text-xs text-gray-500 mt-1">Submitted from Employee interview workflow</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4 text-gray-300">{record.employee}</td>
                <td className="py-4 px-4 text-center">
                  <div className="flex items-center justify-center space-x-2">
                    {getStatusIcon(record.status)}
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(record.status)}`}>
                      {getStatusLabel(record.status)}
                    </span>
                  </div>
                </td>
                <td className="py-4 px-4 text-center">
                  {record.score > 0 ? (
                    <span className="px-3 py-1 text-sm font-semibold bg-white text-black rounded-lg">
                      {record.score}/5.0
                    </span>
                  ) : (
                    <span className="text-gray-400 text-sm">-</span>
                  )}
                </td>
                <td className="py-4 px-4 text-center text-gray-400 text-sm">
                  {formatAssessmentDate(record.date)}
                </td>
                <td className="py-4 px-4 text-center">
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => openAssessment(record)}
                      className="text-blue-400 hover:text-blue-300 font-medium text-sm"
                    >
                      View
                    </button>
                    <button
                      onClick={() => openAssessment(record, true)}
                      className="text-amber-300 hover:text-amber-200 font-medium text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteAssessment(record)}
                      disabled={deletingAssessmentId === record.id}
                      className="text-red-300 hover:text-red-200 font-medium text-sm disabled:opacity-60"
                    >
                      {deletingAssessmentId === record.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
            {filteredAssessments.length === 0 && (
              <tr>
                <td colSpan="6" className="py-8 text-center text-gray-400">
                  {assessmentRecords.length === 0
                    ? 'No real assessments yet. Once employees complete interviews, records will appear here.'
                    : 'No assessments match your search yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </motion.div>

      {selectedAssessment && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => {
            setResumeState({ status: 'idle', message: '' })
            setSelectedAssessment(null)
            setEditMode(false)
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl max-h-[90vh] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-start justify-between gap-4 p-6 border-b border-gray-700">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Assessment Details</p>
                <h2 className="text-2xl font-bold text-white mt-2">{selectedAssessment.title}</h2>
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(selectedAssessment.status)}`}>
                    {getStatusLabel(selectedAssessment.status)}
                  </span>
                  <span className="px-3 py-1 text-sm font-semibold bg-white text-black rounded-lg">
                    {selectedAssessment.score > 0 ? `${selectedAssessment.score}/5.0` : 'Not scored'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditMode((current) => !current)}
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 px-3 py-2 text-sm text-amber-200 hover:bg-amber-500/10"
                >
                  <Pencil className="w-4 h-4" />
                  <span>{editMode ? 'Cancel edit' : 'Edit'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteAssessment(selectedAssessment)}
                  disabled={deletingAssessmentId === selectedAssessment.id}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-60"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{deletingAssessmentId === selectedAssessment.id ? 'Deleting...' : 'Delete'}</span>
                </button>
                <button
                  onClick={() => {
                    setResumeState({ status: 'idle', message: '' })
                    setSelectedAssessment(null)
                    setEditMode(false)
                  }}
                  className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                  aria-label="Close assessment details"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-96px)]">
              {resumeState.status !== 'idle' && (
                <div className={`rounded-xl border px-4 py-3 text-sm ${
                  resumeState.status === 'loading'
                    ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                    : resumeState.status === 'success'
                      ? 'border-green-500/30 bg-green-500/10 text-green-300'
                      : 'border-red-500/30 bg-red-500/10 text-red-300'
                }`}>
                  {resumeState.message}
                </div>
              )}

              {editMode && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-4">
                  <h3 className="text-lg font-semibold text-white">Edit Assessment Record</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      value={editForm.title}
                      onChange={(e) => setEditForm((current) => ({ ...current, title: e.target.value }))}
                      placeholder="Assessment title"
                      className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white"
                    />
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm((current) => ({ ...current, status: e.target.value }))}
                      className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white"
                    >
                      <option value="submitted">Submitted</option>
                      <option value="pending">Pending</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                    <input
                      value={editForm.score}
                      onChange={(e) => setEditForm((current) => ({ ...current, score: e.target.value }))}
                      placeholder="Score (0-5)"
                      type="number"
                      min="0"
                      max="5"
                      step="0.1"
                      className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white"
                    />
                    <input
                      value={editForm.focusArea}
                      onChange={(e) => setEditForm((current) => ({ ...current, focusArea: e.target.value }))}
                      placeholder="Focus area"
                      className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white"
                    />
                    <input
                      value={editForm.duration}
                      onChange={(e) => setEditForm((current) => ({ ...current, duration: e.target.value }))}
                      placeholder="Duration (e.g. 25 min)"
                      className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white"
                    />
                    <input
                      value={editForm.hiringSignal}
                      onChange={(e) => setEditForm((current) => ({ ...current, hiringSignal: e.target.value }))}
                      placeholder="Hiring signal"
                      className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white"
                    />
                    <input
                      value={editForm.confidence}
                      onChange={(e) => setEditForm((current) => ({ ...current, confidence: e.target.value }))}
                      placeholder="Confidence"
                      className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white"
                    />
                  </div>
                  <textarea
                    value={editForm.summary}
                    onChange={(e) => setEditForm((current) => ({ ...current, summary: e.target.value }))}
                    rows={4}
                    placeholder="Manager summary"
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white"
                  />
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={savingEdit}
                    className="inline-flex items-center gap-2 rounded-lg bg-white text-black px-4 py-2 font-semibold hover:bg-gray-200 disabled:opacity-60"
                  >
                    <Save className="w-4 h-4" />
                    <span>{savingEdit ? 'Saving...' : 'Save changes'}</span>
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-gray-700 bg-gray-800/70 p-4">
                  <div className="flex items-center gap-2 text-gray-400 text-sm">
                    <User className="w-4 h-4" />
                    <span>Employee</span>
                  </div>
                  <p className="text-white font-semibold mt-2">{selectedAssessment.employee}</p>
                  {selectedAssessment.profile?.role && <p className="text-sm text-gray-500 mt-1">{selectedAssessment.profile.role}</p>}
                </div>
                <div className="rounded-xl border border-gray-700 bg-gray-800/70 p-4">
                  <div className="flex items-center gap-2 text-gray-400 text-sm">
                    <CalendarDays className="w-4 h-4" />
                    <span>Date</span>
                  </div>
                  <p className="text-white font-semibold mt-2">{formatAssessmentDate(selectedAssessment.date)}</p>
                </div>
                <div className="rounded-xl border border-gray-700 bg-gray-800/70 p-4">
                  <div className="flex items-center gap-2 text-gray-400 text-sm">
                    <Clock className="w-4 h-4" />
                    <span>Duration</span>
                  </div>
                  <p className="text-white font-semibold mt-2">{selectedAssessment.duration}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
                  <p className="text-sm text-gray-400">Interviewer</p>
                  <p className="text-white font-semibold mt-2">{selectedAssessment.interviewer}</p>
                </div>
                <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
                  <p className="text-sm text-gray-400">Focus Area</p>
                  <p className="text-white font-semibold mt-2">{selectedAssessment.focusArea}</p>
                </div>
              </div>

              <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="font-semibold text-white">Resume</h3>
                    <p className="mt-2 text-sm text-gray-400">
                      {selectedAssessment.resume?.fileName
                        ? `${selectedAssessment.resume.fileName} uploaded ${selectedAssessment.resume.uploadedAt ? `on ${new Date(selectedAssessment.resume.uploadedAt).toLocaleString()}` : 'for this employee'}`
                        : 'No resume has been attached to this employee assessment yet.'}
                    </p>
                  </div>
                  {selectedAssessment.resume?.fileName && (
                    <button
                      type="button"
                      onClick={handleResumeDownload}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white text-black font-semibold hover:bg-gray-200 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Resume</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5">
                <div className="flex items-center gap-2 text-gray-300">
                  <FileText className="w-4 h-4" />
                  <h3 className="font-semibold">Summary</h3>
                </div>
                <p className="text-gray-300 mt-3 leading-7">{selectedAssessment.summary}</p>
              </div>

              {selectedAssessment.perDomain?.length > 0 && (
                <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5">
                  <h3 className="font-semibold text-white">Domain-level analysis</h3>
                  <div className="mt-4 grid md:grid-cols-2 gap-4">
                    {selectedAssessment.perDomain.map((domain) => (
                      <div key={domain.id} className="rounded-xl border border-gray-700 bg-gray-900/60 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-white">{domain.title}</p>
                          <span className="text-sm text-gray-400">{domain.score}/5</span>
                        </div>
                        <p className="mt-2 text-sm text-gray-500">Gap level: {domain.gapLevel}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(selectedAssessment.strengths?.length > 0 || selectedAssessment.gaps?.length > 0 || selectedAssessment.recommendations?.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5">
                    <h3 className="font-semibold text-white">Strengths</h3>
                    <div className="mt-3 space-y-2 text-sm text-gray-300">
                      {selectedAssessment.strengths?.length > 0 ? selectedAssessment.strengths.map((item) => <p key={item}>{item}</p>) : <p>No strengths recorded.</p>}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5">
                    <h3 className="font-semibold text-white">Gaps</h3>
                    <div className="mt-3 space-y-2 text-sm text-gray-300">
                      {selectedAssessment.gaps?.length > 0 ? selectedAssessment.gaps.map((item) => <p key={item}>{item}</p>) : <p>No major gaps recorded.</p>}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5">
                    <h3 className="font-semibold text-white">Recommendations</h3>
                    <div className="mt-3 space-y-2 text-sm text-gray-300">
                      {selectedAssessment.recommendations?.length > 0 ? selectedAssessment.recommendations.map((item) => <p key={item}>{item}</p>) : <p>No recommendations recorded.</p>}
                    </div>
                  </div>
                </div>
              )}

              {(selectedAssessment.hiringSignal || selectedAssessment.confidence) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
                    <p className="text-sm text-gray-400">Hiring Signal</p>
                    <p className="text-white font-semibold mt-2">{selectedAssessment.hiringSignal || 'Not available'}</p>
                  </div>
                  <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
                    <p className="text-sm text-gray-400">Evaluation Confidence</p>
                    <p className="text-white font-semibold mt-2">{selectedAssessment.confidence || 'Not available'}</p>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5">
                <h3 className="font-semibold text-white">Highlights</h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedAssessment.highlights.map((item) => (
                    <span
                      key={item}
                      className="px-3 py-2 text-sm rounded-full border border-gray-600 bg-gray-800 text-gray-200"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
