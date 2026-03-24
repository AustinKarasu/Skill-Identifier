import { useState } from 'react'
import { ArrowRight, UserRoundPlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import RecaptchaCheckbox from '../components/common/RecaptchaCheckbox'

export default function EmployeeAuth() {
  const navigate = useNavigate()
  const { loginEmployee, authLoading } = useAuth()
  const [form, setForm] = useState({ email: '', employeeId: '', password: '', code: '', recaptchaToken: '' })
  const [needsCode, setNeedsCode] = useState(false)
  const [error, setError] = useState('')
  const [captchaReset, setCaptchaReset] = useState(0)

  const handleEmployeeLogin = async (e) => {
    e.preventDefault()
    setError('')

    if (!form.recaptchaToken) {
      setError('Please complete the captcha verification before signing in.')
      return
    }

    try {
      const result = await loginEmployee(form)
      if (result?.requiresTwoFactor) {
        setNeedsCode(true)
        setError('Enter the 6-digit code from your authenticator app to continue.')
        return
      }
      navigate('/employee', { replace: true })
    } catch (err) {
      const message = err.message || 'Login failed.'
      setError(message)
      if (String(message).includes('timeout-or-duplicate')) {
        setForm((prev) => ({ ...prev, recaptchaToken: '' }))
        setCaptchaReset((prev) => prev + 1)
      }
    }
  }

  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-xl p-8 md:p-10 shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-sky-400/20 bg-sky-400/10 text-sky-300 text-sm">
            <UserRoundPlus className="w-4 h-4" />
            <span>Employee Access</span>
          </div>
          <h1 className="mt-6 text-3xl font-semibold">Employee login</h1>
          <p className="mt-3 text-gray-400">Sign in with your employee ID, email, password, and authenticator code.</p>
        </div>
      </div>

      <form onSubmit={handleEmployeeLogin} className="mt-8 space-y-5">
        <div>
          <label className="block text-sm text-gray-300 mb-2">Employee ID</label>
          <input
            type="text"
            value={form.employeeId}
            onChange={(e) => setForm((prev) => ({ ...prev, employeeId: e.target.value }))}
            placeholder="EMP-1001"
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-white/30"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-2">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="employee@company.com"
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-white/30"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-2">Password</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            placeholder="Enter your password"
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-white/30"
            required
          />
        </div>
        {needsCode && (
          <div>
            <label className="block text-sm text-gray-300 mb-2">Authenticator Code</label>
            <input
              type="text"
              maxLength={6}
              value={form.code}
              onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.replace(/\D/g, '') }))}
              placeholder="6-digit code"
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-white/30 text-center tracking-widest"
              required
            />
          </div>
        )}
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
          <RecaptchaCheckbox
            onVerify={(token) => setForm((prev) => ({ ...prev, recaptchaToken: token }))}
            onExpire={() => setForm((prev) => ({ ...prev, recaptchaToken: '' }))}
            resetKey={captchaReset}
          />
        </div>

        {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}

        <button
          type="submit"
          disabled={authLoading}
          className="w-full rounded-2xl bg-white text-black font-semibold px-4 py-3 hover:bg-gray-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        >
          <span>{authLoading ? 'Signing in...' : 'Login as Employee'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </div>
  )
}
