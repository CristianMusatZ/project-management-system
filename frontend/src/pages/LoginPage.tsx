import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FolderKanban, ShieldCheck } from 'lucide-react';
import api from '../services/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // MFA step 2
  const [mfaPending, setMfaPending] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  // ── Step 1: email + parolă ──────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await login(email, password);
      // login() returnează răspunsul API — dacă nu e requiresMFA, a navigat deja
      if ((res as any)?.requiresMFA) {
        setTempToken((res as any).tempToken);
        setMfaPending(true);
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Eroare la autentificare.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step 2: cod TOTP ─────────────────────────────────────────────────────
  const handleMFASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await api.post(
        '/mfa/verify',
        { code: otpCode },
        { headers: { Authorization: `Bearer ${tempToken}` } }
      );
      const fullToken = res.data.token;
      // Decodăm payload-ul JWT pentru a obține datele utilizatorului
      const payload = JSON.parse(atob(fullToken.split('.')[1]));
      const userData = {
        id: payload.id,
        email: payload.email,
        role: payload.role,
        firstName: payload.firstName,
        lastName: payload.lastName,
      };
      localStorage.setItem('token', fullToken);
      localStorage.setItem('user', JSON.stringify(userData));
      window.location.href = '/';
    } catch (err: any) {
      setError(err.response?.data?.error || 'Cod invalid.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Render step 2 (MFA) ─────────────────────────────────────────────────
  if (mfaPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-100">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 animate-scale-in">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center mb-3">
              <ShieldCheck className="w-8 h-8 text-primary-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Verificare MFA</h1>
            <p className="text-gray-500 text-sm mt-1 text-center">
              Introdu codul de 6 cifre din aplicația ta Authenticator
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleMFASubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cod TOTP
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition text-center text-2xl font-mono tracking-widest"
                placeholder="000000"
                autoFocus
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || otpCode.length !== 6}
              className="w-full py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition"
            >
              {isLoading ? 'Se verifică...' : 'Verifică'}
            </button>
          </form>

          <button
            onClick={() => { setMfaPending(false); setOtpCode(''); setError(''); }}
            className="mt-4 w-full text-center text-sm text-gray-500 hover:text-gray-700"
          >
            ← Înapoi la login
          </button>
        </div>
      </div>
    );
  }

  // ── Render step 1 (email + parolă) ──────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-blue-100">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-[0_24px_60px_-12px_rgba(0,0,0,0.15)] p-8 animate-scale-in">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary-600 flex items-center justify-center mb-4
                          shadow-[0_4px_16px_rgba(79,70,229,0.4)]">
            <FolderKanban className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Project Management</h1>
          <p className="text-gray-400 text-sm mt-1">Conectați-vă la contul dumneavoastră</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
              placeholder="email@exemplu.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Parolă</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition"
          >
            {isLoading ? 'Se conectează...' : 'Conectare'}
          </button>
        </form>

        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <Link to="/forgot-password" className="text-primary-600 hover:underline">
            Ai uitat parola?
          </Link>
          <span>
            Nu ai cont?{' '}
            <Link to="/register" className="text-primary-600 hover:underline font-medium">
              Înregistrare
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}
