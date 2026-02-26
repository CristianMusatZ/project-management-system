import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { FolderKanban, ListTodo, Clock, CheckCircle2 } from 'lucide-react';
import api from '../services/api';

interface Stats {
  totalProjects: number;
  activeProjects: number;
  totalTasks: number;
  completedTasks: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ totalProjects: 0, activeProjects: 0, totalTasks: 0, completedTasks: 0 });

  useEffect(() => {
    async function fetchStats() {
      try {
        const projectsRes = await api.get('/projects');
        const projects = projectsRes.data.projects || [];
        setStats({
          totalProjects: projects.length,
          activeProjects: projects.filter((p: any) => p.status === 'active').length,
          totalTasks: 0,
          completedTasks: 0,
        });
      } catch {
        // La prima rulare nu vor exista proiecte
      }
    }
    fetchStats();
  }, []);

  const cards = [
    { label: 'Total Proiecte', value: stats.totalProjects, icon: FolderKanban, color: 'bg-blue-500' },
    { label: 'Proiecte Active', value: stats.activeProjects, icon: Clock, color: 'bg-green-500' },
    { label: 'Total Sarcini', value: stats.totalTasks, icon: ListTodo, color: 'bg-purple-500' },
    { label: 'Sarcini Finalizate', value: stats.completedTasks, icon: CheckCircle2, color: 'bg-emerald-500' },
  ];

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Bun venit, {user?.firstName}! 👋
        </h1>
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
                  <p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
                </div>
                <div className={`${card.color} w-12 h-12 rounded-lg flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Placeholder for future charts */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Activitate Recentă</h2>
        <p className="text-gray-400 text-center py-12">
          Graficele și activitatea recentă vor fi adăugate în etapele următoare.
        </p>
      </div>
    </div>
  );
}
