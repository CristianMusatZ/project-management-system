import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { User, Lock, AlertCircle, CheckCircle2, ShieldCheck, ShieldOff, QrCode } from 'lucide-react';

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

  // ── MFA state (doar pentru admin) ────────────────────────────────────────
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaSetupUri, setMfaSetupUri] = useState('');
  const [mfaSetupSecret, setMfaSetupSecret] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaStep, setMfaStep] = useState<'idle' | 'setup' | 'disable'>('idle');
  const [mfaMsg, setMfaMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [mfaSaving, setMfaSaving] = useState(false);

  const isAdmin = user?.role === 'admin';

  const roleLabels: Record<string, string> = {
    admin: 'Administrator',
    project_manager: 'Project Manager',
    member: 'Membru echipă',
    viewer: 'Vizualizator',
  };

  // Încarcă statusul MFA la mount (doar admin)
  useEffect(() => {
    if (!isAdmin) return;
    api.get('/mfa/status').then((res) => setMfaEnabled(res.data.mfaEnabled)).catch(() => {});
  }, [isAdmin]);

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
      if (res.data.user) {
        updateUser({ firstName: res.data.user.first_name, lastName: res.data.user.last_name });
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

  // ── MFA handlers ─────────────────────────────────────────────────────────

  async function handleStartSetup() {
    setMfaMsg(null);
    setMfaSaving(true);
    try {
      const res = await api.get('/mfa/setup');
      setMfaSetupUri(res.data.uri);
      setMfaSetupSecret(res.data.secret);
      setMfaCode('');
      setMfaStep('setup');
    } catch (err: any) {
      setMfaMsg({ type: 'error', text: err.response?.data?.error || 'Eroare la inițializarea MFA.' });
    } finally {
      setMfaSaving(false);
    }
  }

  async function handleEnableMFA(e: React.FormEvent) {
    e.preventDefault();
    setMfaSaving(true);
    setMfaMsg(null);
    try {
      await api.post('/mfa/enable', { code: mfaCode });
      setMfaEnabled(true);
      setMfaStep('idle');
      setMfaSetupUri('');
      setMfaSetupSecret('');
      setMfaCode('');
      setMfaMsg({ type: 'success', text: 'MFA activat cu succes! Vei fi rugat să introduci codul la fiecare autentificare.' });
    } catch (err: any) {
      setMfaMsg({ type: 'error', text: err.response?.data?.error || 'Cod invalid.' });
    } finally {
      setMfaSaving(false);
    }
  }

  async function handleDisableMFA(e: React.FormEvent) {
    e.preventDefault();
    setMfaSaving(true);
    setMfaMsg(null);
    try {
      await api.post('/mfa/disable', { code: mfaCode });
      setMfaEnabled(false);
      setMfaStep('idle');
      setMfaCode('');
      setMfaMsg({ type: 'success', text: 'MFA dezactivat.' });
    } catch (err: any) {
      setMfaMsg({ type: 'error', text: err.response?.data?.error || 'Cod invalid.' });
    } finally {
      setMfaSaving(false);
    }
  }

  // QR Code URI → imagine SVG via Google Charts (fără librării)
  const qrImageUrl = mfaSetupUri
    ? `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(mfaSetupUri)}&size=200x200&margin=8`
    : '';

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
              <input type="text" value={profileForm.firstName}
                onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nume *</label>
              <input type="text" value={profileForm.lastName}
                onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={user?.email || ''} disabled
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-400 text-sm cursor-not-allowed" />
            <p className="text-xs text-gray-400 mt-1">Adresa de email nu poate fi modificată.</p>
          </div>
          <div className="pt-1">
            <button type="submit" disabled={profileSaving}
              className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition font-medium text-sm">
              {profileSaving ? 'Se salvează...' : 'Salvare modificări'}
            </button>
          </div>
        </form>
      </div>

      {/* MFA card — doar pentru admin */}
      {isAdmin && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary-600" />
              <h3 className="font-semibold text-gray-900">Autentificare multi-factor (MFA)</h3>
            </div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${mfaEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {mfaEnabled ? '✓ Activat' : 'Dezactivat'}
            </span>
          </div>

          <p className="text-sm text-gray-500 mb-4">
            MFA adaugă un nivel suplimentar de securitate contului tău de administrator.
            La fiecare autentificare vei introduce un cod de 6 cifre din aplicația Google Authenticator sau Authy.
          </p>

          {mfaMsg && (
            <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${mfaMsg.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
              {mfaMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
              {mfaMsg.text}
            </div>
          )}

          {/* Idle state */}
          {mfaStep === 'idle' && !mfaEnabled && (
            <button onClick={handleStartSetup} disabled={mfaSaving}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition">
              <QrCode className="w-4 h-4" />
              {mfaSaving ? 'Se pregătește...' : 'Activează MFA'}
            </button>
          )}

          {mfaStep === 'idle' && mfaEnabled && (
            <button onClick={() => { setMfaStep('disable'); setMfaCode(''); setMfaMsg(null); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 border border-red-200 text-sm font-medium rounded-lg hover:bg-red-100 transition">
              <ShieldOff className="w-4 h-4" />
              Dezactivează MFA
            </button>
          )}

          {/* Setup flow — scanare QR + confirmare */}
          {mfaStep === 'setup' && (
            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-700 mb-3">
                  1. Scanează codul QR cu <strong>Google Authenticator</strong> sau <strong>Authy</strong>
                </p>
                <div className="flex justify-center mb-3">
                  <img src={qrImageUrl} alt="QR Code MFA" className="w-48 h-48 rounded-lg border border-gray-200" />
                </div>
                <p className="text-xs text-gray-500 text-center mb-2">Sau introdu manual secretul:</p>
                <div className="flex justify-center">
                  <code className="text-xs bg-white border border-gray-300 px-3 py-1.5 rounded-lg font-mono tracking-widest text-gray-700 select-all">
                    {mfaSetupSecret}
                  </code>
                </div>
              </div>

              <form onSubmit={handleEnableMFA} className="space-y-3">
                <p className="text-sm font-medium text-gray-700">
                  2. Introdu codul de 6 cifre din aplicație pentru confirmare
                </p>
                <input
                  type="text" inputMode="numeric" maxLength={6}
                  value={mfaCode} onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-center text-2xl font-mono tracking-widest"
                  placeholder="000000" autoFocus
                />
                <div className="flex gap-3">
                  <button type="submit" disabled={mfaSaving || mfaCode.length !== 6}
                    className="flex-1 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition">
                    {mfaSaving ? 'Se activează...' : 'Confirmă și activează'}
                  </button>
                  <button type="button" onClick={() => { setMfaStep('idle'); setMfaMsg(null); }}
                    className="px-4 py-2.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition">
                    Anulează
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Disable flow */}
          {mfaStep === 'disable' && (
            <form onSubmit={handleDisableMFA} className="space-y-3">
              <p className="text-sm text-gray-600">
                Introdu codul curent din aplicația Authenticator pentru a confirma dezactivarea:
              </p>
              <input
                type="text" inputMode="numeric" maxLength={6}
                value={mfaCode} onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-center text-2xl font-mono tracking-widest"
                placeholder="000000" autoFocus
              />
              <div className="flex gap-3">
                <button type="submit" disabled={mfaSaving || mfaCode.length !== 6}
                  className="flex-1 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition">
                  {mfaSaving ? 'Se dezactivează...' : 'Dezactivează MFA'}
                </button>
                <button type="button" onClick={() => { setMfaStep('idle'); setMfaMsg(null); }}
                  className="px-4 py-2.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition">
                  Anulează
                </button>
              </div>
            </form>
          )}
        </div>
      )}

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
            <input type="password" value={passForm.currentPassword}
              onChange={(e) => setPassForm({ ...passForm, currentPassword: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
              placeholder="••••••••" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parola nouă *</label>
              <input type="password" value={passForm.newPassword}
                onChange={(e) => setPassForm({ ...passForm, newPassword: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                placeholder="min. 8 caractere" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmare parolă *</label>
              <input type="password" value={passForm.confirmPassword}
                onChange={(e) => setPassForm({ ...passForm, confirmPassword: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                placeholder="••••••••" required />
            </div>
          </div>
          <div className="pt-1">
            <button type="submit" disabled={passSaving}
              className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition font-medium text-sm">
              {passSaving ? 'Se schimbă...' : 'Schimbare parolă'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
