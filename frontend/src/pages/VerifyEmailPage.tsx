import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import api from '../services/api';

type Status = 'loading' | 'success' | 'error';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Token de verificare lipsă sau invalid.');
      return;
    }

    api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((res) => {
        // Salvăm token-ul JWT și userul — utilizatorul e logat automat
        const { token: jwt, user } = res.data;
        if (jwt && user) {
          localStorage.setItem('token', jwt);
          localStorage.setItem('user', JSON.stringify(user));
        }
        setStatus('success');
        setMessage(res.data.message || 'Adresa de email a fost confirmată cu succes.');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.response?.data?.error || 'Link invalid sau expirat.');
      });
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-100">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 text-primary-600 animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">Se verifică...</h1>
            <p className="text-gray-500 text-sm">Confirmăm adresa ta de email.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-9 h-9 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Email confirmat!</h1>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">{message}</p>
            <Link
              to="/"
              onClick={() => window.location.href = '/'}
              className="inline-block px-6 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition text-sm"
            >
              Mergi la Dashboard
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-9 h-9 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Link invalid</h1>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">{message}</p>
            <Link to="/login" className="text-primary-600 hover:underline text-sm font-medium">
              ← Înapoi la autentificare
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
