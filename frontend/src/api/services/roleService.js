import { API_ENDPOINTS } from '../endpoints'
import { apiClient } from '../http'

export const roleService = {
  async list() {
    const response = await apiClient.get(API_ENDPOINTS.roles.list)
    return response.data
  },

  async create(payload) {
    const response = await apiClient.post(API_ENDPOINTS.roles.list, payload)
    return response.data
  },

  async update(id, payload) {
    const response = await apiClient.put(API_ENDPOINTS.roles.detail(id), payload)
    return response.data
  },

  async remove(id) {
    const response = await apiClient.delete(API_ENDPOINTS.roles.detail(id))
    return response.data
  },
}
