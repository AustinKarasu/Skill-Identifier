import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader, AlertCircle, Check, FileUp, Mic, BarChart3 } from 'lucide-react'
import { interviewService } from '../../api/services/interviewService'
import ResumeUpload from './ResumeUpload'
import VoiceInterview from './VoiceInterview'
import InterviewResults from './InterviewResults'
import './InterviewFlow.css'

const STEPS = {
  UPLOAD: 'upload',
  SKILLS: 'skills',
  INTERVIEW: 'interview',
  RESULTS: 'results',
}

export default function InterviewFlow() {
  const [currentStep, setCurrentStep] = useState(STEPS.UPLOAD)
  const [interviewSession, setInterviewSession] = useState(null)
  const [extractedSkills, setExtractedSkills] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [results, setResults] = useState(null)
  const [resumeFile, setResumeFile] = useState(null)

  useEffect(() => {
    initializeInterview()
  }, [])

  const initializeInterview = async () => {
    try {
      setLoading(true)
      const session = await interviewService.startInterview()
      setInterviewSession(session)
      setError(null)
    } catch (err) {
      setError('Failed to start interview session. Please try again.')
      console.error('Interview initialization error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleResumeUpload = async (file) => {
    try {
      setLoading(true)
      setError(null)
      setResumeFile(file)

      const uploadResponse = await interviewService.uploadResume(file)

      if (uploadResponse.success) {
        setCurrentStep(STEPS.SKILLS)

        const skillsResponse = await interviewService.extractSkills(uploadResponse.resumeId)
        setExtractedSkills(skillsResponse.skills)

        setTimeout(() => {
          setCurrentStep(STEPS.INTERVIEW)
        }, 1500)
      }
    } catch (err) {
      setError('Failed to upload resume. Please try again.')
      console.error('Resume upload error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleInterviewComplete = async (interviewResults) => {
    try {
      setLoading(true)
      setError(null)

      const completionResponse = await interviewService.completeInterview(
        interviewSession.interviewId
      )

      if (completionResponse.success) {
        const resultsData = await interviewService.getInterviewResults(
          completionResponse.interviewId
        )
        setResults(resultsData)
        setCurrentStep(STEPS.RESULTS)
      }
    } catch (err) {
      setError('Failed to complete interview. Please try again.')
      console.error('Interview completion error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRestartInterview = () => {
    setCurrentStep(STEPS.UPLOAD)
    setExtractedSkills([])
    setResults(null)
    setResumeFile(null)
    setError(null)
    initializeInterview()
  }

  const stepConfig = [
    { key: STEPS.UPLOAD, label: 'Upload Resume', icon: FileUp },
    { key: STEPS.SKILLS, label: 'Analyzing Skills', icon: Loader },
    { key: STEPS.INTERVIEW, label: 'Interview', icon: Mic },
    { key: STEPS.RESULTS, label: 'Results', icon: BarChart3 },
  ]

  return (
    <div className="interview-flow-container">
      {/* Header */}
      <div className="interview-header">
        <h1>AI-Powered Interview Assessment</h1>
        <p>Professional skill evaluation through adaptive voice-based interview</p>
      </div>

      {/* Progress Stepper */}
      <div className="progress-stepper">
        {stepConfig.map((step, index) => {
          const IconComponent = step.icon
          const isCompleted =
            stepConfig.findIndex((s) => s.key === currentStep) > index ||
            currentStep === STEPS.RESULTS
          const isActive = step.key === currentStep
          const isPending = stepConfig.findIndex((s) => s.key === currentStep) < index

          return (
            <div key={step.key} className="stepper-item">
              <motion.div
                className={`step-circle ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isPending ? 'pending' : ''}`}
                initial={false}
                animate={{
                  scale: isActive ? 1.1 : 1,
                  boxShadow: isActive ? '0 0 20px rgba(59, 130, 246, 0.5)' : 'none',
                }}
              >
                {isCompleted && !isActive ? (
                  <Check size={20} />
                ) : (
                  <IconComponent
                    size={20}
                    className={isActive ? 'animate-pulse' : ''}
                  />
                )}
              </motion.div>
              <p className="step-label">{step.label}</p>

              {index < stepConfig.length - 1 && (
                <div
                  className={`step-line ${isCompleted ? 'completed' : ''}`}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="error-alert"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <AlertCircle size={20} />
            <p>{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="interview-content">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              className="loading-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Loader className="spinner" size={40} />
              <p>Processing...</p>
            </motion.div>
          ) : currentStep === STEPS.UPLOAD ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <ResumeUpload onUpload={handleResumeUpload} loading={loading} />
            </motion.div>
          ) : currentStep === STEPS.SKILLS ? (
            <motion.div
              key="skills"
              className="skills-analysis"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="analyzing-header">
                <Loader className="spinner" size={32} />
                <h2>Analyzing your resume...</h2>
              </div>
              <div className="skills-preview">
                <p>Extracted Skills:</p>
                <div className="skills-tags">
                  {extractedSkills.map((skill, idx) => (
                    <motion.div
                      key={skill.name}
                      className="skill-tag"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.1 }}
                    >
                      {skill.name}
                      <span className="skill-level">{skill.level}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : currentStep === STEPS.INTERVIEW ? (
            <motion.div
              key="interview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {interviewSession && (
                <VoiceInterview
                  interviewId={interviewSession.interviewId}
                  extractedSkills={extractedSkills}
                  totalQuestions={interviewSession.totalQuestions}
                  onComplete={handleInterviewComplete}
                />
              )}
            </motion.div>
          ) : currentStep === STEPS.RESULTS ? (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {results && (
                <InterviewResults
                  results={results}
                  onRestart={handleRestartInterview}
                />
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Footer Info */}
      <div className="interview-footer">
        <p className="footer-text">
          This interview will take approximately 45 minutes. Make sure you have a microphone
          and quiet environment.
        </p>
      </div>
    </div>
  )
}
