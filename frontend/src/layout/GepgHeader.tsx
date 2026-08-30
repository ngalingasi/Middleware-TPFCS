import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useSidebar } from '../context/SidebarContext';
import { ThemeToggleButton } from '../components/common/ThemeToggleButton';
import { useGepgAuth } from '../store/gepgAuthStore';

export default function GepgHeader() {
  const { toggleSidebar, toggleMobileSidebar } = useSidebar();
  const { user, logout } = useGepgAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleToggle = () => {
    if (window.innerWidth < 1024) {
      toggleMobileSidebar();
    } else {
      toggleSidebar();
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/signin');
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900 md:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={handleToggle}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
          aria-label="Toggle sidebar"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="hidden text-sm font-semibold text-gray-700 dark:text-gray-200 sm:inline">
          Tanzania Police Force Corporation Sole
        </span>
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggleButton />

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white">
              {user?.full_name?.charAt(0)?.toUpperCase() ?? user?.username?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            <span className="hidden text-sm font-medium text-gray-700 dark:text-gray-200 sm:inline">
              {user?.full_name ?? user?.username}
            </span>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-50 mt-2 w-52 rounded-lg border border-gray-200 bg-white py-1.5 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                <div className="border-b border-gray-100 px-4 py-2 dark:border-gray-800">
                  <p className="truncate text-sm font-medium text-gray-800 dark:text-white/90">{user?.full_name}</p>
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
                </div>
                <Link
                  to="/change-password"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Change password
                </Link>
                <button
                  onClick={handleLogout}
                  className="block w-full px-4 py-2 text-left text-sm text-error-600 hover:bg-gray-50 dark:text-error-400 dark:hover:bg-gray-800"
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
