import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft, Plus, X, AlertCircle, GripVertical,
  Calendar, MessageSquare, Trash2, Pencil, Users, UserPlus, UserMinus,
  Paperclip, Download, Upload,
} from 'lucide-react';

interface Task {
  _id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigneeId: number | null;
  reporterId: number;
  deadline: string | null;
  comments: { _id: string; userId: number; text: string; createdAt: string }[];
  attachments: string[];
  labelIds: string[];
  createdAt: string;
}

interface LabelInfo {
  _id: string;
  name: string;
  color: string;
}

interface Project {
  _id: string;
  name: string;
  description: string;
  status: string;
  priority: string;
  deadline: string;
  memberIds: number[];
}

interface UserInfo {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

const columns = [
  { id: 'todo', label: 'De făcut', color: 'border-gray-300', bg: 'bg-gray-50', badge: 'bg-gray-200 text-gray-700' },
  { id: 'in_progress', label: 'În lucru', color: 'border-blue-400', bg: 'bg-blue-50', badge: 'bg-blue-200 text-blue-700' },
  { id: 'in_review', label: 'În review', color: 'border-yellow-400', bg: 'bg-yellow-50', badge: 'bg-yellow-200 text-yellow-700' },
  { id: 'done', label: 'Finalizat', color: 'border-green-400', bg: 'bg-green-50', badge: 'bg-green-200 text-green-700' },
];

const priorityColors: Record<string, string> = {
  low: 'border-l-slate-400',
  medium: 'border-l-blue-400',
  high: 'border-l-orange-400',
  critical: 'border-l-red-500',
};

const priorityLabels: Record<string, string> = {
  low: 'Scăzută',
  medium: 'Medie',
  high: 'Ridicată',
  critical: 'Critică',
};

interface TaskFormData {
  title: string;
  description: string;
  priority: string;
  deadline: string;
  status: string;
  assigneeId: string;
  labelIds: string[];
}

const emptyTaskForm: TaskFormData = {
  title: '',
  description: '',
  priority: 'medium',
  deadline: '',
  status: 'todo',
  assigneeId: '',
  labelIds: [],
};

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskForm, setTaskForm] = useState<TaskFormData>(emptyTaskForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [showCommentModal, setShowCommentModal] = useState<Task | null>(null);
  const [commentText, setCommentText] = useState('');
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [addMemberId, setAddMemberId] = useState('');
  const [membersError, setMembersError] = useState('');
  const [showAttachmentsModal, setShowAttachmentsModal] = useState<Task | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const [labels, setLabels] = useState<LabelInfo[]>([]);

  const canManage = user?.role === 'admin' || user?.role === 'project_manager';
  const canEditTasks = canManage || user?.role === 'member';
  // Member poate drag doar sarcinile asignate lui; admin/PM pot drag orice
  const canDragTask = (task: Task) =>
    canManage || (user?.role === 'member' && task.assigneeId === user?.id);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [projRes, tasksRes] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get(`/tasks/project/${id}`),
      ]);
      setProject(projRes.data.project);
      setTasks(tasksRes.data.tasks || []);
    } catch {
      setError('Eroare la încărcarea datelor.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch users list for admin/PM + labels for all
  useEffect(() => {
    api.get('/labels').then((res) => setLabels(res.data.labels || [])).catch(() => {});
    if (canManage) {
      api.get('/users/list')
        .then((res) => setUsers(res.data.users || []))
        .catch(() => {});
    }
  }, [canManage]);

  function openCreateTask(status: string = 'todo') {
    setEditingTask(null);
    setTaskForm({ ...emptyTaskForm, status });
    setError('');
    setShowTaskModal(true);
  }

  function openEditTask(task: Task) {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description,
      priority: task.priority,
      deadline: task.deadline ? task.deadline.split('T')[0] : '',
      status: task.status,
      assigneeId: task.assigneeId != null ? String(task.assigneeId) : '',
      labelIds: task.labelIds || [],
    });
    setError('');
    setShowTaskModal(true);
  }

  async function handleTaskSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!taskForm.title) {
      setError('Titlul este obligatoriu.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...taskForm,
        assigneeId: taskForm.assigneeId ? Number(taskForm.assigneeId) : null,
      };
      if (editingTask) {
        await api.put(`/tasks/${editingTask._id}`, payload);
      } else {
        await api.post('/tasks', { ...payload, projectId: id });
      }
      setShowTaskModal(false);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Eroare la salvare.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTask(taskId: string) {
    if (!window.confirm('Sigur doriți să ștergeți această sarcină?')) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      fetchData();
    } catch {
      alert('Eroare la ștergere.');
    }
  }

  // Drag & Drop
  function handleDragStart(taskId: string) {
    setDraggedTask(taskId);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  async function handleDrop(newStatus: string) {
    if (!draggedTask) return;
    const task = tasks.find((t) => t._id === draggedTask);
    if (!task || task.status === newStatus) {
      setDraggedTask(null);
      return;
    }

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t._id === draggedTask ? { ...t, status: newStatus } : t))
    );
    setDraggedTask(null);

    try {
      await api.put(`/tasks/${task._id}`, { status: newStatus });
    } catch {
      fetchData(); // Revert on error
    }
  }

  // Comments
  async function handleAddComment() {
    if (!commentText.trim() || !showCommentModal) return;
    try {
      await api.post(`/tasks/${showCommentModal._id}/comments`, { text: commentText });
      setCommentText('');
      setShowCommentModal(null);
      fetchData();
    } catch {
      alert('Eroare la adăugarea comentariului.');
    }
  }

  // Member management
  async function handleAddMember() {
    if (!addMemberId) return;
    setMembersError('');
    try {
      const res = await api.post(`/projects/${id}/members`, { userId: Number(addMemberId) });
      setProject(res.data.project);
      setAddMemberId('');
    } catch (err: any) {
      setMembersError(err.response?.data?.error || 'Eroare la adăugarea membrului.');
    }
  }

  async function handleRemoveMember(userId: number) {
    setMembersError('');
    try {
      const res = await api.delete(`/projects/${id}/members/${userId}`);
      setProject(res.data.project);
    } catch (err: any) {
      setMembersError(err.response?.data?.error || 'Eroare la eliminarea membrului.');
    }
  }

  function getUserName(userId: number | null) {
    if (!userId) return '—';
    const u = users.find((u) => u.id === userId);
    return u ? `${u.first_name} ${u.last_name}` : `#${userId}`;
  }

  // Attachments
  const UPLOADS_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace('/api', '');

  async function handleUploadAttachment(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !showAttachmentsModal) return;

    if (file.size > 10 * 1024 * 1024) {
      setAttachmentError('Fișierul depășește limita de 10 MB.');
      return;
    }

    setAttachmentError('');
    setUploadingAttachment(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Eliminăm prefixul "data:...;base64,"
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await api.post(`/tasks/${showAttachmentsModal._id}/attachments`, {
        filename: file.name,
        data: base64,
        mimeType: file.type,
      });

      // Actualizare locală a task-ului
      const updatedAttachments: string[] = res.data.attachments;
      setTasks((prev) =>
        prev.map((t) =>
          t._id === showAttachmentsModal._id ? { ...t, attachments: updatedAttachments } : t
        )
      );
      setShowAttachmentsModal((prev) =>
        prev ? { ...prev, attachments: updatedAttachments } : prev
      );
    } catch (err: any) {
      setAttachmentError(err.response?.data?.error || 'Eroare la încărcarea fișierului.');
    } finally {
      setUploadingAttachment(false);
      // Resetare input
      e.target.value = '';
    }
  }

  async function handleDeleteAttachment(filename: string) {
    if (!showAttachmentsModal) return;
    if (!window.confirm(`Ștergi atașamentul "${filename.substring(filename.indexOf('_') + 1)}"?`)) return;

    try {
      const res = await api.delete(`/tasks/${showAttachmentsModal._id}/attachments/${encodeURIComponent(filename)}`);
      const updatedAttachments: string[] = res.data.attachments;
      setTasks((prev) =>
        prev.map((t) =>
          t._id === showAttachmentsModal._id ? { ...t, attachments: updatedAttachments } : t
        )
      );
      setShowAttachmentsModal((prev) =>
        prev ? { ...prev, attachments: updatedAttachments } : prev
      );
    } catch {
      setAttachmentError('Eroare la ștergerea atașamentului.');
    }
  }

  function getAttachmentLabel(filename: string) {
    // Elimină prefixul timestamp de la numele fișierului (ex: 1234567890_document.pdf → document.pdf)
    const idx = filename.indexOf('_');
    return idx !== -1 ? filename.substring(idx + 1) : filename;
  }

  if (loading) return <div className="p-6 text-center text-gray-400">Se încarcă...</div>;
  if (!project) return <div className="p-6 text-center text-red-500">Proiect negăsit.</div>;

  const nonMembers = users.filter((u) => !project.memberIds.includes(u.id));
  const memberUsers = users.filter((u) => project.memberIds.includes(u.id));

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/projects')} className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{project.description || 'Fără descriere'}</p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <button
              onClick={() => { setShowMembersModal(true); setMembersError(''); setAddMemberId(''); }}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
            >
              <Users className="w-4 h-4" />
              Membri ({project.memberIds.length})
            </button>
          )}
          {canManage && (
            <button
              onClick={() => openCreateTask()}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium"
            >
              <Plus className="w-5 h-5" />
              Sarcină nouă
            </button>
          )}
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          return (
            <div
              key={col.id}
              className={`flex-1 min-w-[280px] max-w-[350px] ${col.bg} rounded-xl p-3 flex flex-col`}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(col.id)}
            >
              {/* Column header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${col.badge.split(' ')[0]}`} />
                  <h3 className="font-semibold text-sm text-gray-700">{col.label}</h3>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${col.badge}`}>
                    {colTasks.length}
                  </span>
                </div>
                {canManage && (
                  <button
                    onClick={() => openCreateTask(col.id)}
                    className="p-1 hover:bg-white/60 rounded transition"
                  >
                    <Plus className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>

              {/* Tasks */}
              <div className="flex-1 space-y-2 overflow-y-auto">
                {colTasks.map((task) => (
                  <div
                    key={task._id}
                    draggable={canDragTask(task)}
                    onDragStart={() => canDragTask(task) && handleDragStart(task._id)}
                    className={`bg-white rounded-lg p-3 border border-gray-200 border-l-4 ${priorityColors[task.priority]} ${canDragTask(task) ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'} hover:shadow-sm transition group`}
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical className="w-4 h-4 text-gray-300 mt-0.5 opacity-0 group-hover:opacity-100 transition flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">{task.title}</p>
                        {task.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>
                        )}
                        {(task.labelIds?.length > 0) && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {task.labelIds.map((lid) => {
                              const lbl = labels.find((l) => l._id === lid);
                              if (!lbl) return null;
                              return (
                                <span key={lid} className="text-xs px-2 py-0.5 rounded-full font-medium"
                                  style={{ backgroundColor: lbl.color + '25', color: lbl.color }}>
                                  {lbl.name}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <span className="text-xs text-gray-400">
                            {priorityLabels[task.priority]}
                          </span>
                          {task.assigneeId && canManage && (
                            <span className="text-xs text-blue-600 font-medium">
                              {getUserName(task.assigneeId)}
                            </span>
                          )}
                          {task.deadline && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(task.deadline).toLocaleDateString('ro-RO')}
                            </span>
                          )}
                          {task.comments.length > 0 && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              {task.comments.length}
                            </span>
                          )}
                          {task.attachments?.length > 0 && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Paperclip className="w-3 h-3" />
                              {task.attachments.length}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Task actions */}
                    <div className="flex gap-1 mt-2 pt-2 border-t border-gray-100 opacity-0 group-hover:opacity-100 transition">
                      {canEditTasks && (
                        <button
                          onClick={() => openEditTask(task)}
                          className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                          title="Editare"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => { setShowCommentModal(task); setCommentText(''); }}
                        className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                        title="Comentarii"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                      {canEditTasks && (
                        <button
                          onClick={() => { setShowAttachmentsModal(task); setAttachmentError(''); }}
                          className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                          title="Atașamente"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canManage && (
                        <button
                          onClick={() => handleDeleteTask(task._id)}
                          className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"
                          title="Ștergere"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {colTasks.length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-xs">
                    Trageți sarcini aici sau apăsați +
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Create/Edit Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowTaskModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-gray-900">
                {editingTask ? 'Editare sarcină' : 'Sarcină nouă'}
              </h2>
              <button onClick={() => setShowTaskModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
              </div>
            )}

            <form onSubmit={handleTaskSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titlu *</label>
                <input
                  type="text"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="Ex: Implementare login"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descriere</label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                  rows={3}
                  placeholder="Detalii despre sarcină..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={taskForm.status}
                    onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                  >
                    {columns.map((col) => (
                      <option key={col.id} value={col.id}>{col.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prioritate</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                  >
                    {Object.entries(priorityLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Asignat la</label>
                  <select
                    value={taskForm.assigneeId}
                    onChange={(e) => setTaskForm({ ...taskForm, assigneeId: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                  >
                    <option value="">— Neasignat —</option>
                    {users
                      .filter((u) => project?.memberIds.includes(u.id))
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.first_name} {u.last_name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
                  <input
                    type="date"
                    value={taskForm.deadline}
                    onChange={(e) => setTaskForm({ ...taskForm, deadline: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                  />
                </div>
              </div>

              {labels.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Etichete</label>
                  <div className="flex flex-wrap gap-2">
                    {labels.map((lbl) => {
                      const selected = taskForm.labelIds.includes(lbl._id);
                      return (
                        <button
                          key={lbl._id}
                          type="button"
                          onClick={() =>
                            setTaskForm((f) => ({
                              ...f,
                              labelIds: selected
                                ? f.labelIds.filter((id) => id !== lbl._id)
                                : [...f.labelIds, lbl._id],
                            }))
                          }
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition border"
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
                  onClick={() => setShowTaskModal(false)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  Anulare
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition font-medium"
                >
                  {saving ? 'Se salvează...' : editingTask ? 'Salvare' : 'Creare'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Comment Modal */}
      {showCommentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCommentModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Comentarii — {showCommentModal.title}</h2>
              <button onClick={() => setShowCommentModal(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Existing comments */}
            <div className="max-h-60 overflow-y-auto space-y-3 mb-4">
              {showCommentModal.comments.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Niciun comentariu.</p>
              ) : (
                showCommentModal.comments.map((c) => (
                  <div key={c._id} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm text-gray-700">{c.text}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(c.createdAt).toLocaleString('ro-RO')}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Add comment */}
            {canEditTasks && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Scrie un comentariu..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                />
                <button
                  onClick={handleAddComment}
                  disabled={!commentText.trim()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition text-sm font-medium"
                >
                  Trimite
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Attachments Modal */}
      {showAttachmentsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAttachmentsModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 truncate pr-2">
                Atașamente — {showAttachmentsModal.title}
              </h2>
              <button onClick={() => setShowAttachmentsModal(null)} className="p-1 hover:bg-gray-100 rounded flex-shrink-0">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {attachmentError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {attachmentError}
              </div>
            )}

            {/* Lista atașamente existente */}
            <div className="max-h-64 overflow-y-auto space-y-2 mb-4">
              {showAttachmentsModal.attachments?.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Niciun atașament.</p>
              ) : (
                showAttachmentsModal.attachments?.map((filename) => (
                  <div key={filename} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg group">
                    <Paperclip className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="flex-1 text-sm text-gray-700 truncate" title={getAttachmentLabel(filename)}>
                      {getAttachmentLabel(filename)}
                    </span>
                    <a
                      href={`${UPLOADS_BASE}/uploads/${filename}`}
                      download={getAttachmentLabel(filename)}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 hover:bg-primary-50 rounded text-gray-400 hover:text-primary-600 transition"
                      title="Descarcă"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    {canEditTasks && (
                      <button
                        onClick={() => handleDeleteAttachment(filename)}
                        className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 transition"
                        title="Șterge"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Upload fișier */}
            {canEditTasks && (
              <div>
                <label
                  className={`flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed rounded-lg cursor-pointer transition
                    ${uploadingAttachment
                      ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                      : 'border-primary-300 hover:border-primary-500 hover:bg-primary-50 text-primary-600'
                    }`}
                >
                  <Upload className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {uploadingAttachment ? 'Se încarcă...' : 'Alege fișier (max 10 MB)'}
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    disabled={uploadingAttachment}
                    onChange={handleUploadAttachment}
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Members Management Modal */}
      {showMembersModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowMembersModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-gray-900">Membri proiect</h2>
              <button onClick={() => setShowMembersModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {membersError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {membersError}
              </div>
            )}

            {/* Add member */}
            {nonMembers.length > 0 && (
              <div className="flex gap-2 mb-5">
                <select
                  value={addMemberId}
                  onChange={(e) => setAddMemberId(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Selectează utilizator...</option>
                  {nonMembers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.first_name} {u.last_name} ({u.role})
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAddMember}
                  disabled={!addMemberId}
                  className="flex items-center gap-1 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition text-sm font-medium"
                >
                  <UserPlus className="w-4 h-4" />
                  Adaugă
                </button>
              </div>
            )}

            {/* Current members list */}
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {memberUsers.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Niciun membru alocat.</p>
              ) : (
                memberUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {u.first_name[0]}{u.last_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{u.first_name} {u.last_name}</p>
                      <p className="text-xs text-gray-500">{u.role}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveMember(u.id)}
                      className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 transition"
                      title="Elimină"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
