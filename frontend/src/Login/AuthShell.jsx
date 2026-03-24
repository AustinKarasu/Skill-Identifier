import { BriefcaseBusiness, ShieldCheck, Sparkles } from 'lucide-react'
import { Link, Outlet, useLocation } from 'react-router-dom'

export default function AuthShell() {
  const location = useLocation()
  const isManager = location.pathname.includes('/manager')

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(40,40,40,0.9),_rgba(0,0,0,1)_55%)] text-white">
      <div className="min-h-screen grid lg:grid-cols-[1.15fr_0.85fr]">
        <section className="hidden lg:flex flex-col justify-between p-12 border-r border-white/10 bg-[linear-gradient(160deg,_rgba(255,255,255,0.05),_rgba(255,255,255,0.01))]">
          <div>
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full border border-white/10 bg-white/5">
              <BriefcaseBusiness className="w-5 h-5 text-white" />
              <span className="text-sm tracking-[0.2em] uppercase text-gray-300">SkillSenseAI Access</span>
            </div>
            <h1 className="mt-8 text-5xl font-semibold leading-tight max-w-xl">
              Secure sign-in flows built to plug into FastAPI without a frontend rewrite.
            </h1>
            <p className="mt-6 text-lg text-gray-300 max-w-2xl">
              Manager and employee auth are separated cleanly, session-ready, and already shaped for token-based API responses.
            </p>
          </div>

          <div className="grid gap-4">
            {[
              ['FastAPI ready endpoints', 'Auth actions are centralized in a shared service layer.'],
              ['Session persistence', 'Token and user state are already stored and guarded by routes.'],
              ['Expandable structure', 'You can attach OTP, RBAC, refresh tokens, and profile fetches later.'],
            ].map(([title, copy]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-gray-200" />
                  <h2 className="font-medium text-white">{title}</h2>
                </div>
                <p className="mt-3 text-sm text-gray-400">{copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center p-6 md:p-10">
          <div className="w-full max-w-xl">
            <div className="mb-8 flex items-center justify-between gap-3">
              <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors">
                <Sparkles className="w-4 h-4" />
                <span>SkillSenseAI</span>
              </Link>
              <div className="flex rounded-full border border-white/10 bg-white/5 p-1">
                <Link
                  to="/login/manager"
                  className={`px-4 py-2 rounded-full text-sm transition-colors ${
                    isManager ? 'bg-white text-black font-semibold' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  Manager
                </Link>
                <Link
                  to="/login/employee"
                  className={`px-4 py-2 rounded-full text-sm transition-colors ${
                    !isManager ? 'bg-white text-black font-semibold' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  Employee
                </Link>
              </div>
            </div>

            <Outlet />
          </div>
        </section>
      </div>
    </div>
  )
}
