import { API_ENDPOINTS } from '../endpoints'
import { apiClient } from '../http'

export const reportService = {
  async getSummary() {
    const response = await apiClient.get(API_ENDPOINTS.reports.summary)
    return response.data
  },
}
