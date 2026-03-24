import { motion } from 'framer-motion'
import { ClipboardCheck, FileText, LogOut, Sparkles, UserRound, ChevronRight, Mail, MapPin, BriefcaseBusiness, BadgeCheck, Link2, Github, Linkedin, X, Menu } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { employeeJourneyService } from '../api/services/employeeJourneyService'
import { useAuth } from '../auth/useAuth'

export default function EmployeeLayout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const [journeyProfile, setJourneyProfile] = useState(null)
  const [showProfileCard, setShowProfileCard] = useState(false)
  const [showMobileNav, setShowMobileNav] = useState(false)

  const items = [
    { to: '/employee', label: 'Employee Profile', icon: UserRound, desc: 'Info, resume, domains' },
    { to: '/employee/interview', label: 'AI Interview', icon: ClipboardCheck, desc: 'Interview and evaluation' },
    { to: '/employee/assessments', label: 'Skill Assessments', icon: ClipboardCheck, desc: 'Structured skill tests' },
    { to: '/employee/reports', label: 'Report History', icon: FileText, desc: 'Download or share past reports' },
  ]

  useEffect(() => {
    let mounted = true
    const loadJourneyProfile = async () => {
      try {
        const journey = await employeeJourneyService.getJourney()
        if (!mounted) return
        setJourneyProfile(journey.profile || null)
      } catch {
        if (!mounted) return
        setJourneyProfile(null)
      }
    }
    loadJourneyProfile()
    return () => {
      mounted = false
    }
  }, [location.pathname, showProfileCard])

  const displayName = journeyProfile?.fullName || user?.fullName || 'Employee Session'
  const displayEmail = journeyProfile?.email || user?.email || 'employee@company.com'
  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,34,34,0.96),_rgba(0,0,0,1)_52%)] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowMobileNav(true)}
              className="lg:hidden w-10 h-10 rounded-xl border border-white/10 bg-black/40 hover:bg-white/5 transition-colors flex items-center justify-center"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5 text-gray-200" />
            </button>
            <div className="w-11 h-11 rounded-2xl bg-white text-black flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Employee Frontend</p>
              <h1 className="text-lg font-semibold">SkillSenseAI Employee Portal</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:block text-right">
              <p className="text-sm font-medium text-white">{displayName}</p>
              <p className="text-xs text-gray-500">{displayEmail}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowProfileCard((prev) => !prev)}
              className="w-10 h-10 rounded-xl border border-white/10 overflow-hidden bg-black/40 hover:bg-white/5 transition-colors flex items-center justify-center"
            >
              {journeyProfile?.photoData ? (
                <img src={journeyProfile.photoData} alt="Employee profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-semibold text-white">{initials || 'EM'}</span>
              )}
            </button>
            <button
              onClick={async () => {
                await logout()
                navigate('/login/employee', { replace: true })
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {showProfileCard && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-end p-4 md:p-8" onClick={() => setShowProfileCard(false)}>
          <div
            className="w-full max-w-md rounded-3xl border border-white/10 bg-gray-950/95 backdrop-blur-xl p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Profile</h3>
              <button type="button" onClick={() => setShowProfileCard(false)} className="p-2 rounded-lg hover:bg-white/5 text-gray-300">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 p-4 rounded-2xl border border-white/10 bg-white/5">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl border border-white/10 overflow-hidden bg-black/40 flex items-center justify-center">
                  {journeyProfile?.photoData ? <img src={journeyProfile.photoData} alt="Profile" className="w-full h-full object-cover" /> : <span className="text-sm font-semibold">{initials || 'EM'}</span>}
                </div>
                <div>
                  <p className="text-white font-semibold">{displayName}</p>
                  <p className="text-xs text-gray-400">{displayEmail}</p>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-xs text-gray-300">
                <p className="inline-flex items-center gap-2"><BadgeCheck className="w-3.5 h-3.5 text-gray-500" /> {journeyProfile?.employeeId || 'Employee ID not set'}</p>
                <p className="inline-flex items-center gap-2"><BriefcaseBusiness className="w-3.5 h-3.5 text-gray-500" /> {journeyProfile?.role || 'Role not set'}</p>
                <p className="inline-flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-gray-500" /> {journeyProfile?.location || 'Location not set'}</p>
                <p className="inline-flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-gray-500" /> {displayEmail}</p>
                {journeyProfile?.portfolioUrl && <p className="inline-flex items-center gap-2"><Link2 className="w-3.5 h-3.5 text-gray-500" /> {journeyProfile.portfolioUrl}</p>}
                {journeyProfile?.githubUrl && <p className="inline-flex items-center gap-2"><Github className="w-3.5 h-3.5 text-gray-500" /> {journeyProfile.githubUrl}</p>}
                {journeyProfile?.linkedinUrl && <p className="inline-flex items-center gap-2"><Linkedin className="w-3.5 h-3.5 text-gray-500" /> {journeyProfile.linkedinUrl}</p>}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowProfileCard(false)
                navigate('/employee')
              }}
              className="mt-4 w-full rounded-xl bg-white text-black font-semibold px-4 py-2 hover:bg-gray-200"
            >
              Edit Profile
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 grid lg:grid-cols-[280px_minmax(0,1fr)] gap-6">
        <aside className="space-y-4 hidden lg:block">
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-gray-500">Profile</p>
            <h2 className="mt-3 text-xl font-semibold">{user?.fullName || 'Employee'}</h2>
            <p className="mt-2 text-sm text-gray-400">
              Complete your profile, upload your resume, select domains, and start the AI interview.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-3">
            {items.map(({ to, label, icon: Icon, desc }) => (
              <NavLink key={to} to={to}>
                {({ isActive }) => (
                  <motion.div
                    whileHover={{ x: 4 }}
                    className={`flex items-start gap-3 rounded-2xl px-4 py-4 transition-colors ${
                      isActive ? 'bg-white text-black' : 'text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mt-0.5 ${isActive ? 'text-black' : 'text-gray-400'}`} />
                    <div className="flex-1">
                      <p className={`font-semibold ${isActive ? 'text-black' : 'text-white'}`}>{label}</p>
                      <p className={`text-xs mt-1 ${isActive ? 'text-gray-700' : 'text-gray-500'}`}>{desc}</p>
                    </div>
                    <ChevronRight className={`w-4 h-4 mt-1 ${isActive ? 'text-black' : 'text-gray-600'}`} />
                  </motion.div>
                )}
              </NavLink>
            ))}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-5">
            <div className="flex items-center gap-2 text-gray-300">
              <FileText className="w-4 h-4" />
              <p className="font-medium">What the manager will see</p>
            </div>
            <p className="mt-3 text-sm text-gray-400">
              Your selected domains, interview answers, calculated skill levels, and gap summary will be saved for the manager assessment view.
            </p>
          </div>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>

      {showMobileNav && (
        <div className="fixed inset-0 z-50 bg-black/60 lg:hidden" onClick={() => setShowMobileNav(false)}>
          <div
            className="absolute top-0 left-0 h-full w-72 bg-gray-950 border-r border-white/10 p-4 space-y-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase tracking-[0.2em] text-gray-500">Navigation</p>
              <button
                type="button"
                onClick={() => setShowMobileNav(false)}
                className="p-2 rounded-lg hover:bg-white/5 text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-gray-500">Profile</p>
              <h2 className="mt-3 text-lg font-semibold">{user?.fullName || 'Employee'}</h2>
              <p className="mt-2 text-sm text-gray-400">
                Complete your profile, upload your resume, select domains, and start the AI interview.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-3">
              {items.map(({ to, label, icon: Icon, desc }) => (
                <NavLink key={to} to={to} onClick={() => setShowMobileNav(false)}>
                  {({ isActive }) => (
                    <div
                      className={`flex items-start gap-3 rounded-2xl px-4 py-4 transition-colors ${
                        isActive ? 'bg-white text-black' : 'text-gray-300 hover:bg-white/5'
                      }`}
                    >
                      <Icon className={`w-5 h-5 mt-0.5 ${isActive ? 'text-black' : 'text-gray-400'}`} />
                      <div className="flex-1">
                        <p className={`font-semibold ${isActive ? 'text-black' : 'text-white'}`}>{label}</p>
                        <p className={`text-xs mt-1 ${isActive ? 'text-gray-700' : 'text-gray-500'}`}>{desc}</p>
                      </div>
                      <ChevronRight className={`w-4 h-4 mt-1 ${isActive ? 'text-black' : 'text-gray-600'}`} />
                    </div>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
