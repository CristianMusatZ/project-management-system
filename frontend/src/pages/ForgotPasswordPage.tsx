import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderKanban, CheckCircle2, ArrowLeft } from 'lucide-react';
import api from '../services/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetUrl, setResetUrl] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setSent(true);
      // În development, backend-ul returnează link-ul direct pentru testare
      if (res.data.resetUrl) {
        setResetUrl(res.data.resetUrl);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Eroare la procesarea cererii.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-100">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="flex flex-col items-center mb-8">
          <FolderKanban className="w-12 h-12 text-primary-600 mb-3" />
          <h1 className="text-2xl font-bold text-gray-900">Recuperare parolă</h1>
          <p className="text-gray-500 text-sm mt-1 text-center">
            Introdu adresa de email și îți vom trimite instrucțiuni de resetare
          </p>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="w-14 h-14 text-green-500" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Cerere trimisă!</h2>
            <p className="text-gray-500 text-sm mb-6">
              Dacă adresa <strong>{email}</strong> există în sistem, vei primi instrucțiuni de resetare.
            </p>

            {resetUrl && (
              <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-left">
                <p className="text-xs font-semibold text-yellow-700 mb-1">
                  🔧 Mod dezvoltare — link resetare:
                </p>
                <a
                  href={resetUrl}
                  className="text-xs text-primary-600 hover:underline break-all"
                >
                  {resetUrl}
                </a>
              </div>
            )}

            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm text-primary-600 hover:underline font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Înapoi la autentificare
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adresă de email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                  placeholder="email@exemplu.com"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition"
              >
                {isLoading ? 'Se procesează...' : 'Trimite instrucțiuni'}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              <Link
                to="/login"
                className="inline-flex items-center gap-1 text-primary-600 hover:underline font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                Înapoi la autentificare
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
