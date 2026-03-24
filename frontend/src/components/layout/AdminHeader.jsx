import { motion } from 'framer-motion'
import { BarChart3, LogOut, Settings, User, Bell, Menu, X, Clock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { notificationService } from '../../api/services/notificationService'
import { settingsService } from '../../api/services/settingsService'
import { useAuth } from '../../auth/useAuth'

export default function AdminHeader({ onMenuClick }) {
  const navigate = useNavigate()
  const { user, logout, authLoading } = useAuth()
  const [showNotifications, setShowNotifications] = useState(false)
  const [showQuickSettings, setShowQuickSettings] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [profilePhoto, setProfilePhoto] = useState('')
  const [quickSettings, setQuickSettings] = useState({
    emailNotifications: true,
    assessmentAlerts: true,
    weeklyReports: false,
  })
  const [preferenceSnapshot, setPreferenceSnapshot] = useState({ pushNotifications: true })
  const [quickSettingsState, setQuickSettingsState] = useState({ status: 'idle', message: '' })
  const [notificationState, setNotificationState] = useState({ status: 'idle', message: '' })

  useEffect(() => {
    let mounted = true
    let intervalId

    const loadNotifications = async () => {
      try {
        const items = await notificationService.list()
        if (!mounted) return
        setNotifications(items)
        setNotificationState({ status: 'ready', message: '' })
      } catch (error) {
        if (!mounted) return
        setNotificationState({ status: 'error', message: error.message })
      }
    }

    loadNotifications()
    intervalId = window.setInterval(loadNotifications, 30000)

    const handleFocus = () => loadNotifications()
    window.addEventListener('focus', handleFocus)

    return () => {
      mounted = false
      if (intervalId) window.clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  useEffect(() => {
    const loadQuickSettings = async () => {
      try {
        const settings = await settingsService.getSettings({ preferences: {} })
        const prefs = settings.preferences || {}
        const profile = settings.profile || {}
        setPreferenceSnapshot({ pushNotifications: prefs.pushNotifications ?? true })
        setQuickSettings({
          emailNotifications: prefs.emailAlerts ?? true,
          assessmentAlerts: prefs.assessmentNotifications ?? true,
          weeklyReports: prefs.weeklyReport ?? false,
        })
        setProfilePhoto(profile.photoData || '')
      } catch {
        setQuickSettingsState({ status: 'error', message: 'Quick settings failed to load.' })
      }
    }

    loadQuickSettings()
  }, [])

  const persistQuickSettings = async (nextQuickSettings) => {
    setQuickSettingsState({ status: 'saving', message: 'Saving quick settings...' })
    try {
      await settingsService.saveSection('preferences', {
        emailAlerts: nextQuickSettings.emailNotifications,
        assessmentNotifications: nextQuickSettings.assessmentAlerts,
        weeklyReport: nextQuickSettings.weeklyReports,
        pushNotifications: preferenceSnapshot.pushNotifications,
      })
      setQuickSettingsState({ status: 'saved', message: 'Quick settings saved.' })
    } catch (error) {
      setQuickSettingsState({ status: 'error', message: error.message })
    }
  }

  const closeAllMenus = () => {
    setShowNotifications(false)
    setShowQuickSettings(false)
    setShowProfile(false)
  }

  const unreadCount = notifications.filter((item) => !item.read).length

  const handleNotificationOpen = async () => {
    const nextValue = !showNotifications
    setShowNotifications(nextValue)
    setShowQuickSettings(false)
    setShowProfile(false)

    if (nextValue) {
      try {
        const unreadItems = notifications.filter((item) => !item.read)
        if (unreadItems.length > 0) {
          await Promise.all(unreadItems.map((item) => notificationService.markRead(item.id)))
        }
        const nextNotifications = await notificationService.list()
        setNotifications(nextNotifications)
      } catch (error) {
        setNotificationState({ status: 'error', message: error.message })
      }
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login/manager', { replace: true })
  }

  return (
    <header className="sticky top-0 z-40 bg-black border-b border-gray-700 backdrop-blur-md">
      <div className="max-w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          <div className="flex items-center space-x-2 md:space-x-3">
            <button
              onClick={onMenuClick}
              className="md:hidden p-2 rounded-lg hover:bg-gray-900 transition-colors duration-300 text-gray-300 hover:text-white"
              aria-label="Toggle menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center space-x-2 md:space-x-3 group">
              <div className="p-2 bg-white rounded-lg group-hover:shadow-lg transition-all duration-300">
                <BarChart3 className="w-5 h-5 md:w-6 md:h-6 text-black" />
              </div>
              <div>
                <span className="text-lg md:text-xl font-bold text-white hidden sm:block">SkillSenseAI Admin</span>
                <p className="hidden md:block text-xs text-gray-500">{user?.role === 'employee' ? 'Employee session' : 'Manager session'}</p>
              </div>
            </motion.div>
          </div>

          <div className="flex items-center space-x-2 md:space-x-4">
            <button
              onClick={handleNotificationOpen}
              className="relative p-2 rounded-lg hover:bg-gray-900 transition-colors duration-300 text-gray-300 hover:text-white"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-[10px] font-semibold text-white flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setShowQuickSettings(!showQuickSettings)
                setShowNotifications(false)
                setShowProfile(false)
              }}
              className="p-2 rounded-lg hover:bg-gray-900 transition-colors duration-300 text-gray-300 hover:text-white"
            >
              <Settings className="w-5 h-5" />
            </button>

            <button
              onClick={() => {
                setShowProfile(!showProfile)
                setShowNotifications(false)
                setShowQuickSettings(false)
              }}
              className="p-2 rounded-lg hover:bg-gray-900 transition-colors duration-300 text-gray-300 hover:text-white"
            >
              <User className="w-5 h-5" />
            </button>

            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="p-2 rounded-lg hover:bg-red-900/30 transition-colors duration-300 text-gray-300 hover:text-red-400"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {showNotifications && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="absolute right-4 md:right-8 top-16 md:top-20 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-lg z-50">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h3 className="font-bold text-white">Notifications</h3>
            <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.map((notif) => (
              <div key={notif.id} className="p-4 border-b border-gray-800 hover:bg-gray-800 cursor-pointer transition-colors">
                <p className="text-white font-medium text-sm">{notif.title}</p>
                <p className="text-gray-400 text-xs mt-1">{notif.message}</p>
                <div className="flex items-center space-x-1 mt-2 text-gray-500 text-xs">
                  <Clock className="w-3 h-3" />
                  <span>{notif.time}</span>
                </div>
              </div>
            ))}
            {notifications.length === 0 && notificationState.status !== 'error' && (
              <div className="p-4 text-sm text-gray-400">No notifications yet.</div>
            )}
            {notificationState.status === 'error' && (
              <div className="p-4 text-sm text-red-300">Unable to load notifications: {notificationState.message}</div>
            )}
          </div>
          <div className="p-3 border-t border-gray-700">
            <button
              onClick={() => {
                closeAllMenus()
                navigate('/reports')
              }}
              className="w-full text-center text-sm text-gray-300 hover:text-white py-2 rounded hover:bg-gray-800 transition-colors"
            >
              View All
            </button>
          </div>
        </motion.div>
      )}

      {showQuickSettings && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="absolute right-4 md:right-8 top-16 md:top-20 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-lg z-50">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h3 className="font-bold text-white">Quick Settings</h3>
            <button onClick={() => setShowQuickSettings(false)} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4 space-y-3">
            {[
              ['emailNotifications', 'Email Notifications'],
              ['assessmentAlerts', 'Assessment Alerts'],
              ['weeklyReports', 'Weekly Reports'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={quickSettings[key]}
                  onChange={async () => {
                    const next = {
                      ...quickSettings,
                      [key]: !quickSettings[key],
                    }
                    setQuickSettings(next)
                    await persistQuickSettings(next)
                  }}
                  className="w-4 h-4 rounded bg-gray-800 border-gray-700"
                />
                <span className="text-gray-300 text-sm">{label}</span>
              </label>
            ))}
            {quickSettingsState.status !== 'idle' && (
              <p
                className={`text-xs ${
                  quickSettingsState.status === 'error' ? 'text-red-300' : quickSettingsState.status === 'saving' ? 'text-blue-300' : 'text-green-300'
                }`}
              >
                {quickSettingsState.message}
              </p>
            )}
          </div>
          <div className="p-3 border-t border-gray-700">
            <button
              onClick={() => {
                closeAllMenus()
                navigate('/settings')
              }}
              className="w-full text-center text-sm text-black bg-white hover:bg-gray-200 py-2 rounded font-semibold transition-colors"
            >
              Open Full Settings
            </button>
          </div>
        </motion.div>
      )}

      {showProfile && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="absolute right-4 md:right-8 top-16 md:top-20 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-lg z-50">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h3 className="font-bold text-white">Profile</h3>
            <button onClick={() => setShowProfile(false)} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center text-black font-bold overflow-hidden">
                {profilePhoto ? (
                  <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  user?.fullName?.split(' ').map((part) => part[0]).join('').slice(0, 2) || 'AD'
                )}
              </div>
              <div>
                <p className="font-bold text-white">{user?.fullName || 'Admin User'}</p>
                <p className="text-xs text-gray-400">{user?.email || 'admin@skillsenseai.com'}</p>
              </div>
            </div>
            <div className="border-t border-gray-700 pt-4 space-y-2">
              <button
                onClick={() => {
                  closeAllMenus()
                  navigate('/settings?tab=profile')
                }}
                className="w-full text-left px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded transition-colors text-sm"
              >
                Edit Profile
              </button>
              <button
                onClick={() => {
                  closeAllMenus()
                  navigate('/settings?tab=security&section=password')
                }}
                className="w-full text-left px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded transition-colors text-sm"
              >
                Change Password
              </button>
              <button
                onClick={() => {
                  closeAllMenus()
                  navigate('/settings?tab=security&section=2fa')
                }}
                className="w-full text-left px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded transition-colors text-sm"
              >
                Two-Factor Auth
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {showLogoutConfirm && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold text-white mb-2">Confirm Logout?</h2>
            <p className="text-gray-400 mb-6">
              Are you sure you want to log out? You will need to log in again to access your account.
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleLogout}
                disabled={authLoading}
                className="flex-1 bg-red-600 text-white font-semibold py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {authLoading ? 'Logging out...' : 'Logout'}
              </button>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 bg-gray-800 text-white font-semibold py-2 rounded-lg border border-gray-700 hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </header>
  )
}
