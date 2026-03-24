import { API_ENDPOINTS } from '../endpoints'
import { apiClient } from '../http'

export const settingsService = {
  async getSettings(defaultValue) {
    const response = await apiClient.get(API_ENDPOINTS.settings.get)
    return response.data ?? defaultValue
  },

  async saveSection(section, payload) {
    const response = await apiClient.put(API_ENDPOINTS.settings.updateSection(section), payload)
    return response.data
  },

  async clearLocal() {
    return { success: true }
  },
}
