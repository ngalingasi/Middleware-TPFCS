// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 19/11/2026
// │ Messages tab: raw requests and answers between billing systems, the bridge and GePG
// └──────────────────────────────────────────────────────────────────────────┘

import { useCallback, useEffect, useState } from 'react';
import Badge from '../../../components/ui/badge/Badge';
import Modal from '../../../components/tpfcs/Modal';
import { toast } from '../../../components/tpfcs/Toast';
import PayloadViewer from '../../../components/gepg/PayloadViewer';
import { billingSystemsApi } from '../../../api/billingSystems';
import { logsApi, type MessageDirection, type MessageLog } from '../../../api/logs';
import { gepgErrorMessage } from '../../../utils/gepgError';
import type { BillingSystem } from '../../../types/gepg';
import { DateRange, Detail, Field, Pager, fieldClass, size, th, when } from './shared';

const INTRO: Record<MessageDirection, string> = {
  CLIENT_IN: 'What billing systems sent to the bridge, exactly as received, and what the bridge answered.',
  GEPG_OUT: 'What the bridge sent to GePG (the signed XML) and GePG\'s raw answer. Failed and unanswered calls are here too.',
  GEPG_IN: 'What GePG sent to the three callback addresses, exactly as received, including messages the bridge refused, and the acknowledgement the bridge returned.',
};

const parseHeaders = (text: string | null) => {
  try {
    return text ? (JSON.parse(text) as Record<string, string>) : {};
  } catch {
    return {};
  }
};

