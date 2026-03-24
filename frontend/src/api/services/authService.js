import { API_ENDPOINTS } from '../endpoints'
import { apiClient } from '../http'

export const authService = {
  async loginManager(payload) {
    const response = await apiClient.post(API_ENDPOINTS.auth.managerLogin, payload)
    return response.data
  },

  async loginEmployee(payload) {
    const response = await apiClient.post(API_ENDPOINTS.auth.employeeLogin, payload)
    return response.data
  },

  async fetchCurrentUser() {
    const response = await apiClient.get(API_ENDPOINTS.auth.currentUser)
    return response.data
  },

  async logout() {
    const response = await apiClient.post(API_ENDPOINTS.auth.logout)
    return response.data
  },

  async deleteAccount(payload) {
    const response = await apiClient.delete(API_ENDPOINTS.auth.deleteAccount, { data: payload })
    return response.data
  },

  async changePassword(payload) {
    const response = await apiClient.post(API_ENDPOINTS.auth.changePassword, payload)
    return response.data
  },

  async getSessions() {
    const response = await apiClient.get(API_ENDPOINTS.auth.sessions)
    return response.data
  },

  async revokeOtherSessions() {
    const response = await apiClient.post(API_ENDPOINTS.auth.revokeOtherSessions)
    return response.data
  },

  async getTwoFactorStatus() {
    const response = await apiClient.get(API_ENDPOINTS.auth.twoFactorStatus)
    return response.data
  },

  async startTwoFactorSetup() {
    const response = await apiClient.post(API_ENDPOINTS.auth.twoFactorSetup)
    return response.data
  },

  async enableTwoFactor(payload) {
    const response = await apiClient.post(API_ENDPOINTS.auth.twoFactorEnable, payload)
    return response.data
  },

  async disableTwoFactor() {
    const response = await apiClient.post(API_ENDPOINTS.auth.twoFactorDisable)
    return response.data
  },
}
