import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
const CSRF_COOKIE_NAME = 'csrf_token'

const getCookieValue = (name) => {
  if (typeof document === 'undefined') return ''
  const prefix = `${name}=`
  return document.cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix))
    ?.slice(prefix.length) || ''
}

export const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === 'true'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const method = String(config.method || 'get').toUpperCase()
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfToken = getCookieValue(CSRF_COOKIE_NAME)
    if (csrfToken) {
      config.headers = {
        ...(config.headers || {}),
        'X-CSRF-Token': csrfToken,
      }
    }
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const detail =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      'Request failed'

    return Promise.reject(new Error(detail))
  }
)
