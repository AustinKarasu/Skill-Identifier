import { API_ENDPOINTS } from '../endpoints'
import { apiClient } from '../http'

export const leaderboardService = {
  async getSummary() {
    const response = await apiClient.get(API_ENDPOINTS.leaderboard.summary)
    return response.data
  },
}
