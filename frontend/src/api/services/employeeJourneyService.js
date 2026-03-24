import { API_ENDPOINTS } from '../endpoints'
import { apiClient } from '../http'

export const TECH_DOMAIN_CATALOG = [
  {
    id: 'frontend',
    title: 'Frontend Engineering',
    skills: ['HTML', 'CSS', 'JavaScript', 'TypeScript', 'React', 'Next.js', 'Vue', 'Angular', 'Tailwind CSS', 'Accessibility', 'Responsive Design', 'State Management'],
  },
  {
    id: 'backend',
    title: 'Backend Engineering',
    skills: ['Python', 'FastAPI', 'Node.js', 'Express', 'Java', 'Spring Boot', 'REST APIs', 'GraphQL', 'Microservices', 'Authentication', 'Caching', 'Message Queues'],
  },
  {
    id: 'database',
    title: 'Databases & Storage',
    skills: ['PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQL Optimization', 'Data Modeling', 'ORMs', 'Migrations', 'Indexing', 'Backup Strategy'],
  },
  {
    id: 'devops',
    title: 'Cloud & DevOps',
    skills: ['Docker', 'Kubernetes', 'CI/CD', 'GitHub Actions', 'AWS', 'Azure', 'GCP', 'Linux', 'Terraform', 'Observability', 'Monitoring', 'Infrastructure as Code'],
  },
  {
    id: 'mobile',
    title: 'Mobile Development',
    skills: ['React Native', 'Flutter', 'Swift', 'Kotlin', 'Mobile UX', 'Push Notifications', 'Offline Sync', 'App Store Deployment'],
  },
  {
    id: 'data-ai',
    title: 'Data & AI',
    skills: ['Pandas', 'NumPy', 'Data Analysis', 'Machine Learning', 'Prompt Engineering', 'LLM Apps', 'Vector Databases', 'ETL', 'Visualization', 'Model Evaluation'],
  },
  {
    id: 'qa',
    title: 'QA & Automation',
    skills: ['Unit Testing', 'Integration Testing', 'Playwright', 'Cypress', 'Selenium', 'Test Strategy', 'Regression Testing', 'Performance Testing', 'Bug Reporting'],
  },
  {
    id: 'security',
    title: 'Security Engineering',
    skills: ['OWASP', 'Secure Coding', 'JWT', 'RBAC', 'Pen Testing Basics', 'Secrets Management', 'Compliance', 'Threat Modeling'],
  },
]

export const employeeJourneyService = {
  async getJourney() {
    const response = await apiClient.get(API_ENDPOINTS.employee.journey)
    return response.data
  },

  async saveProfile(profile) {
    const response = await apiClient.put(API_ENDPOINTS.employee.profile, profile)
    return response.data
  },

  async saveResume(resume) {
    const response = await apiClient.put(API_ENDPOINTS.employee.resume, resume)
    return response.data
  },

  async analyzeResume() {
    const response = await apiClient.post(API_ENDPOINTS.employee.resumeAnalyze)
    return response.data
  },

  async matchResumeToJob(jobDescription) {
    const response = await apiClient.post(API_ENDPOINTS.employee.resumeJobMatch, {
      jobDescription,
    })
    return response.data
  },

  async downloadResume(employeeId, fileName = 'resume') {
    const response = await apiClient.get(API_ENDPOINTS.employee.resumeDownload(employeeId), {
      responseType: 'blob',
    })

    const blobUrl = window.URL.createObjectURL(response.data)
    const element = document.createElement('a')
    element.href = blobUrl
    element.download = fileName
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
    window.URL.revokeObjectURL(blobUrl)
  },

  async saveDomains({ domains, skills }) {
    const response = await apiClient.put(API_ENDPOINTS.employee.domains, { domains, skills })
    return response.data
  },

  async getInterviewQuestions() {
    const response = await apiClient.get(API_ENDPOINTS.employee.interviewQuestions)
    return response.data
  },

  async startInterviewSession() {
    const response = await apiClient.get(API_ENDPOINTS.employee.interviewSession)
    return response.data
  },

  async sendInterviewMessage({ sessionId, message }) {
    const response = await apiClient.post(API_ENDPOINTS.employee.interviewChat, {
      sessionId,
      message,
    })
    return response.data
  },

  async saveInterviewResult({ answers, durationMinutes, sessionId }) {
    const response = await apiClient.post(API_ENDPOINTS.employee.interviewComplete, {
      answers,
      durationMinutes,
      sessionId,
    })
    return response.data
  },

  async getInterviewResults() {
    const response = await apiClient.get(API_ENDPOINTS.assessments.list)
    return response.data.filter((item) => item.employeeId)
  },
}
