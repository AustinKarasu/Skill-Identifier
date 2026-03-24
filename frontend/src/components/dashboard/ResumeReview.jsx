import { motion } from 'framer-motion'
import { Download, FileText, Pencil, Search, Trash2, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { assessmentService } from '../../api/services/assessmentService'

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Unable to read the selected resume file.'))
    reader.readAsDataURL(file)
  })

export default function ResumeReview() {
  const [rows, setRows] = useState([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [viewerState, setViewerState] = useState({ status: 'idle', message: '' })
  const [zoomPercent, setZoomPercent] = useState(100)
  const [viewerRefreshKey, setViewerRefreshKey] = useState(0)
  const [previewEnabled, setPreviewEnabled] = useState(false)
  const fileInputRef = useRef(null)

  const loadResumeRows = async () => {
    const indexRows = await assessmentService.listResumeIndex()
    setRows(indexRows)
  }

  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        const indexRows = await assessmentService.listResumeIndex()
        if (!mounted) return
        setRows(indexRows)
      } catch (error) {
        if (!mounted) return
        setViewerState({ status: 'error', message: error.message })
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [])

  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return rows
    return rows.filter((item) => {
      const employee = String(item.employee || '').toLowerCase()
      const role = String(item.profile?.role || '').toLowerCase()
      const fileName = String(item.resume?.fileName || '').toLowerCase()
      return employee.includes(query) || role.includes(query) || fileName.includes(query)
    })
  }, [rows, searchTerm])

  const activeEmployeeId = selectedEmployeeId || filteredRows[0]?.employeeId || ''
  const selectedRow = useMemo(
    () => filteredRows.find((item) => item.employeeId === activeEmployeeId) || null,
    [activeEmployeeId, filteredRows]
  )
  const hasResume = Boolean(selectedRow?.resume?.fileName)
  const resumeViewUrl =
    previewEnabled && selectedRow?.employeeId && hasResume ? assessmentService.getResumeViewUrl(selectedRow.employeeId) : ''
  const profile = selectedRow?.profile || {}

  useEffect(() => {
    if (!selectedEmployeeId) return
    const stillExists = filteredRows.some((item) => item.employeeId === selectedEmployeeId)
    if (!stillExists) {
      setSelectedEmployeeId(filteredRows[0]?.employeeId || '')
    }
  }, [filteredRows, selectedEmployeeId])

  useEffect(() => {
    setPreviewEnabled(false)
    setViewerState({ status: 'idle', message: '' })
    setZoomPercent(100)
  }, [selectedRow?.employeeId])

  const handleDownload = async () => {
    if (!selectedRow?.employeeId || !selectedRow?.resume?.fileName) return
    await assessmentService.downloadResume(selectedRow.employeeId, selectedRow.resume.fileName)
  }

  const handleResumeReplaceClick = () => {
    if (!selectedRow?.employeeId) return
    fileInputRef.current?.click()
  }

  const handleResumeReplace = async (event) => {
    const file = event.target.files?.[0]
    if (!file || !selectedRow?.employeeId) return

    const lowerName = file.name.toLowerCase()
    const isPdf = lowerName.endsWith('.pdf') && (file.type === 'application/pdf' || !file.type)
    if (!isPdf) {
      setViewerState({ status: 'error', message: 'Only PDF files are allowed when replacing a resume.' })
      event.target.value = ''
      return
    }

    setViewerState({ status: 'loading', message: 'Uploading updated resume...' })
    try {
      const fileData = await readFileAsDataUrl(file)
      await assessmentService.updateResume(selectedRow.employeeId, {
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
        fileSize: file.size,
        contentType: 'application/pdf',
        fileData,
      })
      await loadResumeRows()
      setViewerState({ status: 'ready', message: 'Resume updated successfully.' })
      setPreviewEnabled(true)
      setZoomPercent(100)
      setViewerRefreshKey((prev) => prev + 1)
    } catch (error) {
      setViewerState({ status: 'error', message: error.message })
    } finally {
      event.target.value = ''
    }
  }

  const handleResumeDelete = async () => {
    if (!selectedRow?.employeeId || !hasResume) return
    setViewerState({ status: 'loading', message: 'Deleting resume...' })
    try {
      await assessmentService.deleteResume(selectedRow.employeeId)
      await loadResumeRows()
      setSelectedEmployeeId('')
      setViewerState({ status: 'ready', message: 'Resume deleted successfully.' })
      setPreviewEnabled(false)
      setViewerRefreshKey((prev) => prev + 1)
    } catch (error) {
      setViewerState({ status: 'error', message: error.message })
    }
  }

  const increaseZoom = () => setZoomPercent((prev) => Math.min(prev + 10, 220))
  const decreaseZoom = () => setZoomPercent((prev) => Math.max(prev - 10, 60))

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl font-bold text-white">Resume Review</h1>
        <p className="text-gray-400 mt-2">View, replace, delete, and download employee PDF resumes from one manager workspace.</p>
      </motion.div>

      <div className="grid xl:grid-cols-[360px_1fr] gap-6">
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search employee or file..."
              className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-gray-600"
            />
          </div>

          <div className="max-h-[70vh] overflow-y-auto space-y-2">
            {filteredRows.map((item) => {
              const active = item.employeeId === activeEmployeeId
              return (
                <button
                  key={item.employeeId}
                  type="button"
                  onClick={() => setSelectedEmployeeId(item.employeeId)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    active ? 'bg-white text-black border-white' : 'bg-gray-800 border-gray-700 hover:border-gray-600 text-gray-100'
                  }`}
                >
                  <p className={`font-semibold ${active ? 'text-black' : 'text-white'}`}>{item.employee}</p>
                  <p className={`text-sm mt-1 ${active ? 'text-gray-700' : 'text-gray-400'}`}>{item.profile?.role || 'Role not set'}</p>
                  <p className={`text-xs mt-2 ${active ? 'text-gray-700' : 'text-gray-500'}`}>
                    {item.resume?.fileName || 'No resume uploaded'}
                  </p>
                </button>
              )
            })}
            {filteredRows.length === 0 && <p className="text-sm text-gray-400">No employees found for this search.</p>}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
          <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,application/pdf" onChange={handleResumeReplace} />
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-4 border-b border-gray-700">
            <div>
              <p className="text-sm text-gray-400">Selected Employee</p>
              <p className="text-lg font-semibold text-white">{selectedRow?.employee || 'No selection'}</p>
              <p className="text-xs text-gray-500 mt-1">{selectedRow?.resume?.fileName || 'Select a resume card to review details'}</p>
              {hasResume && !previewEnabled && (
                <p className="text-xs text-gray-400 mt-1">Preview loads on demand to keep this page fast.</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!hasResume) return
                  setViewerState({ status: 'loading', message: 'Loading resume preview...' })
                  setPreviewEnabled(true)
                  setViewerRefreshKey((prev) => prev + 1)
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-700 text-gray-200 px-3 py-2 hover:bg-gray-800"
                disabled={!selectedRow?.employeeId || !hasResume}
              >
                <FileText className="w-4 h-4" />
                <span>Load Preview</span>
              </button>
              <button
                type="button"
                onClick={decreaseZoom}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
                disabled={!hasResume || !previewEnabled}
              >
                <ZoomOut className="w-4 h-4" />
                <span>Zoom Out</span>
              </button>
              <span className="px-3 py-2 text-sm rounded-lg border border-gray-700 text-gray-200">{zoomPercent}%</span>
              <button
                type="button"
                onClick={increaseZoom}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
                disabled={!hasResume || !previewEnabled}
              >
                <ZoomIn className="w-4 h-4" />
                <span>Zoom In</span>
              </button>
              <button
                type="button"
                onClick={handleResumeReplaceClick}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-700 text-gray-200 px-3 py-2 hover:bg-gray-800"
                disabled={!selectedRow?.employeeId}
              >
                <Pencil className="w-4 h-4" />
                <span>Reupload</span>
              </button>
              <button
                type="button"
                onClick={handleResumeDelete}
                className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 text-red-300 px-3 py-2 hover:bg-red-500/10"
                disabled={!selectedRow?.employeeId || !hasResume}
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-2 rounded-lg bg-white text-black font-semibold px-3 py-2 hover:bg-gray-200"
                disabled={!selectedRow?.employeeId || !hasResume}
              >
                <Download className="w-4 h-4" />
                <span>Download</span>
              </button>
            </div>
          </div>

          {selectedRow && (
            <div className="mt-4 rounded-lg border border-gray-700 bg-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Employee profile</p>
              <div className="mt-3 flex items-start gap-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden border border-gray-700 bg-gray-800 flex items-center justify-center">
                  {profile.photoData ? (
                    <img src={profile.photoData} alt="Employee profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm text-gray-400">
                      {String(selectedRow.employee || 'EM')
                        .split(' ')
                        .map((part) => part[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="grid md:grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-300">
                  <p><span className="text-gray-500">Name:</span> {selectedRow.employee || 'Not set'}</p>
                  <p><span className="text-gray-500">Email:</span> {profile.email || 'Not set'}</p>
                  <p><span className="text-gray-500">Role:</span> {profile.role || 'Not set'}</p>
                  <p><span className="text-gray-500">Department:</span> {profile.department || 'Not set'}</p>
                  <p><span className="text-gray-500">Location:</span> {profile.location || 'Not set'}</p>
                  <p><span className="text-gray-500">Experience:</span> {profile.yearsExperience ? `${profile.yearsExperience} years` : 'Not set'}</p>
                  <p><span className="text-gray-500">Portfolio:</span> {profile.portfolioUrl || 'Not set'}</p>
                  <p><span className="text-gray-500">GitHub:</span> {profile.githubUrl || 'Not set'}</p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 rounded-lg border border-gray-700 bg-black/30 h-[72vh] overflow-auto">
            {viewerState.status === 'loading' && <p className="text-sm text-gray-400 p-4">{viewerState.message || 'Loading...'}</p>}
            {viewerState.status === 'error' && (
              <p className="text-sm text-red-300 p-4">Unable to load resume preview: {viewerState.message}</p>
            )}
            {viewerState.status === 'ready' && viewerState.message && (
              <p className="text-sm text-green-300 p-4">{viewerState.message}</p>
            )}
            {resumeViewUrl && viewerState.status !== 'error' && (
              <iframe
                key={`${selectedRow?.employeeId}-${zoomPercent}-${viewerRefreshKey}`}
                title="Employee resume viewer"
                src={`${resumeViewUrl}#toolbar=1&zoom=${zoomPercent}`}
                className="w-full h-full"
                onLoad={() => setViewerState({ status: 'ready', message: '' })}
              />
            )}
            {!resumeViewUrl && viewerState.status !== 'error' && viewerState.status !== 'loading' && (
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-70" />
                  <p>
                    {selectedRow
                      ? hasResume
                        ? 'Click “Load Preview” to view the resume.'
                        : 'No resume uploaded for this employee yet.'
                      : 'Select an employee to preview resume.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
