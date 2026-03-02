import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, FolderKanban, Calendar, AlertCircle, MoreVertical, Pencil, Trash2, X } from 'lucide-react';

interface Project {
  _id: string;
  name: string;
  description: string;
  status: string;
  priority: string;
  startDate: string;
  deadline: string;
  ownerId: number;
  memberIds: number[];
  labelIds: string[];
  createdAt: string;
}

interface LabelInfo {
  _id: string;
  name: string;
  color: string;
}

const statusLabels: Record<string, string> = {
  planning: 'Planificare',
  active: 'Activ',
  on_hold: 'În așteptare',
  completed: 'Finalizat',
  cancelled: 'Anulat',
};

const statusColors: Record<string, string> = {
  planning: 'bg-gray-100 text-gray-700',
  active: 'bg-green-100 text-green-700',
  on_hold: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
};

const priorityColors: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-blue-100 text-blue-600',
  high: 'bg-orange-100 text-orange-600',
  critical: 'bg-red-100 text-red-600',
};

const priorityLabels: Record<string, string> = {
  low: 'Scăzută',
  medium: 'Medie',
  high: 'Ridicată',
  critical: 'Critică',
};

interface ProjectFormData {
  name: string;
  description: string;
  status: string;
  priority: string;
  deadline: string;
  labelIds: string[];
}

const emptyForm: ProjectFormData = {
  name: '',
  description: '',
  status: 'planning',
  priority: 'medium',
  deadline: '',
  labelIds: [],
};

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [form, setForm] = useState<ProjectFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const canManage = user?.role === 'admin' || user?.role === 'project_manager';

  const [labels, setLabels] = useState<LabelInfo[]>([]);

  useEffect(() => {
    fetchProjects();
    api.get('/labels').then((res) => setLabels(res.data.labels || [])).catch(() => {});
  }, []);

  async function fetchProjects() {
    try {
      setLoading(true);
      const res = await api.get('/projects');
      setProjects(res.data.projects || []);
    } catch {
      setError('Eroare la încărcarea proiectelor.');
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingProject(null);
    setForm(emptyForm);
    setError('');
    setShowModal(true);
  }

  function openEditModal(project: Project) {
    setEditingProject(project);
    setForm({
      name: project.name,
      description: project.description,
      status: project.status,
      priority: project.priority,
      deadline: project.deadline ? project.deadline.split('T')[0] : '',
      labelIds: project.labelIds || [],
    });
    setError('');
    setShowModal(true);
    setOpenMenu(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.deadline) {
      setError('Numele și deadline-ul sunt obligatorii.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editingProject) {
        await api.put(`/projects/${editingProject._id}`, form);
      } else {
        await api.post('/projects', form);
      }
      setShowModal(false);
      fetchProjects();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Eroare la salvare.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(project: Project) {
    if (!window.confirm(`Sigur doriți să ștergeți proiectul "${project.name}"?`)) return;
    try {
      await api.delete(`/projects/${project._id}`);
      fetchProjects();
    } catch {
      alert('Eroare la ștergere.');
    }
    setOpenMenu(null);
  }

  const filtered = projects.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proiecte</h1>
          <p className="text-gray-500 mt-1">{projects.length} proiecte în total</p>
        </div>
        {canManage && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium"
          >
            <Plus className="w-5 h-5" />
            Proiect nou
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Caută proiecte..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
        >
          <option value="">Toate statusurile</option>
          {Object.entries(statusLabels).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Se încarcă...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <FolderKanban className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-500">Niciun proiect găsit</h3>
          <p className="text-gray-400 mt-1">
            {projects.length === 0 ? 'Creați primul proiect pentru a începe.' : 'Încercați alte filtre.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((project, idx) => (
            <div
              key={project._id}
              className="bg-white rounded-2xl border border-gray-200/80 p-5 relative
                         card-hover animate-slide-in-up"
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              {/* Menu button */}
              {canManage && (
                <div className="absolute top-4 right-4">
                  <button
                    onClick={() => setOpenMenu(openMenu === project._id ? null : project._id)}
                    className="p-1 rounded hover:bg-gray-100"
                  >
                    <MoreVertical className="w-4 h-4 text-gray-400" />
                  </button>
                  {openMenu === project._id && (
                    <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-xl shadow-lg z-10 animate-slide-in-down overflow-hidden">
                      <button
                        onClick={() => openEditModal(project)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Pencil className="w-4 h-4" /> Editare
                      </button>
                      <button
                        onClick={() => handleDelete(project)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" /> Ștergere
                      </button>
                    </div>
                  )}
                </div>
              )}

              <Link to={`/projects/${project._id}`} className="block">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center flex-shrink-0">
                    <FolderKanban className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900 truncate pr-8">{project.name}</h3>
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{project.description || 'Fără descriere'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[project.status]}`}>
                    {statusLabels[project.status]}
                  </span>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${priorityColors[project.priority]}`}>
                    {priorityLabels[project.priority]}
                  </span>
                  {(project.labelIds || []).map((lid) => {
                    const lbl = labels.find((l) => l._id === lid);
                    if (!lbl) return null;
                    return (
                      <span key={lid} className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: lbl.color + '25', color: lbl.color }}>
                        {lbl.name}
                      </span>
                    );
                  })}
                </div>

                <div className="flex items-center text-xs text-gray-400 gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Deadline: {new Date(project.deadline).toLocaleDateString('ro-RO')}</span>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg mx-4 p-6 animate-scale-in shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-gray-900">
                {editingProject ? 'Editare proiect' : 'Proiect nou'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nume proiect *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="Ex: Redesign website"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descriere</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                  rows={3}
                  placeholder="Descrierea proiectului..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  >
                    {Object.entries(statusLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prioritate</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  >
                    {Object.entries(priorityLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deadline *</label>
                <input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  required
                />
              </div>

              {labels.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Etichete</label>
                  <div className="flex flex-wrap gap-2">
                    {labels.map((lbl) => {
                      const selected = form.labelIds.includes(lbl._id);
                      return (
                        <button
                          key={lbl._id}
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              labelIds: selected
                                ? f.labelIds.filter((id) => id !== lbl._id)
                                : [...f.labelIds, lbl._id],
                            }))
                          }
                          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition border"
                          style={{
                            backgroundColor: selected ? lbl.color + '30' : 'transparent',
                            color: lbl.color,
                            borderColor: selected ? lbl.color : lbl.color + '60',
                          }}
                        >
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: lbl.color }} />
                          {lbl.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  Anulare
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition font-medium"
                >
                  {saving ? 'Se salvează...' : editingProject ? 'Salvare' : 'Creare'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
