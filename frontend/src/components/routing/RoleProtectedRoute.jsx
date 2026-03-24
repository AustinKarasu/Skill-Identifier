import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'

export default function RoleProtectedRoute({ allowedRoles = [] }) {
  const { isAuthenticated, user, booting } = useAuth()

  if (booting) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/login/manager" replace />
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return <Navigate to={user?.role === 'employee' ? '/employee' : '/'} replace />
  }

  return <Outlet />
}
