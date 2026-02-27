import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FolderKanban, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../services/api';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-100">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
          <AlertCircle className="w-14 h-14 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Link invalid</h2>
          <p className="text-gray-500 text-sm mb-6">
            Link-ul de resetare este invalid sau lipsește token-ul.
          </p>
          <Link
            to="/forgot-password"
            className="inline-block py-2.5 px-6 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition text-sm"
          >
            Solicită un link nou
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Parolele nu coincid.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Parola trebuie să aibă cel puțin 8 caractere.');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Eroare la resetarea parolei.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-100">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="flex flex-col items-center mb-8">
          <FolderKanban className="w-12 h-12 text-primary-600 mb-3" />
          <h1 className="text-2xl font-bold text-gray-900">Resetare parolă</h1>
          <p className="text-gray-500 text-sm mt-1">Introdu parola nouă</p>
        </div>

        {success ? (
          <div className="text-center">
            <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Parolă resetată!</h2>
            <p className="text-gray-500 text-sm mb-2">
              Parola ta a fost schimbată cu succes.
            </p>
            <p className="text-gray-400 text-xs mb-6">
              Vei fi redirecționat la pagina de autentificare în câteva secunde...
            </p>
            <Link
              to="/login"
              className="inline-block py-2.5 px-6 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition text-sm"
            >
              Mergi la autentificare
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parolă nouă
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                  placeholder="Minim 8 caractere"
                  required
                  minLength={8}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmă parola nouă
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                  placeholder="Repetă parola"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition"
              >
                {isLoading ? 'Se resetează...' : 'Resetează parola'}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              <Link to="/login" className="text-primary-600 hover:underline font-medium">
                Înapoi la autentificare
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
