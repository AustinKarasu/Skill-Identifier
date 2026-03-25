import { motion } from 'framer-motion'
import { Plus, Trash2, Edit2, X, BarChart3, Users, ClipboardCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { roleService } from '../../api/services/roleService'

export default function RoleManagement() {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [selectedRole, setSelectedRole] = useState(null)
  const [roles, setRoles] = useState([])

  const [formData, setFormData] = useState({
    name: '',
    skills: [{ name: '', level: 3 }],
  })

  const skillLevels = ['Beginner (1)', 'Basic (2)', 'Intermediate (3)', 'Advanced (4)', 'Expert (5)']

  useEffect(() => {
    let mounted = true

    const loadRoles = async () => {
      const items = await roleService.list()
      if (!mounted) return
      setRoles(items)
    }

    loadRoles()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!showForm && !deleteConfirmId && !selectedRole) return undefined

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [deleteConfirmId, selectedRole, showForm])

  const handleFormChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSkillChange = (index, field, value) => {
    const newSkills = [...formData.skills]
    if (field === 'level') {
      newSkills[index] = { ...newSkills[index], level: Number.parseInt(value, 10) }
    } else {
      newSkills[index] = { ...newSkills[index], name: value }
    }
    setFormData((prev) => ({ ...prev, skills: newSkills }))
  }

  const addSkillField = () => {
    setFormData((prev) => ({
      ...prev,
      skills: [...prev.skills, { name: '', level: 3 }],
    }))
  }

  const removeSkillField = (index) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== index),
    }))
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData({ name: '', skills: [{ name: '', level: 3 }] })
  }

  const handleAddRole = async (e) => {
    e.preventDefault()
    if (!formData.name || !formData.skills[0].name) return

    if (editingId) {
      const nextRoles = await roleService.update(editingId, {
        name: formData.name,
        requiredSkills: formData.skills.filter((s) => s.name),
      })
      setRoles(nextRoles)
      setEditingId(null)
    } else {
      const nextRoles = await roleService.create({
        name: formData.name,
        requiredSkills: formData.skills.filter((s) => s.name),
      })
      setRoles(nextRoles)
    }

    resetForm()
  }

  const handleEditRole = (role) => {
    setEditingId(role.id)
    setFormData({
      name: role.name,
      skills: role.requiredSkills,
    })
    setShowForm(true)
  }

  const handleDeleteRole = async (id) => {
    await roleService.remove(id)
    window.location.reload()
  }

  const getReadinessColor = (readiness) => {
    switch (readiness) {
      case 'Strong':
        return 'bg-green-500/10 text-green-400 border-green-500/30'
      case 'On Track':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30'
      case 'Growing':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30'
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/30'
    }
  }

  const formatReviewDate = (date) =>
    new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

  const getMemberCount = (role) => {
    if (Array.isArray(role?.members)) return role.members.length
    return Number(role?.employees || 0)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-white">Role Management</h1>
          <p className="text-gray-400 mt-2">Define roles and required skills for your team</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary w-full md:w-auto bg-white text-black hover:bg-gray-200 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Create Role</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {roles.map((role, i) => (
          <motion.div
            key={role.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-gray-900 border border-gray-700 rounded-lg p-6 group"
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-2">{role.name}</h3>
                <p className="text-sm text-gray-400">{getMemberCount(role)} members in this role</p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEditRole(role)}
                  className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeleteConfirmId(role.id)}
                  className="p-2 rounded-lg hover:bg-red-900/30 text-gray-400 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-300">Required Skills</p>
              {role.requiredSkills.map((skill) => (
                <div key={skill.name} className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">{skill.name}</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full"
                        style={{ width: `${(skill.level / 5) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-8">{skill.level}/5</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3 mt-6">
              <div className="rounded-lg bg-gray-800 border border-gray-700 p-3">
                <p className="text-xs text-gray-400">Avg Score</p>
                <p className="text-white font-semibold mt-2">{role.avgScore}/5</p>
              </div>
              <div className="rounded-lg bg-gray-800 border border-gray-700 p-3">
                <p className="text-xs text-gray-400">Top Gap</p>
                <p className="text-white font-semibold mt-2">{role.topGap}</p>
              </div>
              <div className="rounded-lg bg-gray-800 border border-gray-700 p-3">
                <p className="text-xs text-gray-400">Readiness</p>
                <p className="text-white font-semibold mt-2">{role.readiness}</p>
              </div>
            </div>

            <button
              onClick={() => setSelectedRole(role)}
              className="w-full mt-6 p-3 rounded-lg border border-gray-600 text-white hover:bg-gray-800 transition-all duration-300 text-sm font-semibold"
            >
              View Results
            </button>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-gray-900 border border-gray-700 rounded-lg p-6"
      >
        <h3 className="text-lg font-bold text-white mb-4">Skill Levels Reference</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {skillLevels.map((level, i) => (
            <div key={level} className="p-4 rounded-lg bg-gray-800 border border-gray-700">
              <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden mb-3">
                <div className="h-full bg-white" style={{ width: `${((i + 1) / 5) * 100}%` }} />
              </div>
              <p className="text-sm font-semibold text-white">{level}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={resetForm}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">{editingId ? 'Edit Role' : 'Create Role'}</h2>
              <button onClick={resetForm} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddRole} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Role Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-gray-600 focus:outline-none"
                  placeholder="Enter role name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Required Skills</label>
                <div className="space-y-3">
                  {formData.skills.map((skill, index) => (
                    <div key={`${skill.name}-${index}`} className="flex gap-2">
                      <input
                        type="text"
                        value={skill.name}
                        onChange={(e) => handleSkillChange(index, 'name', e.target.value)}
                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-gray-600 focus:outline-none text-sm"
                        placeholder="Skill name"
                      />
                      <select
                        value={skill.level}
                        onChange={(e) => handleSkillChange(index, 'level', e.target.value)}
                        className="w-20 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-gray-600 focus:outline-none text-sm"
                      >
                        {[1, 2, 3, 4, 5].map((l) => (
                          <option key={l} value={l}>
                            {l}/5
                          </option>
                        ))}
                      </select>
                      {formData.skills.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSkillField(index)}
                          className="px-3 py-2 rounded-lg hover:bg-red-900/30 text-gray-400 hover:text-red-400 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addSkillField}
                  className="mt-3 w-full px-4 py-2 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors text-sm"
                >
                  + Add Skill
                </button>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-white text-black font-semibold py-2 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  {editingId ? 'Update Role' : 'Create Role'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 bg-gray-800 text-white font-semibold py-2 rounded-lg border border-gray-700 hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {selectedRole && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedRole(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl max-h-[90vh] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-start justify-between gap-4 p-6 border-b border-gray-700">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Role Results</p>
                <h2 className="text-2xl font-bold text-white mt-2">{selectedRole.name}</h2>
                <span className={`inline-flex mt-3 px-3 py-1 text-xs font-semibold rounded-full border ${getReadinessColor(selectedRole.readiness)}`}>
                  {selectedRole.readiness}
                </span>
              </div>
              <button
                onClick={() => setSelectedRole(null)}
                className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                aria-label="Close role results"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-96px)]">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-gray-700 bg-gray-800/70 p-4">
                  <div className="flex items-center gap-2 text-gray-400 text-sm">
                    <Users className="w-4 h-4" />
                  <span>Members</span>
                  </div>
                  <p className="text-white font-semibold mt-2">{getMemberCount(selectedRole)}</p>
                </div>
                <div className="rounded-xl border border-gray-700 bg-gray-800/70 p-4">
                  <div className="flex items-center gap-2 text-gray-400 text-sm">
                    <BarChart3 className="w-4 h-4" />
                    <span>Average Score</span>
                  </div>
                  <p className="text-white font-semibold mt-2">{selectedRole.avgScore}/5</p>
                </div>
                <div className="rounded-xl border border-gray-700 bg-gray-800/70 p-4">
                  <div className="flex items-center gap-2 text-gray-400 text-sm">
                    <ClipboardCheck className="w-4 h-4" />
                    <span>Last Review</span>
                  </div>
                  <p className="text-white font-semibold mt-2">{formatReviewDate(selectedRole.lastReview)}</p>
                </div>
              </div>

              <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5">
                <h3 className="font-semibold text-white">Skill Readiness Breakdown</h3>
                <div className="mt-4 space-y-4">
                  {selectedRole.requiredSkills.map((skill) => (
                    <div key={skill.name}>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-gray-200">{skill.name}</span>
                        <span className="text-gray-400">{skill.level}/5 expected</span>
                      </div>
                      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-white rounded-full" style={{ width: `${(skill.level / 5) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5">
                  <p className="text-sm text-gray-400">Primary Gap</p>
                  <p className="text-white font-semibold mt-2">{selectedRole.topGap}</p>
                </div>
                <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5">
                  <p className="text-sm text-gray-400">Team Coverage</p>
                  <p className="text-white font-semibold mt-2">{getMemberCount(selectedRole)} named members linked to this role</p>
                </div>
              </div>

              <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5">
                <h3 className="font-semibold text-white">Role Members</h3>
                <div className="mt-4 space-y-3">
                  {selectedRole.members?.length > 0 ? (
                    selectedRole.members.map((member) => (
                      <div key={member.id} className="flex items-center justify-between gap-4 rounded-xl border border-gray-700 bg-gray-900/60 px-4 py-3">
                        <div>
                          <p className="font-medium text-white">{member.name}</p>
                          <p className="text-sm text-gray-500">{member.email}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-300 capitalize">{member.status}</p>
                          <p className="text-xs text-gray-500">Skill level {member.skillLevel}/5</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-400">No employee records are linked to this role yet.</p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {deleteConfirmId && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setDeleteConfirmId(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-md"
          >
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Delete Role?</h2>
              <p className="text-gray-400">
                Are you sure you want to delete this role? This action cannot be undone.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleDeleteRole(deleteConfirmId)}
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
    </div>
  )
}
