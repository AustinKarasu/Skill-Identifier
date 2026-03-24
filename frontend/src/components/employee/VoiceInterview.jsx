import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Volume2, Mic, MicOff, AlertCircle, Clock, SkipForward, Check } from 'lucide-react'
import { interviewService } from '../../api/services/interviewService'
import './VoiceInterview.css'

export default function VoiceInterview({
  interviewId,
  extractedSkills,
  totalQuestions = 10,
  onComplete,
}) {
  const [currentQuestion, setCurrentQuestion] = useState(1)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [isRecording, setIsRecording] = useState(false)
  const [recordedAudio, setRecordedAudio] = useState(null)
  const [recognizedText, setRecognizedText] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showSkipConfirm, setShowSkipConfirm] = useState(false)
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [questionAsked, setQuestionAsked] = useState(false)

  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const recognitionRef = useRef(null)
  const timerIntervalRef = useRef(null)

  // Initialize Web Speech API
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = false
      recognitionRef.current.interimResults = true
      recognitionRef.current.language = 'en-US'

      recognitionRef.current.onstart = () => {
        setIsListening(true)
        setRecognizedText('')
      }

      recognitionRef.current.onresult = (event) => {
        let interimTranscript = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            setRecognizedText((prev) => prev + transcript)
          } else {
            interimTranscript += transcript
          }
        }
      }

      recognitionRef.current.onerror = (event) => {
        setError(`Speech recognition error: ${event.error}`)
        setIsListening(false)
      }

      recognitionRef.current.onend = () => {
        setIsListening(false)
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
    }
  }, [])

  // Load initial question
  useEffect(() => {
    loadQuestion(currentQuestion)
  }, [currentQuestion])

  // Timer
  useEffect(() => {
    timerIntervalRef.current = setInterval(() => {
      setTimeElapsed((prev) => prev + 1)
    }, 1000)

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    }
  }, [])

  const loadQuestion = async () => {
    try {
      setLoading(true)
      setError(null)
      setRecognizedText('')
      setQuestionAsked(false)

      const question = await interviewService.getNextQuestion(interviewId, currentQuestion)
      setQuestions([...questions, question])

      // Auto-play question via text-to-speech
      setTimeout(() => {
        speakQuestion(question.text)
      }, 500)
    } catch (err) {
      setError('Failed to load question. Please try again.')
      console.error('Load question error:', err)
    } finally {
      setLoading(false)
    }
  }

  const speakQuestion = (text) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1
      utterance.pitch = 1
      utterance.volume = 1

      utterance.onend = () => {
        setQuestionAsked(true)
      }

      window.speechSynthesis.speak(utterance)
    }
  }

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)

      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
        const audioUrl = URL.createObjectURL(audioBlob)
        setRecordedAudio(audioUrl)
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()
      setIsRecording(true)

      // Start speech recognition
      if (recognitionRef.current) {
        recognitionRef.current.start()
      }
    } catch (err) {
      setError('Microphone access denied. Please enable microphone permissions.')
      console.error('Recording error:', err)
    }
  }

  const handleStopRecording = () => {
    setIsRecording(false)

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop())
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
  }

  const handleSubmitAnswer = async () => {
    if (!recognizedText && !recordedAudio) {
      setError('Please record an answer before submitting.')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const question = questions[currentQuestion - 1]
      const submissionResponse = await interviewService.submitAnswer(
        interviewId,
        question.questionId,
        recognizedText,
        recordedAudio
      )

      if (submissionResponse.success) {
        if (currentQuestion < totalQuestions) {
          setCurrentQuestion(currentQuestion + 1)
          setRecognizedText('')
          setRecordedAudio(null)
        } else {
          // Interview complete
          onComplete(submissionResponse)
        }
      }
    } catch (err) {
      setError('Failed to submit answer. Please try again.')
      console.error('Submit answer error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSkipQuestion = async () => {
    if (currentQuestion < totalQuestions) {
      setCurrentQuestion(currentQuestion + 1)
      setRecognizedText('')
      setRecordedAudio(null)
      setShowSkipConfirm(false)
    } else {
      onComplete({})
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const currentQuestionData = questions[currentQuestion - 1]
  const progressPercent = (currentQuestion / totalQuestions) * 100

  return (
    <div className="voice-interview-container">
      {/* Header */}
      <div className="interview-header-bar">
        <div className="header-info">
          <h2>Interview in Progress</h2>
          <p>
            Question {currentQuestion} of {totalQuestions}
          </p>
        </div>
        <div className="header-timer">
          <Clock size={20} />
          <span>{formatTime(timeElapsed)}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="progress-container">
        <div className="progress-bar-wrapper">
          <motion.div
            className="progress-fill"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <p className="progress-text">{Math.round(progressPercent)}%</p>
      </div>

      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="interview-error"
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
      {loading && !currentQuestionData ? (
        <motion.div
          className="loading-state"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="loading-spinner" />
          <p>Loading question...</p>
        </motion.div>
      ) : currentQuestionData ? (
        <div className="interview-content">
          {/* Question Card */}
          <motion.div
            className="question-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="question-header">
              <span className="question-badge">Question {currentQuestion}</span>
              <span className="skill-badge">{currentQuestionData.skillBased}</span>
            </div>

            <p className="question-text">{currentQuestionData.text}</p>

            {!questionAsked && (
              <motion.button
                className="btn-replay"
                onClick={() => speakQuestion(currentQuestionData.text)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Volume2 size={18} />
                Replay Question
              </motion.button>
            )}
          </motion.div>

          {/* Recording Section */}
          <motion.div
            className="recording-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="recording-prompt">
              <p>{questionAsked ? 'Your turn to answer...' : 'Question will be read aloud...'}</p>
            </div>

            {/* Transcription Display */}
            {(recognizedText || isListening) && (
              <motion.div
                className="transcription-box"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <p className="transcription-label">What we heard:</p>
                <p className="transcription-text">
                  {recognizedText || <em>Listening...</em>}
                </p>
              </motion.div>
            )}

            {/* Recording Controls */}
            <div className="recording-controls">
              {!isRecording ? (
                <motion.button
                  className="btn-record"
                  onClick={handleStartRecording}
                  disabled={!questionAsked || loading}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Mic size={24} />
                  <span>Start Recording</span>
                </motion.button>
              ) : (
                <motion.button
                  className="btn-record recording"
                  onClick={handleStopRecording}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  >
                    <MicOff size={24} />
                  </motion.div>
                  <span>Stop Recording</span>
                </motion.button>
              )}
            </div>

            {/* Audio Playback */}
            {recordedAudio && !isRecording && (
              <motion.div
                className="audio-playback"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <p>Your recording:</p>
                <audio controls src={recordedAudio} />
              </motion.div>
            )}
          </motion.div>

          {/* Action Buttons */}
          <div className="interview-actions">
            <motion.button
              className="btn-submit"
              onClick={handleSubmitAnswer}
              disabled={!recognizedText || loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {loading ? (
                <>
                  <motion.div
                    className="button-spinner"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                  Processing...
                </>
              ) : currentQuestion === totalQuestions ? (
                <>
                  <Check size={18} />
                  Complete Interview
                </>
              ) : (
                <>
                  <Check size={18} />
                  Next Question
                </>
              )}
            </motion.button>

            <motion.button
              className="btn-skip"
              onClick={() => setShowSkipConfirm(true)}
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <SkipForward size={18} />
              Skip Question
            </motion.button>
          </div>
        </div>
      ) : null}

      {/* Skip Confirmation Modal */}
      <AnimatePresence>
        {showSkipConfirm && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="modal-dialog"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
            >
              <h3>Skip Question?</h3>
              <p>This question will not be included in your evaluation.</p>
              <div className="modal-actions">
                <button
                  className="btn-cancel"
                  onClick={() => setShowSkipConfirm(false)}
                >
                  No, Answer it
                </button>
                <button
                  className="btn-confirm"
                  onClick={handleSkipQuestion}
                >
                  Yes, Skip
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
