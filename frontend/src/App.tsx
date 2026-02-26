import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import Layout from './components/Layout';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="flex items-center justify-center h-screen">Se încarcă...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/projects" element={<div className="p-6"><h1 className="text-2xl font-bold">Proiecte</h1><p className="text-gray-500 mt-2">Pagina proiectelor — de implementat</p></div>} />
                <Route path="/tasks" element={<div className="p-6"><h1 className="text-2xl font-bold">Sarcini</h1><p className="text-gray-500 mt-2">Pagina sarcinilor — de implementat</p></div>} />
                <Route path="/reports" element={<div className="p-6"><h1 className="text-2xl font-bold">Rapoarte</h1><p className="text-gray-500 mt-2">Pagina rapoartelor — de implementat</p></div>} />
                <Route path="/users" element={<div className="p-6"><h1 className="text-2xl font-bold">Utilizatori</h1><p className="text-gray-500 mt-2">Pagina utilizatorilor — de implementat</p></div>} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
