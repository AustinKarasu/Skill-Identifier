import { motion } from 'framer-motion'
import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  Users,
  Briefcase,
  ClipboardCheck,
  BrainCircuit,
  CalendarDays,
  BarChart3,
  FileText,
  Trophy,
  ScrollText,
  Sliders,
  BookOpen,
  X,
} from 'lucide-react'

export default function Sidebar({ isOpen = true, onNavigate }) {
  const [showDocs, setShowDocs] = useState(false)

  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      desc: 'Overview & metrics',
      href: '/',
    },
    {
      id: 'employees',
      label: 'Employees',
      icon: Users,
      desc: 'Team management',
      href: '/employees',
    },
    {
      id: 'roles',
      label: 'Roles',
      icon: Briefcase,
      desc: 'Role & skills setup',
      href: '/roles',
    },
    {
      id: 'assessments',
      label: 'Assessments',
      icon: ClipboardCheck,
      desc: 'AI interviews',
      href: '/assessments',
    },
    {
      id: 'assessment-engine',
      label: 'Assessment Engine',
      icon: BookOpen,
      desc: 'Rubrics & tests',
      href: '/assessment-engine',
    },
    {
      id: 'interviews',
      label: 'Interview',
      icon: BrainCircuit,
      desc: 'Interview transcripts',
      href: '/interviews',
    },
    {
      id: 'manager-ops',
      label: 'Manager Ops',
      icon: CalendarDays,
      desc: 'Schedule & outreach',
      href: '/manager-ops',
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: BarChart3,
      desc: 'Analytics & insights',
      href: '/reports',
    },
    {
      id: 'resumes',
      label: 'Resumes',
      icon: FileText,
      desc: 'Resume review',
      href: '/resumes',
    },
    {
      id: 'leaderboard',
      label: 'Leaderboard',
      icon: Trophy,
      desc: 'Top performers',
      href: '/leaderboard',
    },
    {
      id: 'audit-logs',
      label: 'Audit Logs',
      icon: ScrollText,
      desc: 'Manager / employee actions',
      href: '/audit-logs',
    },
  ]

  const settingsItem = {
    id: 'settings',
    label: 'Settings',
    icon: Sliders,
    desc: 'Configuration',
    href: '/settings',
  }

  useEffect(() => {
    if (!showDocs) return undefined

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [showDocs])

  return (
    <>
      <aside
        className={`fixed left-0 top-16 md:top-20 h-[calc(100vh-4rem)] md:h-[calc(100vh-5rem)] w-64 bg-black border-r border-gray-700 transition-transform duration-300 z-30 flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
        <nav className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2">
          {menuItems.map(({ id, label, icon: Icon, desc, href }, i) => (
            <NavLink key={id} to={href} onClick={() => onNavigate && onNavigate()}>
              {({ isActive }) => (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ x: 5 }}
                  className={`w-full flex items-start space-x-3 px-4 py-3 rounded-lg transition-all duration-300 group cursor-pointer ${
                    isActive
                      ? 'bg-white text-black border border-gray-300'
                      : 'hover:bg-gray-900 border border-transparent text-gray-300'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 mt-0.5 flex-shrink-0 transition-colors ${
                      isActive ? 'text-black' : 'text-gray-400 group-hover:text-white'
                    }`}
                  />
                  <div className="flex-1 text-left">
                    <p
                      className={`font-semibold text-sm transition-colors ${
                        isActive ? 'text-black' : 'text-gray-300 group-hover:text-gray-200'
                      }`}
                    >
                      {label}
                    </p>
                    <p className={`${isActive ? 'text-gray-700' : 'text-gray-500 group-hover:text-gray-400'} text-xs`}>
                      {desc}
                    </p>
                  </div>
                  {isActive && <div className="w-1 h-8 bg-black rounded-r-full" />}
                </motion.div>
              )}
            </NavLink>
          ))}

          <div className="mt-6 border-t border-gray-700/80 pt-4">
            <NavLink to={settingsItem.href} onClick={() => onNavigate && onNavigate()}>
              {({ isActive }) => {
                const SettingsIcon = settingsItem.icon

                return (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: menuItems.length * 0.05 }}
                    whileHover={{ x: 5 }}
                    className={`w-full flex items-start space-x-3 px-4 py-3 rounded-lg transition-all duration-300 group cursor-pointer ${
                      isActive
                        ? 'bg-white text-black border border-gray-300'
                        : 'hover:bg-gray-900 border border-transparent text-gray-300'
                    }`}
                  >
                    <SettingsIcon
                      className={`w-5 h-5 mt-0.5 flex-shrink-0 transition-colors ${
                        isActive ? 'text-black' : 'text-gray-400 group-hover:text-white'
                      }`}
                    />
                    <div className="flex-1 text-left">
                      <p
                        className={`font-semibold text-sm transition-colors ${
                          isActive ? 'text-black' : 'text-gray-300 group-hover:text-gray-200'
                        }`}
                      >
                        {settingsItem.label}
                      </p>
                      <p className={`${isActive ? 'text-gray-700' : 'text-gray-500 group-hover:text-gray-400'} text-xs`}>
                        {settingsItem.desc}
                      </p>
                    </div>
                    {isActive && <div className="w-1 h-8 bg-black rounded-r-full" />}
                  </motion.div>
                )
              }}
            </NavLink>
          </div>
        </nav>

        <div className="p-4 md:p-6 border-t border-gray-700 bg-gradient-to-t from-gray-950 to-transparent">
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-2">Need Help?</p>
            <button
              onClick={() => setShowDocs(true)}
              className="w-full px-3 py-2 text-xs font-semibold text-white border border-gray-600 rounded-lg hover:bg-gray-900 transition-all duration-300 flex items-center justify-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              <span>Documentation</span>
            </button>
          </div>
        </div>
      </aside>

      {showDocs && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowDocs(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl max-h-[90vh] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-start justify-between gap-4 p-6 border-b border-gray-700">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Documentation</p>
                <h2 className="text-2xl font-bold text-white mt-2">Admin Frontend Notes</h2>
                <p className="text-gray-400 mt-2">Quick reference for wiring the dashboard to FastAPI later.</p>
              </div>
              <button
                onClick={() => setShowDocs(false)}
                className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                aria-label="Close documentation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-96px)]">
              <section className="rounded-xl border border-gray-700 bg-gray-800/50 p-5">
                <h3 className="font-semibold text-white">Suggested API Surface</h3>
                <div className="mt-3 space-y-2 text-sm text-gray-300">
                  <p>`GET /api/dashboard/summary` for stats, charts, and recent activity.</p>
                  <p>`GET /api/assessments` with search/status query params for the table and modal details.</p>
                  <p>`GET /api/roles` and `GET /api/roles/:id` for requirements and result snapshots.</p>
                  <p>`GET/PUT /api/settings` for profile, preferences, privacy, appearance, and localization.</p>
                </div>
              </section>

              <section className="rounded-xl border border-gray-700 bg-gray-800/50 p-5">
                <h3 className="font-semibold text-white">Frontend Integration Notes</h3>
                <div className="mt-3 space-y-2 text-sm text-gray-300">
                  <p>Current modals already accept structured objects, so swapping mock arrays for API responses should be straightforward.</p>
                  <p>Settings can be persisted section-by-section without changing the UI shape.</p>
                  <p>Search on assessments is client-side today and can be replaced with server filtering later.</p>
                </div>
              </section>

              <section className="rounded-xl border border-gray-700 bg-gray-800/50 p-5">
                <h3 className="font-semibold text-white">Implementation Checklist</h3>
                <div className="mt-3 space-y-2 text-sm text-gray-300">
                  <p>Return stable IDs for assessments, roles, and user settings.</p>
                  <p>Use ISO dates from FastAPI so the current date formatting helpers continue to work.</p>
                  <p>Keep booleans and enum-style fields aligned with the current component state names to minimize refactors.</p>
                </div>
              </section>
            </div>
          </motion.div>
        </div>
      )}
    </>
  )
}
