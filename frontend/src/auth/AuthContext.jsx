import { useEffect, useState } from 'react'
import { authService } from '../api/services/authService'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }) {
  const [session, setSession] = useState({ user: null })
  const [authLoading, setAuthLoading] = useState(false)
  const [booting, setBooting] = useState(true)

  const persistSession = ({ user }) => {
    setSession({ user })
  }

  const clearSession = () => {
    setSession({ user: null })
  }

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setBooting(true)
      try {
        const user = await authService.fetchCurrentUser()
        if (!mounted) return
        if (user) {
          setSession({ user })
        }
      } catch {
        if (!mounted) return
        setSession({ user: null })
      } finally {
        if (mounted) setBooting(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  const loginManager = async (payload) => {
    setAuthLoading(true)
    try {
      const result = await authService.loginManager(payload)
      if (result.requiresTwoFactor) {
        return result
      }
      persistSession(result)
      return result
    } finally {
      setAuthLoading(false)
    }
  }

  const loginEmployee = async (payload) => {
    setAuthLoading(true)
    try {
      const result = await authService.loginEmployee(payload)
      if (result.requiresTwoFactor) {
        return result
      }
      persistSession(result)
      return result
    } finally {
      setAuthLoading(false)
    }
  }

  const logout = async () => {
    setAuthLoading(true)
    try {
      await authService.logout()
    } finally {
      clearSession()
      setAuthLoading(false)
    }
  }

  const deleteAccount = async () => {
    if (!session.user) return

    setAuthLoading(true)
    try {
      await authService.deleteAccount({
        userId: session.user.id,
        email: session.user.email,
      })
    } finally {
      clearSession()
      setAuthLoading(false)
    }
  }

  const value = {
    user: session.user,
    authLoading,
    booting,
    isAuthenticated: Boolean(session.user),
    loginManager,
    loginEmployee,
    logout,
    deleteAccount,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
