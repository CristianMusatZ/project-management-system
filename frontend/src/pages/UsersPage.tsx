import { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Users, UserCheck, UserX, UserPlus, X, AlertCircle, Trash2 } from 'lucide-react';

interface UserItem {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface CreateUserForm {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
}

const emptyForm: CreateUserForm = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  role: 'member',
};

const roleColors: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  project_manager: 'bg-blue-100 text-blue-700',
  member: 'bg-green-100 text-green-700',
  viewer: 'bg-gray-100 text-gray-700',
};

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState('');

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      setLoading(true);
      const res = await api.get('/users');
      setUsers(res.data.users || []);
    } catch {
      // error
    } finally {
      setLoading(false);
    }
  }

  async function handleRoleChange(userId: number, newRole: string) {
    try {
      await api.patch(`/users/${userId}/role`, { role: newRole });
      fetchUsers();
    } catch {
      alert('Eroare la schimbarea rolului.');
    }
  }

  async function handleToggleActive(userId: number) {
    try {
      await api.patch(`/users/${userId}/toggle-active`);
      fetchUsers();
    } catch {
      alert('Eroare la actualizarea statusului.');
    }
  }

  async function handleDeleteUser() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/users/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchUsers();
    } catch (err: any) {
      setDeleteError(err.response?.data?.error || 'Eroare la ștergere.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!createForm.email || !createForm.password || !createForm.firstName || !createForm.lastName) {
      setCreateError('Toate câmpurile sunt obligatorii.');
      return;
    }
    if (createForm.password.length < 8) {
      setCreateError('Parola trebuie să aibă cel puțin 8 caractere.');
      return;
    }
    setSaving(true);
    setCreateError('');
    try {
      await api.post('/users', createForm);
      setShowCreateModal(false);
      setCreateForm(emptyForm);
      fetchUsers();
    } catch (err: any) {
      setCreateError(err.response?.data?.error || 'Eroare la crearea utilizatorului.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Utilizatori</h1>
          <p className="text-gray-500 mt-1">{users.length} utilizatori înregistrați</p>
        </div>
        <button
          onClick={() => { setShowCreateModal(true); setCreateForm(emptyForm); setCreateError(''); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium"
        >
          <UserPlus className="w-4 h-4" />
          Utilizator nou
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Se încarcă...</div>
      ) : users.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-500">Niciun utilizator</h3>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Utilizator</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rol</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Înregistrat</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => {
                return (
                  <tr key={u.id} className={`hover:bg-gray-50 transition ${!u.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {u.first_name[0]}{u.last_name[0]}
                        </div>
                        <span className="font-medium text-sm text-gray-900">{u.first_name} {u.last_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500">{u.email}</td>
                    <td className="px-5 py-4">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-full border-0 cursor-pointer ${roleColors[u.role]}`}
                      >
                        <option value="admin">Administrator</option>
                        <option value="project_manager">Project Manager</option>
                        <option value="member">Membru echipă</option>
                        <option value="viewer">Vizualizator</option>
                      </select>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {u.is_active ? 'Activ' : 'Inactiv'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-400">
                      {new Date(u.created_at).toLocaleDateString('ro-RO')}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleToggleActive(u.id)}
                          className={`p-2 rounded-lg transition ${u.is_active ? 'hover:bg-orange-50 text-gray-400 hover:text-orange-500' : 'hover:bg-green-50 text-gray-400 hover:text-green-500'}`}
                          title={u.is_active ? 'Dezactivare cont' : 'Activare cont'}
                        >
                          {u.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </button>
                        {currentUser?.id !== u.id && (
                          <button
                            onClick={() => { setDeleteTarget(u); setDeleteError(''); }}
                            className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition"
                            title="Ștergere permanentă"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm mx-4 p-6 animate-scale-in shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-4 mb-5">
              <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Ștergere permanentă</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Ești sigur că vrei să ștergi permanent contul lui{' '}
                  <strong className="text-gray-800">{deleteTarget.first_name} {deleteTarget.last_name}</strong>?
                </p>
                <p className="text-xs text-red-500 mt-2">
                  Această acțiune este ireversibilă. Utilizatorul va fi eliminat din toate proiectele și sarcinile sale vor fi deasignate.
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {deleteError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium text-sm"
              >
                Anulare
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition font-medium text-sm"
              >
                {deleting ? 'Se șterge...' : 'Șterge permanent'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 p-6 animate-scale-in shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-gray-900">Utilizator nou</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {createError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {createError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prenume *</label>
                  <input
                    type="text"
                    value={createForm.firstName}
                    onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                    placeholder="Ion"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nume *</label>
                  <input
                    type="text"
                    value={createForm.lastName}
                    onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                    placeholder="Popescu"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                  placeholder="ion.popescu@exemplu.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parolă * (min. 8 caractere)</label>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                >
                  <option value="admin">Administrator</option>
                  <option value="project_manager">Project Manager</option>
                  <option value="member">Membru echipă</option>
                  <option value="viewer">Vizualizator</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  Anulare
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition font-medium"
                >
                  {saving ? 'Se creează...' : 'Creare cont'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
