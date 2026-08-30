import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import ComponentCard from '../../components/common/ComponentCard';
import Badge from '../../components/ui/badge/Badge';
import { reconciliationApi } from '../../api/reconciliation';
import type { ReconciliationRequestDetail, ReconciliationStatus } from '../../types/gepg';

const STATUS_COLOR: Record<ReconciliationStatus, 'success' | 'warning' | 'error' | 'primary'> = {
  PENDING: 'warning',
  PROCESSING: 'primary',
  COMPLETED: 'success',
  FAILED: 'error',
};

export default function ReconciliationDetailPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const [request, setRequest] = useState<ReconciliationRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!requestId) return;
    reconciliationApi
      .get(requestId)
      .then((res) => setRequest(res.data.data))
      .finally(() => setLoading(false));
  }, [requestId]);

  if (loading) return <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>;
  if (!request) return <p className="text-sm text-error-500">Reconciliation request not found</p>;

  return (
    <div>
      <PageMeta title={`Reconciliation ${request.reconciliation_request_id} | Tanzania Police Force Corporation Sole`} description="Reconciliation detail" />
      <PageBreadcrumb pageTitle={`Reconciliation ${request.reconciliation_request_id}`} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Badge color={STATUS_COLOR[request.status]}>{request.status}</Badge>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Transaction date: <span className="font-medium text-gray-800 dark:text-white/90">{request.transaction_date}</span>
        </span>
        {request.status_code && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Status code: <span className="font-medium text-gray-800 dark:text-white/90">{request.status_code}</span>
          </span>
        )}
      </div>

      <ComponentCard
        title="Transactions"
        desc={
          request.status === 'PENDING' || request.status === 'PROCESSING'
            ? 'GePG has not yet returned results for this request'
            : `${request.transactions.length} transaction(s) returned by GePG`
        }
      >
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-100 dark:bg-white/[0.05]">
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Bill</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Control No.</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Amount</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Channel</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">PSP</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Depositor</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {request.transactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-sm text-gray-400">
                    No transactions
                  </td>
                </tr>
              )}
              {request.transactions.map((t) => (
                <tr key={t.id} className="odd:bg-white even:bg-gray-50 dark:odd:bg-transparent dark:even:bg-white/[0.03]">
                  <td className="px-2 py-1.5 text-sm">
                    <Link to={`/bills/${t.sp_bill_id}`} className="text-brand-600 hover:underline dark:text-brand-400">
                      {t.sp_bill_id}
                    </Link>
                  </td>
                  <td className="px-2 py-1.5 text-sm text-gray-500 dark:text-gray-400">{t.bill_control_number}</td>
                  <td className="px-2 py-1.5 text-sm font-medium text-gray-800 dark:text-white/90">
                    {t.currency} {Number(t.paid_amount ?? 0).toLocaleString()}
                  </td>
                  <td className="px-2 py-1.5 text-sm text-gray-500 dark:text-gray-400">{t.used_payment_channel}</td>
                  <td className="px-2 py-1.5 text-sm text-gray-500 dark:text-gray-400">{t.psp_name}</td>
                  <td className="px-2 py-1.5 text-sm text-gray-500 dark:text-gray-400">{t.depositor_name}</td>
                  <td className="px-2 py-1.5 text-sm text-gray-500 dark:text-gray-400">{t.transaction_datetime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ComponentCard>
    </div>
  );
}
