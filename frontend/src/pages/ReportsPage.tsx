import { useEffect, useState } from 'react';
import api from '../services/api';
import { BarChart3, PieChart, Download, FileText } from 'lucide-react';

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
  status: string;
  priority: string;
}

export default function ReportsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      try {
        setLoading(true);
        const projRes = await api.get('/projects');
        const projs: Project[] = projRes.data.projects || [];
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
    fetchAll();
  }, []);

  // Stats
  const projectsByStatus = {
    planning: projects.filter((p) => p.status === 'planning').length,
    active: projects.filter((p) => p.status === 'active').length,
    on_hold: projects.filter((p) => p.status === 'on_hold').length,
    completed: projects.filter((p) => p.status === 'completed').length,
    cancelled: projects.filter((p) => p.status === 'cancelled').length,
  };

  const tasksByStatus = {
    todo: tasks.filter((t) => t.status === 'todo').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    in_review: tasks.filter((t) => t.status === 'in_review').length,
    done: tasks.filter((t) => t.status === 'done').length,
  };

  const tasksByPriority = {
    low: tasks.filter((t) => t.priority === 'low').length,
    medium: tasks.filter((t) => t.priority === 'medium').length,
    high: tasks.filter((t) => t.priority === 'high').length,
    critical: tasks.filter((t) => t.priority === 'critical').length,
  };

  const overdueProjects = projects.filter(
    (p) => new Date(p.deadline) < new Date() && p.status !== 'completed' && p.status !== 'cancelled'
  ).length;

  const completionRate = tasks.length > 0
    ? Math.round((tasksByStatus.done / tasks.length) * 100)
    : 0;

  function BarDisplay({ data, colors, labels }: { data: Record<string, number>; colors: Record<string, string>; labels: Record<string, string> }) {
    const max = Math.max(...Object.values(data), 1);
    return (
      <div className="space-y-3">
        {Object.entries(data).map(([key, val]) => (
          <div key={key}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-600">{labels[key] || key}</span>
              <span className="text-sm font-semibold text-gray-900">{val}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all ${colors[key] || 'bg-gray-400'}`}
                style={{ width: `${(val / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (loading) return <div className="p-6 text-center text-gray-400">Se încarcă...</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rapoarte</h1>
          <p className="text-gray-500 mt-1">Statistici și vizualizare date</p>
        </div>
        {/* Export buttons - to be implemented with PDFKit/ExcelJS */}
        <div className="flex gap-2">
          <button
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm font-medium text-gray-700"
            onClick={() => alert('Export PDF — va fi implementat în etapa următoare')}
          >
            <FileText className="w-4 h-4" /> Export PDF
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm font-medium text-gray-700"
            onClick={() => alert('Export Excel — va fi implementat în etapa următoare')}
          >
            <Download className="w-4 h-4" /> Export Excel
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Total proiecte</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{projects.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Total sarcini</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{tasks.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Rată finalizare</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{completionRate}%</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Proiecte depășite</p>
          <p className={`text-3xl font-bold mt-1 ${overdueProjects > 0 ? 'text-red-600' : 'text-gray-900'}`}>{overdueProjects}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Projects by status */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-5">
            <PieChart className="w-5 h-5 text-primary-600" />
            <h3 className="font-semibold text-gray-900">Proiecte per status</h3>
          </div>
          <BarDisplay
            data={projectsByStatus}
            colors={{
              planning: 'bg-gray-400',
              active: 'bg-green-500',
              on_hold: 'bg-yellow-500',
              completed: 'bg-blue-500',
              cancelled: 'bg-red-500',
            }}
            labels={{
              planning: 'Planificare',
              active: 'Activ',
              on_hold: 'În așteptare',
              completed: 'Finalizat',
              cancelled: 'Anulat',
            }}
          />
        </div>

        {/* Tasks by status */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="w-5 h-5 text-primary-600" />
            <h3 className="font-semibold text-gray-900">Sarcini per status</h3>
          </div>
          <BarDisplay
            data={tasksByStatus}
            colors={{
              todo: 'bg-gray-400',
              in_progress: 'bg-blue-500',
              in_review: 'bg-yellow-500',
              done: 'bg-green-500',
            }}
            labels={{
              todo: 'De făcut',
              in_progress: 'În lucru',
              in_review: 'În review',
              done: 'Finalizat',
            }}
          />
        </div>

        {/* Tasks by priority */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="w-5 h-5 text-orange-500" />
            <h3 className="font-semibold text-gray-900">Sarcini per prioritate</h3>
          </div>
          <BarDisplay
            data={tasksByPriority}
            colors={{
              low: 'bg-slate-400',
              medium: 'bg-blue-500',
              high: 'bg-orange-500',
              critical: 'bg-red-500',
            }}
            labels={{
              low: 'Scăzută',
              medium: 'Medie',
              high: 'Ridicată',
              critical: 'Critică',
            }}
          />
        </div>
      </div>

      {/* Project details table */}
      <div className="mt-8 bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Detalii proiecte</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Proiect</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Sarcini</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Finalizate</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Progres</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Deadline</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {projects.map((proj) => {
              const projTasks = tasks.filter((t) => t.projectId === proj._id);
              const doneTasks = projTasks.filter((t) => t.status === 'done').length;
              const progress = projTasks.length > 0 ? Math.round((doneTasks / projTasks.length) * 100) : 0;
              const isOverdue = new Date(proj.deadline) < new Date() && proj.status !== 'completed';

              return (
                <tr key={proj._id} className="hover:bg-gray-50">
                  <td className="px-5 py-4 font-medium text-sm text-gray-900">{proj.name}</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      proj.status === 'active' ? 'bg-green-100 text-green-700' :
                      proj.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {proj.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center text-sm text-gray-600">{projTasks.length}</td>
                  <td className="px-5 py-4 text-center text-sm text-gray-600">{doneTasks}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 justify-center">
                      <div className="w-20 bg-gray-100 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-primary-500 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{progress}%</span>
                    </div>
                  </td>
                  <td className={`px-5 py-4 text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                    {new Date(proj.deadline).toLocaleDateString('ro-RO')}
                    {isOverdue && ' ⚠'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
