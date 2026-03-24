import { API_ENDPOINTS } from '../endpoints'
import { apiClient } from '../http'

export const managerOpsService = {
  async getWorkbench() {
    const response = await apiClient.get(API_ENDPOINTS.manager.workbench)
    return response.data
  },

  async scheduleInterview(payload) {
    const response = await apiClient.post(API_ENDPOINTS.manager.scheduleInterview, payload)
    return response.data
  },

  async sendCommunication(payload) {
    const response = await apiClient.post(API_ENDPOINTS.manager.sendCommunication, payload)
    return response.data
  },

  async enhanceCommunication(payload) {
    const response = await apiClient.post(API_ENDPOINTS.manager.enhanceCommunication, payload)
    return response.data
  },

  async updateCandidateProfile(employeeId, payload) {
    const response = await apiClient.put(API_ENDPOINTS.manager.updateCandidateProfile(employeeId), payload)
    return response.data
  },

  getScheduleIcsUrl(scheduleId) {
    const baseURL = String(apiClient.defaults.baseURL || '')
    const path = API_ENDPOINTS.manager.scheduleIcs(scheduleId)
    if (baseURL.startsWith('http')) {
      return `${baseURL}${path}`
    }
    return `${window.location.origin}${baseURL}${path}`
  },
}
