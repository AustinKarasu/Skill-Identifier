import { motion } from 'framer-motion'
import { CheckCircle2, CloudUpload, ArrowRight, ArrowLeft, Sparkles, Camera, Link2, Github, Linkedin, X, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { employeeJourneyService, TECH_DOMAIN_CATALOG } from '../api/services/employeeJourneyService'
import { useAuth } from '../auth/useAuth'

const steps = [
  { id: 1, title: 'About You', desc: 'Profile and experience' },
  { id: 2, title: 'Resume Upload', desc: 'Attach your latest resume' },
  { id: 3, title: 'Domains & Skills', desc: 'Select technical focus areas' },
]

const SAMPLE_JOB_DESCRIPTION = `We are hiring a Frontend Engineer to build responsive product experiences using React, TypeScript, CSS, and REST APIs. You should be comfortable collaborating with designers, shipping production UI features, improving performance, and working closely with backend services. Experience with accessibility, reusable component systems, testing, and modern delivery workflows is preferred.`

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Resume upload failed. Please try that file again.'))
    reader.readAsDataURL(file)
  })

const normalizeAnalysisRecord = (value) => (value && Object.keys(value).length ? value : null)

export default function EmployeeOnboarding() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [currentStep, setCurrentStep] = useState(1)
  const [profile, setProfile] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    employeeId: '',
    role: '',
    department: '',
    experienceLevel: 'Mid-level',
    yearsExperience: '',
    location: '',
    portfolioUrl: '',
    githubUrl: '',
    linkedinUrl: '',
    photoData: '',
    summary: '',
  })
  const [resume, setResume] = useState({ fileName: '', uploadedAt: '', fileSize: 0, contentType: '', fileData: '' })
  const [resumeAnalysis, setResumeAnalysis] = useState(null)
  const [resumeAnalyzedAt, setResumeAnalyzedAt] = useState('')
  const [resumeAnalysisStatus, setResumeAnalysisStatus] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [jobMatchAnalysis, setJobMatchAnalysis] = useState(null)
  const [jobMatchAnalyzedAt, setJobMatchAnalyzedAt] = useState('')
  const [selectedDomains, setSelectedDomains] = useState([])
  const [selectedSkills, setSelectedSkills] = useState([])
  const [uploadError, setUploadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [jobMatchError, setJobMatchError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [profileDirty, setProfileDirty] = useState(false)
  const [resumeDirty, setResumeDirty] = useState(false)
  const [domainsDirty, setDomainsDirty] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [isLoadingJourney, setIsLoadingJourney] = useState(true)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isMatchingJob, setIsMatchingJob] = useState(false)
  const [isResumeAnalysisModalOpen, setIsResumeAnalysisModalOpen] = useState(false)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const hasAutoRetriedResumeAnalysis = useRef(false)

  const hasAnalysisData = (analysis) => {
    if (!analysis) return false
    return Boolean(
      analysis.summary ||
      (analysis.skills && analysis.skills.length) ||
      (analysis.experience && analysis.experience.length) ||
      (analysis.education && analysis.education.length),
    )
  }

  const applyJourney = (journey) => {
    setProfile({
      ...journey.profile,
      fullName: journey.profile.fullName || user?.fullName || '',
      email: journey.profile.email || user?.email || '',
      yearsExperience: journey.profile.yearsExperience || '',
      portfolioUrl: journey.profile.portfolioUrl || '',
      githubUrl: journey.profile.githubUrl || '',
      linkedinUrl: journey.profile.linkedinUrl || '',
      photoData: journey.profile.photoData || '',
    })
    setResume(journey.resume)
    setResumeAnalysis(normalizeAnalysisRecord(journey.resumeAnalysis))
    setResumeAnalyzedAt(journey.resumeAnalyzedAt || '')
    setResumeAnalysisStatus(journey.resumeAnalysisStatus || '')
    setJobDescription(journey.jobDescription || '')
    setJobMatchAnalysis(normalizeAnalysisRecord(journey.jobMatchAnalysis))
    setJobMatchAnalyzedAt(journey.jobMatchAnalyzedAt || '')
    setSelectedDomains(journey.domains)
    setSelectedSkills(journey.skills)
  }

  const openResumeAnalysisModalIfReady = (analysis, status) => {
    if (status === 'unreadable') return
    if (hasAnalysisData(analysis)) {
      setIsResumeAnalysisModalOpen(true)
    }
  }

  const applyResumeAnalysisResult = (updated, { openModal = false } = {}) => {
    const nextAnalysis = normalizeAnalysisRecord(updated?.resumeAnalysis)
    const nextStatus = updated?.resumeAnalysisStatus || ''
    setResumeAnalysis(nextAnalysis)
    setResumeAnalyzedAt(updated?.resumeAnalyzedAt || '')
    setResumeAnalysisStatus(nextStatus)
    if (openModal) {
      openResumeAnalysisModalIfReady(nextAnalysis, nextStatus)
    }
    return updated
  }

  const applyJobMatchResult = (updated) => {
    setJobDescription(updated?.jobDescription || '')
    setJobMatchAnalysis(normalizeAnalysisRecord(updated?.jobMatchAnalysis))
    setJobMatchAnalyzedAt(updated?.jobMatchAnalyzedAt || '')
    if (updated?.resumeAnalysis) {
      applyResumeAnalysisResult(updated)
    }
    return updated
  }

  const runResumeAnalysis = async ({ silent = false } = {}) => {
    if (!resume.fileName && !silent) return null

    try {
      setUploadError('')
      setResumeAnalysisStatus('processing')
      if (!silent) {
        setIsAnalyzing(true)
      }
      const updated = await employeeJourneyService.analyzeResume()
      return applyResumeAnalysisResult(updated, { openModal: !silent })
    } catch (error) {
      if (!silent) {
        setUploadError(error.message || 'Unable to analyze resume right now. Please try again.')
      }
      return null
    } finally {
      if (!silent) {
        setIsAnalyzing(false)
      }
    }
  }

  useEffect(() => {
    let mounted = true

    const loadJourney = async () => {
      setIsLoadingJourney(true)
      const journey = await employeeJourneyService.getJourney()
      if (!mounted) return

      applyJourney(journey)
      setProfileDirty(false)
      setResumeDirty(false)
      setDomainsDirty(false)
      setIsLoadingJourney(false)

      const needsFreshAnalysis =
        journey.resume?.fileName &&
        (
          journey.resumeAnalysisStatus === 'unreadable' ||
          !hasAnalysisData(journey.resumeAnalysis)
        )

      if (needsFreshAnalysis && !hasAutoRetriedResumeAnalysis.current) {
        hasAutoRetriedResumeAnalysis.current = true
        setIsAnalyzing(true)
        setResumeAnalysisStatus('processing')
        try {
          const updated = await employeeJourneyService.analyzeResume()
          if (!mounted) return
          applyResumeAnalysisResult(updated)
        } catch {
          if (!mounted) return
          setResumeAnalysisStatus(journey.resumeAnalysisStatus || '')
        } finally {
          if (mounted) {
            setIsAnalyzing(false)
          }
        }
      }
    }

    loadJourney()

    return () => {
      mounted = false
    }
  }, [user?.email, user?.fullName])

  const availableSkills = useMemo(() => {
    const domains = TECH_DOMAIN_CATALOG.filter((item) => selectedDomains.includes(item.id))
    return [...new Set(domains.flatMap((item) => item.skills))]
  }, [selectedDomains])

  const formatTimestamp = (value) => {
    if (!value) return ''
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value
    return parsed.toLocaleString()
  }

  const refreshJourneyAnalysis = async () => {
    const journey = await employeeJourneyService.getJourney()
    applyJourney(journey)
    return journey
  }

  const analysisStage = isAnalyzing
    ? 'analyzing'
    : resumeAnalysisStatus === 'unreadable'
      ? 'unreadable'
      : hasAnalysisData(resumeAnalysis)
        ? 'ready'
        : resume.fileName
          ? 'processing'
          : 'idle'

  const genericResumeSummary = useMemo(() => {
    const summary = String(resumeAnalysis?.summary || '').trim()
    if (summary) return summary
    return 'Generic resume upload complete. Skills were extracted, but role relevance is not yet ranked.'
  }, [resumeAnalysis?.summary])

  const genericSkillPreview = useMemo(() => {
    const skills = Array.isArray(resumeAnalysis?.skills) ? resumeAnalysis.skills : []
    return skills.slice(0, 5)
  }, [resumeAnalysis?.skills])

  const handleReanalyze = async () => {
    if (!resume.fileName) return
    await runResumeAnalysis()
  }

  const handleJobMatchAnalyze = async () => {
    if (!resume.fileName) {
      setJobMatchError('Upload a resume before matching it against a job description.')
      return
    }
    if (jobDescription.trim().length < 40) {
      setJobMatchError('Paste a fuller job description so the AI can score the match properly.')
      return
    }

    try {
      setJobMatchError('')
      setIsMatchingJob(true)
      const updated = await employeeJourneyService.matchResumeToJob(jobDescription)
      applyJobMatchResult(updated)
    } catch (error) {
      setJobMatchError(error?.message || 'Unable to generate a job match report right now. Please try again.')
    } finally {
      setIsMatchingJob(false)
    }
  }

  const canContinue =
    (currentStep === 1 &&
      profile.fullName &&
      profile.email &&
      profile.employeeId &&
      profile.role &&
      profile.department &&
      profile.summary) ||
    (currentStep === 2 && resume.fileName) ||
    (currentStep === 3 && selectedDomains.length > 0 && selectedSkills.length > 0)

  const updateProfileField = (field, value) => {
    setProfile((prev) => ({ ...prev, [field]: value }))
    setProfileDirty(true)
  }

  const handleResumeUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadError('')
    const lowerName = file.name.toLowerCase()
    const isPdf = lowerName.endsWith('.pdf') && (file.type === 'application/pdf' || !file.type)
    if (!isPdf) {
      setUploadError('Only PDF resumes are allowed. Please upload a .pdf file.')
      event.target.value = ''
      return
    }

    try {
      const fileData = await readFileAsDataUrl(file)
      setResume({
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
        fileSize: file.size,
        contentType: file.type || 'application/pdf',
        fileData,
      })
      setJobMatchAnalysis(null)
      setJobMatchAnalyzedAt('')
      setJobMatchError('')
      setResumeDirty(true)
    } catch (error) {
      setUploadError(error.message)
    } finally {
      event.target.value = ''
    }
  }

  const handleQuickResumeUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadError('')
    const lowerName = file.name.toLowerCase()
    const isPdf = lowerName.endsWith('.pdf') && (file.type === 'application/pdf' || !file.type)
    if (!isPdf) {
      setUploadError('Only PDF resumes are allowed. Please upload a .pdf file.')
      event.target.value = ''
      return
    }

    try {
      setIsAnalyzing(true)
      const fileData = await readFileAsDataUrl(file)
      const nextResume = {
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
        fileSize: file.size,
        contentType: file.type || 'application/pdf',
        fileData,
      }
      setResume(nextResume)
      setJobMatchAnalysis(null)
      setJobMatchAnalyzedAt('')
      setJobMatchError('')
      const updated = await employeeJourneyService.saveResume(nextResume)
      setResumeDirty(false)
      applyResumeAnalysisResult(updated, { openModal: true })

      let finalJourney = updated
      if (!hasAnalysisData(updated.resumeAnalysis)) {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)))
          const journey = await refreshJourneyAnalysis()
          finalJourney = journey
          if (hasAnalysisData(journey.resumeAnalysis)) {
            openResumeAnalysisModalIfReady(journey.resumeAnalysis, journey.resumeAnalysisStatus || '')
            break
          }
        }
      }
      if (finalJourney?.resumeAnalysisStatus === 'unreadable') {
        setIsResumeAnalysisModalOpen(false)
      }
    } catch (error) {
      setUploadError(error.message || 'Unable to analyze resume right now. Please try again.')
    } finally {
      setIsAnalyzing(false)
      event.target.value = ''
    }
  }

  const handlePhotoUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setUploadError('Profile photo must be an image file.')
      event.target.value = ''
      return
    }

    try {
      const photoData = await readFileAsDataUrl(file)
      setProfile((prev) => ({ ...prev, photoData }))
      setProfileDirty(true)
      setUploadError('')
    } catch (error) {
      setUploadError(error.message)
    } finally {
      event.target.value = ''
    }
  }

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setCameraOpen(false)
  }

  const openCamera = async () => {
    setCameraError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      streamRef.current = stream
      setCameraOpen(true)
      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      }, 50)
    } catch {
      setCameraError('Unable to access camera. Please allow camera permission or upload an image instead.')
    }
  }

  const captureFromCamera = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth || !video.videoHeight) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) return
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const photoData = canvas.toDataURL('image/jpeg', 0.92)
    setProfile((prev) => ({ ...prev, photoData }))
    setProfileDirty(true)
    setUploadError('')
    closeCamera()
  }

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  useEffect(() => {
    if (!isResumeAnalysisModalOpen) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsResumeAnalysisModalOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isResumeAnalysisModalOpen])

  const nextStep = async () => {
    if (isSubmitting) return
    setActionError('')
    setUploadError('')

    try {
      setIsSubmitting(true)
      if (currentStep === 1 && profileDirty) {
        await employeeJourneyService.saveProfile(profile)
        setProfileDirty(false)
      }
      if (currentStep === 2) {
        const updated = await employeeJourneyService.saveResume(resume)
        setResumeDirty(false)
        applyResumeAnalysisResult(updated)
      }
      if (currentStep < 3) {
        setCurrentStep((prev) => prev + 1)
      }
    } catch (error) {
      const message = error?.message || 'Unable to continue right now. Please try again.'
      if (currentStep === 2) setUploadError(message)
      setActionError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const startInterview = async () => {
    if (isSubmitting) return
    setActionError('')
    setUploadError('')

    try {
      setIsSubmitting(true)
      if (profileDirty) {
        await employeeJourneyService.saveProfile(profile)
        setProfileDirty(false)
      }
      if (resumeDirty || !resume.fileName) {
        const updated = await employeeJourneyService.saveResume(resume)
        setResumeDirty(false)
        applyResumeAnalysisResult(updated)
      }
      if (domainsDirty || selectedDomains.length > 0 || selectedSkills.length > 0) {
        await employeeJourneyService.saveDomains({ domains: selectedDomains, skills: selectedSkills })
        setDomainsDirty(false)
      }
      navigate('/employee/interview')
    } catch (error) {
      const message = error?.message || 'Unable to start interview right now. Please try again.'
      setActionError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {isLoadingJourney && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 flex items-center gap-3 text-sm text-gray-300">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading your dashboard data...</span>
        </div>
      )}
      <div className="rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-xl p-6 md:p-8">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-gray-300 text-sm">
              <Sparkles className="w-4 h-4" />
              <span>Employee onboarding</span>
            </div>
            <h1 className="mt-5 text-3xl md:text-4xl font-semibold">Build your employee profile before the interview</h1>
            <p className="mt-3 text-gray-400 max-w-3xl">
              We'll collect your background, resume, and technical domains so the AI interview is more targeted and useful for both you and your manager.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Current Step</p>
            <p className="mt-2 text-lg font-semibold text-white">{steps[currentStep - 1].title}</p>
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-xl p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">Resume AI Insights</h2>
            <p className="text-sm text-gray-400">Snapshot of what the AI learned from your resume.</p>
          </div>
          {resumeAnalyzedAt && (
            <span className="text-xs text-gray-400">Updated: {formatTimestamp(resumeAnalyzedAt)}</span>
          )}
        </div>

        <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="px-2 py-1 rounded-full border border-white/10 bg-black/30">PDF only</span>
            {resume.fileName && <span className="px-2 py-1 rounded-full border border-white/10 bg-black/30">{resume.fileName}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-gray-200 hover:bg-white/20 cursor-pointer">
              <CloudUpload className="w-4 h-4" />
              <span>{resume.fileName ? 'Re-upload & analyze' : 'Upload & analyze'}</span>
              <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleQuickResumeUpload} />
            </label>
            {resume.fileName && (
              <button
                type="button"
                onClick={handleReanalyze}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-gray-200 hover:bg-white/10"
              >
                Re-analyze
              </button>
            )}
            {analysisStage === 'ready' && resumeAnalysis && (
              <button
                type="button"
                onClick={() => setIsResumeAnalysisModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-500/20"
              >
                View detailed output
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 grid md:grid-cols-4 gap-3 text-xs text-gray-400">
          {[
            { id: 'upload', label: 'Upload' },
            { id: 'extract', label: 'Extract' },
            { id: 'analyze', label: 'Analyze' },
            { id: 'ready', label: 'Ready' },
          ].map((step, index) => {
            const isActive =
              (analysisStage === 'ready' && index <= 3) ||
              (analysisStage === 'analyzing' && index <= 2) ||
              (analysisStage === 'processing' && index <= 1) ||
              (analysisStage === 'unreadable' && index <= 1) ||
              (analysisStage === 'idle' && index <= 0)
            return (
              <div
                key={step.id}
                className={`rounded-xl border px-3 py-2 ${isActive ? 'border-white/20 bg-white/10 text-white' : 'border-white/10 bg-black/20'}`}
              >
                <p className="font-semibold">{step.label}</p>
                <p className="mt-1 text-[11px]">{isActive ? 'Complete' : 'Pending'}</p>
              </div>
            )
          })}
        </div>

        {analysisStage === 'analyzing' && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-gray-300 flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Analyzing your resume and generating insights...</span>
          </div>
        )}

        {uploadError && (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {uploadError}
          </div>
        )}

        {analysisStage === 'ready' && resumeAnalysis ? (
          <div className="mt-5 grid md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Summary</p>
              <p className="mt-2 text-sm text-gray-200">{resumeAnalysis.summary || 'Summary will appear after analysis.'}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 md:col-span-2">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Top Skills</p>
              {resumeAnalysis.skills?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {resumeAnalysis.skills.slice(0, 12).map((skill) => (
                    <span key={skill} className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-gray-200">
                      {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-gray-500">No skills detected yet.</p>
              )}
            </div>
          </div>
        ) : analysisStage === 'processing' ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-gray-400">
            Analysis is still processing. Please wait a moment.
          </div>
        ) : analysisStage === 'unreadable' ? (
          <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            We couldn't extract enough readable information from this resume yet. Try re-analyzing or upload a clearer PDF copy.
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-gray-400">
            Upload and analyze your resume to generate AI insights.
          </div>
        )}
      </div>

      <div className="rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-xl p-6 md:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Job Match Simulator</h2>
            <p className="text-sm text-gray-400">Paste a job description to see how this resume stacks up before the interview starts.</p>
          </div>
          {jobMatchAnalyzedAt && (
            <span className="text-xs text-gray-400">Updated: {formatTimestamp(jobMatchAnalyzedAt)}</span>
          )}
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Target Job Description</p>
              <button
                type="button"
                onClick={() => {
                  setJobDescription(SAMPLE_JOB_DESCRIPTION)
                  setJobMatchError('')
                }}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300 hover:bg-white/10"
              >
                Use sample JD
              </button>
            </div>
            <textarea
              value={jobDescription}
              onChange={(event) => {
                setJobDescription(event.target.value)
                setJobMatchError('')
              }}
              placeholder="Paste the role overview, must-have skills, responsibilities, and preferred qualifications here..."
              className="mt-4 h-56 w-full rounded-3xl border border-white/10 bg-slate-950/70 px-4 py-4 text-sm text-white placeholder:text-gray-500 focus:border-white/30 focus:outline-none"
            />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleJobMatchAnalyze}
                disabled={!resume.fileName || isMatchingJob}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isMatchingJob ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Analyzing match...</span>
                  </>
                ) : (
                  <span>Analyze Resume vs JD</span>
                )}
              </button>
              <span className="text-xs text-gray-500">
                {!resume.fileName ? 'Upload a resume first to enable matching.' : 'Great for recruiter demos and shortlist decisions.'}
              </span>
            </div>
            {jobMatchError && (
              <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {jobMatchError}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(16,185,129,0.1),rgba(2,6,23,0.7))] p-5">
            {jobMatchAnalysis ? (
              <div className="space-y-5">
                <div className="rounded-3xl border border-emerald-400/20 bg-slate-950/70 p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-200/80">AI Match Brief</p>
                  <div className="mt-4 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-4xl font-semibold text-white">{jobMatchAnalysis.score || 0}%</p>
                      <p className="mt-1 text-sm text-emerald-100">{jobMatchAnalysis.fitLabel || 'Match Score'}</p>
                    </div>
                    <div className="text-right text-xs text-slate-400">
                      <p>{jobMatchAnalysis.matchedSkillCount || 0} matched skills</p>
                      <p>{jobMatchAnalysis.jobSkillCount || 0} required signals</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-200">{jobMatchAnalysis.summary}</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Matched Skills</p>
                    {jobMatchAnalysis.matchedSkills?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {jobMatchAnalysis.matchedSkills.map((skill) => (
                          <span key={skill} className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100">
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-gray-500">No strong overlaps detected yet.</p>
                    )}
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Missing Skills</p>
                    {jobMatchAnalysis.missingSkills?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {jobMatchAnalysis.missingSkills.map((skill) => (
                          <span key={skill} className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs text-amber-100">
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-gray-500">No critical gaps detected from the pasted JD.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[280px] flex-col justify-center rounded-3xl border border-dashed border-white/10 bg-black/20 p-6 text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Recruiter Preview</p>
                <h3 className="mt-4 text-2xl font-semibold text-white">Instant role-fit scoring</h3>
                <p className="mt-3 text-sm leading-7 text-gray-400">
                  Upload any resume, then paste a role JD to transform the profile from generic extraction into a role-specific hiring brief with fit score, missing skills, and interview focus.
                </p>
                <div className="mt-5 grid gap-2 text-left text-xs text-gray-300">
                  <p className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">1. Parse resume into skills, experience, and summary.</p>
                  <p className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">2. Match the same resume against a target role.</p>
                  <p className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">3. Generate manager-ready interview signals instantly.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {jobMatchAnalysis && (
          <>
            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Generic Resume Snapshot</p>
                <p className="mt-3 text-sm leading-7 text-slate-200">{genericResumeSummary}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {genericSkillPreview.length ? (
                    genericSkillPreview.map((skill) => (
                      <span key={skill} className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-xs text-gray-200">
                        {skill}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-500">Run resume analysis to display top extracted skills.</span>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-100/80">Role-Specific Hiring Brief</p>
                <p className="mt-3 text-sm leading-7 text-slate-100">{jobMatchAnalysis.summary || 'Role match summary will appear here.'}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-200">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2">
                    <p className="text-gray-400">Fit label</p>
                    <p className="mt-1 font-semibold text-white">{jobMatchAnalysis.fitLabel || 'Pending'}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2">
                    <p className="text-gray-400">Manager next move</p>
                    <p className="mt-1 font-semibold text-white">{jobMatchAnalysis.recommendedActions?.[0] || 'Gather one focused evidence check.'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Interview Focus Areas</p>
                {jobMatchAnalysis.interviewFocus?.length ? (
                  <div className="mt-4 space-y-3">
                    {jobMatchAnalysis.interviewFocus.map((item, index) => (
                      <div key={`${item}-${index}`} className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-200">
                        {item}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-gray-500">Focus areas will appear after analysis.</p>
                )}
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Recommended Actions</p>
                {jobMatchAnalysis.recommendedActions?.length ? (
                  <div className="mt-4 space-y-3">
                    {jobMatchAnalysis.recommendedActions.map((item, index) => (
                      <div key={`${item}-${index}`} className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-200">
                        {item}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-gray-500">Actions will appear after analysis.</p>
                )}
              </div>
            </div>
          </>
        )}

        {jobMatchAnalysis?.domainAlignment?.length ? (
          <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Domain Alignment</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {jobMatchAnalysis.domainAlignment.map((item) => (
                <div key={item.domain} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{item.domain}</p>
                    <span className="text-xs text-emerald-100">{item.score}%</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" style={{ width: `${Math.max(item.score || 0, 6)}%` }} />
                  </div>
                  <p className="mt-3 text-xs text-slate-400">
                    {item.evidence?.length ? `Resume evidence: ${item.evidence.join(', ')}` : 'Needs more evidence in the resume or interview.'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {jobMatchAnalysis?.highlightedStrengths?.length || jobMatchAnalysis?.riskFactors?.length ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-100/80">Highlighted Strengths</p>
              <div className="mt-4 space-y-3">
                {(jobMatchAnalysis.highlightedStrengths || []).map((item, index) => (
                  <div key={`${item}-${index}`} className="rounded-2xl border border-emerald-400/15 bg-slate-950/40 px-4 py-3 text-sm text-emerald-50">
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-amber-400/20 bg-amber-500/10 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-100/80">Risk Factors</p>
              <div className="mt-4 space-y-3">
                {(jobMatchAnalysis.riskFactors || []).map((item, index) => (
                  <div key={`${item}-${index}`} className="rounded-2xl border border-amber-400/15 bg-slate-950/40 px-4 py-3 text-sm text-amber-50">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`rounded-3xl border p-5 ${
              currentStep === step.id
                ? 'border-white/20 bg-white text-black'
                : currentStep > step.id
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-white/10 bg-white/5 text-gray-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{step.title}</p>
              {currentStep > step.id ? <CheckCircle2 className="w-5 h-5" /> : <span className="text-xs">0{step.id}</span>}
            </div>
            <p className={`mt-2 text-sm ${currentStep === step.id ? 'text-gray-700' : currentStep > step.id ? 'text-emerald-200' : 'text-gray-500'}`}>
              {step.desc}
            </p>
          </div>
        ))}
      </div>

      <motion.div
        key={currentStep}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-xl p-6 md:p-8"
      >
        {currentStep === 1 && (
          <div className="space-y-5">
            <h2 className="text-2xl font-semibold">Employee profile card</h2>
            <div className="rounded-3xl border border-white/10 bg-black/20 p-5 md:p-6">
              <div className="grid lg:grid-cols-[230px_1fr] gap-6">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Profile photo</label>
                  <div className="group relative block rounded-3xl border border-white/15 bg-black/40 p-3 overflow-hidden">
                    <div className="relative aspect-square rounded-2xl bg-gray-900 border border-white/10 overflow-hidden flex items-center justify-center">
                      {profile.photoData ? <img src={profile.photoData} alt="Profile preview" className="h-full w-full object-cover" /> : <div className="text-gray-500 text-sm">Add photo</div>}
                      <div className="absolute bottom-3 right-3 w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center pointer-events-none">
                        <Camera className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <label className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-gray-200 hover:bg-white/5 cursor-pointer">
                        <CloudUpload className="w-3 h-3" />
                        <span>Upload</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                      </label>
                      <button
                        type="button"
                        onClick={openCamera}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-gray-200 hover:bg-white/5"
                      >
                        <Camera className="w-3 h-3" />
                        <span>Camera</span>
                      </button>
                    </div>
                  </div>
                  {cameraError && <p className="mt-2 text-xs text-red-300">{cameraError}</p>}
                </div>

                <div className="space-y-5">
                  <div className="grid md:grid-cols-2 gap-5">
                    {[
                      ['fullName', 'Full Name', 'Aarush Sharma'],
                      ['email', 'Email', 'aarush@company.com'],
                      ['employeeId', 'Employee ID', 'EMP-1024'],
                      ['role', 'Current Role', 'Frontend Developer'],
                      ['department', 'Department', 'Engineering'],
                      ['location', 'Location', 'Mumbai, India'],
                    ].map(([field, label, placeholder]) => (
                      <div key={field}>
                        <label className="block text-sm text-gray-300 mb-2">{label}</label>
                        <input
                          type="text"
                          value={profile[field]}
                          onChange={(e) => updateProfileField(field, e.target.value)}
                          placeholder={placeholder}
                          className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-white/30"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="grid md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">Portfolio URL</label>
                      <div className="relative">
                        <Link2 className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="url"
                          value={profile.portfolioUrl}
                          onChange={(e) => updateProfileField('portfolioUrl', e.target.value)}
                          placeholder="https://portfolio.example.com"
                          className="w-full rounded-2xl border border-white/10 bg-black/40 pl-10 pr-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-white/30"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">Years of Experience</label>
                      <input
                        type="number"
                        min="0"
                        max="40"
                        value={profile.yearsExperience}
                        onChange={(e) => updateProfileField('yearsExperience', e.target.value)}
                        placeholder="4"
                        className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-white/30"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">GitHub</label>
                      <div className="relative">
                        <Github className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="url"
                          value={profile.githubUrl}
                          onChange={(e) => updateProfileField('githubUrl', e.target.value)}
                          placeholder="https://github.com/username"
                          className="w-full rounded-2xl border border-white/10 bg-black/40 pl-10 pr-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-white/30"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">LinkedIn</label>
                      <div className="relative">
                        <Linkedin className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="url"
                          value={profile.linkedinUrl}
                          onChange={(e) => updateProfileField('linkedinUrl', e.target.value)}
                          placeholder="https://linkedin.com/in/username"
                          className="w-full rounded-2xl border border-white/10 bg-black/40 pl-10 pr-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-white/30"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm text-gray-300 mb-2">Experience Level</label>
                <select
                  value={profile.experienceLevel}
                  onChange={(e) => updateProfileField('experienceLevel', e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white focus:outline-none focus:border-white/30"
                >
                  <option>Intern</option>
                  <option>Junior</option>
                  <option>Mid-level</option>
                  <option>Senior</option>
                  <option>Lead</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">Professional Summary</label>
              <textarea
                rows="5"
                value={profile.summary}
                onChange={(e) => updateProfileField('summary', e.target.value)}
                placeholder="Share the kinds of products, technologies, and responsibilities you've worked on."
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-white/30"
              />
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-5">
            <h2 className="text-2xl font-semibold">Upload your resume</h2>
            <p className="text-gray-400">
              Your actual resume file is saved with your onboarding record so your manager can review and download it during assessment review.
            </p>

            <label className="block rounded-[2rem] border border-dashed border-white/15 bg-black/20 p-8 cursor-pointer hover:border-white/30 transition-colors">
              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-white text-black flex items-center justify-center">
                  <CloudUpload className="w-6 h-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">Upload resume</h3>
                <p className="mt-2 text-sm text-gray-500">PDF only. Click to choose a file.</p>
                <input type="file" className="hidden" accept=".pdf,application/pdf" onChange={handleResumeUpload} />
              </div>
            </label>

            {uploadError && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{uploadError}</div>}

            {resume.fileName && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
                <p className="text-sm text-emerald-300">Uploaded file</p>
                <p className="mt-2 text-lg font-semibold text-white">{resume.fileName}</p>
                <p className="mt-1 text-sm text-gray-400">
                  {Math.max(1, Math.round((resume.fileSize || 0) / 1024))} KB | {new Date(resume.uploadedAt).toLocaleString()}
                </p>
              </div>
            )}

            <div className="rounded-3xl border border-white/10 bg-black/20 p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-white">Resume Insights</h3>
                  <p className="text-xs text-gray-500">This analysis helps the AI create better interview questions and scoring.</p>
                </div>
                {resumeAnalyzedAt && (
                  <span className="text-xs text-gray-400">Analyzed: {formatTimestamp(resumeAnalyzedAt)}</span>
                )}
              </div>

              {resumeAnalysis ? (
                <div className="space-y-4">
                  {resumeAnalysis.summary && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Summary</p>
                      <p className="mt-2 text-sm text-gray-200">{resumeAnalysis.summary}</p>
                    </div>
                  )}

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Top Skills</p>
                    {resumeAnalysis.skills?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {resumeAnalysis.skills.map((skill) => (
                          <span key={skill} className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-gray-200">
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-gray-500">No skills detected yet. Upload a clearer PDF for best results.</p>
                    )}
                  </div>

                  {(resumeAnalysis.experience?.length || resumeAnalysis.education?.length) && (
                    <div className="grid md:grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Experience</p>
                        {resumeAnalysis.experience?.length ? (
                          <div className="mt-3 space-y-2 text-sm text-gray-200">
                            {resumeAnalysis.experience.slice(0, 4).map((item, index) => (
                              <div key={`${item.title || 'role'}-${index}`} className="rounded-xl border border-white/10 bg-black/40 p-3">
                                <p className="font-semibold">{item.title || 'Role'}</p>
                                <p className="text-xs text-gray-400">{item.company || 'Company'} · {item.duration || 'Timeline'}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-gray-500">No experience entries detected.</p>
                        )}
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Education</p>
                        {resumeAnalysis.education?.length ? (
                          <div className="mt-3 space-y-2 text-sm text-gray-200">
                            {resumeAnalysis.education.slice(0, 4).map((item, index) => (
                              <div key={`${item.degree || 'degree'}-${index}`} className="rounded-xl border border-white/10 bg-black/40 p-3">
                                <p className="font-semibold">{item.degree || 'Degree'}</p>
                                <p className="text-xs text-gray-400">{item.institution || 'Institution'} · {item.year || 'Year'}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-gray-500">No education entries detected.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-gray-400">
                  Upload and save your resume to generate AI-powered insights.
                </div>
              )}
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold">Choose your domains and technical skills</h2>
            <p className="text-gray-400">
              Pick the domains you want the AI interview to focus on, then select the specific technical skills you want evaluated.
            </p>

            <div className="grid xl:grid-cols-2 gap-4">
              {TECH_DOMAIN_CATALOG.map((domain) => {
                const active = selectedDomains.includes(domain.id)
                return (
                  <button
                    key={domain.id}
                    type="button"
                    onClick={() => {
                      setSelectedDomains((prev) =>
                        active ? prev.filter((item) => item !== domain.id) : [...prev, domain.id]
                      )
                      setDomainsDirty(true)
                    }}
                    className={`text-left rounded-3xl border p-5 transition-all ${
                      active ? 'border-white/20 bg-white text-black' : 'border-white/10 bg-black/20 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className={`font-semibold ${active ? 'text-black' : 'text-white'}`}>{domain.title}</h3>
                        <p className={`mt-2 text-sm ${active ? 'text-gray-700' : 'text-gray-500'}`}>
                          {domain.skills.slice(0, 6).join(', ')}
                        </p>
                      </div>
                      {active && <CheckCircle2 className="w-5 h-5 text-black" />}
                    </div>
                  </button>
                )
              })}
            </div>

            {availableSkills.length > 0 && (
              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <h3 className="text-lg font-semibold text-white">Selected skill stack</h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {availableSkills.map((skill) => {
                    const active = selectedSkills.includes(skill)
                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => {
                          setSelectedSkills((prev) =>
                            active ? prev.filter((item) => item !== skill) : [...prev, skill]
                          )
                          setDomainsDirty(true)
                        }}
                        className={`px-3 py-2 rounded-full text-sm border transition-colors ${
                          active
                            ? 'bg-white text-black border-white'
                            : 'bg-gray-900 text-gray-300 border-gray-700 hover:border-gray-500'
                        }`}
                      >
                        {skill}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          <button
            type="button"
            onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
            disabled={currentStep === 1 || isSubmitting}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          {currentStep < 3 ? (
            <button
              type="button"
              onClick={nextStep}
              disabled={!canContinue || isSubmitting}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white text-black font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={startInterview}
              disabled={!canContinue || isSubmitting}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white text-black font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Starting...</span>
                </>
              ) : (
                <>
                  <span>Start AI Interview</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
        {actionError && <p className="mt-4 text-sm text-red-300">{actionError}</p>}
      </motion.div>

      {isResumeAnalysisModalOpen && resumeAnalysis && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          onClick={() => setIsResumeAnalysisModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Resume analysis details"
            className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#07111f] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-white/10 bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(15,23,42,0.95))] px-6 py-5 md:px-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/80">Resume AI Report</p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">Detailed resume analysis</h3>
                  <p className="mt-2 text-sm text-slate-300">
                    {resume.fileName || 'Uploaded resume'}
                    {resumeAnalyzedAt ? ` • ${formatTimestamp(resumeAnalyzedAt)}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsResumeAnalysisModalOpen(false)}
                  className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-emerald-100">
                  Status: {resumeAnalysisStatus || 'ready'}
                </span>
                {resumeAnalysis.provider && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200">
                    Source: {resumeAnalysis.provider}
                  </span>
                )}
                {resumeAnalysis.confidenceScore && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200">
                    Confidence: {resumeAnalysis.confidenceScore}
                  </span>
                )}
                {resumeAnalysis.qualityGrade && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200">
                    Quality: {resumeAnalysis.qualityGrade}
                  </span>
                )}
              </div>
            </div>

            <div className="max-h-[calc(90vh-150px)] overflow-y-auto px-6 py-6 md:px-8">
              <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-5">
                  <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Executive Summary</p>
                    <p className="mt-3 text-sm leading-7 text-slate-100">
                      {resumeAnalysis.summary || 'No summary was generated for this resume yet.'}
                    </p>
                  </section>

                  <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Experience</p>
                      <span className="text-xs text-slate-500">{resumeAnalysis.experience?.length || 0} roles</span>
                    </div>
                    {resumeAnalysis.experience?.length ? (
                      <div className="mt-4 space-y-4">
                        {resumeAnalysis.experience.map((item, index) => (
                          <div key={`${item.title || 'role'}-${item.company || 'company'}-${index}`} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className="text-base font-semibold text-white">{item.title || 'Role not specified'}</p>
                                <p className="text-sm text-emerald-100/90">{item.company || 'Company not specified'}</p>
                              </div>
                              {item.duration && <span className="text-xs text-slate-400">{item.duration}</span>}
                            </div>
                            {item.highlights && <p className="mt-3 text-sm leading-6 text-slate-300">{item.highlights}</p>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-400">No work history details were extracted.</p>
                    )}
                  </section>
                </div>

                <div className="space-y-5">
                  <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Skills</p>
                      <span className="text-xs text-slate-500">{resumeAnalysis.skills?.length || 0} detected</span>
                    </div>
                    {resumeAnalysis.skills?.length ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {resumeAnalysis.skills.map((skill) => (
                          <span key={skill} className="rounded-full border border-emerald-400/15 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-50">
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-400">No skills were extracted.</p>
                    )}
                  </section>

                  <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Education</p>
                      <span className="text-xs text-slate-500">{resumeAnalysis.education?.length || 0} entries</span>
                    </div>
                    {resumeAnalysis.education?.length ? (
                      <div className="mt-4 space-y-3">
                        {resumeAnalysis.education.map((item, index) => (
                          <div key={`${item.degree || 'degree'}-${item.institution || 'institution'}-${index}`} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                            <p className="text-sm font-semibold text-white">{item.degree || 'Degree not specified'}</p>
                            <p className="mt-1 text-sm text-slate-300">{item.institution || 'Institution not specified'}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {[item.field, item.year].filter(Boolean).join(' • ') || 'Year not specified'}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-400">No education details were extracted.</p>
                    )}
                  </section>

                  {resumeAnalysis.warnings?.length ? (
                    <section className="rounded-3xl border border-amber-400/20 bg-amber-500/10 p-5">
                      <p className="text-xs uppercase tracking-[0.2em] text-amber-100/80">Warnings</p>
                      <div className="mt-3 space-y-2">
                        {resumeAnalysis.warnings.map((warning, index) => (
                          <p key={`${warning}-${index}`} className="text-sm text-amber-50">
                            {warning}
                          </p>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {cameraOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={closeCamera}>
          <div
            className="w-full max-w-2xl rounded-3xl border border-white/10 bg-gray-950 p-5 space-y-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Capture Profile Photo</h3>
              <button type="button" onClick={closeCamera} className="p-2 rounded-lg hover:bg-white/5 text-gray-300">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-2xl border border-white/10 overflow-hidden bg-black">
              <video ref={videoRef} autoPlay playsInline muted className="w-full max-h-[60vh] object-cover" />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeCamera}
                className="px-4 py-2 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={captureFromCamera}
                className="px-4 py-2 rounded-xl bg-white text-black font-semibold hover:bg-gray-200"
              >
                Use This Photo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

