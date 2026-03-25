import { motion } from 'framer-motion'
import { Bot, Loader2, Plus, Sparkles, Trash2, Users, Wand2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { teamService } from '../../api/services/teamService'
import { employeeService } from '../../api/services/employeeService'

const splitSkills = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

export default function Teams() {
  const [teams, setTeams] = useState([])
  const [employees, setEmployees] = useState([])
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [suggestingTeamId, setSuggestingTeamId] = useState(null)
  const [suggestionsByTeam, setSuggestionsByTeam] = useState({})

  const [form, setForm] = useState({
    name: '',
    roleFocus: '',
    requiredSkills: '',
    targetSize: 4,
    description: '',
  })

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [teamRows, employeeRows] = await Promise.all([teamService.list(), employeeService.list()])
        if (!mounted) return
        setTeams(Array.isArray(teamRows) ? teamRows : [])
        setEmployees(Array.isArray(employeeRows) ? employeeRows : [])
        setSelectedTeamId((current) => current || teamRows?.[0]?.id || null)
      } catch (loadError) {
        if (!mounted) return
        setError(loadError.message || 'Unable to load teams right now.')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) || null,
    [teams, selectedTeamId]
  )

  const availableEmployees = useMemo(() => {
    if (!selectedTeam) return employees
    const taken = new Set((selectedTeam.memberEmployeeIds || []).map((item) => Number(item)))
    return employees.filter((employee) => !taken.has(Number(employee.id)))
  }, [employees, selectedTeam])

  const createTeam = async (event) => {
    event.preventDefault()
    if (!form.name.trim()) return
    try {
      setSaving(true)
      const next = await teamService.create({
        name: form.name.trim(),
        roleFocus: form.roleFocus.trim(),
        requiredSkills: splitSkills(form.requiredSkills),
        targetSize: Number(form.targetSize) || 4,
        description: form.description.trim(),
      })
      setTeams(Array.isArray(next) ? next : [])
      setSelectedTeamId(next?.[0]?.id || selectedTeamId)
      setForm({ name: '', roleFocus: '', requiredSkills: '', targetSize: 4, description: '' })
    } catch (submitError) {
      setError(submitError.message || 'Unable to create team.')
    } finally {
      setSaving(false)
    }
  }

  const removeTeam = async (teamId) => {
    const ok = window.confirm('Delete this team?')
    if (!ok) return
    try {
      await teamService.remove(teamId)
      const next = await teamService.list()
      setTeams(Array.isArray(next) ? next : [])
      setSelectedTeamId(next?.[0]?.id || null)
    } catch (removeError) {
      setError(removeError.message || 'Unable to delete team.')
    }
  }

  const updateMember = async (teamId, employeeId, action) => {
    try {
      const updatedTeam = await teamService.updateMember(teamId, { employeeId, action })
      setTeams((prev) => prev.map((item) => (item.id === teamId ? updatedTeam : item)))
    } catch (memberError) {
      setError(memberError.message || 'Unable to update member.')
    }
  }

  const suggestTeam = async (teamId) => {
    try {
      setSuggestingTeamId(teamId)
      const result = await teamService.suggest(teamId)
      setSuggestionsByTeam((prev) => ({ ...prev, [teamId]: result }))
    } catch (suggestError) {
      setError(suggestError.message || 'Unable to generate AI suggestion.')
    } finally {
      setSuggestingTeamId(null)
    }
  }

  const applySuggestion = async (teamId) => {
    const suggestion = suggestionsByTeam[teamId]
    if (!suggestion?.suggestions?.length) return
    const size = Number(suggestion.team?.targetSize || 4)
    const memberIds = suggestion.suggestions.slice(0, size).map((item) => item.employeeId)
    try {
      const result = await teamService.applySuggestion(teamId, memberIds)
      setTeams((prev) => prev.map((item) => (item.id === teamId ? result.team : item)))
    } catch (applyError) {
      setError(applyError.message || 'Unable to apply suggestion.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-white">Teams</h1>
          <p className="text-gray-400 mt-2">Create manager squads and let AI suggest the best members by skills, resume signals, and gaps.</p>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-6">
        <motion.form initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={createTeam} className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-3">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Plus className="w-4 h-4" />Create Team</h2>
          <input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Team name"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
          />
          <input
            value={form.roleFocus}
            onChange={(event) => setForm((prev) => ({ ...prev, roleFocus: event.target.value }))}
            placeholder="Role focus (e.g. Full Stack Squad)"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
          />
          <input
            value={form.requiredSkills}
            onChange={(event) => setForm((prev) => ({ ...prev, requiredSkills: event.target.value }))}
            placeholder="Required skills (comma separated)"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
          />
          <input
            type="number"
            min={2}
            max={12}
            value={form.targetSize}
            onChange={(event) => setForm((prev) => ({ ...prev, targetSize: event.target.value }))}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
          />
          <textarea
            rows={3}
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="Team mission"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
          />
          <button type="submit" disabled={saving} className="w-full rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black hover:bg-gray-200 disabled:opacity-50">
            {saving ? 'Saving...' : 'Create Team'}
          </button>
        </motion.form>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teams.map((team) => (
              <div key={team.id} className={`rounded-xl border p-4 ${team.id === selectedTeamId ? 'border-white bg-gray-900' : 'border-gray-700 bg-gray-900/70'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-white font-semibold">{team.name}</p>
                    <p className="text-xs text-gray-400 mt-1">{team.roleFocus || 'Role focus not set'}</p>
                    <p className="text-xs text-gray-500 mt-1">{team.members?.length || 0}/{team.targetSize} members</p>
                  </div>
                  <button onClick={() => removeTeam(team.id)} className="text-gray-500 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(team.requiredSkills || []).slice(0, 6).map((skill) => (
                    <span key={`${team.id}-${skill}`} className="px-2 py-1 text-[11px] border border-blue-500/30 bg-blue-500/10 text-blue-200 rounded">{skill}</span>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => setSelectedTeamId(team.id)} className="flex-1 rounded-lg border border-gray-600 px-2 py-1.5 text-xs text-gray-200 hover:bg-gray-800">Manage</button>
                  <button onClick={() => suggestTeam(team.id)} className="flex-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-200 hover:bg-emerald-500/20 inline-flex items-center justify-center gap-1">
                    {suggestingTeamId === team.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                    AI Suggest
                  </button>
                </div>
              </div>
            ))}
          </div>

          {loading && <p className="text-sm text-gray-500">Loading teams...</p>}

          {selectedTeam && (
            <div className="rounded-xl border border-gray-700 bg-gray-900 p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2"><Users className="w-4 h-4" />{selectedTeam.name}</h3>
                <button onClick={() => suggestTeam(selectedTeam.id)} className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200 inline-flex items-center gap-1">
                  <Bot className="w-3.5 h-3.5" />
                  Refresh AI
                </button>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-gray-500">Current Members</p>
                <div className="mt-2 space-y-2">
                  {(selectedTeam.members || []).map((member) => (
                    <div key={member.id} className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2">
                      <div>
                        <p className="text-sm text-white">{member.name}</p>
                        <p className="text-xs text-gray-400">{member.role} · Level {member.skillLevel}/5</p>
                      </div>
                      <button onClick={() => updateMember(selectedTeam.id, member.id, 'remove')} className="text-xs text-red-300 hover:text-red-200">Remove</button>
                    </div>
                  ))}
                  {(selectedTeam.members || []).length === 0 && <p className="text-sm text-gray-500">No members assigned yet.</p>}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-gray-500">Available Employees</p>
                <div className="mt-2 max-h-48 overflow-y-auto space-y-2">
                  {availableEmployees.map((member) => (
                    <div key={member.id} className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800/40 px-3 py-2">
                      <p className="text-sm text-gray-200">{member.name} <span className="text-gray-500">({member.role})</span></p>
                      <button onClick={() => updateMember(selectedTeam.id, member.id, 'add')} className="text-xs text-emerald-300 hover:text-emerald-200">Add</button>
                    </div>
                  ))}
                </div>
              </div>

              {suggestionsByTeam[selectedTeam.id]?.suggestions?.length > 0 && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-emerald-200 inline-flex items-center gap-1"><Sparkles className="w-4 h-4" />AI Team Suggestion</p>
                    <button onClick={() => applySuggestion(selectedTeam.id)} className="rounded-lg border border-emerald-400/40 bg-emerald-500/20 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-500/30">
                      Apply Top {selectedTeam.targetSize}
                    </button>
                  </div>
                  <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                    {suggestionsByTeam[selectedTeam.id].suggestions.slice(0, 8).map((row) => (
                      <div key={`${selectedTeam.id}-${row.employeeId}`} className="rounded-lg border border-emerald-500/20 bg-black/30 px-3 py-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-white">{row.name}</p>
                          <p className="text-xs text-emerald-200">{row.fitScore}% fit</p>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Matched: {(row.matchedSkills || []).slice(0, 3).join(', ') || '—'} · Gaps: {row.gapCount}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
