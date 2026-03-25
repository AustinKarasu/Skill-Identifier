import { API_ENDPOINTS } from '../endpoints'
import { apiClient } from '../http'

export const teamService = {
  async list() {
    const response = await apiClient.get(API_ENDPOINTS.teams.list)
    return response.data
  },

  async create(payload) {
    const response = await apiClient.post(API_ENDPOINTS.teams.list, payload)
    return response.data
  },

  async update(id, payload) {
    const response = await apiClient.put(API_ENDPOINTS.teams.detail(id), payload)
    return response.data
  },

  async remove(id) {
    const response = await apiClient.delete(API_ENDPOINTS.teams.detail(id))
    return response.data
  },

  async updateMember(id, payload) {
    const response = await apiClient.post(API_ENDPOINTS.teams.members(id), payload)
    return response.data
  },

  async suggest(id) {
    const response = await apiClient.post(API_ENDPOINTS.teams.suggest(id))
    return response.data
  },

  async applySuggestion(id, employeeIds) {
    const response = await apiClient.post(API_ENDPOINTS.teams.applySuggestion(id), { employeeIds })
    return response.data
  },
}
