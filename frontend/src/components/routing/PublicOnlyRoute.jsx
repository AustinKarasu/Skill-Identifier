import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'

export default function PublicOnlyRoute() {
  const { isAuthenticated, user } = useAuth()

  if (isAuthenticated) {
    return <Navigate to={user?.role === 'employee' ? '/employee' : '/'} replace />
  }

  return <Outlet />
}
