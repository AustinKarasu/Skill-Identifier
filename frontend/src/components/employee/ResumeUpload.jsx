import React, { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Upload, FileText, AlertCircle, Check } from 'lucide-react'
import './ResumeUpload.css'

export default function ResumeUpload({ onUpload, loading }) {
  const fileInputRef = useRef(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const ALLOWED_TYPES = ['application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
  const MAX_SIZE = 10 * 1024 * 1024 // 10MB

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setSuccess(false)

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Only PDF and Word documents are allowed.')
      return
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      setError('File size must be less than 10MB.')
      return
    }

    setSelectedFile(file)
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first.')
      return
    }

    try {
      setError(null)
      
      // Simulate upload progress
      for (let i = 0; i <= 100; i += 10) {
        setUploadProgress(i)
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      setSuccess(true)
      setUploadProgress(0)
      
      // Call parent handler
      onUpload(selectedFile)
    } catch (err) {
      setError('Failed to upload resume. Please try again.')
      console.error('Upload error:', err)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    
    const file = e.dataTransfer.files?.[0]
    if (file) {
      const event = { target: { files: [file] } }
      handleFileSelect(event)
    }
  }

  return (
    <div className="resume-upload-container">
      <div className="upload-header">
        <h2>Upload Your Resume</h2>
        <p>
          Help us understand your skills and experience better. Supported formats: PDF, DOC, DOCX (Max 10MB)
        </p>
      </div>

      <div className="upload-content">
        {/* Dropzone */}
        <motion.div
          className={`upload-dropzone ${selectedFile ? 'has-file' : ''}`}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          whileHover={{ scale: 0.98 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={handleFileSelect}
            disabled={loading}
            className="hidden-input"
          />

          {!selectedFile ? (
            <div className="upload-icon-section">
              <motion.div
                className="upload-icon"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Upload size={48} />
              </motion.div>
              <h3>Drag and drop your resume here</h3>
              <p>or click to browse</p>
            </div>
          ) : (
            <div className="file-selected-section">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="file-icon"
              >
                <FileText size={40} />
              </motion.div>
              <h3>{selectedFile.name}</h3>
              <p className="file-size">
                {(selectedFile.size / 1024).toFixed(2)} KB
              </p>
            </div>
          )}
        </motion.div>

        {/* Error Display */}
        {error && (
          <motion.div
            className="upload-error"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <AlertCircle size={20} />
            <p>{error}</p>
          </motion.div>
        )}

        {/* Success Display */}
        {success && (
          <motion.div
            className="upload-success"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Check size={20} />
            <p>Resume uploaded successfully!</p>
          </motion.div>
        )}

        {/* Upload Progress */}
        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className="upload-progress">
            <p>Uploading... {uploadProgress}%</p>
            <div className="progress-bar">
              <motion.div
                className="progress-fill"
                initial={{ width: 0 }}
                animate={{ width: `${uploadProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="upload-info">
          <h4>What we do with your resume:</h4>
          <ul>
            <li>Extract technical skills and experience level</li>
            <li>Identify expertise areas for interview customization</li>
            <li>Generate adaptive questions based on your background</li>
            <li>Provide personalized evaluation report</li>
          </ul>
        </div>
      </div>

      {/* Action Button */}
      <div className="upload-actions">
        {selectedFile && (
          <motion.button
            className="btn-upload"
            onClick={handleUpload}
            disabled={loading}
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
            ) : success ? (
              <>
                <Check size={20} />
                Uploaded
              </>
            ) : (
              <>
                <Upload size={20} />
                Upload Resume
              </>
            )}
          </motion.button>
        )}
        
        {!selectedFile && (
          <button
            className="btn-browse"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
          >
            Browse File
          </button>
        )}
      </div>
    </div>
  )
}
