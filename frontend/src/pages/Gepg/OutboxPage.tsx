// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Outbox page: events sent to billing systems, with every delivery attempt
// └──────────────────────────────────────────────────────────────────────────┘

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import Badge from '../../components/ui/badge/Badge';
import Button from '../../components/ui/button/Button';
import Input from '../../components/form/input/InputField';
import Modal from '../../components/tpfcs/Modal';
import { toast } from '../../components/tpfcs/Toast';
import { outboxApi } from '../../api/outbox';
import { billingSystemsApi } from '../../api/billingSystems';
import { gepgErrorMessage } from '../../utils/gepgError';
import type { BillingSystem, EventStatus, OutboxEvent, OutboxEventDetail, OutboxStats } from '../../types/gepg';

const STATUS: Record<EventStatus, { label: string; color: 'warning' | 'success' | 'error' | 'light'; meaning: string }> = {
  PENDING: { label: 'Waiting', color: 'warning', meaning: 'Not delivered yet; the bridge will try again' },
  DELIVERED: { label: 'Delivered', color: 'success', meaning: 'The billing system answered with a success status' },
  DEAD: { label: 'Failed', color: 'error', meaning: 'Not accepted within the retry window; retry by hand' },
  PULL_ONLY: { label: 'Pull only', color: 'light', meaning: 'No callback URL; the system collects it from the events feed' },
};

const selectClass =
  'h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-3 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90';

const th = 'px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300';

const when = (v?: string | null) => (v ? new Date(v).toLocaleString() : '—');

