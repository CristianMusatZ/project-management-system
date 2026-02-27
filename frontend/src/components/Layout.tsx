import { ReactNode, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, FolderKanban, ListTodo, BarChart3, Users,
  LogOut, UserCircle, Bell, Settings, CheckCheck, Clock,
  MessageSquare, UserCheck,
} from 'lucide-react';
import api from '../services/api';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  entity_type: string;
  entity_id: string;
  is_read: boolean;
  created_at: string;
}

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/projects', label: 'Proiecte', icon: FolderKanban },
  { path: '/tasks', label: 'Sarcini', icon: ListTodo },
  { path: '/reports', label: 'Rapoarte', icon: BarChart3 },
  { path: '/users', label: 'Utilizatori', icon: Users, roles: ['admin'] },
  { path: '/settings', label: 'Setări', icon: Settings, roles: ['admin'] },
];

const notifIcon: Record<string, ReactNode> = {
  task_assigned: <UserCheck className="w-4 h-4 text-blue-500" />,
  task_status_changed: <Clock className="w-4 h-4 text-orange-500" />,
  comment_added: <MessageSquare className="w-4 h-4 text-green-500" />,
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'acum';
  if (m < 60) return `acum ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `acum ${h}h`;
  return `acum ${Math.floor(h / 24)}z`;
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const filteredNav = navItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  );

  // Fetch notificări
  async function fetchNotifications() {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // poll la 30s
    return () => clearInterval(interval);
  }, []);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotif(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleMarkAllRead() {
    await api.put('/notifications/read-all');
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }

  async function handleNotifClick(notif: Notification) {
    if (!notif.is_read) {
      await api.put(`/notifications/${notif.id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setShowNotif(false);
    // Navighează la pagina sarcini (task-urile sunt grupate pe proiecte)
    if (notif.entity_type === 'task') navigate('/tasks');
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <FolderKanban className="w-8 h-8 text-primary-600" />
          <span className="ml-3 text-lg font-bold text-gray-900">PMS</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {filteredNav.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Notificări bell */}
        <div className="px-4 pb-2" ref={notifRef}>
          <button
            onClick={() => { setShowNotif((v) => !v); if (!showNotif) fetchNotifications(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors relative"
          >
            <div className="relative">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <span>Notificări</span>
          </button>

          {/* Dropdown notificări */}
          {showNotif && (
            <div className="absolute left-64 bottom-20 w-80 bg-white rounded-xl border border-gray-200 shadow-xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="font-semibold text-sm text-gray-900">
                  Notificări {unreadCount > 0 && <span className="text-primary-600">({unreadCount} noi)</span>}
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 transition"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Marchează toate
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-400">
                    <Bell className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                    Nicio notificare
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleNotifClick(n)}
                      className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition border-b border-gray-50 last:border-0 ${!n.is_read ? 'bg-blue-50/40' : ''}`}
                    >
                      <div className="mt-0.5 flex-shrink-0">
                        {notifIcon[n.type] || <Bell className="w-4 h-4 text-gray-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!n.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                          {n.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[11px] text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                      </div>
                      {!n.is_read && (
                        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User info + Logout */}
        <div className="px-4 py-4 border-t border-gray-200">
          <div className="flex items-center">
            <Link to="/profile" className="flex items-center gap-3 flex-1 min-w-0 group">
              <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold flex-shrink-0 group-hover:bg-primary-200 transition-colors">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate group-hover:text-primary-700 transition-colors">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                  <UserCircle className="w-3 h-3" /> {user?.role}
                </p>
              </div>
            </Link>
            <button
              onClick={logout}
              className="text-gray-400 hover:text-red-500 transition-colors ml-2"
              title="Deconectare"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
