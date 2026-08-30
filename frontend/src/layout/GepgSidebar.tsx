import { Link, useLocation } from 'react-router';
import { useSidebar } from '../context/SidebarContext';
import { useGepgAuth } from '../store/gepgAuthStore';

const Icon = {
  Dashboard: () => (
    <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  Bill: () => (
    <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  Payment: () => (
    <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <rect x="2" y="5" width="20" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 10h20" />
    </svg>
  ),
  Reconciliation: () => (
    <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  Users: () => (
    <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  ApiKey: () => (
    <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 11-12 0 6 6 0 0112 0zM3 21l6-6m-2 2l-2-2m0 0l-2 2 2 2" />
    </svg>
  ),
  Profile: () => (
    <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
};

type NavItem = { name: string; icon: React.ReactNode; path: string };

const NAV: NavItem[] = [
  { name: 'Dashboard', icon: <Icon.Dashboard />, path: '/' },
  { name: 'Bills', icon: <Icon.Bill />, path: '/bills' },
  { name: 'Payments', icon: <Icon.Payment />, path: '/payments' },
  { name: 'Reconciliation', icon: <Icon.Reconciliation />, path: '/reconciliation' },
];

const ADMIN_NAV: NavItem[] = [
  { name: 'Users', icon: <Icon.Users />, path: '/users' },
  { name: 'API Keys', icon: <Icon.ApiKey />, path: '/api-keys' },
];

const BOTTOM_NAV: NavItem[] = [{ name: 'Profile', icon: <Icon.Profile />, path: '/profile' }];

export default function GepgSidebar() {
  const { isExpanded, isHovered, isMobileOpen, toggleMobileSidebar } = useSidebar();
  const { isAdmin } = useGepgAuth();
  const location = useLocation();
  const expanded = isExpanded || isHovered || isMobileOpen;

  const nav = isAdmin ? [...NAV, ...ADMIN_NAV] : NAV;

  const isActive = (path: string) => (path === '/' ? location.pathname === '/' : location.pathname.startsWith(path));

  const linkCls = (active: boolean) =>
    `flex items-center gap-3 w-full px-3 py-2 rounded-lg text-[13px] transition-colors ${
      expanded ? '' : 'justify-center px-0'
    } ${
      active
        ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 font-medium'
        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-200'
    }`;

  const renderItem = (item: NavItem) => (
    <li key={item.path}>
      <Link
        to={item.path}
        onClick={() => {
          if (isMobileOpen) toggleMobileSidebar();
        }}
        className={linkCls(isActive(item.path))}
      >
        {item.icon}
        {expanded && <span>{item.name}</span>}
      </Link>
    </li>
  );

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className={`flex items-center gap-3 border-b border-gray-200 px-4 py-5 dark:border-gray-700 ${expanded ? 'justify-start' : 'justify-center'}`}>
        <img src="/images/logo/logo.png" alt="Tanzania Police Force Corporation Sole" className="h-8 w-8 flex-shrink-0 rounded object-contain" />
        {expanded && (
          <div className="min-w-0 overflow-hidden">
            <p className="truncate text-[13px] font-bold leading-tight text-gray-800 dark:text-white">Tanzania Police Force Corporation Sole</p>
            <p className="truncate text-[10px] text-gray-400 dark:text-gray-500">Payment Gateway Integration</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">{nav.map(renderItem)}</ul>
      </nav>

      <div className="border-t border-gray-200 px-3 py-3 dark:border-gray-700">
        <ul className="space-y-0.5">{BOTTOM_NAV.map(renderItem)}</ul>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={`hidden lg:flex flex-col fixed inset-y-0 left-0 z-40 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ${
          expanded ? 'w-64' : 'w-[72px]'
        }`}
      >
        {sidebarContent}
      </aside>

      {isMobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={toggleMobileSidebar} />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 lg:hidden">
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
