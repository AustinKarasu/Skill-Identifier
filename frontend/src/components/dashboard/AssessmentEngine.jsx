import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { PlusCircle, Trash2, Save, AlertTriangle, Pencil, Copy, X, Search } from 'lucide-react'
import { assessmentEngineService } from '../../api/services/assessmentEngineService'

const emptyRubric = { name: '', description: '', competencies: [{ name: '', weight: 1, description: '' }] }
const emptyTemplate = {
  title: '',
  description: '',
  category: 'general',
  rubricId: null,
  questions: [{ id: 'q1', type: 'mcq', prompt: '', options: [''], correctIndex: 0, keywords: [] }],
}

export default function AssessmentEngine() {
  const [rubrics, setRubrics] = useState([])
  const [templates, setTemplates] = useState([])
  const [rubricDraft, setRubricDraft] = useState(emptyRubric)
  const [templateDraft, setTemplateDraft] = useState(emptyTemplate)
  const [activeTab, setActiveTab] = useState('rubrics')
  const [error, setError] = useState('')
  const [rubricEditId, setRubricEditId] = useState(null)
  const [templateEditId, setTemplateEditId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [rubricData, templateData] = await Promise.all([
          assessmentEngineService.listRubrics(),
          assessmentEngineService.listTemplates(),
        ])
        setRubrics(rubricData)
        setTemplates(templateData)
      } catch (err) {
        setError(err.message)
      }
    }
    load()
  }, [])

  const refresh = async () => {
    const [rubricData, templateData] = await Promise.all([
      assessmentEngineService.listRubrics(),
      assessmentEngineService.listTemplates(),
    ])
    setRubrics(rubricData)
    setTemplates(templateData)
  }

  const resetRubricDraft = () => {
    setRubricDraft(emptyRubric)
    setRubricEditId(null)
  }

  const resetTemplateDraft = () => {
    setTemplateDraft(emptyTemplate)
    setTemplateEditId(null)
  }

  const startEditRubric = (rubric) => {
    setRubricDraft({
      name: rubric.name || '',
      description: rubric.description || '',
      competencies: (rubric.competencies || []).map((item) => ({
        name: item.name || '',
        weight: item.weight ?? 1,
        description: item.description || '',
      })),
    })
    setRubricEditId(rubric.id)
    setActiveTab('rubrics')
  }

  const startEditTemplate = (template) => {
    setTemplateDraft({
      title: template.title || '',
      description: template.description || '',
      category: template.category || 'general',
      rubricId: template.rubricId ?? null,
      questions: (template.questions || []).map((question, index) => ({
        id: question.id || `q${index + 1}`,
        type: question.type || 'mcq',
        prompt: question.prompt || '',
        options: question.options || [''],
        correctIndex: question.correctIndex ?? 0,
        keywords: question.keywords || [],
      })),
    })
    setTemplateEditId(template.id)
    setActiveTab('templates')
  }

  const duplicateTemplate = async (template) => {
    setError('')
    try {
      await assessmentEngineService.createTemplate({
        title: `${template.title} (Copy)`,
        description: template.description || '',
        category: template.category || 'general',
        rubricId: template.rubricId ?? null,
        questions: template.questions || [],
      })
      await refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  const validateRubricDraft = () => {
    if (!rubricDraft.name.trim()) return 'Rubric name is required.'
    const validCompetencies = rubricDraft.competencies.filter((item) => item.name.trim())
    if (!validCompetencies.length) return 'Add at least one competency.'
    return ''
  }

  const validateTemplateDraft = () => {
    if (!templateDraft.title.trim()) return 'Assessment title is required.'
    const validQuestions = templateDraft.questions.filter((item) => item.prompt.trim())
    if (!validQuestions.length) return 'Add at least one question prompt.'
    for (const question of validQuestions) {
      if (question.type === 'mcq') {
        const options = (question.options || []).filter((opt) => String(opt).trim())
        if (options.length < 2) return 'Each multiple-choice question needs at least two options.'
      }
    }
    return ''
  }

  const saveRubric = async () => {
    setError('')
    try {
      const validation = validateRubricDraft()
      if (validation) {
        setError(validation)
        return
      }
      if (rubricEditId) {
        await assessmentEngineService.updateRubric(rubricEditId, rubricDraft)
      } else {
        await assessmentEngineService.createRubric(rubricDraft)
      }
      resetRubricDraft()
      await refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  const saveTemplate = async () => {
    setError('')
    try {
      const validation = validateTemplateDraft()
      if (validation) {
        setError(validation)
        return
      }
      if (templateEditId) {
        await assessmentEngineService.updateTemplate(templateEditId, templateDraft)
      } else {
        await assessmentEngineService.createTemplate(templateDraft)
      }
      resetTemplateDraft()
      await refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  const filteredRubrics = rubrics.filter((item) =>
    `${item.name} ${item.description}`.toLowerCase().includes(searchQuery.toLowerCase()),
  )
  const filteredTemplates = templates.filter((item) =>
    `${item.title} ${item.description} ${item.category}`.toLowerCase().includes(searchQuery.toLowerCase()),
  )
  const totalQuestions = templates.reduce((sum, item) => sum + (item.questions?.length || 0), 0)
  const lastUpdated = [...rubrics, ...templates]
    .map((item) => item.createdAt)
    .filter(Boolean)
    .sort()
    .slice(-1)[0]

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-semibold text-white">Assessment Engine</h1>
        <p className="mt-2 text-sm text-gray-400">Create rubrics and skill assessments stored in the database.</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Rubrics', value: rubrics.length },
          { label: 'Templates', value: templates.length },
          { label: 'Questions', value: totalQuestions },
          { label: 'Last Updated', value: lastUpdated ? new Date(lastUpdated).toLocaleDateString() : '—' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-white/10 bg-black/40 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">{stat.label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {['rubrics', 'templates'].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold ${
              activeTab === tab ? 'bg-white text-black' : 'bg-white/10 text-gray-200'
            }`}
          >
            {tab === 'rubrics' ? 'Rubric Templates' : 'Assessment Templates'}
          </button>
        ))}
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search rubrics or templates"
            className="w-full rounded-xl border border-white/10 bg-black/40 pl-9 pr-3 py-2 text-sm text-white"
          />
        </div>
        {(rubricEditId || templateEditId) && (
          <button
            type="button"
            onClick={() => {
              resetRubricDraft()
              resetTemplateDraft()
            }}
            className="inline-flex items-center gap-2 text-xs text-gray-300"
          >
            <X className="w-4 h-4" />
            Cancel edit
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {activeTab === 'rubrics' ? (
        <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-6">
          <div className="rounded-3xl border border-white/10 bg-black/30 p-5 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white">{rubricEditId ? 'Edit Rubric' : 'New Rubric'}</h2>
              <p className="text-xs text-gray-500">Define competency weights and descriptions.</p>
            </div>
            <input
              value={rubricDraft.name}
              onChange={(e) => setRubricDraft((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Rubric name"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            />
            <textarea
              value={rubricDraft.description}
              onChange={(e) => setRubricDraft((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Description"
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            />
            <div className="space-y-3">
              {rubricDraft.competencies.map((item, index) => (
                <div key={index} className="rounded-xl border border-white/10 bg-black/40 p-3 space-y-2">
                  <input
                    value={item.name}
                    onChange={(e) => {
                      const next = [...rubricDraft.competencies]
                      next[index] = { ...item, name: e.target.value }
                      setRubricDraft((prev) => ({ ...prev, competencies: next }))
                    }}
                    placeholder="Competency"
                    className="w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1 text-xs text-white"
                  />
                  <input
                    type="number"
                    value={item.weight}
                    onChange={(e) => {
                      const next = [...rubricDraft.competencies]
                      next[index] = { ...item, weight: Number(e.target.value) }
                      setRubricDraft((prev) => ({ ...prev, competencies: next }))
                    }}
                    min={1}
                    max={5}
                    className="w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1 text-xs text-white"
                  />
                  <input
                    value={item.description}
                    onChange={(e) => {
                      const next = [...rubricDraft.competencies]
                      next[index] = { ...item, description: e.target.value }
                      setRubricDraft((prev) => ({ ...prev, competencies: next }))
                    }}
                    placeholder="Description"
                    className="w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1 text-xs text-white"
                  />
                  {rubricDraft.competencies.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = rubricDraft.competencies.filter((_, idx) => idx !== index)
                        setRubricDraft((prev) => ({ ...prev, competencies: next }))
                      }}
                      className="text-xs text-red-300"
                    >
                      Remove competency
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setRubricDraft((prev) => ({ ...prev, competencies: [...prev.competencies, { name: '', weight: 1, description: '' }] }))}
                className="inline-flex items-center gap-2 text-xs text-gray-300"
              >
                <PlusCircle className="w-4 h-4" />
                Add competency
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveRubric}
                className="inline-flex items-center gap-2 rounded-xl bg-white text-black px-4 py-2 text-sm font-semibold"
              >
                <Save className="w-4 h-4" />
                {rubricEditId ? 'Update Rubric' : 'Save Rubric'}
              </button>
              {rubricEditId && (
                <button
                  type="button"
                  onClick={resetRubricDraft}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-gray-200"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {filteredRubrics.map((rubric) => (
              <div key={rubric.id} className="rounded-3xl border border-white/10 bg-black/30 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{rubric.name}</h3>
                    <p className="text-xs text-gray-500">{rubric.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => startEditRubric(rubric)}
                      className="inline-flex items-center gap-1 text-xs text-gray-300"
                    >
                      <Pencil className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm(`Delete rubric "${rubric.name}"?`)) return
                        await assessmentEngineService.deleteRubric(rubric.id)
                        await refresh()
                      }}
                      className="inline-flex items-center gap-1 text-xs text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(rubric.competencies || []).map((item) => (
                    <span key={item.name} className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-gray-200">
                      {item.name} ({item.weight})
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {filteredRubrics.length === 0 && <p className="text-sm text-gray-500">No rubrics found.</p>}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-6">
          <div className="rounded-3xl border border-white/10 bg-black/30 p-5 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white">{templateEditId ? 'Edit Assessment Template' : 'New Assessment Template'}</h2>
              <p className="text-xs text-gray-500">Define questions, scoring rules, and rubric linkage.</p>
            </div>
            <input
              value={templateDraft.title}
              onChange={(e) => setTemplateDraft((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Assessment title"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            />
            <textarea
              value={templateDraft.description}
              onChange={(e) => setTemplateDraft((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Description"
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            />
            <select
              value={templateDraft.category}
              onChange={(e) => setTemplateDraft((prev) => ({ ...prev, category: e.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            >
              <option value="general">General</option>
              <option value="frontend">Frontend</option>
              <option value="backend">Backend</option>
              <option value="database">Database</option>
            </select>
            <select
              value={templateDraft.rubricId || ''}
              onChange={(e) => setTemplateDraft((prev) => ({ ...prev, rubricId: e.target.value ? Number(e.target.value) : null }))}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            >
              <option value="">No rubric</option>
              {rubrics.map((rubric) => (
                <option key={rubric.id} value={rubric.id}>{rubric.name}</option>
              ))}
            </select>
            <div className="space-y-3">
              {templateDraft.questions.map((question, index) => (
                <div key={question.id} className="rounded-xl border border-white/10 bg-black/40 p-3 space-y-2">
                  <input
                    value={question.prompt}
                    onChange={(e) => {
                      const next = [...templateDraft.questions]
                      next[index] = { ...question, prompt: e.target.value }
                      setTemplateDraft((prev) => ({ ...prev, questions: next }))
                    }}
                    placeholder="Question prompt"
                    className="w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1 text-xs text-white"
                  />
                  <select
                    value={question.type}
                    onChange={(e) => {
                      const next = [...templateDraft.questions]
                      next[index] = { ...question, type: e.target.value }
                      setTemplateDraft((prev) => ({ ...prev, questions: next }))
                    }}
                    className="w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1 text-xs text-white"
                  >
                    <option value="mcq">Multiple Choice</option>
                    <option value="text">Short Answer</option>
                  </select>
                  {question.type === 'mcq' && (
                    <div className="space-y-2">
                      {(question.options || []).map((opt, optIndex) => (
                        <input
                          key={optIndex}
                          value={opt}
                          onChange={(e) => {
                            const next = [...templateDraft.questions]
                            const options = [...question.options]
                            options[optIndex] = e.target.value
                            next[index] = { ...question, options }
                            setTemplateDraft((prev) => ({ ...prev, questions: next }))
                          }}
                          placeholder={`Option ${optIndex + 1}`}
                          className="w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1 text-xs text-white"
                        />
                      ))}
                      {question.options?.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...templateDraft.questions]
                            const options = question.options.slice(0, -1)
                            next[index] = { ...question, options, correctIndex: Math.min(question.correctIndex ?? 0, options.length - 1) }
                            setTemplateDraft((prev) => ({ ...prev, questions: next }))
                          }}
                          className="text-xs text-red-300"
                        >
                          Remove option
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...templateDraft.questions]
                          const options = [...question.options, '']
                          next[index] = { ...question, options }
                          setTemplateDraft((prev) => ({ ...prev, questions: next }))
                        }}
                        className="text-xs text-gray-300"
                      >
                        Add option
                      </button>
                      <input
                        type="number"
                        value={question.correctIndex ?? 0}
                        onChange={(e) => {
                          const next = [...templateDraft.questions]
                          next[index] = { ...question, correctIndex: Number(e.target.value) }
                          setTemplateDraft((prev) => ({ ...prev, questions: next }))
                        }}
                        className="w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1 text-xs text-white"
                        placeholder="Correct option index"
                      />
                    </div>
                  )}
                  {question.type === 'text' && (
                    <input
                      value={(question.keywords || []).join(', ')}
                      onChange={(e) => {
                        const next = [...templateDraft.questions]
                        next[index] = { ...question, keywords: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) }
                        setTemplateDraft((prev) => ({ ...prev, questions: next }))
                      }}
                      placeholder="Keywords (comma separated)"
                      className="w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1 text-xs text-white"
                    />
                  )}
                  {templateDraft.questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = templateDraft.questions.filter((_, idx) => idx !== index)
                        setTemplateDraft((prev) => ({ ...prev, questions: next }))
                      }}
                      className="text-xs text-red-300"
                    >
                      Remove question
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setTemplateDraft((prev) => ({ ...prev, questions: [...prev.questions, { id: `q${prev.questions.length + 1}`, type: 'mcq', prompt: '', options: [''], correctIndex: 0, keywords: [] }] }))}
                className="inline-flex items-center gap-2 text-xs text-gray-300"
              >
                <PlusCircle className="w-4 h-4" />
                Add question
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveTemplate}
                className="inline-flex items-center gap-2 rounded-xl bg-white text-black px-4 py-2 text-sm font-semibold"
              >
                <Save className="w-4 h-4" />
                {templateEditId ? 'Update Template' : 'Save Template'}
              </button>
              {templateEditId && (
                <button
                  type="button"
                  onClick={resetTemplateDraft}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-gray-200"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {filteredTemplates.map((template) => (
              <div key={template.id} className="rounded-3xl border border-white/10 bg-black/30 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{template.title}</h3>
                    <p className="text-xs text-gray-500">{template.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => startEditTemplate(template)}
                      className="inline-flex items-center gap-1 text-xs text-gray-300"
                    >
                      <Pencil className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => duplicateTemplate(template)}
                      className="inline-flex items-center gap-1 text-xs text-gray-300"
                    >
                      <Copy className="w-4 h-4" />
                      Duplicate
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm(`Delete template "${template.title}"?`)) return
                        await assessmentEngineService.deleteTemplate(template.id)
                        await refresh()
                      }}
                      className="inline-flex items-center gap-1 text-xs text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500">Category: {template.category}</p>
                <p className="mt-2 text-xs text-gray-500">Questions: {template.questions?.length || 0}</p>
                <p className="mt-2 text-xs text-gray-500">
                  Rubric: {rubrics.find((rubric) => rubric.id === template.rubricId)?.name || 'None'}
                </p>
              </div>
            ))}
            {filteredTemplates.length === 0 && <p className="text-sm text-gray-500">No assessment templates found.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
