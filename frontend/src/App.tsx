import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import DashboardPage from './pages/DashboardPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import TasksPage from './pages/TasksPage';
import ReportsPage from './pages/ReportsPage';
import UsersPage from './pages/UsersPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import Layout from './components/Layout';
import PageTransition from './components/PageTransition';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100/60">
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="w-10 h-10 rounded-full border-4 border-primary-200 border-t-primary-600 animate-spin" />
          <p className="text-sm text-gray-500 font-medium">Se încarcă...</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <PageTransition>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/projects" element={<ProjectsPage />} />
                  <Route path="/projects/:id" element={<ProjectDetailPage />} />
                  <Route path="/tasks" element={<TasksPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/users" element={<AdminRoute><UsersPage /></AdminRoute>} />
                  <Route path="/settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
                  <Route path="/profile" element={<ProfilePage />} />
                </Routes>
              </PageTransition>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
