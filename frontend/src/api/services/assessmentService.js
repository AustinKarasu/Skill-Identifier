import { API_ENDPOINTS } from '../endpoints'
import { apiClient } from '../http'
import { employeeJourneyService } from './employeeJourneyService'

export const assessmentService = {
  async list() {
    const response = await apiClient.get(API_ENDPOINTS.assessments.list)
    return response.data
  },

  async downloadResume(employeeId, fileName) {
    return employeeJourneyService.downloadResume(employeeId, fileName)
  },

  getResumeViewUrl(employeeId) {
    const baseURL = String(apiClient.defaults.baseURL || '')
    const path = API_ENDPOINTS.employee.resumeView(employeeId)
    if (baseURL.startsWith('http')) {
      return `${baseURL}${path}`
    }
    return `${window.location.origin}${baseURL}${path}`
  },

  async updateResume(employeeId, resumePayload) {
    const response = await apiClient.put(API_ENDPOINTS.employee.resumeManage(employeeId), resumePayload)
    return response.data
  },

  async deleteResume(employeeId) {
    const response = await apiClient.delete(API_ENDPOINTS.employee.resumeManage(employeeId))
    return response.data
  },

  async deleteAssessment(assessmentId) {
    const response = await apiClient.delete(API_ENDPOINTS.assessments.detail(assessmentId))
    return response.data
  },

  async updateAssessment(assessmentId, payload) {
    const response = await apiClient.put(API_ENDPOINTS.assessments.detail(assessmentId), payload)
    return response.data
  },

  async getById(assessmentId) {
    const response = await apiClient.get(API_ENDPOINTS.assessments.detail(assessmentId))
    return response.data
  },

  async downloadPdf(assessmentId, fileName = 'interview-report') {
    const response = await apiClient.get(API_ENDPOINTS.assessments.pdf(assessmentId), {
      responseType: 'blob',
    })
    const blobUrl = window.URL.createObjectURL(response.data)
    const element = document.createElement('a')
    element.href = blobUrl
    element.download = `${fileName}.pdf`
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
    window.URL.revokeObjectURL(blobUrl)
  },

  async createShareLink(assessmentId) {
    const response = await apiClient.post(API_ENDPOINTS.assessments.share(assessmentId))
    return response.data
  },

  async getShared(token) {
    const response = await apiClient.get(API_ENDPOINTS.assessments.shared(token))
    return response.data
  },

  async downloadSharedPdf(token, fileName = 'shared-interview-report') {
    const response = await apiClient.get(API_ENDPOINTS.assessments.sharedPdf(token), {
      responseType: 'blob',
    })
    const blobUrl = window.URL.createObjectURL(response.data)
    const element = document.createElement('a')
    element.href = blobUrl
    element.download = `${fileName}.pdf`
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
    window.URL.revokeObjectURL(blobUrl)
  },

  async listResumeIndex() {
    const response = await apiClient.get(API_ENDPOINTS.employee.resumeIndex)
    return response.data
  },

  async getInterviewRetention() {
    const response = await apiClient.get(API_ENDPOINTS.interviews.retention)
    return response.data
  },

  async updateInterviewRetention(payload) {
    const response = await apiClient.put(API_ENDPOINTS.interviews.retention, payload)
    return response.data
  },
}
