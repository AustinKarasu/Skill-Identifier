import { API_ENDPOINTS } from '../endpoints'
import { apiClient } from '../http'

export const employeeService = {
  async list() {
    const response = await apiClient.get(API_ENDPOINTS.employees.list)
    return response.data
  },

  async create(payload) {
    const response = await apiClient.post(API_ENDPOINTS.employees.list, payload)
    return response.data
  },

  async update(id, payload) {
    const response = await apiClient.put(API_ENDPOINTS.employees.detail(id), payload)
    return response.data
  },

  async remove(id) {
    const response = await apiClient.delete(API_ENDPOINTS.employees.detail(id))
    return response.data
  },
}
