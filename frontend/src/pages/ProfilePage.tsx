import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { User, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();

  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [passForm, setPassForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passSaving, setPassSaving] = useState(false);
  const [passMsg, setPassMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const roleLabels: Record<string, string> = {
    admin: 'Administrator',
    project_manager: 'Project Manager',
    member: 'Membru echipă',
    viewer: 'Vizualizator',
  };

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profileForm.firstName || !profileForm.lastName) {
      setProfileMsg({ type: 'error', text: 'Prenumele și numele sunt obligatorii.' });
      return;
    }
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const res = await api.put('/auth/profile', profileForm);
      // Update auth context with new name
      if (res.data.user) {
        updateUser({
          firstName: res.data.user.first_name,
          lastName: res.data.user.last_name,
        });
      }
      setProfileMsg({ type: 'success', text: 'Profilul a fost actualizat.' });
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.response?.data?.error || 'Eroare la actualizare.' });
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passForm.currentPassword || !passForm.newPassword || !passForm.confirmPassword) {
      setPassMsg({ type: 'error', text: 'Toate câmpurile sunt obligatorii.' });
      return;
    }
    if (passForm.newPassword.length < 8) {
      setPassMsg({ type: 'error', text: 'Parola nouă trebuie să aibă cel puțin 8 caractere.' });
      return;
    }
    if (passForm.newPassword !== passForm.confirmPassword) {
      setPassMsg({ type: 'error', text: 'Parolele noi nu coincid.' });
      return;
    }
    setPassSaving(true);
    setPassMsg(null);
    try {
      await api.put('/auth/change-password', {
        currentPassword: passForm.currentPassword,
        newPassword: passForm.newPassword,
      });
      setPassMsg({ type: 'success', text: 'Parola a fost schimbată cu succes.' });
      setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setPassMsg({ type: 'error', text: err.response?.data?.error || 'Eroare la schimbarea parolei.' });
    } finally {
      setPassSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Profilul meu</h1>
        <p className="text-gray-500 mt-1">Vizualizați și actualizați datele contului</p>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
          <div className="w-16 h-16 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-2xl font-bold">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{user?.firstName} {user?.lastName}</h2>
            <p className="text-sm text-gray-500">{user?.email}</p>
            <span className="inline-block mt-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-primary-100 text-primary-700">
              {roleLabels[user?.role || ''] || user?.role}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-primary-600" />
          <h3 className="font-semibold text-gray-900">Date personale</h3>
        </div>

        {profileMsg && (
          <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${profileMsg.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
            {profileMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            {profileMsg.text}
          </div>
        )}

        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prenume *</label>
              <input
                type="text"
                value={profileForm.firstName}
                onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nume *</label>
              <input
                type="text"
                value={profileForm.lastName}
                onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-400 text-sm cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 mt-1">Adresa de email nu poate fi modificată.</p>
          </div>
          <div className="pt-1">
            <button
              type="submit"
              disabled={profileSaving}
              className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition font-medium text-sm"
            >
              {profileSaving ? 'Se salvează...' : 'Salvare modificări'}
            </button>
          </div>
        </form>
      </div>

      {/* Change password card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-4 h-4 text-primary-600" />
          <h3 className="font-semibold text-gray-900">Schimbare parolă</h3>
        </div>

        {passMsg && (
          <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${passMsg.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
            {passMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            {passMsg.text}
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Parola curentă *</label>
            <input
              type="password"
              value={passForm.currentPassword}
              onChange={(e) => setPassForm({ ...passForm, currentPassword: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
              placeholder="••••••••"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parola nouă *</label>
              <input
                type="password"
                value={passForm.newPassword}
                onChange={(e) => setPassForm({ ...passForm, newPassword: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                placeholder="min. 8 caractere"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmare parolă *</label>
              <input
                type="password"
                value={passForm.confirmPassword}
                onChange={(e) => setPassForm({ ...passForm, confirmPassword: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                placeholder="••••••••"
                required
              />
            </div>
          </div>
          <div className="pt-1">
            <button
              type="submit"
              disabled={passSaving}
              className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition font-medium text-sm"
            >
              {passSaving ? 'Se schimbă...' : 'Schimbare parolă'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
