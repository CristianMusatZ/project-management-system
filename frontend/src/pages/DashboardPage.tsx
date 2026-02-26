import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FolderKanban, ListTodo, Clock, CheckCircle2, ArrowRight, AlertTriangle } from 'lucide-react';
import api from '../services/api';

interface Project {
  _id: string;
  name: string;
  status: string;
  priority: string;
  deadline: string;
}

interface Task {
  _id: string;
  projectId: string;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        const projectsRes = await api.get('/projects');
        const projs: Project[] = projectsRes.data.projects || [];
        setProjects(projs);

        const allTasks: Task[] = [];
        for (const proj of projs) {
          try {
            const taskRes = await api.get(`/tasks/project/${proj._id}`);
            allTasks.push(...(taskRes.data.tasks || []));
          } catch { /* skip */ }
        }
        setTasks(allTasks);
      } catch { /* error */ } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const activeProjects = projects.filter((p) => p.status === 'active').length;
  const completedTasks = tasks.filter((t) => t.status === 'done').length;
  const overdueProjects = projects.filter(
    (p) => new Date(p.deadline) < new Date() && p.status !== 'completed' && p.status !== 'cancelled'
  );

  const recentTasks = [...tasks]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const projectNameMap = Object.fromEntries(projects.map((p) => [p._id, p.name]));

  const cards = [
    { label: 'Total Proiecte', value: projects.length, icon: FolderKanban, color: 'bg-blue-500' },
    { label: 'Proiecte Active', value: activeProjects, icon: Clock, color: 'bg-green-500' },
    { label: 'Total Sarcini', value: tasks.length, icon: ListTodo, color: 'bg-purple-500' },
    { label: 'Sarcini Finalizate', value: completedTasks, icon: CheckCircle2, color: 'bg-emerald-500' },
  ];

  const statusColors: Record<string, string> = {
    todo: 'bg-gray-100 text-gray-700',
    in_progress: 'bg-blue-100 text-blue-700',
    in_review: 'bg-yellow-100 text-yellow-700',
    done: 'bg-green-100 text-green-700',
  };

  const statusLabels: Record<string, string> = {
    todo: 'De făcut',
    in_progress: 'În lucru',
    in_review: 'În review',
    done: 'Finalizat',
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Bun venit, {user?.firstName}! 👋</h1>
        <p className="text-gray-500 mt-1">Iată o privire de ansamblu asupra proiectelor tale.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{loading ? '...' : card.value}</p>
                </div>
                <div className={`${card.color} w-12 h-12 rounded-lg flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Tasks */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Sarcini recente</h2>
            <Link to="/tasks" className="text-sm text-primary-600 hover:underline flex items-center gap-1">
              Toate <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {recentTasks.length === 0 ? (
            <p className="text-gray-400 text-center py-8 text-sm">Nicio sarcină încă.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentTasks.map((task) => (
                <div key={task._id} className="flex items-center gap-3 px-6 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                    <p className="text-xs text-gray-400">{projectNameMap[task.projectId] || ''}</p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${statusColors[task.status]}`}>
                    {statusLabels[task.status]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Overdue Projects */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Proiecte cu deadline depășit</h2>
            <Link to="/projects" className="text-sm text-primary-600 hover:underline flex items-center gap-1">
              Toate <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {overdueProjects.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Niciun proiect depășit. Bravo! 🎉</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {overdueProjects.map((proj) => (
                <Link
                  key={proj._id}
                  to={`/projects/${proj._id}`}
                  className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 transition"
                >
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{proj.name}</p>
                    <p className="text-xs text-red-500">
                      Deadline: {new Date(proj.deadline).toLocaleDateString('ro-RO')}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
