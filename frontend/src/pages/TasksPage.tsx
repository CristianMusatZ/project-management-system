import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

import { ListTodo, Calendar, Search, FolderKanban } from 'lucide-react';

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

const statusLabels: Record<string, string> = {
  todo: 'De făcut',
  in_progress: 'În lucru',
  in_review: 'În review',
  done: 'Finalizat',
};

const statusColors: Record<string, string> = {
  todo: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  in_review: 'bg-yellow-100 text-yellow-700',
  done: 'bg-green-100 text-green-700',
};

const priorityLabels: Record<string, string> = {
  low: 'Scăzută',
  medium: 'Medie',
  high: 'Ridicată',
  critical: 'Critică',
};

const priorityDots: Record<string, string> = {
  low: 'bg-slate-400',
  medium: 'bg-blue-400',
  high: 'bg-orange-400',
  critical: 'bg-red-500',
};

export default function TasksPage() {
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterProject, setFilterProject] = useState('');

  useEffect(() => {
    async function fetchAll() {
      try {
        setLoading(true);
        const projRes = await api.get('/projects');
        const projs: Project[] = projRes.data.projects || [];
        setProjects(projs);

        // Fetch tasks for all projects
        const allTasks: Task[] = [];
        for (const proj of projs) {
          try {
            const taskRes = await api.get(`/tasks/project/${proj._id}`);
            allTasks.push(...(taskRes.data.tasks || []));
          } catch {
            // skip
          }
        }
        setTasks(allTasks);
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
    const matchStatus = !filterStatus || t.status === filterStatus;
    const matchProject = !filterProject || t.projectId === filterProject;
    return matchSearch && matchStatus && matchProject;
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

  return (
    <div className="p-6">
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
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
        >
          <option value="">Toate statusurile</option>
          {Object.entries(statusLabels).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
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

      {/* Tasks list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Se încarcă...</div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16">
          <ListTodo className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-500">Nicio sarcină găsită</h3>
          <p className="text-gray-400 mt-1">Creați sarcini din pagina unui proiect.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {sorted.map((task) => (
            <div key={task._id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition">
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${priorityDots[task.priority]}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm text-gray-900 truncate">{task.title}</p>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <Link
                    to={`/projects/${task.projectId}`}
                    className="text-xs text-primary-600 hover:underline flex items-center gap-1"
                  >
                    <FolderKanban className="w-3 h-3" />
                    {projectNameMap[task.projectId] || 'Proiect necunoscut'}
                  </Link>
                  <span className="text-xs text-gray-400">{priorityLabels[task.priority]}</span>
                  {task.deadline && (
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(task.deadline).toLocaleDateString('ro-RO')}
                    </span>
                  )}
                </div>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${statusColors[task.status]}`}>
                {statusLabels[task.status]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