export default function MessagesTab({ direction }: { direction: MessageDirection }) {
  const [filters, setFilters] = useState({ q: '', status: '', systemId: '', ack: '', ip: '', startDate: '', endDate: '' });
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<MessageLog[]>([]);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [acks, setAcks] = useState<string[]>([]);
  const [systems, setSystems] = useState<BillingSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<MessageLog | null>(null);

  const load = useCallback(() => {
    logsApi
      .messages({ page, limit: 20, direction, ...filters })
      .then((res) => {
        setRows(res.data.data);
        setPages(res.data.pagination.pages || 1);
        setTotal(res.data.pagination.total);
        setAcks(res.data.acks);
      })
      .catch((err) => toast.error('Failed to load the messages', gepgErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [page, direction, filters]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (direction === 'CLIENT_IN') billingSystemsApi.list().then((res) => setSystems(res.data.data.systems)).catch(() => setSystems([]));
  }, [direction]);

  const set = (key: keyof typeof filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const open = async (id: number) => {
    try {
      setDetail((await logsApi.message(id)).data.data);
    } catch (err) {
      toast.error('Could not open the message', gepgErrorMessage(err));
    }
  };

  const outcome = (m: MessageLog) => (direction === 'GEPG_IN' && m.ack_code ? `Answered ${m.ack_code}` : m.status_code ? `HTTP ${m.status_code}` : 'No answer');
  const headers = detail ? parseHeaders(detail.request_headers) : {};

  return (
    <div>
      <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">{INTRO[direction]}</p>

      <div className="mb-3 flex flex-wrap gap-3">
        <Field label="Search (bill, reference, address, error)">
          <input className={fieldClass} value={filters.q} onChange={(e) => set('q', e.target.value)} placeholder="e.g. TPFT-INV-1001" />
        </Field>
        <Field label="Result">
          <select className={fieldClass} value={filters.status} onChange={(e) => set('status', e.target.value)}>
            <option value="">All</option>
            <option value="ok">Succeeded</option>
            <option value="failed">Failed</option>
          </select>
        </Field>
        {direction === 'CLIENT_IN' && (
          <Field label="Billing system">
            <select className={fieldClass} value={filters.systemId} onChange={(e) => set('systemId', e.target.value)}>
              <option value="">All</option>
              {systems.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code}
                </option>
              ))}
            </select>
          </Field>
        )}
        {direction === 'GEPG_IN' && (
          <Field label="Answer sent">
            <select className={fieldClass} value={filters.ack} onChange={(e) => set('ack', e.target.value)}>
              <option value="">All</option>
              {acks.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Field>
        )}
        {direction !== 'GEPG_OUT' && (
          <Field label="From IP address">
            <input className={fieldClass} value={filters.ip} onChange={(e) => set('ip', e.target.value)} placeholder="e.g. 41.59." />
          </Field>
        )}
        <DateRange startDate={filters.startDate} endDate={filters.endDate} onChange={set} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="min-w-full">
          <thead className="bg-gray-50 dark:bg-white/[0.03]">
            <tr>
              <th className={th}>Time</th>
              {direction === 'CLIENT_IN' && <th className={th}>System</th>}
              <th className={th}>Operation</th>
              <th className={th}>Bill</th>
              <th className={th}>Result</th>
              <th className={th}>Took</th>
              {direction !== 'GEPG_OUT' && <th className={th}>From</th>}
              <th className={th}>Sent / received</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-4 text-center text-sm text-gray-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-sm text-gray-400">
                  No messages match.
                </td>
              </tr>
            )}
            {rows.map((m) => (
              <tr key={m.id} onClick={() => open(m.id)} className="cursor-pointer odd:bg-white even:bg-gray-50 hover:bg-brand-50/40 dark:odd:bg-transparent dark:even:bg-white/[0.03]">
                <td className="px-3 py-2 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">{when(m.created_at)}</td>
                {direction === 'CLIENT_IN' && <td className="px-3 py-2 text-sm font-medium text-gray-800 dark:text-white/90">{m.billing_system_code}</td>}
                <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">{m.operation}</td>
                <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">{m.bill_id ?? '—'}</td>
                <td className="px-3 py-2">
                  <Badge size="sm" color={m.ok ? 'success' : 'error'}>
                    {outcome(m)}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-sm text-gray-500">{m.duration_ms === null ? '—' : `${m.duration_ms} ms`}</td>
                {direction !== 'GEPG_OUT' && <td className="px-3 py-2 text-sm text-gray-500">{m.ip_address ?? '—'}</td>}
                <td className="px-3 py-2 text-xs whitespace-nowrap text-gray-400">
                  {size(m.request_size)} / {size(m.response_size)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pager page={page} pages={pages} total={total} noun="message" onPage={setPage} />
      </div>

      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.operation ?? 'Message'} · #${detail.id}` : ''} size="xl">
        {detail && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <Badge color={detail.ok ? 'success' : 'error'}>{outcome(detail)}</Badge>
              {detail.error && detail.error !== outcome(detail) && <span className="text-error-600 dark:text-error-500">{detail.error}</span>}
              {detail.truncated ? <Badge color="warning">Cut at 2 MB</Badge> : null}
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Detail label="Time">{when(detail.created_at)}</Detail>
              <Detail label="Took">{detail.duration_ms === null ? '' : `${detail.duration_ms} ms`}</Detail>
              <Detail label="Bill">{detail.bill_id}</Detail>
              <Detail label="Reference (ReqId / ResId)">{detail.reference}</Detail>
              <Detail label={detail.direction === 'GEPG_OUT' ? 'Sent to' : 'Address called'}>
                {detail.method} {detail.url}
              </Detail>
              {detail.billing_system_code && <Detail label="Billing system">{detail.billing_system_code}</Detail>}
              {detail.direction !== 'GEPG_OUT' && <Detail label="From IP">{detail.ip_address}</Detail>}
              {detail.forwarded_for && <Detail label="Forwarded for">{detail.forwarded_for}</Detail>}
              {detail.user_agent && <Detail label="Client">{detail.user_agent}</Detail>}
            </dl>
            {Object.keys(headers).length > 0 && (
              <div>
                <p className="mb-1 font-medium text-gray-800 dark:text-white/90">Request headers (secrets hidden)</p>
                <pre className="max-h-40 overflow-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-800 dark:bg-white/[0.04] dark:text-gray-200">
                  {Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\n')}
                </pre>
              </div>
            )}
            <PayloadViewer title={detail.direction === 'GEPG_OUT' ? 'Sent to GePG' : detail.direction === 'GEPG_IN' ? 'Received from GePG' : 'Received from the billing system'} text={detail.request_body} />
            <PayloadViewer title={detail.direction === 'GEPG_OUT' ? 'GePG answered' : detail.direction === 'GEPG_IN' ? 'The bridge answered GePG' : 'The bridge answered'} text={detail.response_body} />
          </div>
        )}
      </Modal>
    </div>
  );
}
