// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 19/11/2026
// │ Audit tab: who did what, from which address
// └──────────────────────────────────────────────────────────────────────────┘

import { useCallback, useEffect, useState } from 'react';
import Badge from '../../../components/ui/badge/Badge';
import Modal from '../../../components/tpfcs/Modal';
import { toast } from '../../../components/tpfcs/Toast';
import PayloadViewer from '../../../components/gepg/PayloadViewer';
import { logsApi, type AuditLog } from '../../../api/logs';
import { gepgErrorMessage } from '../../../utils/gepgError';
import { DateRange, Detail, Field, Pager, fieldClass, th, when } from './shared';

export default function AuditTab() {
  const [filters, setFilters] = useState({ q: '', status: '', ip: '', startDate: '', endDate: '' });
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<AuditLog | null>(null);

  const load = useCallback(() => {
    logsApi
      .audit({ page, limit: 20, ...filters })
      .then((res) => {
        setRows(res.data.data);
        setPages(res.data.pagination.pages || 1);
        setTotal(res.data.pagination.total);
      })
      .catch((err) => toast.error('Failed to load the audit log', gepgErrorMessage(err)))
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

  const open = async (id: number) => {
    try {
      setDetail((await logsApi.auditOne(id)).data.data);
    } catch (err) {
      toast.error('Could not open the entry', gepgErrorMessage(err));
    }
  };

  return (
    <div>
      <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
        Every request made through the dashboard or by a billing system, with who made it and from where. Passwords, tokens and certificate files are never stored.
      </p>

      <div className="mb-3 flex flex-wrap gap-3">
        <Field label="Search (action, user, details)">
          <input className={fieldClass} value={filters.q} onChange={(e) => set('q', e.target.value)} placeholder="e.g. /api/v1/bills or admin" />
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
              <th className={th}>User</th>
              <th className={th}>Action</th>
              <th className={th}>Details</th>
              <th className={th}>Result</th>
              <th className={th}>IP address</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-center text-sm text-gray-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-400">
                  No entries match.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} onClick={() => open(r.id)} className="cursor-pointer odd:bg-white even:bg-gray-50 hover:bg-brand-50/40 dark:odd:bg-transparent dark:even:bg-white/[0.03]">
                <td className="px-3 py-2 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">{when(r.created_at)}</td>
                <td className="px-3 py-2 text-sm text-gray-800 dark:text-white/90">{r.username ?? '—'}</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-700 dark:text-gray-300">{r.action}</td>
                <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{r.description}</td>
                <td className="px-3 py-2">
                  <Badge size="sm" color={r.status === 'SUCCESS' ? 'success' : 'error'}>
                    {r.status === 'SUCCESS' ? 'Succeeded' : 'Failed'}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-sm text-gray-500">{r.ip_address ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pager page={page} pages={pages} total={total} noun="entry" onPage={setPage} />
      </div>

      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.action} · #${detail.id}` : ''} size="xl">
        {detail && (
          <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Detail label="Time">{when(detail.created_at)}</Detail>
              <Detail label="User">{detail.username ? `${detail.username}${detail.full_name ? ` (${detail.full_name})` : ''}` : ''}</Detail>
              <Detail label="IP address">{detail.ip_address}</Detail>
              <Detail label="Result">{detail.status}</Detail>
              <Detail label="About">{[detail.entity_type, detail.entity_id].filter(Boolean).join(' ')}</Detail>
              <Detail label="Browser">{detail.user_agent}</Detail>
            </dl>
            <p className="text-gray-600 dark:text-gray-300">{detail.description}</p>
            <PayloadViewer title="Request" text={detail.request_data} />
            <PayloadViewer title="Answer" text={detail.response_data} />
          </div>
        )}
      </Modal>
    </div>
  );
}
