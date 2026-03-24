import { motion } from 'framer-motion'
import { Plus, Search, Edit2, Trash2, CheckCircle, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { employeeService } from '../../api/services/employeeService'

export default function EmployeeManagement() {
  const [searchTerm, setSearchTerm] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [employees, setEmployees] = useState([])

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: '',
    skills: '',
    status: 'pending',
  })

  useEffect(() => {
    let mounted = true

    const loadEmployees = async () => {
      const items = await employeeService.list()
      if (!mounted) return
      setEmployees(items)
    }

    loadEmployees()

    return () => {
      mounted = false
    }
  }, [])

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.status.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleFormChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleAddEmployee = async (e) => {
    e.preventDefault()
    if (!formData.name || !formData.email || !formData.role) return

    if (editingId) {
      const nextEmployees = await employeeService.update(editingId, {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        skills: formData.skills ? formData.skills.split(',').map((s) => s.trim()) : [],
        status: formData.status,
      })
      setEmployees(nextEmployees)
      setEditingId(null)
    } else {
      const nextEmployees = await employeeService.create({
        name: formData.name,
        email: formData.email,
        role: formData.role,
        skills: formData.skills ? formData.skills.split(',').map((s) => s.trim()) : [],
        skillLevel: 0,
        status: formData.status,
        lastAssessment: 'Never',
      })
      setEmployees(nextEmployees)
    }

    setFormData({ name: '', email: '', role: '', skills: '', status: 'pending' })
    setShowForm(false)
  }

  const handleEditEmployee = (emp) => {
    setEditingId(emp.id)
    setFormData({
      name: emp.name,
      email: emp.email,
      role: emp.role,
      skills: emp.skills.join(', '),
      status: emp.status,
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
    const nextEmployees = await employeeService.remove(id)
    setEmployees(nextEmployees)
    setDeleteConfirmId(null)
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
          onClick={() => setShowForm(true)}
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
                    <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-black font-bold">
                      {emp.name.split(' ').map((n) => n[0]).join('')}
                    </div>
                    <div>
                      <p className="text-white font-medium">{emp.name}</p>
                      <p className="text-xs text-gray-400">{emp.email}</p>
                    </div>
                  </div>
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
            className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-md"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                {editingId ? 'Edit Employee' : 'Add Employee'}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false)
                  setEditingId(null)
                  setFormData({ name: '', email: '', role: '', skills: '', status: 'pending' })
                }}
                className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddEmployee} className="space-y-4">
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

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-white text-black font-semibold py-2 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  {editingId ? 'Update Employee' : 'Add Employee'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingId(null)
                    setFormData({ name: '', email: '', role: '', skills: '', status: 'pending' })
                  }}
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
    </div>
  )
}
