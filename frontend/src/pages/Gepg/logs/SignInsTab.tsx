// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 19/11/2026
// │ Sign-ins tab: every password check, code and sign-out, with address and browser
// └──────────────────────────────────────────────────────────────────────────┘

import { useCallback, useEffect, useState } from 'react';
import Badge from '../../../components/ui/badge/Badge';
import { toast } from '../../../components/tpfcs/Toast';
import { logsApi, type SignInEvent } from '../../../api/logs';
import { gepgErrorMessage } from '../../../utils/gepgError';
import { DateRange, Field, Pager, fieldClass, th, when } from './shared';

export default function SignInsTab() {
  const [filters, setFilters] = useState({ q: '', status: '', ip: '', startDate: '', endDate: '' });
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<SignInEvent[]>([]);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    logsApi
      .signIns({ page, limit: 20, ...filters })
      .then((res) => {
        setRows(res.data.data);
        setPages(res.data.pagination.pages || 1);
        setTotal(res.data.pagination.total);
      })
      .catch((err) => toast.error('Failed to load the sign-in history', gepgErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [page, filters]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const set = (key: keyof typeof filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  return (
    <div>
      <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
        Each step of signing in: password check, code request, code entry, sign-out. Failed attempts show the reason, so repeated failures from one address stand out.
      </p>

      <div className="mb-3 flex flex-wrap gap-3">
        <Field label="Search (user)">
          <input className={fieldClass} value={filters.q} onChange={(e) => set('q', e.target.value)} placeholder="e.g. admin" />
        </Field>
        <Field label="Result">
          <select className={fieldClass} value={filters.status} onChange={(e) => set('status', e.target.value)}>
            <option value="">All</option>
            <option value="SUCCESS">Succeeded</option>
            <option value="FAILED">Failed</option>
          </select>
        </Field>
        <Field label="From IP address">
          <input className={fieldClass} value={filters.ip} onChange={(e) => set('ip', e.target.value)} placeholder="e.g. 41.59." />
        </Field>
        <DateRange startDate={filters.startDate} endDate={filters.endDate} onChange={set} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="min-w-full">
          <thead className="bg-gray-50 dark:bg-white/[0.03]">
            <tr>
              <th className={th}>Time</th>
              <th className={th}>Step</th>
              <th className={th}>Result</th>
              <th className={th}>User</th>
              <th className={th}>IP address</th>
              <th className={th}>Browser</th>
              <th className={th}>Reason</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-4 text-center text-sm text-gray-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-400">
                  No sign-ins match.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="odd:bg-white even:bg-gray-50 dark:odd:bg-transparent dark:even:bg-white/[0.03]">
                <td className="px-3 py-2 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">{when(r.created_at)}</td>
                <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                  {r.event}
                  {r.channel ? <span className="text-gray-400"> ({r.channel})</span> : null}
                </td>
                <td className="px-3 py-2">
                  <Badge size="sm" color={r.ok ? 'success' : 'error'}>
                    {r.ok ? 'Succeeded' : 'Failed'}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-sm text-gray-800 dark:text-white/90">{r.username ?? '—'}</td>
                <td className="px-3 py-2 text-sm text-gray-500">{r.ip_address ?? '—'}</td>
                <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{r.browser || '—'}</td>
                <td className="px-3 py-2 text-sm text-error-600 dark:text-error-500">{r.reason ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pager page={page} pages={pages} total={total} noun="event" onPage={setPage} />
      </div>
    </div>
  );
}
