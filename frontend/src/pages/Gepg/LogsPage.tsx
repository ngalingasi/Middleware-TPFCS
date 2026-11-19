// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 19/11/2026
// │ Logs page: raw messages, audit, sign-ins and sessions in one place
// └──────────────────────────────────────────────────────────────────────────┘

import { useSearchParams } from 'react-router';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import { Link } from 'react-router';
import AuditTab from './logs/AuditTab';
import MessagesTab from './logs/MessagesTab';
import RetentionPanel from './logs/RetentionPanel';
import SessionsTab from './logs/SessionsTab';
import SignInsTab from './logs/SignInsTab';

const TABS = [
  { id: 'from-systems', label: 'Billing system requests' },
  { id: 'to-gepg', label: 'To GePG' },
  { id: 'from-gepg', label: 'From GePG' },
  { id: 'audit', label: 'Audit' },
  { id: 'sign-ins', label: 'Sign-ins' },
  { id: 'sessions', label: 'Signed in now' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function LogsPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab') as TabId | null;
  const tab: TabId = TABS.some((t) => t.id === requested) ? (requested as TabId) : 'from-systems';

  return (
    <div>
      <PageMeta title="Logs | Tanzania Police Force Corporation Sole" description="Raw messages, audit and sign-in history" />
      <PageBreadcrumb pageTitle="Logs" />

      <RetentionPanel />

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-wrap gap-1 border-b border-gray-100 px-3 pt-3 dark:border-gray-800">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setParams({ tab: t.id })}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
                tab === t.id
                  ? 'border-b-2 border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
          <Link to="/outbox" className="ml-auto px-4 py-2 text-sm text-brand-600 hover:underline dark:text-brand-400">
            Sent to billing systems: Outbox
          </Link>
        </div>

        <div className="p-4">
          {tab === 'from-systems' && <MessagesTab key="CLIENT_IN" direction="CLIENT_IN" />}
          {tab === 'to-gepg' && <MessagesTab key="GEPG_OUT" direction="GEPG_OUT" />}
          {tab === 'from-gepg' && <MessagesTab key="GEPG_IN" direction="GEPG_IN" />}
          {tab === 'audit' && <AuditTab />}
          {tab === 'sign-ins' && <SignInsTab />}
          {tab === 'sessions' && <SessionsTab />}
        </div>
      </div>
    </div>
  );
}
