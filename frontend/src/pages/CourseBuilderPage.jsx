import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useStore } from '../store';
import { Plus, Trash2, ChevronDown, ChevronRight, Save, Eye, Rocket, ArrowLeft, Loader2, GripVertical, BookOpen, X } from 'lucide-react';

// ─── DIFFICULTY COLORS ────────────────────────────────────────────────────────
const DIFF = { easy: '#3fb950', medium: '#f0883e', hard: '#f85149' };
const VALIDATION_TYPES = ['file_exists', 'contains', 'regex', 'static', 'custom'];

// ─── TASK FORM (STRICT SCHEMA) ────────────────────────────────────────────────
function TaskForm({ milestoneId, existingTask, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: '', goal: '', description: '', difficulty: 'easy',
    concepts: [], steps: [''], hints: ['', '', ''],
    starter_template: '', commands: [''], file_path: '',
    validation_type: 'file_exists', validation_rules: {},
    folder_structure: {}, estimated_minutes: 30,
    ...(existingTask || {})
  });
  const [conceptInput, setConceptInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Parse JSON fields from existing task
  useEffect(() => {
    if (existingTask) {
      const parse = (v, d) => { try { return typeof v === 'string' ? JSON.parse(v) : (v || d); } catch { return d; } };
      setForm(prev => ({
        ...prev,
        concepts: parse(existingTask.concepts, []),
        steps: parse(existingTask.steps, ['']),
        hints: parse(existingTask.hints, ['', '', '']),
        commands: parse(existingTask.commands, ['']),
        validation_rules: parse(existingTask.validation_rules, {}),
        folder_structure: parse(existingTask.folder_structure, {}),
      }));
    }
  }, [existingTask]);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const updateListItem = (key, idx, val) => {
    const arr = [...form[key]];
    arr[idx] = val;
    set(key, arr);
  };

  const addListItem = (key) => set(key, [...form[key], '']);
  const removeListItem = (key, idx) => set(key, form[key].filter((_, i) => i !== idx));

  const addConcept = () => {
    if (conceptInput.trim() && !form.concepts.includes(conceptInput.trim())) {
      set('concepts', [...form.concepts, conceptInput.trim()]);
      setConceptInput('');
    }
  };

  const handleSave = async () => {
    setError('');
    // Client-side validation
    if (!form.title || form.title.length < 3) { setError('Task title required (3+ chars)'); return; }
    if (!form.goal || form.goal.length < 5) { setError('Task goal required (5+ chars)'); return; }
    const validSteps = form.steps.filter(s => s.trim());
    if (validSteps.length === 0) { setError('At least 1 step required'); return; }

    setSaving(true);
    try {
      const payload = {
        ...form,
        steps: validSteps,
        hints: form.hints.filter(h => h.trim()),
        commands: form.commands.filter(c => c.trim()),
      };
      if (existingTask) {
        await api.builderUpdateTask(existingTask.id, payload);
      } else {
        await api.builderAddTask(milestoneId, payload);
      }
      onSave();
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  return (
    <div style={s.taskForm}>
      <div style={s.formHeader}>
        <h3 style={s.formTitle}>{existingTask ? 'Edit Task' : 'New Task'}</h3>
        <button onClick={onCancel} style={s.closeBtn}><X size={16} /></button>
      </div>

      {error && <div style={s.formError}>⚠ {error}</div>}

      <div style={s.formGrid}>
        {/* Row 1: Title + Difficulty */}
        <div style={s.fieldFull}>
          <label style={s.label}>Task Title *</label>
          <input style={s.input} value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Create Python Environment" />
        </div>
        <div style={s.fieldSmall}>
          <label style={s.label}>Difficulty</label>
          <select style={s.select} value={form.difficulty} onChange={e => set('difficulty', e.target.value)}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>

        {/* Row 2: Goal */}
        <div style={s.fieldFull}>
          <label style={s.label}>Goal * <span style={s.hint}>What should the student achieve?</span></label>
          <input style={s.input} value={form.goal} onChange={e => set('goal', e.target.value)} placeholder="e.g. Setup virtual environment for NLP work" />
        </div>

        {/* Description */}
        <div style={s.fieldFull}>
          <label style={s.label}>Description</label>
          <textarea style={{ ...s.input, minHeight: 60 }} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Detailed task description..." />
        </div>

        {/* Concepts */}
        <div style={s.fieldFull}>
          <label style={s.label}>Concepts (tags)</label>
          <div style={s.tagRow}>
            {form.concepts.map((c, i) => (
              <span key={i} style={s.tag}>
                {c}
                <button onClick={() => set('concepts', form.concepts.filter((_, j) => j !== i))} style={s.tagRemove}>×</button>
              </span>
            ))}
            <input style={s.tagInput} value={conceptInput} onChange={e => setConceptInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addConcept())} placeholder="Type + Enter" />
          </div>
        </div>

        {/* Steps */}
        <div style={s.fieldFull}>
          <label style={s.label}>Steps * <span style={s.hint}>Ordered list of actions</span></label>
          {form.steps.map((step, i) => (
            <div key={i} style={s.listRow}>
              <span style={s.listNum}>{i + 1}.</span>
              <input style={{ ...s.input, flex: 1 }} value={step} onChange={e => updateListItem('steps', i, e.target.value)} placeholder={`Step ${i + 1}`} />
              {form.steps.length > 1 && <button onClick={() => removeListItem('steps', i)} style={s.removeBtn}><Trash2 size={12} /></button>}
            </div>
          ))}
          <button onClick={() => addListItem('steps')} style={s.addBtn}><Plus size={12} /> Add Step</button>
        </div>

        {/* Commands */}
        <div style={s.fieldFull}>
          <label style={s.label}>Commands <span style={s.hint}>Shell commands student should run</span></label>
          {form.commands.map((cmd, i) => (
            <div key={i} style={s.listRow}>
              <span style={s.cmdPrefix}>$</span>
              <input style={{ ...s.input, flex: 1, fontFamily: 'var(--mono)' }} value={cmd} onChange={e => updateListItem('commands', i, e.target.value)} placeholder="npm init -y" />
              {form.commands.length > 1 && <button onClick={() => removeListItem('commands', i)} style={s.removeBtn}><Trash2 size={12} /></button>}
            </div>
          ))}
          <button onClick={() => addListItem('commands')} style={s.addBtn}><Plus size={12} /> Add Command</button>
        </div>

        {/* Starter Template */}
        <div style={s.fieldFull}>
          <label style={s.label}>Starter Template <span style={s.hint}>Code students start with (TODOs)</span></label>
          <textarea style={{ ...s.input, minHeight: 100, fontFamily: 'var(--mono)', fontSize: 12 }} value={form.starter_template} onChange={e => set('starter_template', e.target.value)} placeholder="# TODO: Add python environment activation script" />
        </div>

        {/* File Path */}
        <div style={s.fieldFull}>
          <label style={s.label}>Target File Path <span style={s.hint}>File student should create/edit</span></label>
          <input style={{ ...s.input, fontFamily: 'var(--mono)' }} value={form.file_path} onChange={e => set('file_path', e.target.value)} placeholder="src/index.js" />
        </div>

        {/* Validation */}
        <div style={s.fieldFull}>
          <label style={s.label}>Validation Type * <span style={s.hint}>How system checks completion</span></label>
          <select style={s.select} value={form.validation_type} onChange={e => set('validation_type', e.target.value)}>
            {VALIDATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Hints (3 levels) */}
        <div style={s.fieldFull}>
          <label style={s.label}>Hints (Level 1 → 3: vague → specific)</label>
          {form.hints.map((h, i) => (
            <div key={i} style={s.listRow}>
              <span style={{ ...s.listNum, minWidth: 50, color: ['#3fb950', '#f0883e', '#f85149'][i] || '#8b949e' }}>L{i + 1}</span>
              <input style={{ ...s.input, flex: 1 }} value={h} onChange={e => updateListItem('hints', i, e.target.value)} placeholder={i === 0 ? "Think about isolation..." : i === 1 ? "Use python -m venv" : "python3 -m venv nlp-env && source nlp-env/bin/activate"} />
            </div>
          ))}
          {form.hints.length < 5 && <button onClick={() => addListItem('hints')} style={s.addBtn}><Plus size={12} /> Add Hint Level</button>}
        </div>

        {/* Time */}
        <div style={s.fieldSmall}>
          <label style={s.label}>Estimated Minutes</label>
          <input type="number" style={s.input} value={form.estimated_minutes} onChange={e => set('estimated_minutes', parseInt(e.target.value) || 30)} />
        </div>
      </div>

      <div style={s.formActions}>
        <button onClick={onCancel} style={s.cancelBtn}>Cancel</button>
        <button onClick={handleSave} disabled={saving} style={s.saveBtn}>
          {saving ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
          {existingTask ? 'Update Task' : 'Add Task'}
        </button>
      </div>
    </div>
  );
}

// ─── PREVIEW MODE ─────────────────────────────────────────────────────────────
function StudentPreview({ course, milestones, tasks, onClose }) {
  const [activeMs, setActiveMs] = useState(milestones[0]?.id);
  const msTasks = tasks.filter(t => t.milestone_id === activeMs);
  const [activeTask, setActiveTask] = useState(msTasks[0]);

  useEffect(() => {
    const t = tasks.filter(t => t.milestone_id === activeMs);
    setActiveTask(t[0] || null);
  }, [activeMs, tasks]);

  const parse = (v, d) => { try { return typeof v === 'string' ? JSON.parse(v) : (v || d); } catch { return d; } };

  return (
    <div style={s.previewOverlay}>
      <div style={s.previewModal}>
        <div style={s.previewHeader}>
          <div>
            <div style={{ fontSize: 10, color: '#f0883e', fontWeight: 800, letterSpacing: '0.15em' }}>STUDENT PREVIEW</div>
            <h2 style={{ margin: '4px 0 0', color: '#e6edf3', fontSize: 18 }}>{course.title}</h2>
          </div>
          <button onClick={onClose} style={s.closeBtn}><X size={18} /></button>
        </div>

        <div style={s.previewBody}>
          {/* Left sidebar: milestones */}
          <div style={s.previewSidebar}>
            <div style={{ fontSize: 11, color: '#8b949e', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' }}>Milestones</div>
            {milestones.map((m, i) => (
              <div key={m.id} onClick={() => setActiveMs(m.id)} style={{ ...s.previewMsItem, background: activeMs === m.id ? 'rgba(88,166,255,0.1)' : 'transparent', borderColor: activeMs === m.id ? '#58a6ff' : '#21262d' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: activeMs === m.id ? '#58a6ff' : '#c9d1d9' }}>{i + 1}. {m.title}</div>
                <div style={{ fontSize: 11, color: '#8b949e' }}>{tasks.filter(t => t.milestone_id === m.id).length} tasks</div>
              </div>
            ))}
          </div>

          {/* Right: task content */}
          <div style={s.previewContent}>
            {activeTask ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#8b949e' }}>~{activeTask.estimated_minutes || 30}m est</div>
                    <h2 style={{ margin: '4px 0 8px', fontSize: 22, fontWeight: 800, color: '#e6edf3' }}>{activeTask.title}</h2>
                    <div style={{ fontSize: 13, color: '#8b949e', lineHeight: 1.6 }}>{activeTask.goal}</div>
                  </div>
                  <span style={{ ...s.diffBadge, color: DIFF[activeTask.difficulty] || '#8b949e' }}>{activeTask.difficulty?.toUpperCase()}</span>
                </div>

                {parse(activeTask.concepts, []).length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={s.previewLabel}>CONCEPTS</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {parse(activeTask.concepts, []).map((c, i) => <span key={i} style={s.previewChip}>{c}</span>)}
                    </div>
                  </div>
                )}

                {parse(activeTask.commands, []).filter(Boolean).length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={s.previewLabel}>COMMANDS</div>
                    <div style={s.previewTerminal}>
                      {parse(activeTask.commands, []).filter(Boolean).map((c, i) => <div key={i} style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>$ {c}</div>)}
                    </div>
                  </div>
                )}

                {activeTask.starter_template && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={s.previewLabel}>STARTER TEMPLATE</div>
                    <pre style={s.previewCode}>{activeTask.starter_template}</pre>
                  </div>
                )}

                <div style={{ marginTop: 20 }}>
                  <button style={s.previewStartBtn}>START TASK →</button>
                </div>
                
                {/* Task list for this milestone */}
                <div style={{ marginTop: 24, borderTop: '1px solid #21262d', paddingTop: 16 }}>
                  <div style={s.previewLabel}>ALL TASKS IN THIS MILESTONE</div>
                  {msTasks.map((t, i) => (
                    <div key={t.id} onClick={() => setActiveTask(t)} style={{ ...s.previewTaskItem, background: activeTask?.id === t.id ? 'rgba(88,166,255,0.05)' : 'transparent' }}>
                      <span style={{ color: '#8b949e', fontSize: 11, marginRight: 8 }}>{i + 1}.</span>
                      <span style={{ color: activeTask?.id === t.id ? '#58a6ff' : '#c9d1d9', fontSize: 13 }}>{t.title}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: DIFF[t.difficulty] || '#8b949e' }}>{t.difficulty}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 60, color: '#8b949e' }}>No tasks in this milestone yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN: COURSE BUILDER PAGE ────────────────────────────────────────────────
export default function CourseBuilderPage() {
  const navigate = useNavigate();
  const { id: courseId } = useParams();
  const { user, token, role } = useStore();

  const [mode, setMode] = useState(courseId ? 'edit' : 'list'); // list | create | edit
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Course data (edit mode)
  const [course, setCourse] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [expandedMs, setExpandedMs] = useState({});

  // Task form
  const [showTaskForm, setShowTaskForm] = useState(null); // { milestoneId, task? }
  const [showPreview, setShowPreview] = useState(false);

  // Create form
  const [createForm, setCreateForm] = useState({ title: '', description: '', tech_stack: [], difficulty: 'beginner', estimated_hours: 10, learning_outcome: '' });
  const [stackInput, setStackInput] = useState('');
  const [creating, setCreating] = useState(false);

  // Milestone form
  const [msForm, setMsForm] = useState({ title: '', description: '', duration_days: 7 });
  const [addingMs, setAddingMs] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Guard
  useEffect(() => {
    if (!token) navigate('/login');
    if (role !== 'mentor') navigate('/dashboard');
  }, [token, user]);

  // Load courses list
  useEffect(() => {
    if (mode === 'list') {
      (async () => {
        setLoading(true);
        try {
          const data = await api.builderListCourses();
          setCourses(Array.isArray(data) ? data : []);
        } catch (e) { setError(e.message); }
        setLoading(false);
      })();
    }
  }, [mode]);

  // Load course for editing
  useEffect(() => {
    if (courseId || mode === 'edit') {
      const id = courseId || course?.id;
      if (!id) return;
      (async () => {
        setLoading(true);
        try {
          const data = await api.builderGetCourse(id);
          setCourse(data.course);
          setMilestones(data.milestones || []);
          setTasks(data.tasks || []);
          // Auto-expand first milestone
          if (data.milestones.length > 0) setExpandedMs({ [data.milestones[0].id]: true });
        } catch (e) { setError(e.message); }
        setLoading(false);
      })();
    }
  }, [courseId]);

  const refreshCourse = async (id) => {
    try {
      const data = await api.builderGetCourse(id || course?.id);
      setCourse(data.course);
      setMilestones(data.milestones || []);
      setTasks(data.tasks || []);
    } catch (e) { setError(e.message); }
  };

  // --- Create Course ---
  const handleCreate = async () => {
    setError('');
    if (!createForm.title || createForm.title.length < 3) { setError('Title required (3+ chars)'); return; }
    if (!createForm.description || createForm.description.length < 20) { setError('Description required (20+ chars)'); return; }

    setCreating(true);
    try {
      const res = await api.builderCreateCourse(createForm);
      setMode('edit');
      navigate(`/builder/${res.course_id}`);
      await refreshCourse(res.course_id);
    } catch (e) { setError(e.message); }
    setCreating(false);
  };

  // --- Add Milestone ---
  const handleAddMilestone = async () => {
    if (!msForm.title || msForm.title.length < 2) { setError('Milestone title required'); return; }
    setAddingMs(true);
    setError('');
    try {
      await api.builderAddMilestone(course.id, msForm);
      await refreshCourse();
      setMsForm({ title: '', description: '', duration_days: 7 });
    } catch (e) { setError(e.message); }
    setAddingMs(false);
  };

  // --- Delete Milestone ---
  const handleDeleteMs = async (msId) => {
    if (!confirm('Delete this milestone and all its tasks?')) return;
    try {
      await api.builderDeleteMilestone(msId);
      await refreshCourse();
    } catch (e) { setError(e.message); }
  };

  // --- Delete Task ---
  const handleDeleteTask = async (taskId) => {
    if (!confirm('Delete this task?')) return;
    try {
      await api.builderDeleteTask(taskId);
      await refreshCourse();
    } catch (e) { setError(e.message); }
  };

  // --- Publish ---
  const handlePublish = async () => {
    if (!confirm('Publish this course to the marketplace? Students will be able to enroll.')) return;
    setPublishing(true);
    setError('');
    try {
      await api.builderPublishCourse(course.id);
      await refreshCourse();
    } catch (e) { setError(e.message); }
    setPublishing(false);
  };

  // ─── LIST MODE ──────────────────────────────────────────────────────────────
  if (mode === 'list' && !courseId) {
    return (
      <div style={s.page}>
        <div style={s.topBar}>
          <BookOpen size={20} color="#58a6ff" />
          <h1 style={s.pageTitle}>Course Builder</h1>
          <button onClick={() => setMode('create')} style={s.primaryBtn}><Plus size={14} /> New Course</button>
        </div>

        {error && <div style={s.formError}>{error}</div>}

        {loading ? (
          <div style={s.center}><Loader2 size={20} className="spin" /> Loading...</div>
        ) : courses.length === 0 ? (
          <div style={s.emptyState}>
            <BookOpen size={40} color="#30363d" />
            <div style={{ color: '#8b949e', marginTop: 16 }}>No courses yet. Create your first structured learning path.</div>
            <button onClick={() => setMode('create')} style={{ ...s.primaryBtn, marginTop: 16 }}><Plus size={14} /> Create Course</button>
          </div>
        ) : (
          <div style={s.courseGrid}>
            {courses.map(c => (
              <div key={c.id} style={s.courseCard} onClick={() => navigate(`/builder/${c.id}`)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ ...s.statusBadge, background: c.status === 'published' ? 'rgba(63,185,80,0.1)' : 'rgba(139,148,158,0.1)', color: c.status === 'published' ? '#3fb950' : '#8b949e' }}>
                    {c.status?.toUpperCase() || 'DRAFT'}
                  </span>
                  <span style={{ fontSize: 11, color: DIFF[c.difficulty] || '#8b949e' }}>{c.difficulty}</span>
                </div>
                <h3 style={s.courseCardTitle}>{c.title}</h3>
                <p style={s.courseCardDesc}>{c.description?.substring(0, 100)}{c.description?.length > 100 ? '...' : ''}</p>
                <div style={{ fontSize: 11, color: '#8b949e', marginTop: 'auto' }}>{c.estimated_hours}h estimated</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── CREATE MODE ────────────────────────────────────────────────────────────
  if (mode === 'create') {
    return (
      <div style={s.page}>
        <button onClick={() => setMode('list')} style={s.backBtn}><ArrowLeft size={14} /> Back to Courses</button>
        <h1 style={s.pageTitle}>Create New Course</h1>
        <div style={{ maxWidth: 700 }}>
          {error && <div style={s.formError}>{error}</div>}

          <div style={s.fieldFull}>
            <label style={s.label}>Course Title *</label>
            <input style={s.input} value={createForm.title} onChange={e => setCreateForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Build a REST API with Node.js" />
          </div>
          <div style={s.fieldFull}>
            <label style={s.label}>Description *</label>
            <textarea style={{ ...s.input, minHeight: 80 }} value={createForm.description} onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))} placeholder="What will students learn and build?" />
          </div>
          <div style={s.fieldFull}>
            <label style={s.label}>Learning Outcome</label>
            <input style={s.input} value={createForm.learning_outcome} onChange={e => setCreateForm(p => ({ ...p, learning_outcome: e.target.value }))} placeholder="By the end, students will be able to..." />
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={s.label}>Difficulty</label>
              <select style={s.select} value={createForm.difficulty} onChange={e => setCreateForm(p => ({ ...p, difficulty: e.target.value }))}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={s.label}>Estimated Hours</label>
              <input type="number" style={s.input} value={createForm.estimated_hours} onChange={e => setCreateForm(p => ({ ...p, estimated_hours: parseInt(e.target.value) || 10 }))} />
            </div>
          </div>
          <div style={s.fieldFull}>
            <label style={s.label}>Tech Stack</label>
            <div style={s.tagRow}>
              {createForm.tech_stack.map((t, i) => (
                <span key={i} style={s.tag}>{t}<button onClick={() => setCreateForm(p => ({ ...p, tech_stack: p.tech_stack.filter((_, j) => j !== i) }))} style={s.tagRemove}>×</button></span>
              ))}
              <input style={s.tagInput} value={stackInput} onChange={e => setStackInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (stackInput.trim()) { setCreateForm(p => ({ ...p, tech_stack: [...p.tech_stack, stackInput.trim()] })); setStackInput(''); } } }}
                placeholder="Type + Enter" />
            </div>
          </div>
          <button onClick={handleCreate} disabled={creating} style={{ ...s.primaryBtn, marginTop: 20, width: '100%', justifyContent: 'center', padding: '14px' }}>
            {creating ? <Loader2 size={14} className="spin" /> : <Rocket size={14} />} Create Course Draft
          </button>
        </div>
      </div>
    );
  }

  // ─── EDIT MODE (MAIN BUILDER) ───────────────────────────────────────────────
  if (loading) return <div style={s.center}><Loader2 size={20} className="spin" /> Loading course...</div>;
  if (!course) return <div style={s.center}>Course not found.</div>;

  return (
    <div style={s.page}>
      {/* Top Bar */}
      <div style={s.topBar}>
        <button onClick={() => { setMode('list'); navigate('/builder'); }} style={s.backBtn}><ArrowLeft size={14} /> All Courses</button>
        <div style={{ flex: 1 }}>
          <h1 style={{ ...s.pageTitle, margin: 0, fontSize: 18 }}>{course.title}</h1>
          <span style={{ fontSize: 11, color: '#8b949e' }}>{course.status === 'published' ? '✅ Published' : '📝 Draft'}</span>
        </div>
        <button onClick={() => setShowPreview(true)} style={s.previewBtn}><Eye size={14} /> View as Student</button>
        {course.status !== 'published' && (
          <button onClick={handlePublish} disabled={publishing} style={s.publishBtn}>
            {publishing ? <Loader2 size={14} className="spin" /> : <Rocket size={14} />} Publish
          </button>
        )}
      </div>

      {error && <div style={s.formError}>{error}</div>}

      <div style={s.builderLayout}>
        {/* MILESTONES */}
        <div style={s.builderMain}>
          {milestones.map((ms, mIdx) => {
            const msTasks = tasks.filter(t => t.milestone_id === ms.id);
            const expanded = expandedMs[ms.id];
            return (
              <div key={ms.id} style={s.msCard}>
                <div style={s.msHeader} onClick={() => setExpandedMs(prev => ({ ...prev, [ms.id]: !prev[ms.id] }))}>
                  {expanded ? <ChevronDown size={16} color="#8b949e" /> : <ChevronRight size={16} color="#8b949e" />}
                  <div style={{ flex: 1 }}>
                    <span style={s.msPosition}>Milestone {mIdx + 1}</span>
                    <h3 style={s.msTitle}>{ms.title}</h3>
                    {ms.description && <p style={s.msDesc}>{ms.description}</p>}
                  </div>
                  <span style={s.taskCount}>{msTasks.length} tasks</span>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteMs(ms.id); }} style={s.deleteBtn}><Trash2 size={14} /></button>
                </div>

                {expanded && (
                  <div style={s.msBody}>
                    {msTasks.length === 0 ? (
                      <div style={s.noTasks}>No tasks yet. Add your first task.</div>
                    ) : (
                      msTasks.map((t, tIdx) => {
                        const parse = (v, d) => { try { return typeof v === 'string' ? JSON.parse(v) : (v || d); } catch { return d; } };
                        return (
                          <div key={t.id} style={s.taskCard}>
                            <div style={s.taskCardHeader}>
                              <GripVertical size={12} color="#484f58" />
                              <span style={s.taskPosition}>{tIdx + 1}</span>
                              <div style={{ flex: 1 }}>
                                <div style={s.taskCardTitle}>{t.title}</div>
                                <div style={s.taskCardGoal}>{t.goal}</div>
                              </div>
                              <span style={{ ...s.diffBadge, color: DIFF[t.difficulty] || '#8b949e' }}>{t.difficulty}</span>
                              <span style={s.valBadge}>{t.validation_type || '⚠ no validation'}</span>
                              <button onClick={() => setShowTaskForm({ milestoneId: ms.id, task: t })} style={s.editBtn}>Edit</button>
                              <button onClick={() => handleDeleteTask(t.id)} style={s.deleteBtn}><Trash2 size={12} /></button>
                            </div>
                            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                              {parse(t.concepts, []).map((c, i) => <span key={i} style={s.miniTag}>{c}</span>)}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <button onClick={() => setShowTaskForm({ milestoneId: ms.id })} style={s.addTaskBtn}><Plus size={14} /> Add Task</button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add Milestone Form */}
          <div style={s.addMsSection}>
            <h4 style={{ color: '#8b949e', margin: '0 0 12px', fontSize: 13 }}>Add Milestone</h4>
            <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
              <input style={{ ...s.input, flex: 1 }} value={msForm.title} onChange={e => setMsForm(p => ({ ...p, title: e.target.value }))} placeholder="Milestone title (e.g. Setup, Build, Test)" />
              <input type="number" style={{ ...s.input, width: 70 }} value={msForm.duration_days} onChange={e => setMsForm(p => ({ ...p, duration_days: parseInt(e.target.value) || 7 }))} title="Duration (days)" />
              <button onClick={handleAddMilestone} disabled={addingMs} style={s.addMsBtn}>
                {addingMs ? <Loader2 size={14} className="spin" /> : <Plus size={14} />} Add
              </button>
            </div>
            <input style={s.input} value={msForm.description} onChange={e => setMsForm(p => ({ ...p, description: e.target.value }))} placeholder="Description (optional)" />
          </div>
        </div>
      </div>

      {/* Task Form Modal */}
      {showTaskForm && (
        <div style={s.modalOverlay}>
          <TaskForm
            milestoneId={showTaskForm.milestoneId}
            existingTask={showTaskForm.task}
            onSave={() => { setShowTaskForm(null); refreshCourse(); }}
            onCancel={() => setShowTaskForm(null)}
          />
        </div>
      )}

      {/* Student Preview Modal */}
      {showPreview && course && (
        <StudentPreview
          course={course}
          milestones={milestones}
          tasks={tasks}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const s = {
  page: { minHeight: '100vh', background: '#0d1117', color: '#c9d1d9', padding: '20px 32px 60px', fontFamily: 'var(--sans)' },
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12, color: '#8b949e' },
  topBar: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28, paddingBottom: 16, borderBottom: '1px solid #21262d' },
  pageTitle: { fontSize: 22, fontWeight: 800, color: '#e6edf3', margin: 0 },
  backBtn: { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: 12, padding: 0 },

  // Buttons
  primaryBtn: { display: 'flex', alignItems: 'center', gap: 8, background: '#238636', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  previewBtn: { display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(88,166,255,0.1)', color: '#58a6ff', border: '1px solid rgba(88,166,255,0.2)', borderRadius: 6, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  publishBtn: { display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg, #238636, #2ea043)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },

  // Course List
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80 },
  courseGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 },
  courseCard: { background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: 20, cursor: 'pointer', display: 'flex', flexDirection: 'column', transition: 'border-color 0.2s' },
  courseCardTitle: { fontSize: 16, fontWeight: 700, color: '#e6edf3', margin: '0 0 6px' },
  courseCardDesc: { fontSize: 12, color: '#8b949e', lineHeight: 1.5, margin: 0 },
  statusBadge: { fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4 },

  // Builder Layout
  builderLayout: { maxWidth: 900 },
  builderMain: { display: 'flex', flexDirection: 'column', gap: 16 },

  // Milestone Card
  msCard: { background: '#161b22', border: '1px solid #30363d', borderRadius: 10, overflow: 'hidden' },
  msHeader: { display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', cursor: 'pointer', borderBottom: '1px solid #21262d' },
  msPosition: { fontSize: 10, color: '#8b949e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' },
  msTitle: { fontSize: 15, fontWeight: 700, color: '#e6edf3', margin: '2px 0 0' },
  msDesc: { fontSize: 12, color: '#8b949e', margin: '4px 0 0' },
  taskCount: { fontSize: 11, color: '#8b949e', background: '#0d1117', padding: '3px 8px', borderRadius: 4 },
  msBody: { padding: '16px 20px' },
  noTasks: { textAlign: 'center', padding: 20, color: '#484f58', fontSize: 13 },

  // Task Card
  taskCard: { background: '#0d1117', border: '1px solid #21262d', borderRadius: 8, padding: '12px 14px', marginBottom: 10 },
  taskCardHeader: { display: 'flex', alignItems: 'center', gap: 10 },
  taskPosition: { fontSize: 12, fontWeight: 700, color: '#58a6ff', minWidth: 20 },
  taskCardTitle: { fontSize: 13, fontWeight: 700, color: '#c9d1d9' },
  taskCardGoal: { fontSize: 11, color: '#8b949e' },
  diffBadge: { fontSize: 10, fontWeight: 800, textTransform: 'uppercase' },
  valBadge: { fontSize: 10, color: '#3fb950', background: 'rgba(63,185,80,0.1)', padding: '2px 6px', borderRadius: 4 },
  editBtn: { background: 'none', border: '1px solid #30363d', color: '#58a6ff', borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer' },
  deleteBtn: { background: 'none', border: 'none', color: '#484f58', cursor: 'pointer', padding: 4 },
  miniTag: { fontSize: 10, color: '#7ee787', background: 'rgba(126,231,135,0.08)', padding: '2px 6px', borderRadius: 4, fontFamily: 'var(--mono)' },
  addTaskBtn: { display: 'flex', alignItems: 'center', gap: 6, width: '100%', background: 'transparent', border: '1px dashed #30363d', color: '#8b949e', padding: '10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, justifyContent: 'center', marginTop: 8 },

  // Add Milestone
  addMsSection: { background: '#161b22', border: '1px dashed #30363d', borderRadius: 10, padding: 20 },
  addMsBtn: { display: 'flex', alignItems: 'center', gap: 4, background: '#238636', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },

  // Task Form 
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(1,4,9,0.85)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' },
  taskForm: { width: '100%', maxWidth: 720, background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 0 },
  formHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #21262d' },
  formTitle: { margin: 0, color: '#e6edf3', fontSize: 16 },
  closeBtn: { background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer' },
  formGrid: { padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 },
  formError: { background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', color: '#ff7b72', padding: '10px 16px', borderRadius: 6, fontSize: 13, margin: '0 24px' },
  formActions: { display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '16px 24px', borderTop: '1px solid #21262d' },
  cancelBtn: { background: 'none', border: '1px solid #30363d', color: '#8b949e', borderRadius: 6, padding: '10px 20px', fontSize: 13, cursor: 'pointer' },
  saveBtn: { display: 'flex', alignItems: 'center', gap: 6, background: '#238636', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },

  // Form Fields
  fieldFull: { display: 'flex', flexDirection: 'column', gap: 6 },
  fieldSmall: { display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 200 },
  label: { fontSize: 12, fontWeight: 700, color: '#c9d1d9', textTransform: 'uppercase', letterSpacing: '0.05em' },
  hint: { fontWeight: 400, fontSize: 11, color: '#484f58', textTransform: 'none', letterSpacing: 0 },
  input: { background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3', borderRadius: 6, padding: '10px 12px', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' },
  select: { background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3', borderRadius: 6, padding: '10px 12px', fontSize: 13, outline: 'none' },

  // Tags
  tagRow: { display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  tag: { display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(88,166,255,0.1)', color: '#58a6ff', padding: '4px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600 },
  tagRemove: { background: 'none', border: 'none', color: '#ff7b72', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 },
  tagInput: { background: 'transparent', border: '1px solid #30363d', color: '#e6edf3', borderRadius: 4, padding: '4px 8px', fontSize: 12, outline: 'none', minWidth: 100 },

  // List items
  listRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  listNum: { fontSize: 12, fontWeight: 700, color: '#8b949e', minWidth: 20 },
  cmdPrefix: { fontSize: 13, fontWeight: 700, color: '#3fb950', fontFamily: 'var(--mono)' },
  removeBtn: { background: 'none', border: 'none', color: '#484f58', cursor: 'pointer', padding: 4 },
  addBtn: { display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: '#58a6ff', fontSize: 11, cursor: 'pointer', padding: '4px 0' },

  // Preview
  previewOverlay: { position: 'fixed', inset: 0, background: 'rgba(1,4,9,0.9)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  previewModal: { width: '100%', maxWidth: 1100, height: '85vh', background: '#0d1117', border: '1px solid #30363d', borderRadius: 12, display: 'flex', flexDirection: 'column' },
  previewHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #21262d' },
  previewBody: { display: 'flex', flex: 1, minHeight: 0 },
  previewSidebar: { width: 220, borderRight: '1px solid #21262d', padding: 16, overflowY: 'auto' },
  previewContent: { flex: 1, padding: 24, overflowY: 'auto' },
  previewMsItem: { padding: '10px 12px', borderRadius: 6, border: '1px solid #21262d', marginBottom: 6, cursor: 'pointer' },
  previewLabel: { fontSize: 10, color: '#8b949e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 },
  previewChip: { padding: '4px 8px', borderRadius: 4, background: 'rgba(88,166,255,0.1)', color: '#58a6ff', fontSize: 11, fontWeight: 600 },
  previewTerminal: { background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 14 },
  previewCode: { background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 14, fontFamily: 'var(--mono)', fontSize: 12, color: '#7ee787', overflow: 'auto', whiteSpace: 'pre-wrap' },
  previewStartBtn: { background: '#238636', color: '#fff', border: 'none', borderRadius: 8, padding: '14px 28px', fontSize: 14, fontWeight: 800, cursor: 'pointer', letterSpacing: '0.05em' },
  previewTaskItem: { display: 'flex', alignItems: 'center', padding: '8px 10px', borderRadius: 4, cursor: 'pointer', marginBottom: 4 },
};
