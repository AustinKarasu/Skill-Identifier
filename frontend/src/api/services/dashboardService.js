import { API_ENDPOINTS } from '../endpoints'
import { apiClient } from '../http'

export const dashboardService = {
  async getSummary() {
    const response = await apiClient.get(API_ENDPOINTS.dashboard.summary)
    return response.data
  },
}
