import { API_ENDPOINTS } from '../endpoints'
import { apiClient } from '../http'

export const assessmentEngineService = {
  async listRubrics() {
    const response = await apiClient.get(API_ENDPOINTS.rubrics.list)
    return response.data
  },

  async createRubric(payload) {
    const response = await apiClient.post(API_ENDPOINTS.rubrics.list, payload)
    return response.data
  },

  async updateRubric(id, payload) {
    const response = await apiClient.put(API_ENDPOINTS.rubrics.detail(id), payload)
    return response.data
  },

  async deleteRubric(id) {
    const response = await apiClient.delete(API_ENDPOINTS.rubrics.detail(id))
    return response.data
  },

  async listTemplates() {
    const response = await apiClient.get(API_ENDPOINTS.assessmentTemplates.list)
    return response.data
  },

  async createTemplate(payload) {
    const response = await apiClient.post(API_ENDPOINTS.assessmentTemplates.list, payload)
    return response.data
  },

  async updateTemplate(id, payload) {
    const response = await apiClient.put(API_ENDPOINTS.assessmentTemplates.detail(id), payload)
    return response.data
  },

  async deleteTemplate(id) {
    const response = await apiClient.delete(API_ENDPOINTS.assessmentTemplates.detail(id))
    return response.data
  },

  async listEmployeeAssessments() {
    const response = await apiClient.get(API_ENDPOINTS.employee.assessments)
    return response.data
  },

  async startEmployeeAssessment(templateId) {
    const response = await apiClient.post(API_ENDPOINTS.employee.assessmentStart(templateId))
    return response.data
  },

  async submitEmployeeAssessment(attemptId, answers) {
    const response = await apiClient.post(API_ENDPOINTS.employee.assessmentSubmit(attemptId), { answers })
    return response.data
  },

  async listEmployeeAssessmentHistory() {
    const response = await apiClient.get(API_ENDPOINTS.employee.assessmentHistory)
    return response.data
  },

  async submitFeedback(payload) {
    const response = await apiClient.post(API_ENDPOINTS.employee.feedback, payload)
    return response.data
  },

  async listFeedback() {
    const response = await apiClient.get('/feedback')
    return response.data
  },
}
