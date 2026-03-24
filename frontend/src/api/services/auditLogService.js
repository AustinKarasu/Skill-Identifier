import { API_ENDPOINTS } from '../endpoints'
import { apiClient } from '../http'

export const auditLogService = {
  async list(query = '') {
    const response = await apiClient.get(API_ENDPOINTS.auditLogs.list, {
      params: query ? { q: query } : {},
    })
    return response.data
  },
}