export default function OutboxPage() {
  const [params, setParams] = useSearchParams();
  const systemId = params.get('systemId') ?? '';
  const status = (params.get('status') ?? '') as EventStatus | '';
  const type = params.get('type') ?? '';

  const [billSearch, setBillSearch] = useState('');
  const [billId, setBillId] = useState('');
  const [page, setPage] = useState(1);
  const [events, setEvents] = useState<OutboxEvent[]>([]);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<OutboxStats | null>(null);
  const [types, setTypes] = useState<string[]>([]);
  const [systems, setSystems] = useState<BillingSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [auto, setAuto] = useState(true);
  const [detail, setDetail] = useState<OutboxEventDetail | null>(null);

  const load = useCallback(() => {
    outboxApi
      .list({ page, limit: 20, systemId: systemId || undefined, status, type: type || undefined, billId: billId || undefined })
      .then((res) => {
        setEvents(res.data.data);
        setPages(res.data.pagination.pages || 1);
        setTotal(res.data.pagination.total);
        setStats(res.data.stats);
        setTypes(res.data.types.filter((t) => t !== 'system.test'));
      })
      .catch((err) => toast.error('Failed to load the outbox', gepgErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [page, systemId, status, type, billId]);

  useEffect(() => {
    billingSystemsApi.list().then((res) => setSystems(res.data.data.systems)).catch(() => setSystems([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (!auto) return;
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [auto, load]);

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
    setPage(1);
  };

  const open = async (id: number) => {
    try {
      const res = await outboxApi.get(id);
      setDetail(res.data.data);
    } catch (err) {
      toast.error('Could not open the event', gepgErrorMessage(err));
    }
  };

  const replay = async (id: number) => {
    try {
      await outboxApi.replay(id);
      toast.success('Queued to be sent again');
      setDetail(null);
      load();
    } catch (err) {
      toast.error('Could not queue it', gepgErrorMessage(err));
    }
  };

  const card = (key: EventStatus) => (
    <button
      key={key}
      type="button"
      onClick={() => setFilter('status', status === key ? '' : key)}
      className={`rounded-xl border p-3 text-left transition ${status === key ? 'border-brand-400 bg-brand-50 dark:bg-brand-500/10' : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-white/[0.03]'}`}
      title={STATUS[key].meaning}
    >
      <p className="text-xs text-gray-500 dark:text-gray-400">{STATUS[key].label}</p>
      <p className="text-xl font-semibold text-gray-800 dark:text-white/90">{stats ? stats[key] : '—'}</p>
    </button>
  );

  return (
    <div>
      <PageMeta title="Outbox | Tanzania Police Force Corporation Sole" description="Events sent to billing systems" />
      <PageBreadcrumb pageTitle="Outbox" />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{(['PENDING', 'DELIVERED', 'DEAD', 'PULL_ONLY'] as EventStatus[]).map(card)}</div>

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="grid gap-3 border-b border-gray-100 p-4 sm:grid-cols-2 lg:grid-cols-5 dark:border-gray-800">
          <select className={selectClass} value={systemId} onChange={(e) => setFilter('systemId', e.target.value)}>
            <option value="">All systems</option>
            {systems.map((s) => (
              <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
            ))}
          </select>
          <select className={selectClass} value={status} onChange={(e) => setFilter('status', e.target.value)}>
            <option value="">Any status</option>
            {(Object.keys(STATUS) as EventStatus[]).map((k) => (
              <option key={k} value={k}>{STATUS[k].label}</option>
            ))}
          </select>
          <select className={selectClass} value={type} onChange={(e) => setFilter('type', e.target.value)}>
            <option value="">Any event</option>
            {types.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <form
            className="flex gap-2 sm:col-span-2 lg:col-span-1"
            onSubmit={(e) => {
              e.preventDefault();
              setBillId(billSearch.trim());
              setPage(1);
            }}
          >
            <Input size="md" value={billSearch} placeholder="Bill id" onChange={(e) => setBillSearch(e.target.value)} />
            <Button size="md">Search</Button>
          </form>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
            Refresh every 10 seconds
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-100 dark:bg-white/[0.05]">
                <th className={th}>#</th>
                <th className={th}>Created</th>
                <th className={th}>System</th>
                <th className={th}>Event</th>
                <th className={th}>Bill</th>
                <th className={th}>Status</th>
                <th className={th}>Tries</th>
                <th className={th}>Next try / delivered</th>
                <th className={th}>Last answer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading && (
                <tr><td colSpan={9} className="px-4 py-4 text-center text-sm text-gray-400">Loading…</td></tr>
              )}
              {!loading && events.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-6 text-center text-sm text-gray-400">No events match. Events appear here when GePG answers a bill or a payment arrives.</td></tr>
              )}
              {events.map((e) => (
                <tr key={e.id} onClick={() => open(e.id)} className="cursor-pointer odd:bg-white even:bg-gray-50 hover:bg-brand-50/40 dark:odd:bg-transparent dark:even:bg-white/[0.03]">
                  <td className="px-3 py-2 text-sm text-gray-500">{e.id}</td>
                  <td className="px-3 py-2 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">{when(e.created_at)}</td>
                  <td className="px-3 py-2 text-sm font-medium text-gray-800 dark:text-white/90">{e.system_code}</td>
                  <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">{e.type}</td>
                  <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">{e.bill_id ?? '—'}</td>
                  <td className="px-3 py-2">
                    <Badge size="sm" color={STATUS[e.delivery_status].color}>{STATUS[e.delivery_status].label}</Badge>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-500">{e.attempts}</td>
                  <td className="px-3 py-2 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">
                    {e.delivery_status === 'DELIVERED' ? when(e.delivered_at) : e.delivery_status === 'PENDING' ? when(e.next_attempt_at) : '—'}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{e.last_error ?? (e.last_http_status ? `HTTP ${e.last_http_status}` : '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between p-3 text-sm text-gray-500 dark:text-gray-400">
          <span>{total} event{total === 1 ? '' : 's'}</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span>Page {page} of {pages}</span>
            <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      </div>

      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={detail ? `Event ${detail.id}: ${detail.type}` : ''} size="xl">
        {detail && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <Badge color={STATUS[detail.delivery_status].color}>{STATUS[detail.delivery_status].label}</Badge>
              <span className="text-gray-500 dark:text-gray-400">{STATUS[detail.delivery_status].meaning}</span>
              <span className="ml-auto text-gray-500 dark:text-gray-400">
                {detail.system_code} · {detail.callback_url ?? 'no callback URL'}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-gray-600 sm:grid-cols-4 dark:text-gray-300">
              <div><dt className="text-xs text-gray-400">Created</dt><dd>{when(detail.created_at)}</dd></div>
              <div><dt className="text-xs text-gray-400">Tries</dt><dd>{detail.attempts}</dd></div>
              <div><dt className="text-xs text-gray-400">Gives up after</dt><dd>{when(detail.deadline_at)}</dd></div>
              <div><dt className="text-xs text-gray-400">Delivered</dt><dd>{when(detail.delivered_at)}</dd></div>
            </dl>

            <div>
              <p className="mb-1 font-medium text-gray-800 dark:text-white/90">What the billing system receives</p>
              <pre className="max-h-64 overflow-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-800 dark:bg-white/[0.04] dark:text-gray-200">{JSON.stringify(detail.envelope, null, 2)}</pre>
            </div>

            <div>
              <p className="mb-1 font-medium text-gray-800 dark:text-white/90">Delivery attempts</p>
              {detail.deliveries.length === 0 ? (
                <p className="text-gray-400">None yet.</p>
              ) : (
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-white/[0.05]">
                      <th className={th}>Try</th><th className={th}>Time</th><th className={th}>Result</th><th className={th}>Answer</th><th className={th}>Took</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {detail.deliveries.map((d) => (
                      <tr key={d.id}>
                        <td className="px-3 py-1.5">{d.attempt}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{when(d.created_at)}</td>
                        <td className="px-3 py-1.5"><Badge size="sm" color={d.ok ? 'success' : 'error'}>{d.ok ? 'OK' : (d.error ?? 'Failed')}</Badge></td>
                        <td className="px-3 py-1.5 text-gray-500">{d.response_snippet || (d.http_status ? `HTTP ${d.http_status}` : '—')}</td>
                        <td className="px-3 py-1.5 text-gray-500">{d.duration_ms != null ? `${d.duration_ms} ms` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setDetail(null)}>Close</Button>
              <Button type="button" disabled={!detail.callback_url} onClick={() => replay(detail.id)}>
                {detail.delivery_status === 'DELIVERED' ? 'Send again' : 'Retry now'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
