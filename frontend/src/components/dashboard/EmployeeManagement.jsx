import { motion } from 'framer-motion'
import { Plus, Search, Edit2, Trash2, CheckCircle, Eye, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { employeeService } from '../../api/services/employeeService'
import { managerOpsService } from '../../api/services/managerOpsService'
import { assessmentService } from '../../api/services/assessmentService'

const normalizeText = (value) => String(value || '').trim().toLowerCase()
const asList = (value) => (Array.isArray(value) ? value.filter(Boolean) : [])
const formatDate = (value) => {
  if (!value) return 'Not available'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString()
}

const buildManagerCandidateDraft = (candidate, employee) => {
  const profile = candidate?.profile || {}
  const settings = candidate?.settings || {}
  const settingsProfile = settings.profile || {}
  return {
    profile: {
      fullName: profile.fullName || employee?.name || '',
      email: profile.email || settingsProfile.email || employee?.email || '',
      role: profile.role || employee?.role || '',
      department: profile.department || settingsProfile.department || candidate?.department || '',
      location: profile.location || candidate?.contact?.location || '',
      yearsExperience: profile.yearsExperience || '',
      portfolioUrl: profile.portfolioUrl || '',
      githubUrl: profile.githubUrl || '',
      linkedinUrl: profile.linkedinUrl || '',
      summary: profile.summary || '',
      title: settingsProfile.title || '',
      phone: settingsProfile.phone || candidate?.contact?.phone || '',
      manager: settingsProfile.manager || '',
      photoData: settingsProfile.photoData || profile.photoData || '',
    },
    preferences: { ...(settings.preferences || {}) },
    localization: { ...(settings.localization || {}) },
    privacy: { ...(settings.privacy || {}) },
    security: {
      twoFactorRequired: Boolean(settings.security?.twoFactorRequired),
      sessionTimeoutMinutes: Number(settings.security?.sessionTimeoutMinutes || 60),
    },
    appearance: { ...(settings.appearance || {}) },
    twoFactor: {
      enabled: Boolean(candidate?.twoFactor?.enabled),
      hasSecret: Boolean(candidate?.twoFactor?.hasSecret),
    },
  }
}

export default function EmployeeManagement() {
  const [searchTerm, setSearchTerm] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [employees, setEmployees] = useState([])
  const [workbenchCandidates, setWorkbenchCandidates] = useState([])
  const [loadingEmployeeDetails, setLoadingEmployeeDetails] = useState(false)
  const [detailDraft, setDetailDraft] = useState(null)
  const [detailState, setDetailState] = useState({ status: 'idle', message: '' })

  const [formData, setFormData] = useState({
    employeeId: '',
    name: '',
    email: '',
    role: '',
    skills: '',
    status: 'pending',
    password: '',
    confirmPassword: '',
  })
  const [formError, setFormError] = useState('')
  const [savingEmployee, setSavingEmployee] = useState(false)

  const resetFormState = () => {
    setFormData({
      employeeId: '',
      name: '',
      email: '',
      role: '',
      skills: '',
      status: 'pending',
      password: '',
      confirmPassword: '',
    })
    setFormError('')
    setEditingId(null)
    setShowForm(false)
  }

  useEffect(() => {
    let mounted = true

    const loadEmployees = async () => {
      try {
        const items = await employeeService.list()
        if (!mounted) return
        setEmployees(items)
      } catch {
        if (!mounted) return
        setEmployees([])
      }
    }

    loadEmployees()

    return () => {
      mounted = false
    }
  }, [])

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(emp.employeeId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.status.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const selectedEmployeeDetail = useMemo(() => {
    if (!selectedEmployee) return null
    const email = normalizeText(selectedEmployee.email)
    const name = normalizeText(selectedEmployee.name)
    const role = normalizeText(selectedEmployee.role)
    const candidate = workbenchCandidates.find((item) => normalizeText(item?.contact?.email) === email)
      || workbenchCandidates.find((item) => normalizeText(item?.candidateName) === name)
      || workbenchCandidates.find((item) => normalizeText(item?.candidateName) === name && normalizeText(item?.role) === role)
      || null
    return { employee: selectedEmployee, candidate }
  }, [selectedEmployee, workbenchCandidates])

  const handleFormChange = (e) => {
    const { name, value } = e.target
    if (formError) setFormError('')
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleAddEmployee = async (e) => {
    e.preventDefault()
    if (!formData.name || !formData.email || !formData.role) {
      setFormError('Name, email, and role are required.')
      return
    }

    const trimmedPassword = formData.password.trim()
    const trimmedConfirmPassword = formData.confirmPassword.trim()
    const isPasswordProvided = Boolean(trimmedPassword || trimmedConfirmPassword)

    if (!editingId && !trimmedPassword) {
      setFormError('Create an initial password before adding the employee.')
      return
    }

    if ((isPasswordProvided || !editingId) && trimmedPassword.length < 8) {
      setFormError('Password must be at least 8 characters long.')
      return
    }

    if ((isPasswordProvided || !editingId) && trimmedPassword !== trimmedConfirmPassword) {
      setFormError('Password and confirmation must match.')
      return
    }

    setSavingEmployee(true)
    try {
      if (editingId) {
        const nextEmployees = await employeeService.update(editingId, {
          name: formData.name,
          employeeId: formData.employeeId,
          email: formData.email,
          role: formData.role,
          skills: formData.skills ? formData.skills.split(',').map((s) => s.trim()).filter(Boolean) : [],
          status: formData.status,
          ...(trimmedPassword ? { password: trimmedPassword } : {}),
        })
        setEmployees(nextEmployees)
      } else {
        const nextEmployees = await employeeService.create({
          name: formData.name,
          employeeId: formData.employeeId,
          email: formData.email,
          role: formData.role,
          skills: formData.skills ? formData.skills.split(',').map((s) => s.trim()).filter(Boolean) : [],
          skillLevel: 0,
          status: formData.status,
          lastAssessment: 'Never',
          password: trimmedPassword,
        })
        setEmployees(nextEmployees)
      }

      resetFormState()
    } catch (err) {
      setFormError(err.message || 'We could not save this employee right now.')
    } finally {
      setSavingEmployee(false)
    }
  }

  const handleEditEmployee = (emp) => {
    setEditingId(emp.id)
    setFormError('')
    setFormData({
      employeeId: emp.employeeId || '',
      name: emp.name,
      email: emp.email,
      role: emp.role,
      skills: emp.skills.join(', '),
      status: emp.status,
      password: '',
      confirmPassword: '',
    })
    setShowForm(true)
  }

  const handleStatusChange = async (employee, status) => {
    const nextEmployees = await employeeService.update(employee.id, { status })
    setEmployees(nextEmployees)
    if (editingId === employee.id) {
      setFormData((prev) => ({ ...prev, status }))
    }
  }

  const handleDeleteEmployee = async (id) => {
    await employeeService.remove(id)
    window.location.reload()
  }

  const handleViewEmployee = async (emp) => {
    setSelectedEmployee(emp)
    setLoadingEmployeeDetails(true)
    try {
      const workbench = await managerOpsService.getWorkbench()
      setWorkbenchCandidates(asList(workbench?.candidates))
    } catch {
      setWorkbenchCandidates([])
    } finally {
      setLoadingEmployeeDetails(false)
    }
  }

  useEffect(() => {
    if (!selectedEmployee?.employeeId) return undefined
    let cancelled = false
    const refresh = async () => {
      try {
        const workbench = await managerOpsService.getWorkbench()
        const employeeRows = await employeeService.list()
        if (cancelled) return
        setWorkbenchCandidates(asList(workbench?.candidates))
        setEmployees(employeeRows)
        const refreshedEmployee =
          employeeRows.find((item) => String(item.employeeId || '') === String(selectedEmployee.employeeId || '')) || selectedEmployee
        setSelectedEmployee(refreshedEmployee)
      } catch {
        // keep last good snapshot if refresh fails
      }
    }

    refresh()
    const intervalId = window.setInterval(refresh, 5000)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [selectedEmployee?.employeeId])

  useEffect(() => {
    if (!selectedEmployeeDetail?.candidate) {
      setDetailDraft(null)
      return
    }
    setDetailDraft(buildManagerCandidateDraft(selectedEmployeeDetail.candidate, selectedEmployeeDetail.employee))
    setDetailState({ status: 'idle', message: '' })
  }, [selectedEmployeeDetail])

  const updateDetailDraft = (section, field, value) => {
    setDetailDraft((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }))
  }

  const refreshWorkbenchCandidate = async (employeeId) => {
    const workbench = await managerOpsService.getWorkbench()
    const employeeRows = await employeeService.list()
    setEmployees(employeeRows)
    setWorkbenchCandidates(asList(workbench?.candidates))
    const refreshed = asList(workbench?.candidates).find((item) => String(item?.employeeId || '') === String(employeeId || ''))
    if (refreshed) {
      const matchingEmployee = employeeRows.find((item) => String(item.employeeId || '') === String(employeeId || '')) || selectedEmployee
      if (matchingEmployee) {
        setSelectedEmployee(matchingEmployee)
      }
      setDetailDraft(buildManagerCandidateDraft(refreshed, matchingEmployee))
    }
    return refreshed
  }

  const handleSaveEmployeeWorkspace = async () => {
    if (!selectedEmployeeDetail?.candidate?.employeeId || !detailDraft) return
    const employeeId = selectedEmployeeDetail.candidate.employeeId
    setDetailState({ status: 'working', message: 'Saving employee profile and dashboard settings...' })
    try {
      await managerOpsService.updateCandidateProfile(employeeId, {
        fullName: detailDraft.profile.fullName,
        email: detailDraft.profile.email,
        role: detailDraft.profile.role,
        department: detailDraft.profile.department,
        location: detailDraft.profile.location,
        yearsExperience: detailDraft.profile.yearsExperience,
        portfolioUrl: detailDraft.profile.portfolioUrl,
        githubUrl: detailDraft.profile.githubUrl,
        linkedinUrl: detailDraft.profile.linkedinUrl,
        summary: detailDraft.profile.summary,
      })

      await managerOpsService.updateCandidateSettings(employeeId, 'profile', {
        name: detailDraft.profile.fullName,
        email: detailDraft.profile.email,
        title: detailDraft.profile.title,
        phone: detailDraft.profile.phone,
        department: detailDraft.profile.department,
        manager: detailDraft.profile.manager,
        photoData: detailDraft.profile.photoData,
      })
      await managerOpsService.updateCandidateSettings(employeeId, 'preferences', detailDraft.preferences)
      await managerOpsService.updateCandidateSettings(employeeId, 'localization', detailDraft.localization)
      await managerOpsService.updateCandidateSettings(employeeId, 'privacy', detailDraft.privacy)
      await managerOpsService.updateCandidateSettings(employeeId, 'security', detailDraft.security)
      await managerOpsService.updateCandidateSettings(employeeId, 'appearance', detailDraft.appearance)

      await refreshWorkbenchCandidate(employeeId)
      setDetailState({ status: 'saved', message: 'Employee profile, settings, and preferences were updated.' })
    } catch (error) {
      setDetailState({ status: 'error', message: error.message || 'Unable to save employee settings right now.' })
    }
  }

  const handleToggleEmployeeTwoFactor = async (enabled) => {
    if (!selectedEmployeeDetail?.candidate?.employeeId) return
    const employeeId = selectedEmployeeDetail.candidate.employeeId
    setDetailState({
      status: 'working',
      message: enabled ? 'Enabling two-factor authentication for this employee...' : 'Disabling two-factor authentication for this employee...',
    })
    try {
      if (enabled) {
        await managerOpsService.enableCandidateTwoFactor(employeeId)
      } else {
        await managerOpsService.disableCandidateTwoFactor(employeeId)
      }
      await refreshWorkbenchCandidate(employeeId)
      setDetailState({
        status: 'saved',
        message: enabled ? 'Two-factor authentication enabled for this employee.' : 'Two-factor authentication disabled for this employee.',
      })
    } catch (error) {
      setDetailState({ status: 'error', message: error.message || 'Unable to update employee two-factor settings.' })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-white">Employee Management</h1>
          <p className="text-gray-400 mt-2">Manage your team members and their skills</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null)
            setFormError('')
            setFormData({
              employeeId: '',
              name: '',
              email: '',
              role: '',
              skills: '',
              status: 'pending',
              password: '',
              confirmPassword: '',
            })
            setShowForm(true)
          }}
          className="btn-primary w-full md:w-auto bg-white text-black hover:bg-gray-200 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Add Employee</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search by name, email, role, or status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-gray-600 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Employees Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-900 border border-gray-700 rounded-lg overflow-x-auto"
      >
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-4 px-4 text-gray-300 font-semibold text-sm">Name</th>
              <th className="text-left py-4 px-4 text-gray-300 font-semibold text-sm">Employee ID</th>
              <th className="text-left py-4 px-4 text-gray-300 font-semibold text-sm">Role</th>
              <th className="text-left py-4 px-4 text-gray-300 font-semibold text-sm">Skills</th>
              <th className="text-center py-4 px-4 text-gray-300 font-semibold text-sm">Level</th>
              <th className="text-left py-4 px-4 text-gray-300 font-semibold text-sm">Status</th>
              <th className="text-right py-4 px-4 text-gray-300 font-semibold text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map((emp, i) => (
              <motion.tr
                key={emp.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="border-b border-gray-800 hover:bg-gray-800 transition-colors"
              >
                <td className="py-4 px-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-white overflow-hidden flex items-center justify-center text-black font-bold">
                      {emp.photoData ? (
                        <img src={emp.photoData} alt={`${emp.name} avatar`} className="w-full h-full object-cover" />
                      ) : (
                        emp.name.split(' ').map((n) => n[0]).join('')
                      )}
                    </div>
                    <div>
                      <p className="text-white font-medium">{emp.name}</p>
                      <p className="text-xs text-gray-400">{emp.email}</p>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4 text-sm">
                  <span className="inline-flex items-center rounded-lg border border-gray-700 bg-gray-800 px-3 py-1 font-mono text-gray-200">
                    {emp.employeeId || 'Not linked'}
                  </span>
                </td>
                <td className="py-4 px-4 text-gray-300 text-sm">{emp.role}</td>
                <td className="py-4 px-4">
                  <div className="flex flex-wrap gap-2">
                    {emp.skills.map((skill) => (
                      <span
                        key={skill}
                        className="px-2 py-1 text-xs bg-gray-700 text-gray-200 rounded border border-gray-600"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-4 px-4 text-center">
                  <span className="inline-block px-3 py-1 text-sm font-semibold text-black bg-white rounded-lg">
                    {emp.skillLevel}/5.0
                  </span>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center space-x-2">
                    {emp.status === 'active' ? <CheckCircle className="w-4 h-4 text-green-400" /> : <span className="w-4 h-4 rounded-full border border-yellow-400/40 bg-yellow-400/20" />}
                    <select
                      value={emp.status}
                      onChange={(e) => handleStatusChange(emp, e.target.value)}
                      className="bg-transparent text-xs font-medium text-white focus:outline-none"
                    >
                      <option value="active" className="bg-gray-900 text-white">Active</option>
                      <option value="pending" className="bg-gray-900 text-white">Pending</option>
                      <option value="inactive" className="bg-gray-900 text-white">Inactive</option>
                    </select>
                  </div>
                </td>
                <td className="py-4 px-4 text-right">
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={() => handleViewEmployee(emp)}
                      className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEditEmployee(emp)}
                      className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(emp.id)}
                      className="p-2 rounded-lg hover:bg-red-900/30 text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </motion.div>

      {/* Add Employee Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                {editingId ? 'Edit Employee' : 'Add Employee'}
              </h2>
              <button
                onClick={() => {
                  resetFormState()
                }}
                className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddEmployee} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Employee ID</label>
                <input
                  type="text"
                  name="employeeId"
                  value={formData.employeeId}
                  onChange={handleFormChange}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-gray-600 focus:outline-none"
                  placeholder="Leave blank to auto-generate"
                />
                <p className="mt-2 text-xs text-gray-500">
                  This is the employee login ID. You can set it manually, update it later, or leave it blank to let the system generate one.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-gray-600 focus:outline-none"
                  placeholder="Enter name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleFormChange}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-gray-600 focus:outline-none"
                  placeholder="Enter email"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Role</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleFormChange}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-gray-600 focus:outline-none"
                  required
                >
                  <option value="">Select a role</option>
                  <option value="Frontend Developer">Frontend Developer</option>
                  <option value="Backend Developer">Backend Developer</option>
                  <option value="Full Stack Developer">Full Stack Developer</option>
                  <option value="DevOps Engineer">DevOps Engineer</option>
                  <option value="QA Engineer">QA Engineer</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Skills (comma separated)</label>
                <input
                  type="text"
                  name="skills"
                  value={formData.skills}
                  onChange={handleFormChange}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-gray-600 focus:outline-none"
                  placeholder="e.g., React, JavaScript"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleFormChange}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-gray-600 focus:outline-none"
                >
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {editingId ? 'Access & password reset' : 'Account access setup'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {editingId
                      ? 'Set a new password only when you need to reset this employee account. Leave both fields blank to keep the current password.'
                      : 'Create an initial password so the employee can sign in securely on day one.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {editingId ? 'New Password' : 'Initial Password'}
                    </label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleFormChange}
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-gray-600 focus:outline-none"
                      placeholder={editingId ? 'Leave blank to keep current password' : 'Minimum 8 characters'}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleFormChange}
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-gray-600 focus:outline-none"
                      placeholder="Re-enter password"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-400">
                  Use at least 8 characters. A mix of upper/lowercase letters, numbers, and symbols is recommended.
                </div>
              </div>

              {formError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={savingEmployee}
                  className="flex-1 bg-white text-black font-semibold py-2 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  {savingEmployee ? 'Saving...' : editingId ? 'Update Employee' : 'Add Employee'}
                </button>
                <button
                  type="button"
                  onClick={resetFormState}
                  className="flex-1 bg-gray-800 text-white font-semibold py-2 rounded-lg border border-gray-700 hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-md"
          >
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Delete Employee?</h2>
              <p className="text-gray-400">
                Are you sure you want to delete this employee? This action cannot be undone.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleDeleteEmployee(deleteConfirmId)}
                className="flex-1 bg-red-600 text-white font-semibold py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 bg-gray-800 text-white font-semibold py-2 rounded-lg border border-gray-700 hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {selectedEmployeeDetail && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelectedEmployee(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-6xl max-h-[90vh] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Employee 360 View</p>
                <h2 className="text-2xl font-bold text-white mt-1">{selectedEmployeeDetail.employee.name}</h2>
              </div>
              <button onClick={() => setSelectedEmployee(null)} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-84px)]">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-4">
                  <p className="text-xs text-gray-400 uppercase">Employee ID</p>
                  <p className="text-sm font-mono text-white mt-1">{selectedEmployeeDetail.employee.employeeId || 'Not linked yet'}</p>
                </div>
                <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-4">
                  <p className="text-xs text-gray-400 uppercase">Email</p>
                  <p className="text-sm text-white mt-1 break-all">{selectedEmployeeDetail.employee.email}</p>
                </div>
                <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-4">
                  <p className="text-xs text-gray-400 uppercase">Role</p>
                  <p className="text-sm text-white mt-1">{selectedEmployeeDetail.employee.role || 'Not set'}</p>
                </div>
                <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-4">
                  <p className="text-xs text-gray-400 uppercase">Skill Level</p>
                  <p className="text-sm text-white mt-1">{selectedEmployeeDetail.employee.skillLevel}/5</p>
                </div>
                <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-4">
                  <p className="text-xs text-gray-400 uppercase">Status</p>
                  <p className="text-sm text-white mt-1 capitalize">{selectedEmployeeDetail.employee.status}</p>
                </div>
              </div>

              {loadingEmployeeDetails ? (
                <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-gray-300">
                  Loading employee full details...
                </div>
              ) : !selectedEmployeeDetail.candidate ? (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
                  No full employee journey is linked yet for this employee. We can show base employee table data, but resume/job-match/interview records need a linked employee account session.
                </div>
              ) : (
                <>
                  {detailState.status !== 'idle' && (
                    <div className={`rounded-xl border px-4 py-3 text-sm ${
                      detailState.status === 'error'
                        ? 'border-red-500/30 bg-red-500/10 text-red-200'
                        : detailState.status === 'working'
                          ? 'border-blue-500/30 bg-blue-500/10 text-blue-200'
                          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                    }`}>
                      {detailState.message}
                    </div>
                  )}

                  {detailDraft && (
                    <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-5 space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-white">Manager Controls</h3>
                          <p className="text-sm text-gray-400">Edit the employee dashboard profile, employee settings, and two-factor access from one place.</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleEmployeeTwoFactor(!detailDraft.twoFactor.enabled)}
                            className="px-4 py-2 rounded-lg border border-gray-600 text-sm text-gray-100 hover:bg-gray-800"
                          >
                            {detailDraft.twoFactor.enabled ? 'Disable 2FA' : 'Enable 2FA'}
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveEmployeeWorkspace}
                            className="px-4 py-2 rounded-lg bg-white text-black text-sm font-semibold hover:bg-gray-200"
                          >
                            Save Employee Workspace
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          ['fullName', 'Full Name'],
                          ['email', 'Email'],
                          ['role', 'Role'],
                          ['department', 'Department'],
                          ['location', 'Location'],
                          ['yearsExperience', 'Years Experience'],
                          ['title', 'Title'],
                          ['phone', 'Phone'],
                          ['manager', 'Manager'],
                          ['portfolioUrl', 'Portfolio URL'],
                          ['githubUrl', 'GitHub URL'],
                          ['linkedinUrl', 'LinkedIn URL'],
                        ].map(([field, label]) => (
                          <div key={field}>
                            <label className="block text-xs uppercase tracking-[0.16em] text-gray-400 mb-2">{label}</label>
                            <input
                              type="text"
                              value={detailDraft.profile[field] || ''}
                              onChange={(e) => updateDetailDraft('profile', field, e.target.value)}
                              className="w-full rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2 text-sm text-white focus:border-gray-500 focus:outline-none"
                            />
                          </div>
                        ))}
                      </div>

                      <div>
                        <label className="block text-xs uppercase tracking-[0.16em] text-gray-400 mb-2">Summary</label>
                        <textarea
                          rows={4}
                          value={detailDraft.profile.summary || ''}
                          onChange={(e) => updateDetailDraft('profile', 'summary', e.target.value)}
                          className="w-full rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2 text-sm text-white focus:border-gray-500 focus:outline-none"
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-700 bg-gray-900/60 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-white">Profile photo</p>
                          <p className="text-xs text-gray-400">
                            {detailDraft.profile.photoData ? 'A profile photo is stored for this employee.' : 'No profile photo is currently stored.'}
                          </p>
                        </div>
                        {detailDraft.profile.photoData && (
                          <button
                            type="button"
                            onClick={() => updateDetailDraft('profile', 'photoData', '')}
                            className="px-3 py-2 rounded-lg border border-gray-600 text-sm text-gray-100 hover:bg-gray-800"
                          >
                            Remove Stored Photo
                          </button>
                        )}
                      </div>
                      {detailDraft.profile.photoData && (
                        <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-4">
                          <img
                            src={detailDraft.profile.photoData}
                            alt={`${detailDraft.profile.fullName || 'Employee'} profile`}
                            className="h-28 w-28 rounded-xl object-cover border border-gray-700"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-4 space-y-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-gray-400">Notifications</p>
                          {[
                            ['emailAlerts', 'Email Alerts'],
                            ['assessmentNotifications', 'Assessment Notifications'],
                            ['weeklyReport', 'Weekly Report'],
                            ['pushNotifications', 'Push Notifications'],
                          ].map(([field, label]) => (
                            <label key={field} className="flex items-center justify-between gap-3 text-sm text-gray-200">
                              <span>{label}</span>
                              <input
                                type="checkbox"
                                checked={Boolean(detailDraft.preferences[field])}
                                onChange={(e) => updateDetailDraft('preferences', field, e.target.checked)}
                              />
                            </label>
                          ))}
                        </div>

                        <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-4 space-y-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-gray-400">Localization</p>
                          {[
                            ['language', 'Language'],
                            ['timezone', 'Timezone'],
                            ['dateFormat', 'Date Format'],
                          ].map(([field, label]) => (
                            <div key={field}>
                              <label className="block text-xs text-gray-500 mb-2">{label}</label>
                              <input
                                type="text"
                                value={detailDraft.localization[field] || ''}
                                onChange={(e) => updateDetailDraft('localization', field, e.target.value)}
                                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-gray-500 focus:outline-none"
                              />
                            </div>
                          ))}
                        </div>

                        <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-4 space-y-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-gray-400">Privacy</p>
                          {[
                            ['profileVisibility', 'Profile Visibility', 'text'],
                            ['shareAssessments', 'Share Assessments', 'checkbox'],
                            ['shareSkills', 'Share Skills', 'checkbox'],
                            ['allowTracking', 'Allow Tracking', 'checkbox'],
                          ].map(([field, label, inputType]) => (
                            inputType === 'checkbox' ? (
                              <label key={field} className="flex items-center justify-between gap-3 text-sm text-gray-200">
                                <span>{label}</span>
                                <input
                                  type="checkbox"
                                  checked={Boolean(detailDraft.privacy[field])}
                                  onChange={(e) => updateDetailDraft('privacy', field, e.target.checked)}
                                />
                              </label>
                            ) : (
                              <div key={field}>
                                <label className="block text-xs text-gray-500 mb-2">{label}</label>
                                <input
                                  type="text"
                                  value={detailDraft.privacy[field] || ''}
                                  onChange={(e) => updateDetailDraft('privacy', field, e.target.value)}
                                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-gray-500 focus:outline-none"
                                />
                              </div>
                            )
                          ))}
                        </div>

                        <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-4 space-y-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-gray-400">Security & Appearance</p>
                          <label className="flex items-center justify-between gap-3 text-sm text-gray-200">
                            <span>Require 2FA</span>
                            <input
                              type="checkbox"
                              checked={Boolean(detailDraft.security.twoFactorRequired)}
                              onChange={(e) => updateDetailDraft('security', 'twoFactorRequired', e.target.checked)}
                            />
                          </label>
                          <div>
                            <label className="block text-xs text-gray-500 mb-2">Session Timeout (minutes)</label>
                            <input
                              type="number"
                              min="30"
                              max="240"
                              step="30"
                              value={detailDraft.security.sessionTimeoutMinutes || 60}
                              onChange={(e) => updateDetailDraft('security', 'sessionTimeoutMinutes', Number(e.target.value))}
                              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-gray-500 focus:outline-none"
                            />
                          </div>
                          {[
                            ['theme', 'Theme'],
                            ['accentColor', 'Accent Color'],
                            ['fontSize', 'Font Size'],
                          ].map(([field, label]) => (
                            <div key={field}>
                              <label className="block text-xs text-gray-500 mb-2">{label}</label>
                              <input
                                type="text"
                                value={detailDraft.appearance[field] || ''}
                                onChange={(e) => updateDetailDraft('appearance', field, e.target.value)}
                                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-gray-500 focus:outline-none"
                              />
                            </div>
                          ))}
                          <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-400">
                            2FA status: {detailDraft.twoFactor.enabled ? 'Enabled' : 'Disabled'} {detailDraft.twoFactor.hasSecret ? '• setup key present' : '• no setup key yet'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-5">
                    <h3 className="text-lg font-semibold text-white">Profile & Contact</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 text-sm">
                      <p className="text-gray-300"><span className="text-gray-500">Department:</span> {selectedEmployeeDetail.candidate.department || 'Not set'}</p>
                      <p className="text-gray-300"><span className="text-gray-500">Phone:</span> {selectedEmployeeDetail.candidate.contact?.phone || 'Not set'}</p>
                      <p className="text-gray-300"><span className="text-gray-500">Location:</span> {selectedEmployeeDetail.candidate.contact?.location || 'Not set'}</p>
                      <p className="text-gray-300"><span className="text-gray-500">Experience:</span> {selectedEmployeeDetail.candidate.profile?.yearsExperience || 'Not set'} years</p>
                      <p className="text-gray-300"><span className="text-gray-500">Portfolio:</span> {selectedEmployeeDetail.candidate.profile?.portfolioUrl || 'Not provided'}</p>
                      <p className="text-gray-300"><span className="text-gray-500">GitHub:</span> {selectedEmployeeDetail.candidate.profile?.githubUrl || 'Not provided'}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-5">
                    <h3 className="text-lg font-semibold text-white">Skills & Gaps</h3>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs uppercase text-gray-400 tracking-[0.16em]">Employee Skills</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {asList(selectedEmployeeDetail.employee.skills).map((skill) => (
                            <span key={`base-${skill}`} className="px-2 py-1 text-xs bg-gray-700 text-gray-200 rounded border border-gray-600">{skill}</span>
                          ))}
                        </div>
                        <p className="text-xs uppercase text-gray-400 tracking-[0.16em] mt-4">Resume Skills</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {asList(selectedEmployeeDetail.candidate.resume?.skills).map((skill) => (
                            <span key={`resume-${skill}`} className="px-2 py-1 text-xs bg-blue-500/15 text-blue-200 rounded border border-blue-400/30">{skill}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-gray-400 tracking-[0.16em]">Role Match Gaps</p>
                        <ul className="mt-2 space-y-2">
                          {asList(selectedEmployeeDetail.candidate.jobMatch?.missingSkills).slice(0, 8).map((gap) => (
                            <li key={gap} className="text-sm text-amber-200 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">{gap}</li>
                          ))}
                          {asList(selectedEmployeeDetail.candidate.interview?.gaps).slice(0, 4).map((gap) => (
                            <li key={gap} className="text-sm text-red-200 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">{gap}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold text-white">Resume Intelligence</h3>
                      {selectedEmployeeDetail.candidate.employeeId && selectedEmployeeDetail.candidate.resume?.fileName && (
                        <a
                          href={assessmentService.getResumeViewUrl(selectedEmployeeDetail.candidate.employeeId)}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg border border-gray-600 text-xs text-gray-200 hover:bg-gray-800"
                        >
                          View Resume File
                        </a>
                      )}
                    </div>
                    <div className="mt-3 text-sm text-gray-300 space-y-2">
                      <p><span className="text-gray-500">File:</span> {selectedEmployeeDetail.candidate.resume?.fileName || 'Not uploaded'}</p>
                      <p><span className="text-gray-500">Uploaded:</span> {formatDate(selectedEmployeeDetail.candidate.resume?.uploadedAt)}</p>
                      <p><span className="text-gray-500">Analysis status:</span> {selectedEmployeeDetail.candidate.resume?.analysisStatus || 'Not started'}</p>
                      <p><span className="text-gray-500">Quality:</span> {selectedEmployeeDetail.candidate.resume?.qualityGrade || 'N/A'}</p>
                      <p className="text-gray-200">{selectedEmployeeDetail.candidate.resume?.summary || 'No resume summary available yet.'}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-5">
                    <h3 className="text-lg font-semibold text-white">Assessment & Interview Snapshot</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
                      <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-3">
                        <p className="text-xs text-gray-500 uppercase">Match Score</p>
                        <p className="text-xl font-semibold text-white mt-1">{Number(selectedEmployeeDetail.candidate.jobMatch?.score || 0)}%</p>
                      </div>
                      <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-3">
                        <p className="text-xs text-gray-500 uppercase">Interview Score</p>
                        <p className="text-xl font-semibold text-white mt-1">{Number(selectedEmployeeDetail.candidate.interview?.score || 0).toFixed(1)}/5</p>
                      </div>
                      <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-3">
                        <p className="text-xs text-gray-500 uppercase">Hiring Signal</p>
                        <p className="text-sm font-semibold text-white mt-1">{selectedEmployeeDetail.candidate.interview?.hiringSignal || 'Pending'}</p>
                      </div>
                      <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-3">
                        <p className="text-xs text-gray-500 uppercase">Confidence</p>
                        <p className="text-sm font-semibold text-white mt-1">{selectedEmployeeDetail.candidate.interview?.confidence || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs uppercase text-gray-400 tracking-[0.16em]">Strengths</p>
                        <ul className="mt-2 space-y-2">
                          {asList(selectedEmployeeDetail.candidate.interview?.strengths).slice(0, 5).map((item) => (
                            <li key={item} className="text-sm text-emerald-200 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-gray-400 tracking-[0.16em]">Recommendations</p>
                        <ul className="mt-2 space-y-2">
                          {asList(selectedEmployeeDetail.candidate.interview?.recommendations).slice(0, 5).map((item) => (
                            <li key={item} className="text-sm text-blue-200 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2">{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-5">
                      <h3 className="text-lg font-semibold text-white">Scheduled Interviews</h3>
                      <div className="mt-3 space-y-2">
                        {asList(selectedEmployeeDetail.candidate.schedules).slice(0, 6).map((item) => (
                          <div key={item.id} className="rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2">
                            <p className="text-sm text-white">{item.title || 'Interview'}</p>
                            <p className="text-xs text-gray-400 mt-1">{formatDate(item.startAt)} - {item.meetingMode || 'Virtual'}</p>
                          </div>
                        ))}
                        {asList(selectedEmployeeDetail.candidate.schedules).length === 0 && <p className="text-sm text-gray-500">No schedules found.</p>}
                      </div>
                    </div>
                    <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-5">
                      <h3 className="text-lg font-semibold text-white">Communication History</h3>
                      <div className="mt-3 space-y-2">
                        {asList(selectedEmployeeDetail.candidate.communications).slice(0, 6).map((item) => (
                          <div key={item.id} className="rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2">
                            <p className="text-sm text-white capitalize">{item.channel || 'message'} - {item.deliveryStatus || 'recorded'}</p>
                            <p className="text-xs text-gray-400 mt-1">{formatDate(item.createdAt)}</p>
                          </div>
                        ))}
                        {asList(selectedEmployeeDetail.candidate.communications).length === 0 && <p className="text-sm text-gray-500">No communications logged.</p>}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
