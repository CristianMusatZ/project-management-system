import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

import {
  ListTodo, Calendar, Search, FolderKanban, GripVertical, MessageSquare,
} from 'lucide-react';

interface Task {
  _id: string;
  projectId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigneeId: number | null;
  deadline: string | null;
  comments: any[];
  createdAt: string;
}

interface Project {
  _id: string;
  name: string;
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

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [draggedTask, setDraggedTask] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAll() {
      try {
        setLoading(true);
        const [projRes, tasksRes] = await Promise.all([
          api.get('/projects'),
          api.get('/tasks/all'),
        ]);
        setProjects(projRes.data.projects || []);
        setTasks(tasksRes.data.tasks || []);
      } catch {
        // error
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  const projectNameMap = Object.fromEntries(projects.map((p) => [p._id, p.name]));

  const filtered = tasks.filter((t) => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase());
    const matchProject = !filterProject || t.projectId === filterProject;
    return matchSearch && matchProject;
  });

  // Sort: critical first, then by deadline
  const sorted = [...filtered].sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const pA = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2;
    const pB = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2;
    if (pA !== pB) return pA - pB;
    if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    return 0;
  });

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
      // Revert on error — refetch
      const projRes = await api.get('/projects');
      const projs: Project[] = projRes.data.projects || [];
      const allTasks: Task[] = [];
      for (const proj of projs) {
        try {
          const taskRes = await api.get(`/tasks/project/${proj._id}`);
          allTasks.push(...(taskRes.data.tasks || []));
        } catch { /* skip */ }
      }
      setTasks(allTasks);
    }
  }

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sarcini</h1>
        <p className="text-gray-500 mt-1">{tasks.length} sarcini în total, din {projects.length} proiecte</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Caută sarcini..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
          />
        </div>
        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
        >
          <option value="">Toate proiectele</option>
          {projects.map((p) => (
            <option key={p._id} value={p._id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Kanban Board */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Se încarcă...</div>
      ) : sorted.length === 0 && !search && !filterProject ? (
        <div className="text-center py-16">
          <ListTodo className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-500">Nicio sarcină găsită</h3>
          <p className="text-gray-400 mt-1">Creați sarcini din pagina unui proiect.</p>
        </div>
      ) : (
        <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => {
            const colTasks = sorted.filter((t) => t.status === col.id);
            return (
              <div
                key={col.id}
                className={`flex-1 min-w-[280px] max-w-[350px] ${col.bg} rounded-xl p-3 flex flex-col`}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(col.id)}
              >
                {/* Column header */}
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className={`w-3 h-3 rounded-full ${col.badge.split(' ')[0]}`} />
                  <h3 className="font-semibold text-sm text-gray-700">{col.label}</h3>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${col.badge}`}>
                    {colTasks.length}
                  </span>
                </div>

                {/* Tasks */}
                <div className="flex-1 space-y-2 overflow-y-auto">
                  {colTasks.map((task) => (
                    <div
                      key={task._id}
                      draggable
                      onDragStart={() => handleDragStart(task._id)}
                      className={`bg-white rounded-lg p-3 border border-gray-200 border-l-4 ${priorityColors[task.priority]} cursor-grab active:cursor-grabbing hover:shadow-sm transition group`}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="w-4 h-4 text-gray-300 mt-0.5 opacity-0 group-hover:opacity-100 transition flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 truncate">{task.title}</p>
                          {task.description && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <Link
                              to={`/projects/${task.projectId}`}
                              className="text-xs text-primary-600 hover:underline flex items-center gap-1"
                            >
                              <FolderKanban className="w-3 h-3" />
                              {projectNameMap[task.projectId] || 'Proiect'}
                            </Link>
                            <span className="text-xs text-gray-400">
                              {priorityLabels[task.priority]}
                            </span>
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
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {colTasks.length === 0 && (
                    <div className="text-center py-8 text-gray-400 text-xs">
                      {search || filterProject ? 'Nicio sarcină' : 'Trageți sarcini aici'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
