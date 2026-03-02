import { ReactNode, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, FolderKanban, ListTodo, BarChart3, Users,
  LogOut, UserCircle, Bell, Settings, CheckCheck, Clock,
  MessageSquare, UserCheck, X, Trash2,
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
  const [orgLogo, setOrgLogo] = useState<string>('');
  const [orgName, setOrgName] = useState<string>('PMS');

  const filteredNav = navItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  );

  async function fetchNotifications() {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    api.get('/settings').then((res) => {
      const s = res.data.settings || {};
      if (s.org_logo) setOrgLogo(s.org_logo);
      if (s.org_name) setOrgName(s.org_name);
    }).catch(() => {});
  }, []);

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
    if (notif.entity_type === 'task') navigate('/tasks');
  }

  async function handleDismissNotif(e: React.MouseEvent, notifId: number, wasRead: boolean) {
    e.stopPropagation();
    await api.delete(`/notifications/${notifId}`);
    setNotifications((prev) => prev.filter((n) => n.id !== notifId));
    if (!wasRead) setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function handleClearRead() {
    await api.delete('/notifications/read-all');
    setNotifications((prev) => prev.filter((n) => !n.is_read));
  }

  return (
    <div className="min-h-screen bg-gray-100/60">
      {/* ── Floating Sidebar ─────────────────────────────────────────────────── */}
      <aside
        className="sidebar-float fixed top-4 left-4 bottom-4 w-60 bg-white/95 backdrop-blur-sm
                   rounded-2xl border border-gray-200/80 shadow-[0_8px_40px_-8px_rgba(0,0,0,0.18)]
                   flex flex-col z-40 animate-slide-in-left"
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-gray-100 flex-shrink-0">
          {orgLogo ? (
            <img src={orgLogo} alt={orgName} className="max-h-10 max-w-[180px] w-full object-contain" />
          ) : (
            <>
              <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center flex-shrink-0
                              shadow-[0_2px_8px_rgba(79,70,229,0.4)]">
                <FolderKanban className="w-4.5 h-4.5 text-white" />
              </div>
              <span className="ml-2.5 text-base font-bold text-gray-900 truncate">{orgName}</span>
            </>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {filteredNav.map((item, idx) => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  group flex items-center px-3 py-2.5 rounded-xl text-sm font-medium
                  transition-all duration-200 relative overflow-hidden
                  animate-slide-in-left
                  ${isActive
                    ? 'bg-primary-50 text-primary-700 nav-item-active shadow-sm'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
                style={{ animationDelay: `${idx * 50 + 80}ms` }}
              >
                {/* Active background glow */}
                {isActive && (
                  <span className="absolute inset-0 bg-gradient-to-r from-primary-50 to-transparent pointer-events-none" />
                )}
                <Icon
                  className={`w-4.5 h-4.5 mr-3 flex-shrink-0 transition-transform duration-200
                    ${isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-700'}
                    group-hover:scale-110`}
                />
                <span className="relative">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Notificări bell */}
        <div className="px-3 pb-2" ref={notifRef}>
          <button
            onClick={() => { setShowNotif((v) => !v); if (!showNotif) fetchNotifications(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                       text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-all duration-200 relative
                       group btn-press"
          >
            <div className="relative flex-shrink-0">
              <Bell className="w-4.5 h-4.5 text-gray-400 group-hover:text-gray-700 transition-colors
                               group-hover:scale-110 transition-transform duration-200" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px]
                                 font-bold rounded-full flex items-center justify-center notif-badge">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <span>Notificări</span>
          </button>

          {/* Dropdown notificări animat — fixed față de viewport */}
          {showNotif && (
            <div className="fixed left-[272px] bottom-16 w-80 bg-white rounded-2xl border border-gray-200
                            shadow-[0_16px_48px_-8px_rgba(0,0,0,0.18)] z-[60] overflow-hidden
                            animate-slide-in-up origin-bottom-left">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                <span className="font-semibold text-sm text-gray-900">
                  Notificări{unreadCount > 0 && (
                    <span className="ml-1.5 text-xs font-bold bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full">
                      {unreadCount} noi
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800
                                 transition-colors btn-press"
                      title="Marchează toate ca citite"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Marchează toate
                    </button>
                  )}
                  {notifications.some((n) => n.is_read) && (
                    <button
                      onClick={handleClearRead}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500
                                 transition-colors btn-press"
                      title="Șterge notificările citite"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => setShowNotif(false)}
                    className="text-gray-400 hover:text-gray-700 transition-colors btn-press p-0.5 rounded"
                    title="Închide"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-10 text-center text-sm text-gray-400 animate-fade-in">
                    <Bell className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                    Nicio notificare
                  </div>
                ) : (
                  <div className="stagger-children">
                    {notifications.map((n, idx) => (
                      <div
                        key={n.id}
                        className={`relative group flex items-start gap-3 px-4 py-3
                                    border-b border-gray-50 last:border-0
                                    animate-slide-in-up
                                    ${!n.is_read ? 'bg-blue-50/50' : ''}`}
                        style={{ animationDelay: `${idx * 40}ms` }}
                      >
                        <button
                          onClick={() => handleNotifClick(n)}
                          className="flex items-start gap-3 flex-1 min-w-0 text-left
                                     hover:bg-transparent transition-all duration-150"
                        >
                          <div className="mt-0.5 flex-shrink-0">
                            {notifIcon[n.type] || <Bell className="w-4 h-4 text-gray-400" />}
                          </div>
                          <div className="flex-1 min-w-0 pr-6">
                            <p className={`text-sm ${!n.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                              {n.title}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                            <p className="text-[11px] text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                          </div>
                        </button>
                        {!n.is_read && (
                          <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2 animate-pulse absolute right-4 top-4 group-hover:hidden" />
                        )}
                        <button
                          onClick={(e) => handleDismissNotif(e, n.id, n.is_read)}
                          className="absolute right-3 top-3 p-0.5 rounded text-gray-300
                                     hover:text-red-400 hover:bg-red-50 transition-all duration-150
                                     opacity-0 group-hover:opacity-100"
                          title="Șterge notificarea"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User info + Logout */}
        <div className="px-3 py-3 border-t border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2 p-2 rounded-xl hover:bg-gray-50 transition-all duration-200 group">
            <Link to="/profile" className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600
                              text-white flex items-center justify-center text-xs font-bold flex-shrink-0
                              shadow-[0_2px_8px_rgba(79,70,229,0.3)] group-hover:scale-105 transition-transform duration-200">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate group-hover:text-primary-700 transition-colors">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-[11px] text-gray-400 truncate flex items-center gap-1">
                  <UserCircle className="w-3 h-3" /> {user?.role}
                </p>
              </div>
            </Link>
            <button
              onClick={logout}
              className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50
                         btn-press"
              title="Deconectare"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content (offset for floating sidebar) ────────────────────────── */}
      <main className="ml-[256px] min-h-screen p-4">
        <div className="min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
