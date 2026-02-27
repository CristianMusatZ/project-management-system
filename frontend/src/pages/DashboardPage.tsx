import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FolderKanban, ListTodo, Clock, CheckCircle2, ArrowRight, AlertTriangle } from 'lucide-react';
import api from '../services/api';

interface ProjectItem {
  _id: string;
  name: string;
  status: string;
  priority: string;
  startDate: string;
  deadline: string;
}

interface TaskItem {
  _id: string;
  projectId: string;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
}

// ─── Donut Chart ──────────────────────────────────────────────────────────────

interface PieSegment { label: string; value: number; color: string; }

function DonutChart({ segments }: { segments: PieSegment[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return <p className="text-center text-gray-400 text-sm py-8">Nicio sarcină.</p>;

  const r = 36;
  const circumference = 2 * Math.PI * r;
  let cumulative = 0;
  const arcs = segments.map((seg) => {
    const ratio = seg.value / total;
    const arc = { ...seg, ratio, dashLength: ratio * circumference, offset: cumulative * circumference };
    cumulative += ratio;
    return arc;
  });

  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 100 100" className="w-36 h-36 flex-shrink-0" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="#f3f4f6" strokeWidth="18" />
        {arcs.filter((a) => a.ratio > 0).map((arc, i) => (
          <circle
            key={i} cx="50" cy="50" r={r} fill="none"
            stroke={arc.color} strokeWidth="18"
            strokeDasharray={`${arc.dashLength} ${circumference}`}
            strokeDashoffset={-arc.offset}
          />
        ))}
        <text x="50" y="46" textAnchor="middle" fontSize="15" fontWeight="bold" fill="#111827"
          style={{ transform: 'rotate(90deg)', transformOrigin: '50px 50px' }}>{total}</text>
        <text x="50" y="57" textAnchor="middle" fontSize="7" fill="#6b7280"
          style={{ transform: 'rotate(90deg)', transformOrigin: '50px 50px' }}>sarcini</text>
      </svg>
      <div className="flex-1 space-y-2.5">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
              <span className="text-xs text-gray-600 truncate">{seg.label}</span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-xs font-semibold text-gray-900">{seg.value}</span>
              <span className="text-xs text-gray-400">({total > 0 ? Math.round((seg.value / total) * 100) : 0}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────

interface BarItem { label: string; value: number; color: string; }

function HorizontalBarChart({ data }: { data: BarItem[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="text-xs text-gray-600 w-20 text-right flex-shrink-0">{d.label}</span>
          <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${(d.value / max) * 100}%`, backgroundColor: d.color }} />
          </div>
          <span className="text-xs font-semibold text-gray-900 w-5 text-right flex-shrink-0">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Timeline / Gantt ─────────────────────────────────────────────────────────

const PROJ_COLORS: Record<string, string> = {
  planning: '#94a3b8', active: '#3b82f6', on_hold: '#f59e0b', completed: '#22c55e', cancelled: '#ef4444',
};
const PROJ_LABELS: Record<string, string> = {
  planning: 'Planificare', active: 'Activ', on_hold: 'Așteptare', completed: 'Finalizat', cancelled: 'Anulat',
};

function TimelineChart({ projects }: { projects: ProjectItem[] }) {
  if (projects.length === 0) return <p className="text-center text-gray-400 text-sm py-6">Niciun proiect.</p>;

  const now = new Date();
  const dates = projects.flatMap((p) => [new Date(p.startDate || p.deadline), new Date(p.deadline)]);
  const minDate = new Date(Math.min(now.getTime() - 45 * 864e5, ...dates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(now.getTime() + 60 * 864e5, ...dates.map((d) => d.getTime())));
  const totalMs = maxDate.getTime() - minDate.getTime();
  const toP = (d: Date) => Math.max(0, Math.min(100, ((d.getTime() - minDate.getTime()) / totalMs) * 100));
  const nowP = toP(now);

  const months: { label: string; percent: number }[] = [];
  const cur = new Date(minDate); cur.setDate(1);
  while (cur <= maxDate) {
    const pct = toP(cur);
    if (pct >= 0 && pct <= 100) months.push({ label: cur.toLocaleDateString('ro-RO', { month: 'short', year: '2-digit' }), percent: pct });
    cur.setMonth(cur.getMonth() + 1);
  }

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: '480px' }}>
        {/* Luni */}
        <div className="relative h-5 mb-2 border-b border-gray-100">
          {months.map((m, i) => (
            <div key={i} className="absolute text-xs text-gray-400 bottom-1"
              style={{ left: `${m.percent}%`, transform: 'translateX(-50%)' }}>{m.label}</div>
          ))}
        </div>
        {/* Bare */}
        <div className="space-y-2">
          {projects.slice(0, 10).map((p) => {
            const s = toP(new Date(p.startDate || p.deadline));
            const e = toP(new Date(p.deadline));
            const overdue = new Date(p.deadline) < now && p.status !== 'completed' && p.status !== 'cancelled';
            return (
              <div key={p._id} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-28 truncate flex-shrink-0 text-right pr-2" title={p.name}>{p.name}</span>
                <div className="flex-1 relative h-6 bg-gray-100 rounded">
                  <div className="absolute top-0 bottom-0 w-px z-10" style={{ left: `${nowP}%`, backgroundColor: '#ef4444' }} />
                  <div className="absolute h-full rounded"
                    style={{
                      left: `${Math.min(s, e)}%`,
                      width: `${Math.max(Math.abs(e - s), 2)}%`,
                      backgroundColor: overdue ? '#fca5a5' : (PROJ_COLORS[p.status] || '#3b82f6') + 'bb',
                      border: `1px solid ${overdue ? '#ef4444' : PROJ_COLORS[p.status] || '#3b82f6'}`,
                    }}
                    title={`${p.name} — ${new Date(p.deadline).toLocaleDateString('ro-RO')}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
        {/* Legendă */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-px h-4 bg-red-500" /><span className="text-xs text-gray-500">Azi</span>
          </div>
          {Object.entries(PROJ_LABELS).map(([status, label]) => (
            <div key={status} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: PROJ_COLORS[status] }} />
              <span className="text-xs text-gray-500">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard Page ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [pr, tr] = await Promise.all([api.get('/projects'), api.get('/tasks/all')]);
        setProjects(pr.data.projects || []);
        setTasks(tr.data.tasks || []);
      } catch { /* ignore */ } finally { setLoading(false); }
    }
    load();
  }, []);

  const activeProjects = projects.filter((p) => p.status === 'active').length;
  const completedTasks = tasks.filter((t) => t.status === 'done').length;
  const overdueProjects = projects.filter(
    (p) => new Date(p.deadline) < new Date() && p.status !== 'completed' && p.status !== 'cancelled'
  );

  const cards = [
    { label: 'Total Proiecte', value: projects.length, icon: FolderKanban, color: 'bg-blue-500' },
    { label: 'Proiecte Active', value: activeProjects, icon: Clock, color: 'bg-green-500' },
    { label: 'Total Sarcini', value: tasks.length, icon: ListTodo, color: 'bg-purple-500' },
    { label: 'Sarcini Finalizate', value: completedTasks, icon: CheckCircle2, color: 'bg-emerald-500' },
  ];

  const tasksByStatus: PieSegment[] = [
    { label: 'De făcut', value: tasks.filter((t) => t.status === 'todo').length, color: '#94a3b8' },
    { label: 'În lucru', value: tasks.filter((t) => t.status === 'in_progress').length, color: '#3b82f6' },
    { label: 'În review', value: tasks.filter((t) => t.status === 'in_review').length, color: '#f59e0b' },
    { label: 'Finalizate', value: tasks.filter((t) => t.status === 'done').length, color: '#22c55e' },
  ];

  const tasksByPriority: BarItem[] = [
    { label: 'Critică', value: tasks.filter((t) => t.priority === 'critical').length, color: '#ef4444' },
    { label: 'Ridicată', value: tasks.filter((t) => t.priority === 'high').length, color: '#f97316' },
    { label: 'Medie', value: tasks.filter((t) => t.priority === 'medium').length, color: '#3b82f6' },
    { label: 'Scăzută', value: tasks.filter((t) => t.priority === 'low').length, color: '#94a3b8' },
  ];

  const recentTasks = [...tasks]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const projectNameMap = Object.fromEntries(projects.map((p) => [p._id, p.name]));

  const statusColors: Record<string, string> = {
    todo: 'bg-gray-100 text-gray-700',
    in_progress: 'bg-blue-100 text-blue-700',
    in_review: 'bg-yellow-100 text-yellow-700',
    done: 'bg-green-100 text-green-700',
  };
  const statusLabels: Record<string, string> = {
    todo: 'De făcut', in_progress: 'În lucru', in_review: 'În review', done: 'Finalizat',
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bun venit, {user?.firstName}! 👋</h1>
        <p className="text-gray-500 mt-1">Iată o privire de ansamblu asupra proiectelor tale.</p>
      </div>

      {/* Carduri statistici */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{loading ? '…' : card.value}</p>
                </div>
                <div className={`${card.color} w-12 h-12 rounded-lg flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grafice rând 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Sarcini pe status</h2>
          {loading ? <p className="text-gray-400 text-sm text-center py-8">Se încarcă…</p> : <DonutChart segments={tasksByStatus} />}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Sarcini pe prioritate</h2>
          {loading ? <p className="text-gray-400 text-sm text-center py-8">Se încarcă…</p> : <HorizontalBarChart data={tasksByPriority} />}
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Cronologie proiecte</h2>
          <Link to="/projects" className="text-sm text-primary-600 hover:underline flex items-center gap-1">
            Toate <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {loading ? <p className="text-gray-400 text-sm text-center py-6">Se încarcă…</p> : <TimelineChart projects={projects} />}
      </div>

      {/* Liste rapide */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Sarcini recente</h2>
            <Link to="/tasks" className="text-sm text-primary-600 hover:underline flex items-center gap-1">
              Toate <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {recentTasks.length === 0 ? (
            <p className="text-gray-400 text-center py-8 text-sm">Nicio sarcină încă.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentTasks.map((task) => (
                <div key={task._id} className="flex items-center gap-3 px-5 py-3">
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

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Deadline depășit</h2>
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
                <Link key={proj._id} to={`/projects/${proj._id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{proj.name}</p>
                    <p className="text-xs text-red-500">Deadline: {new Date(proj.deadline).toLocaleDateString('ro-RO')}</p>
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
