import { motion } from 'framer-motion'
import { User, Bell, Lock, Palette, LogOut, Trash2, Globe, Database, Shield } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { authService } from '../../api/services/authService'
import { settingsService } from '../../api/services/settingsService'
import { useAuth } from '../../auth/useAuth'

const defaultSettings = {
  profile: {
    name: '',
    email: '',
    title: '',
    phone: '',
    department: '',
    manager: '',
    photoData: '',
  },
  preferences: {
    emailAlerts: true,
    assessmentNotifications: true,
    weeklyReport: true,
    pushNotifications: true,
  },
  localization: {
    language: 'en',
    timezone: 'UTC',
    dateFormat: 'MM/DD/YYYY',
  },
  privacy: {
    profileVisibility: 'everyone',
    shareAssessments: true,
    shareSkills: true,
    allowTracking: true,
  },
  security: {
    twoFactorRequired: true,
    sessionTimeoutMinutes: 60,
    lastPasswordChange: '',
  },
  appearance: {
    theme: 'dark',
    accentColor: 'White',
    fontSize: 'Normal',
  },
}

const loadInitialSettings = () => {
  return defaultSettings
}

const TAB_IDS = new Set(['profile', 'notifications', 'security', 'appearance', 'language', 'privacy', 'data'])

export default function Settings() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, deleteAccount, authLoading } = useAuth()
  const [settings, setSettings] = useState(loadInitialSettings)
  const [saveState, setSaveState] = useState({ status: 'idle', section: '', message: '' })
  const [dangerState, setDangerState] = useState({ status: 'idle', message: '' })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [showPasswords, setShowPasswords] = useState(false)
  const [sessionState, setSessionState] = useState({ loading: true, items: [] })
  const [securityState, setSecurityState] = useState({ status: 'idle', message: '' })
  const [twoFactorInfo, setTwoFactorInfo] = useState({ enabled: false, hasSecret: false, secret: '', otpauthUrl: '', qrCodeUrl: '' })
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [uploadError, setUploadError] = useState('')
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const passwordSectionRef = useRef(null)
  const twoFactorSectionRef = useRef(null)
  const searchParams = new URLSearchParams(location.search)
  const routeTab = searchParams.get('tab')
  const activeTab = routeTab && TAB_IDS.has(routeTab) ? routeTab : 'profile'

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'language', label: 'Language & Region', icon: Globe },
    { id: 'privacy', label: 'Privacy', icon: Shield },
    { id: 'data', label: 'Data & Storage', icon: Database },
  ]

  useEffect(() => {
    const accentPalette = {
      White: { color: '#f8fafc', contrast: '#0a0a0a' },
      Magenta: { color: '#ec4899', contrast: '#ffffff' },
      Blue: { color: '#3b82f6', contrast: '#ffffff' },
      Green: { color: '#22c55e', contrast: '#052e16' },
      Orange: { color: '#f97316', contrast: '#ffffff' },
    }

    const accent = accentPalette[settings.appearance.accentColor] || accentPalette.White
    document.documentElement.dataset.theme = settings.appearance.theme
    document.documentElement.dataset.accent = settings.appearance.accentColor.toLowerCase()
    document.documentElement.style.fontSize =
      settings.appearance.fontSize === 'Small'
        ? '14px'
        : settings.appearance.fontSize === 'Large'
          ? '18px'
          : '16px'
    document.documentElement.style.setProperty('--accent-color', accent.color)
    document.documentElement.style.setProperty('--accent-contrast', accent.contrast)
  }, [settings.appearance.accentColor, settings.appearance.fontSize, settings.appearance.theme])

  useEffect(() => {
    const tab = routeTab && TAB_IDS.has(routeTab) ? routeTab : 'profile'
    const section = new URLSearchParams(location.search).get('section')

    if (tab === 'security' && section) {
      window.setTimeout(() => {
        if (section === 'password') {
          passwordSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
        if (section === '2fa') {
          twoFactorSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 120)
    }
  }, [routeTab, location.search])

  useEffect(() => {
    let mounted = true

    const loadSettings = async () => {
      const loaded = await settingsService.getSettings(defaultSettings)
      if (!mounted) return

      const profileName = loaded?.profile?.name || user?.fullName || ''
      const profileEmail = loaded?.profile?.email || user?.email || ''
      const profileDepartment = loaded?.profile?.department || user?.department || ''

      setSettings({
        profile: {
          ...defaultSettings.profile,
          ...loaded.profile,
          name: profileName,
          email: profileEmail,
          department: profileDepartment,
        },
        preferences: { ...defaultSettings.preferences, ...loaded.preferences },
        localization: { ...defaultSettings.localization, ...loaded.localization },
        privacy: { ...defaultSettings.privacy, ...loaded.privacy },
        security: { ...defaultSettings.security, ...loaded.security },
        appearance: { ...defaultSettings.appearance, ...loaded.appearance },
      })
    }

    loadSettings()

    return () => {
      mounted = false
    }
  }, [user?.department, user?.email, user?.fullName])

  useEffect(() => {
    let mounted = true

    const loadSessions = async () => {
      try {
        const items = await authService.getSessions()
        if (!mounted) return
        setSessionState({ loading: false, items })
      } catch (err) {
        if (!mounted) return
        setSessionState({ loading: false, items: [] })
        setSecurityState({ status: 'error', message: err.message })
      }
    }

    const loadTwoFactorStatus = async () => {
      try {
        const status = await authService.getTwoFactorStatus()
        if (!mounted) return
        setTwoFactorInfo((prev) => ({ ...prev, ...status }))
      } catch (err) {
        if (!mounted) return
        setSecurityState({ status: 'error', message: err.message })
      }
    }

    loadSessions()
    loadTwoFactorStatus()

    return () => {
      mounted = false
    }
  }, [])

  const updateSection = (section, field, value) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }))
  }

  const toggleSectionValue = (section, field) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: !prev[section][field],
      },
    }))
  }

  const persistSettingsSection = async (section) => {
    setSaveState({ status: 'saving', section, message: `Saving ${section} settings...` })

    await settingsService.saveSection(section, settings[section] || {})

    setSaveState({
      status: 'saved',
      section,
      message: `${section.charAt(0).toUpperCase() + section.slice(1)} settings were saved to the backend.`,
    })
  }

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setSecurityState({ status: 'error', message: 'Fill in all password fields before saving.' })
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setSecurityState({ status: 'error', message: 'New password and confirmation must match.' })
      return
    }

    setSecurityState({ status: 'working', message: 'Updating your password...' })
    try {
      const result = await authService.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      })
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setSettings((prev) => ({
        ...prev,
        security: {
          ...prev.security,
          lastPasswordChange: result.lastPasswordChange,
        },
      }))
      setSecurityState({ status: 'saved', message: 'Password updated successfully and saved to backend.' })
    } catch (err) {
      setSecurityState({ status: 'error', message: err.message || 'Password update failed. Please try again.' })
    }
  }

  const handleRevokeOtherSessions = async () => {
    setSecurityState({ status: 'working', message: 'Revoking other active sessions...' })
    const result = await authService.revokeOtherSessions()
    const items = await authService.getSessions()
    setSessionState({ loading: false, items })
    setSecurityState({
      status: 'saved',
      message: result.revokedSessions > 0 ? `${result.revokedSessions} other session(s) were signed out.` : 'No other active sessions were found.',
    })
  }

  const handleTwoFactorSetup = async () => {
    setSecurityState({ status: 'working', message: 'Generating authenticator setup...' })
    try {
      const result = await authService.startTwoFactorSetup()
      setTwoFactorInfo({
        enabled: result.enabled,
        hasSecret: result.hasSecret,
        secret: result.secret,
        otpauthUrl: result.otpauthUrl,
        qrCodeUrl: result.qrCodeUrl || '',
      })
      setSecurityState({ status: 'saved', message: 'Scan the QR code (or use the key) in your authenticator app, then enter the 6-digit code to enable.' })
    } catch (err) {
      setSecurityState({ status: 'error', message: err.message })
    }
  }

  const handleTwoFactorEnable = async () => {
    if (!twoFactorCode) {
      setSecurityState({ status: 'error', message: 'Enter the 6-digit code from your authenticator app.' })
      return
    }
    setSecurityState({ status: 'working', message: 'Verifying code...' })
    try {
      const result = await authService.enableTwoFactor({ code: twoFactorCode })
      setTwoFactorCode('')
      setTwoFactorInfo((prev) => ({ ...prev, ...result }))
      setSecurityState({ status: 'saved', message: 'Two-factor authentication enabled for this account.' })
    } catch (err) {
      setSecurityState({ status: 'error', message: err.message })
    }
  }

  const handleTwoFactorDisable = async () => {
    setSecurityState({ status: 'working', message: 'Disabling two-factor authentication...' })
    try {
      const result = await authService.disableTwoFactor()
      setTwoFactorInfo((prev) => ({ ...prev, ...result, secret: '', otpauthUrl: '', qrCodeUrl: '' }))
      setSecurityState({ status: 'saved', message: 'Two-factor authentication disabled for this account.' })
    } catch (err) {
      setSecurityState({ status: 'error', message: err.message })
    }
  }

  const handleLogoutEverywhere = async () => {
    setDangerState({ status: 'working', message: 'Signing you out from this session...' })
    await logout()
    navigate('/login/manager', { replace: true })
  }

  const handleDeleteAccount = async () => {
    setDangerState({ status: 'working', message: 'Deleting account and clearing your session...' })
    await deleteAccount()
    navigate('/login/manager', { replace: true })
  }

  const handleDataExport = () => {
    const payload = {
      ...settings,
      exportedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const element = document.createElement('a')
    element.href = URL.createObjectURL(blob)
    element.download = 'admin-settings-export.json'
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  const clearLocalSettings = () => {
    settingsService.clearLocal()
    setSettings(defaultSettings)
    setSaveState({
      status: 'saved',
      section: 'data',
      message: 'Local settings cache cleared. Fresh defaults are loaded again.',
    })
  }

  const toggleButtonClass = (enabled) =>
    `relative w-12 h-6 rounded-full transition-all ${enabled ? 'bg-white' : 'bg-gray-600'}`

  const toggleThumbClass = (enabled) =>
    `absolute top-1 w-4 h-4 rounded-full bg-black transition-all ${enabled ? 'right-1' : 'left-1'}`

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('Photo upload failed. Please try again.'))
      reader.readAsDataURL(file)
    })

  const handlePhotoUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setUploadError('Profile photo must be an image file.')
      event.target.value = ''
      return
    }

    try {
      const photoData = await readFileAsDataUrl(file)
      updateSection('profile', 'photoData', photoData)
      setUploadError('')
    } catch (error) {
      setUploadError(error.message)
    } finally {
      event.target.value = ''
    }
  }

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setCameraOpen(false)
  }

  const openCamera = async () => {
    setCameraError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      streamRef.current = stream
      setCameraOpen(true)
      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      }, 50)
    } catch {
      setCameraError('Unable to access camera. Please allow camera permission or upload an image instead.')
    }
  }

  const captureFromCamera = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth || !video.videoHeight) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) return
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const photoData = canvas.toDataURL('image/jpeg', 0.92)
    updateSection('profile', 'photoData', photoData)
    setUploadError('')
    closeCamera()
  }

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  const tabContent = {
    profile: (
      <motion.div key="profile" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
        <div className="rounded-2xl border border-gray-700 bg-gray-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold">Profile Photo</h3>
              <p className="text-sm text-gray-400">Use camera or upload to personalize your profile.</p>
            </div>
            <div className="w-16 h-16 rounded-2xl bg-gray-800 overflow-hidden flex items-center justify-center text-gray-400 text-xs">
              {settings.profile.photoData ? (
                <img src={settings.profile.photoData} alt="Profile preview" className="w-full h-full object-cover" />
              ) : (
                'No Photo'
              )}
            </div>
          </div>

          {cameraError && <p className="text-sm text-red-300">{cameraError}</p>}
          {uploadError && <p className="text-sm text-red-300">{uploadError}</p>}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={openCamera}
              className="px-4 py-2 rounded-lg bg-white text-black font-semibold hover:bg-gray-200 transition-all"
            >
              Open Camera
            </button>
            <label className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 font-semibold cursor-pointer hover:bg-gray-700 transition-all">
              Upload Photo
              <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            </label>
            {settings.profile.photoData && (
              <button
                type="button"
                onClick={() => updateSection('profile', 'photoData', '')}
                className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700 transition-all"
              >
                Remove
              </button>
            )}
          </div>

          {cameraOpen && (
            <div className="rounded-xl border border-gray-700 bg-black p-4 space-y-3">
              <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg bg-black" />
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={captureFromCamera}
                  className="px-4 py-2 rounded-lg bg-white text-black font-semibold hover:bg-gray-200 transition-all"
                >
                  Capture
                </button>
                <button
                  type="button"
                  onClick={closeCamera}
                  className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {[
          ['name', 'Full Name'],
          ['email', 'Email'],
          ['title', 'Job Title'],
          ['phone', 'Phone'],
          ['department', 'Department'],
          ['manager', 'Manager'],
        ].map(([field, label]) => (
          <div key={field}>
            <label className="block text-sm font-semibold text-gray-300 mb-2">{label}</label>
            <input
              type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'}
              name={field}
              value={settings.profile[field]}
              onChange={(e) => updateSection('profile', field, e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-gray-600 focus:outline-none"
            />
          </div>
        ))}

        <button
          type="button"
          onClick={() => persistSettingsSection('profile')}
          className="w-full px-4 py-2 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-all"
        >
          Save Changes
        </button>
      </motion.div>
    ),

    notifications: (
      <motion.div key="notifications" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
        <div className="space-y-4">
          {[
            ['emailAlerts', 'Email Alerts', 'Receive email notifications for important updates and digests'],
            ['assessmentNotifications', 'Assessment Notifications', 'Get notified when assessments or interviews are submitted'],
            ['weeklyReport', 'Weekly Report', 'Receive weekly team performance digest (email + in-app)'],
            ['pushNotifications', 'Push Notifications', 'Enable in-app alerts for important activity'],
          ].map(([field, label, description]) => (
            <div key={field} className="flex items-start justify-between p-4 rounded-lg bg-gray-800 border border-gray-700">
              <div>
                <p className="font-semibold text-white">{label}</p>
                <p className="text-sm text-gray-400 mt-1">{description}</p>
              </div>
              <button
                type="button"
                onClick={() => toggleSectionValue('preferences', field)}
                className={toggleButtonClass(settings.preferences[field])}
              >
                <motion.div layout className={toggleThumbClass(settings.preferences[field])}></motion.div>
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => persistSettingsSection('preferences')}
          className="w-full px-4 py-2 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-all"
        >
          Save Notification Settings
        </button>
      </motion.div>
    ),

    security: (
      <motion.div key="security" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
        {securityState.status !== 'idle' && (
          <div className={`rounded-lg border px-4 py-3 text-sm ${
            securityState.status === 'error'
              ? 'border-red-500/30 bg-red-500/10 text-red-300'
              : securityState.status === 'working'
                ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                : 'border-green-500/30 bg-green-500/10 text-green-300'
          }`}>
            {securityState.message}
          </div>
        )}

        <div ref={passwordSectionRef} className="rounded-lg border border-gray-700 p-6 space-y-4">
          <h3 className="font-semibold text-white">Password</h3>
          <p className="text-sm text-gray-400">Change your password regularly to keep your account secure.</p>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              ['currentPassword', 'Current Password', 'Enter current password'],
              ['newPassword', 'New Password', 'Create a new password'],
              ['confirmPassword', 'Confirm Password', 'Repeat your new password'],
            ].map(([field, label, placeholder]) => (
              <div key={field}>
                <label className="block text-sm font-semibold text-gray-300 mb-2">{label}</label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={passwordForm[field]}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, [field]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-gray-600 focus:outline-none"
                />
              </div>
            ))}
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={showPasswords}
              onChange={(e) => setShowPasswords(e.target.checked)}
              className="h-4 w-4"
            />
            <span>Show passwords</span>
          </label>
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-gray-500">
              Last changed: {settings.security.lastPasswordChange ? new Date(settings.security.lastPasswordChange).toLocaleString() : 'Not recorded yet'}
            </p>
            <button
              type="button"
              onClick={handleChangePassword}
              className="px-4 py-2 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-all"
            >
              Update Password
            </button>
          </div>
        </div>

        <div ref={twoFactorSectionRef} className="rounded-lg border border-gray-700 p-6 space-y-4">
          <h3 className="font-semibold text-white">Two-Factor Authentication</h3>
          <p className="text-sm text-gray-400">
            Connect your authenticator app (Google Authenticator, Authy, 1Password, etc.) and verify a 6-digit TOTP code to enable 2FA.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-300">
            <span className="font-semibold text-white">Status:</span>
            <span className={`px-3 py-1 rounded-full border ${twoFactorInfo.enabled ? 'border-green-500/40 bg-green-500/10 text-green-300' : 'border-gray-600 text-gray-300'}`}>
              {twoFactorInfo.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleTwoFactorSetup}
              className="w-full px-4 py-2 rounded-lg border border-gray-700 text-gray-200 hover:bg-gray-800 transition-all"
            >
              {twoFactorInfo.enabled ? 'Show Authenticator QR/Key' : 'Generate Authenticator QR/Key'}
            </button>
            {twoFactorInfo.otpauthUrl && (
              <div className="rounded-lg border border-gray-700 bg-gray-800 p-4 space-y-2 text-sm text-gray-200">
                {twoFactorInfo.qrCodeUrl && (
                  <img
                    src={twoFactorInfo.qrCodeUrl}
                    alt="Two-factor QR code"
                    className="w-48 h-48 rounded-lg border border-gray-700 bg-white p-2"
                  />
                )}
                <p className="font-semibold text-white">Manual setup key</p>
                <p className="font-mono break-all text-gray-100">{twoFactorInfo.secret}</p>
                <p className="text-xs text-gray-400">Add this to your authenticator app if you cannot scan a QR.</p>
                <p className="text-xs text-gray-500 break-all">{twoFactorInfo.otpauthUrl}</p>
              </div>
            )}
            <div className="grid md:grid-cols-3 gap-3 items-end">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-300 mb-2">Enter 6-digit code</label>
                <input
                  type="text"
                  maxLength={6}
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:border-gray-600 focus:outline-none tracking-widest text-center"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleTwoFactorEnable}
                  className="flex-1 px-4 py-2 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-all"
                  disabled={!twoFactorInfo.hasSecret}
                >
                  Enable 2FA
                </button>
                <button
                  type="button"
                  onClick={handleTwoFactorDisable}
                  className="flex-1 px-4 py-2 border border-gray-700 text-gray-200 rounded-lg hover:bg-gray-800 transition-all"
                >
                  Disable
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-semibold text-gray-300 mb-2">Session Timeout</label>
            <select
              value={settings.security.sessionTimeoutMinutes}
              onChange={(e) => updateSection('security', 'sessionTimeoutMinutes', Number(e.target.value))}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-gray-600 focus:outline-none"
            >
              <option value={30}>30 minutes</option>
              <option value={60}>60 minutes</option>
              <option value={120}>120 minutes</option>
              <option value={240}>240 minutes</option>
            </select>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => persistSettingsSection('security')}
              className="px-4 py-2 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-all"
            >
              Save Security Settings
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-gray-700 p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="font-semibold text-white">Active Sessions</h3>
              <p className="text-sm text-gray-400">Review currently active sessions for this account.</p>
            </div>
            <button
              type="button"
              onClick={handleRevokeOtherSessions}
              className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition-all"
            >
              Log Out Other Sessions
            </button>
          </div>
          <div className="space-y-3">
            {sessionState.loading ? (
              <p className="text-sm text-gray-400">Loading session history...</p>
            ) : sessionState.items.length > 0 ? (
              sessionState.items.map((session) => (
                <div key={session.id} className="rounded-lg border border-gray-700 bg-gray-800 p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-white">{session.device}</p>
                    <p className="text-sm text-gray-400">Started {new Date(session.createdAt).toLocaleString()}</p>
                  </div>
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${session.current ? 'border-green-500/30 bg-green-500/10 text-green-300' : 'border-gray-600 text-gray-300'}`}>
                    {session.current ? 'Current Session' : 'Active'}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400">No active sessions were returned by the backend.</p>
            )}
          </div>
        </div>
      </motion.div>
    ),

    appearance: (
      <motion.div key="appearance" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
        <div className="space-y-4">
          <h3 className="font-semibold text-white">Theme</h3>
          <div className="grid grid-cols-2 gap-4">
            {['dark', 'light'].map((theme) => (
              <button
                key={theme}
                type="button"
                onClick={() => updateSection('appearance', 'theme', theme)}
                className={`p-4 rounded-lg border transition-all cursor-pointer ${
                  settings.appearance.theme === theme
                    ? 'bg-white border-white text-black'
                    : 'border-gray-700 text-gray-300 hover:border-gray-600'
                }`}
              >
                {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-white">Accent Color</h3>
          <div className="grid grid-cols-5 gap-3">
            {[
              { name: 'White', color: 'bg-white' },
              { name: 'Magenta', color: 'bg-pink-500' },
              { name: 'Blue', color: 'bg-blue-500' },
              { name: 'Green', color: 'bg-green-500' },
              { name: 'Orange', color: 'bg-orange-500' },
            ].map(({ name, color }) => (
              <button
                key={name}
                type="button"
                onClick={() => updateSection('appearance', 'accentColor', name)}
                className={`h-10 rounded-lg border-2 transition-all ${color} ${
                  settings.appearance.accentColor === name ? 'border-white scale-105' : 'border-gray-700 hover:border-gray-600'
                }`}
                title={name}
              ></button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-white">Font Size</h3>
          <select
            value={settings.appearance.fontSize}
            onChange={(e) => updateSection('appearance', 'fontSize', e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-gray-600 focus:outline-none"
          >
            <option value="Small">Small</option>
            <option value="Normal">Normal</option>
            <option value="Large">Large</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => persistSettingsSection('appearance')}
          className="w-full px-4 py-2 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-all"
        >
          Save Appearance
        </button>
      </motion.div>
    ),

    language: (
      <motion.div key="language" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">Language</label>
          <select
            name="language"
            value={settings.localization.language}
            onChange={(e) => updateSection('localization', 'language', e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-gray-600 focus:outline-none"
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="it">Italian</option>
            <option value="pt">Portuguese</option>
            <option value="ja">Japanese</option>
            <option value="zh">Chinese</option>
            <option value="hi">Hindi</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">Timezone</label>
          <select
            name="timezone"
            value={settings.localization.timezone}
            onChange={(e) => updateSection('localization', 'timezone', e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-gray-600 focus:outline-none"
          >
            <option value="UTC">UTC</option>
            <option value="EST">Eastern Time (EST)</option>
            <option value="CST">Central Time (CST)</option>
            <option value="MST">Mountain Time (MST)</option>
            <option value="PST">Pacific Time (PST)</option>
            <option value="IST">India Standard Time (IST)</option>
            <option value="SGT">Singapore Time (SGT)</option>
            <option value="JST">Japan Standard Time (JST)</option>
            <option value="AEST">Australian Eastern (AEST)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">Date Format</label>
          <select
            name="dateFormat"
            value={settings.localization.dateFormat}
            onChange={(e) => updateSection('localization', 'dateFormat', e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-gray-600 focus:outline-none"
          >
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            <option value="DD.MM.YYYY">DD.MM.YYYY</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => persistSettingsSection('localization')}
          className="w-full px-4 py-2 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-all"
        >
          Save Preferences
        </button>
      </motion.div>
    ),

    privacy: (
      <motion.div key="privacy" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-3">Profile Visibility</label>
          <div className="space-y-2">
            {[
              { value: 'everyone', label: 'Everyone', desc: 'Your profile is visible to all users' },
              { value: 'team', label: 'Team Only', desc: 'Only your team can see your profile' },
              { value: 'private', label: 'Private', desc: 'Only you can see your profile' },
            ].map(({ value, label, desc }) => (
              <label key={value} className="flex items-center space-x-3 p-3 rounded-lg border border-gray-700 hover:border-gray-600 cursor-pointer">
                <input
                  type="radio"
                  name="profileVisibility"
                  value={value}
                  checked={settings.privacy.profileVisibility === value}
                  onChange={() => updateSection('privacy', 'profileVisibility', value)}
                  className="w-4 h-4"
                />
                <div>
                  <p className="text-white font-medium text-sm">{label}</p>
                  <p className="text-gray-400 text-xs">{desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {[
            ['shareAssessments', 'Share Assessment Results', 'Allow sharing your assessment scores with team'],
            ['shareSkills', 'Share Skills & Experience', 'Add your skills to the team skill pool'],
            ['allowTracking', 'Allow Analytics Tracking', 'Help us improve by tracking your activity'],
          ].map(([field, label, copy]) => (
            <label key={field} className="flex items-start justify-between p-4 rounded-lg bg-gray-800 border border-gray-700">
              <div>
                <p className="font-semibold text-white">{label}</p>
                <p className="text-sm text-gray-400 mt-1">{copy}</p>
              </div>
              <button
                type="button"
                onClick={() => toggleSectionValue('privacy', field)}
                className={toggleButtonClass(settings.privacy[field])}
              >
                <motion.div layout className={toggleThumbClass(settings.privacy[field])}></motion.div>
              </button>
            </label>
          ))}
        </div>

        <button
          type="button"
          onClick={() => persistSettingsSection('privacy')}
          className="w-full px-4 py-2 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-all"
        >
          Save Privacy Settings
        </button>
      </motion.div>
    ),

    data: (
      <motion.div key="data" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h3 className="font-semibold text-white mb-2">Storage Usage</h3>
          <p className="text-sm text-gray-400 mb-4">You are using 2.4 GB of 10 GB storage</p>
          <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-white" style={{ width: '24%' }}></div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-700 p-6 space-y-4">
          <h3 className="font-semibold text-white">Data Export</h3>
          <p className="text-sm text-gray-400">Download a copy of your current local settings payload.</p>
          <button
            type="button"
            onClick={handleDataExport}
            className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition-all"
          >
            Export Data (JSON)
          </button>
        </div>

        <div className="rounded-lg border border-gray-700 p-6 space-y-4">
          <h3 className="font-semibold text-white">FastAPI Readiness</h3>
          <p className="text-sm text-gray-400">
            Settings are already reading from and saving to the backend by section, so the current payload shape is fully synced for FastAPI.
          </p>
          <div className="text-sm text-gray-500">
            Suggested endpoint shape: `GET /api/settings` and `PUT /api/settings/:section`
          </div>
        </div>

        <div className="rounded-lg border border-gray-700 p-6 space-y-4">
          <h3 className="font-semibold text-white">Local Cache</h3>
          <p className="text-sm text-gray-400">Clear temporary local settings to simulate a fresh backend fetch later.</p>
          <button
            type="button"
            onClick={clearLocalSettings}
            className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition-all"
          >
            Clear Cache
          </button>
        </div>
      </motion.div>
    ),
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-2">Manage your account preferences, security, and personalization.</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-xl border border-gray-700/80 bg-gradient-to-r from-gray-900 to-gray-900/60 p-4 sm:p-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Account</p>
            <p className="text-white font-semibold mt-1">{settings.profile.name || user?.fullName || 'Current User'}</p>
            <p className="text-sm text-gray-400">{settings.profile.email || user?.email || 'No email configured'}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full border border-gray-600 text-xs text-gray-300 bg-gray-800/70">
              {(user?.role || 'user').toString().toUpperCase()}
            </span>
            <span className="px-2.5 py-1 rounded-full border border-gray-600 text-xs text-gray-300 bg-gray-800/70">
              {settings.profile.department || user?.department || 'Department not set'}
            </span>
          </div>
        </div>
      </motion.div>

      {saveState.status !== 'idle' && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${
          saveState.status === 'saving'
            ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
            : 'border-green-500/30 bg-green-500/10 text-green-300'
        }`}>
          {saveState.message}
        </div>
      )}

      {dangerState.status !== 'idle' && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${
          dangerState.status === 'working'
            ? 'border-red-500/30 bg-red-500/10 text-red-300'
            : 'border-green-500/30 bg-green-500/10 text-green-300'
        }`}>
          {dangerState.message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-2">
            {tabs.map(({ id, label, icon: Icon }) => (
              <motion.button
                key={id}
                whileHover={{ x: 5 }}
                onClick={() => navigate(`/settings?tab=${id}`)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                  activeTab === id
                    ? 'bg-white text-black font-semibold'
                    : 'text-gray-300 hover:bg-gray-800 border border-gray-700'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{label}</span>
              </motion.button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="bg-gray-900 border border-gray-700 rounded-lg p-6"
          >
            {tabContent[activeTab]}
          </motion.div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-red-500/10 border border-red-500/30 rounded-lg p-6"
      >
        <h3 className="text-lg font-bold text-red-400 mb-4">Danger Zone</h3>
        <p className="mb-4 text-sm text-red-200/80">
          Signed in as {settings.profile.name || 'current user'}. These actions affect your active session immediately.
        </p>
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleLogoutEverywhere}
            disabled={authLoading}
            className="w-full flex items-center justify-between p-4 rounded-lg border border-red-500/30 hover:bg-red-500/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="flex items-center space-x-3">
              <LogOut className="w-5 h-5 text-red-400" />
              <span className="text-red-400 font-semibold">Log Out</span>
            </div>
            <span className="text-xs text-red-400">All Devices</span>
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm((prev) => !prev)}
            disabled={authLoading}
            className="w-full flex items-center justify-between p-4 rounded-lg border border-red-500/30 hover:bg-red-500/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="flex items-center space-x-3">
              <Trash2 className="w-5 h-5 text-red-400" />
              <span className="text-red-400 font-semibold">Delete Account</span>
            </div>
            <span className="text-xs text-red-400">{showDeleteConfirm ? 'Confirm Below' : 'Permanent'}</span>
          </button>

          {showDeleteConfirm && (
            <div className="rounded-lg border border-red-500/30 bg-black/20 p-4 space-y-3">
              <p className="text-sm text-red-200">
                This removes the current account from the backend store and signs you out immediately.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={authLoading}
                  className="px-4 py-2 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Confirm Delete
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={authLoading}
                  className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
