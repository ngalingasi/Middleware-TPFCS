import { Navigate, Outlet } from 'react-router';
import { useGepgAuth } from '../../store/gepgAuthStore';

interface Props {
  adminOnly?: boolean;
}

export default function GepgProtectedRoute({ adminOnly }: Props) {
  const { isAuthenticated, isLoading, isAdmin } = useGepgAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
