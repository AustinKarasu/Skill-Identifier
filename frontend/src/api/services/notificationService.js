import { API_ENDPOINTS } from '../endpoints'
import { apiClient } from '../http'

export const notificationService = {
  async list() {
    const response = await apiClient.get(API_ENDPOINTS.notifications.list)
    return response.data
  },

  async markRead(id) {
    const response = await apiClient.post(API_ENDPOINTS.notifications.markRead(id))
    return response.data
  },
}
