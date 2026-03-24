import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Download,
  ArrowRight,
  Award,
  Target,
  Zap,
  AlertCircle,
  BookOpen,
  CheckCircle,
  Clock,
  TrendingUp,
  Share2,
} from 'lucide-react'
import './InterviewResults.css'

export default function InterviewResults({ results, onRestart }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [expandedSkill, setExpandedSkill] = useState(null)

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <Award size={18} /> },
    { id: 'skills', label: 'Skills Analysis', icon: <TrendingUp size={18} /> },
    { id: 'gaps', label: 'Skill Gaps', icon: <Target size={18} /> },
    { id: 'courses', label: 'Learning Path', icon: <BookOpen size={18} /> },
  ]

  const getRatingColor = (rating) => {
    if (rating >= 4.5) return '#10b981'
    if (rating >= 3.5) return '#3b82f6'
    if (rating >= 2.5) return '#f59e0b'
    return '#ef4444'
  }

  const getRatingLabel = (rating) => {
    if (rating >= 4.5) return 'Advanced'
    if (rating >= 3.5) return 'Proficient'
    if (rating >= 2.5) return 'Intermediate'
    return 'Beginner'
  }

  const downloadReport = () => {
    const reportText = `
AI INTERVIEW ASSESSMENT REPORT
Generated: ${new Date().toLocaleDateString()}

OVERALL ASSESSMENT
Overall Score: ${results.scoreboardSummary.overallScore}/100
Communication Rating: ${results.scoreboardSummary.communicationRating}/10
Technical Proficiency: ${results.scoreboardSummary.technicalProficiency}/10
Problem Solving: ${results.scoreboardSummary.problemSolving}/10

SKILLS EVALUATION
${results.skillsEvaluation
  .map(
    (skill) => `
${skill.skill}: ${skill.rating}/5 (${getRatingLabel(skill.rating)})
${skill.feedback}
Topics: ${skill.topicsCovered.join(', ')}
`
  )
  .join('\n')}

STRENGTHS
${results.strengths.map((s) => `• ${s}`).join('\n')}

WEAKNESSES
${results.weaknesses.map((w) => `• ${w}`).join('\n')}

SKILL GAPS
${results.skillGaps.map((gap) => `• ${gap.skill} (${gap.priority}) - ${gap.estimatedResolutionTime}`).join('\n')}

ACTION PLAN
Short Term:
${results.actionPlan.shortTerm.map((a) => `• ${a}`).join('\n')}

Medium Term:
${results.actionPlan.mediumTerm.map((a) => `• ${a}`).join('\n')}

Long Term:
${results.actionPlan.longTerm.map((a) => `• ${a}`).join('\n')}
    `

    const blob = new Blob([reportText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `interview-report-${new Date().getTime()}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="interview-results-container">
      {/* Header */}
      <motion.div
        className="results-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="header-content">
          <h1>Interview Assessment Complete</h1>
          <p>Your professional evaluation report is ready</p>
        </div>
        <motion.div
          className="confetti-burst"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Award size={48} />
        </motion.div>
      </motion.div>

      {/* Summary Cards */}
      <motion.div
        className="summary-cards"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="summary-card primary">
          <div className="card-icon">
            <Award size={32} />
          </div>
          <div className="card-content">
            <p className="card-label">Overall Score</p>
            <p className="card-value">{results.scoreboardSummary.overallScore}</p>
            <p className="card-unit">/100</p>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon">
            <Zap size={32} />
          </div>
          <div className="card-content">
            <p className="card-label">Communication</p>
            <p className="card-value">{results.scoreboardSummary.communicationRating}</p>
            <p className="card-unit">/10</p>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon">
            <TrendingUp size={32} />
          </div>
          <div className="card-content">
            <p className="card-label">Technical Proficiency</p>
            <p className="card-value">{results.scoreboardSummary.technicalProficiency}</p>
            <p className="card-unit">/10</p>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon">
            <Clock size={32} />
          </div>
          <div className="card-content">
            <p className="card-label">Duration</p>
            <p className="card-value">{results.scoreboardSummary.interviewDuration}</p>
            <p className="card-unit">minutes</p>
          </div>
        </div>
      </motion.div>

      {/* Tab Navigation */}
      <div className="tabs-navigation">
        {tabs.map((tab) => (
          <motion.button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {tab.icon}
            {tab.label}
          </motion.button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            className="tab-content"
            key="overview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="overview-section">
              <div className="section-split">
                {/* Strengths */}
                <div className="strength-section">
                  <h3>
                    <CheckCircle size={24} />
                    Key Strengths
                  </h3>
                  <ul>
                    {results.strengths.map((strength, idx) => (
                      <motion.li
                        key={idx}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                      >
                        {strength}
                      </motion.li>
                    ))}
                  </ul>
                </div>

                {/* Weaknesses */}
                <div className="weakness-section">
                  <h3>
                    <AlertCircle size={24} />
                    Areas for Improvement
                  </h3>
                  <ul>
                    {results.weaknesses.map((weakness, idx) => (
                      <motion.li
                        key={idx}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                      >
                        {weakness}
                      </motion.li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'skills' && (
          <motion.div
            className="tab-content"
            key="skills"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="skills-grid">
              {results.skillsEvaluation.map((skill, idx) => (
                <motion.div
                  key={skill.skill}
                  className={`skill-card ${expandedSkill === skill.skill ? 'expanded' : ''}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.1 }}
                  onClick={() =>
                    setExpandedSkill(
                      expandedSkill === skill.skill ? null : skill.skill
                    )
                  }
                >
                  <div className="skill-header">
                    <h4>{skill.skill}</h4>
                    <div className="skill-rating">
                      <span
                        className="rating-value"
                        style={{ color: getRatingColor(skill.rating) }}
                      >
                        {skill.rating}/5
                      </span>
                      <span className="rating-label">
                        {getRatingLabel(skill.rating)}
                      </span>
                    </div>
                  </div>

                  <div className="rating-bar">
                    <motion.div
                      className="rating-progress"
                      initial={{ width: 0 }}
                      animate={{ width: `${(skill.rating / 5) * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.2 }}
                      style={{ backgroundColor: getRatingColor(skill.rating) }}
                    />
                  </div>

                  <AnimatePresence>
                    {expandedSkill === skill.skill && (
                      <motion.div
                        className="skill-details"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <p className="feedback">{skill.feedback}</p>
                        <div className="topics">
                          <p className="topics-label">Topics Covered:</p>
                          <div className="topics-list">
                            {skill.topicsCovered.map((topic, tidx) => (
                              <span key={tidx} className="topic-tag">
                                {topic}
                              </span>
                            ))}
                          </div>
                        </div>
                        <p className="improvements">
                          <strong>Next Steps:</strong> {skill.improvements}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'gaps' && (
          <motion.div
            className="tab-content"
            key="gaps"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="gaps-list">
              {results.skillGaps.map((gap, idx) => (
                <motion.div
                  key={gap.skill}
                  className={`gap-card priority-${gap.priority.toLowerCase()}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <div className="gap-header">
                    <del className="priority-badge">{gap.priority}</del>
                    <h4>{gap.skill}</h4>
                  </div>
                  <p className="gap-reasoning">{gap.reasoning}</p>
                  <div className="gap-timeline">
                    <Clock size={16} />
                    <span>Est. {gap.estimatedResolutionTime}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'courses' && (
          <motion.div
            className="tab-content"
            key="courses"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="courses-section">
              <div className="action-plan">
                <h3>Recommended Action Plan</h3>
                
                <div className="plan-phases">
                  <div className="plan-phase">
                    <h4>Short Term (Next 4 Weeks)</h4>
                    <ul>
                      {results.actionPlan.shortTerm.map((item, idx) => (
                        <li key={idx}>
                          <CheckCircle size={16} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="plan-phase">
                    <h4>Medium Term (4-12 Weeks)</h4>
                    <ul>
                      {results.actionPlan.mediumTerm.map((item, idx) => (
                        <li key={idx}>
                          <TrendingUp size={16} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="plan-phase">
                    <h4>Long Term (3+ Months)</h4>
                    <ul>
                      {results.actionPlan.longTerm.map((item, idx) => (
                        <li key={idx}>
                          <Award size={16} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="courses-recommended">
                <h3>Top Recommended Courses</h3>
                <div className="courses-list">
                  {results.recommendedCourses.map((course, idx) => (
                    <motion.div
                      key={course.title}
                      className="course-card"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                    >
                      <div className="course-header">
                        <h4>{course.title}</h4>
                        <span className="course-priority">{course.priority}</span>
                      </div>
                      <p className="course-description">{course.description}</p>
                      <div className="course-meta">
                        <span className="meta-item">
                          <BookOpen size={14} />
                          {course.provider}
                        </span>
                        <span className="meta-item">
                          <Clock size={14} />
                          {course.duration}
                        </span>
                        <span className="meta-item meta-difficulty">
                          {course.difficulty}
                        </span>
                      </div>
                      <div className="course-progress">
                        <p>Estimated completion: {course.estimatedCompletion}</p>
                      </div>
                      <motion.a
                        href="#"
                        className="course-enroll"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Enroll Now <ArrowRight size={16} />
                      </motion.a>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Buttons */}
      <motion.div
        className="results-actions"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <motion.button
          className="btn-download"
          onClick={downloadReport}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Download size={18} />
          Download Report
        </motion.button>

        <motion.button
          className="btn-share"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Share2 size={18} />
          Share with Manager
        </motion.button>

        <motion.button
          className="btn-restart"
          onClick={onRestart}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Take Another Interview
        </motion.button>
      </motion.div>
    </div>
  )
}
