import { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
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
  assigneeId?: number | null;
}

interface UserInfo {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

const statusLabelsMap: Record<string, string> = {
  planning: 'Planificare', active: 'Activ', on_hold: 'În așteptare',
  completed: 'Finalizat', cancelled: 'Anulat',
};

export default function ReportsPage() {
  const { user } = useAuth();
  const canExport = user?.role === 'admin' || user?.role === 'project_manager' || user?.role === 'viewer';
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      try {
        setLoading(true);
        const [projRes, tasksRes, usersRes] = await Promise.all([
          api.get('/projects'),
          api.get('/tasks/all'),
          api.get('/users/list').catch(() => ({ data: { users: [] } })),
        ]);
        setProjects(projRes.data.projects || []);
        setTasks(tasksRes.data.tasks || []);
        setUsers(usersRes.data.users || []);
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

  function exportToExcel() {
    const BOM = '\uFEFF';
    const date = new Date().toLocaleDateString('ro-RO');
    const rows: string[] = [];

    rows.push(`"Raport PMS - ${date}"`);
    rows.push('');
    rows.push('SUMAR');
    rows.push(`"Total Proiecte",${projects.length}`);
    rows.push(`"Total Sarcini",${tasks.length}`);
    rows.push(`"Rată Finalizare",${completionRate}%`);
    rows.push(`"Proiecte Depășite",${overdueProjects}`);
    rows.push('');
    rows.push('PROIECTE PER STATUS');
    rows.push('"Status","Număr"');
    Object.entries(projectsByStatus).forEach(([key, val]) => {
      rows.push(`"${statusLabelsMap[key] || key}",${val}`);
    });
    rows.push('');
    rows.push('SARCINI PER STATUS');
    rows.push('"Status","Număr"');
    const taskStatusLabels: Record<string, string> = { todo: 'De făcut', in_progress: 'În lucru', in_review: 'În review', done: 'Finalizat' };
    Object.entries(tasksByStatus).forEach(([key, val]) => {
      rows.push(`"${taskStatusLabels[key] || key}",${val}`);
    });
    rows.push('');
    rows.push('DETALII PROIECTE');
    rows.push('"Proiect","Status","Total Sarcini","Sarcini Finalizate","Progres (%)","Deadline"');
    projects.forEach((proj) => {
      const projTasks = tasks.filter((t) => t.projectId === proj._id);
      const done = projTasks.filter((t) => t.status === 'done').length;
      const progress = projTasks.length > 0 ? Math.round((done / projTasks.length) * 100) : 0;
      const deadline = new Date(proj.deadline).toLocaleDateString('ro-RO');
      rows.push(`"${proj.name}","${statusLabelsMap[proj.status] || proj.status}",${projTasks.length},${done},${progress}%,"${deadline}"`);
    });

    const csv = BOM + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `raport-pms-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportToPDF() {
    const date = new Date().toLocaleDateString('ro-RO');

    const projectRows = projects.map((proj) => {
      const projTasks = tasks.filter((t) => t.projectId === proj._id);
      const done = projTasks.filter((t) => t.status === 'done').length;
      const progress = projTasks.length > 0 ? Math.round((done / projTasks.length) * 100) : 0;
      const isOverdue = new Date(proj.deadline) < new Date() && proj.status !== 'completed';
      return `
        <tr>
          <td>${proj.name}</td>
          <td>${statusLabelsMap[proj.status] || proj.status}</td>
          <td style="text-align:center">${projTasks.length}</td>
          <td style="text-align:center">${done}</td>
          <td style="text-align:center">${progress}%</td>
          <td style="color:${isOverdue ? '#dc2626' : 'inherit'}">${new Date(proj.deadline).toLocaleDateString('ro-RO')}${isOverdue ? ' ⚠' : ''}</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8"/>
  <title>Raport PMS - ${date}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1f2937; padding: 32px; }
    h1 { font-size: 22px; font-weight: 700; color: #1e40af; margin-bottom: 4px; }
    .subtitle { color: #6b7280; font-size: 12px; margin-bottom: 24px; }
    .section-title { font-size: 13px; font-weight: 700; color: #374151; margin: 20px 0 10px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 8px; }
    .stat-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; }
    .stat-label { font-size: 11px; color: #6b7280; margin-bottom: 4px; }
    .stat-value { font-size: 22px; font-weight: 700; }
    .stat-blue { color: #2563eb; }
    .stat-green { color: #16a34a; }
    .stat-red { color: #dc2626; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #f3f4f6; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
    td { padding: 8px 10px; border-bottom: 1px solid #f3f4f6; font-size: 12px; }
    tr:last-child td { border-bottom: none; }
    .footer { margin-top: 32px; text-align: center; font-size: 10px; color: #9ca3af; }
    @media print {
      body { padding: 20px; }
      button { display: none; }
    }
  </style>
</head>
<body>
  <h1>Raport Project Management System</h1>
  <p class="subtitle">Generat la: ${date} &nbsp;|&nbsp; Utilizator: ${user?.firstName} ${user?.lastName}</p>

  <div class="section-title">Sumar</div>
  <div class="stats-grid">
    <div class="stat-card"><div class="stat-label">Total Proiecte</div><div class="stat-value stat-blue">${projects.length}</div></div>
    <div class="stat-card"><div class="stat-label">Proiecte Active</div><div class="stat-value stat-green">${projectsByStatus.active}</div></div>
    <div class="stat-card"><div class="stat-label">Total Sarcini</div><div class="stat-value">${tasks.length}</div></div>
    <div class="stat-card"><div class="stat-label">Rată Finalizare</div><div class="stat-value stat-green">${completionRate}%</div></div>
  </div>
  ${overdueProjects > 0 ? `<p style="color:#dc2626;margin-top:8px;font-size:12px;">⚠ ${overdueProjects} proiect(e) cu deadline depășit</p>` : ''}

  <div class="section-title">Proiecte per Status</div>
  <table>
    <thead><tr><th>Status</th><th>Număr Proiecte</th></tr></thead>
    <tbody>
      ${Object.entries(projectsByStatus).map(([k, v]) => `<tr><td>${statusLabelsMap[k] || k}</td><td>${v}</td></tr>`).join('')}
    </tbody>
  </table>

  <div class="section-title">Sarcini per Status</div>
  <table>
    <thead><tr><th>Status</th><th>Număr Sarcini</th></tr></thead>
    <tbody>
      <tr><td>De făcut</td><td>${tasksByStatus.todo}</td></tr>
      <tr><td>În lucru</td><td>${tasksByStatus.in_progress}</td></tr>
      <tr><td>În review</td><td>${tasksByStatus.in_review}</td></tr>
      <tr><td>Finalizat</td><td>${tasksByStatus.done}</td></tr>
    </tbody>
  </table>

  <div class="section-title">Detalii Proiecte</div>
  <table>
    <thead>
      <tr><th>Proiect</th><th>Status</th><th>Sarcini</th><th>Finalizate</th><th>Progres</th><th>Deadline</th></tr>
    </thead>
    <tbody>${projectRows}</tbody>
  </table>

  <div class="footer">PMS — Sistem de Management al Proiectelor &nbsp;|&nbsp; ${date}</div>

  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
  }

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
        {/* Export buttons - vizibile doar pentru admin, PM și viewer */}
        {canExport && (
          <div className="flex gap-2">
            <button
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm font-medium text-gray-700"
              onClick={exportToPDF}
            >
              <FileText className="w-4 h-4" /> Export PDF
            </button>
            <button
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm font-medium text-gray-700"
              onClick={exportToExcel}
            >
              <Download className="w-4 h-4" /> Export Excel
            </button>
          </div>
        )}
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

      {/* Per-user statistics table */}
      {users.length > 0 && (
        <div className="mt-8 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Sarcini per utilizator</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Utilizator</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Rol</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Alocate</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Finalizate</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase">În lucru</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Rată finalizare</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => {
                const userTasks = tasks.filter((t) => t.assigneeId === u.id);
                const doneTasks = userTasks.filter((t) => t.status === 'done').length;
                const inProgress = userTasks.filter((t) => t.status === 'in_progress').length;
                const rate = userTasks.length > 0 ? Math.round((doneTasks / userTasks.length) * 100) : 0;
                const roleColors: Record<string, string> = {
                  admin: 'bg-purple-100 text-purple-700',
                  project_manager: 'bg-blue-100 text-blue-700',
                  member: 'bg-green-100 text-green-700',
                  viewer: 'bg-gray-100 text-gray-700',
                };
                const roleLabels: Record<string, string> = {
                  admin: 'Admin',
                  project_manager: 'PM',
                  member: 'Membru',
                  viewer: 'Vizualizator',
                };
                return (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {u.first_name[0]}{u.last_name[0]}
                        </div>
                        <div>
                          <p className="font-medium text-sm text-gray-900">{u.first_name} {u.last_name}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${roleColors[u.role] || 'bg-gray-100 text-gray-700'}`}>
                        {roleLabels[u.role] || u.role}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center text-sm font-semibold text-gray-900">{userTasks.length}</td>
                    <td className="px-5 py-4 text-center text-sm text-green-600 font-medium">{doneTasks}</td>
                    <td className="px-5 py-4 text-center text-sm text-blue-600 font-medium">{inProgress}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-20 bg-gray-100 rounded-full h-2">
                          <div
                            className="h-2 rounded-full bg-green-500 transition-all"
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{rate}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
