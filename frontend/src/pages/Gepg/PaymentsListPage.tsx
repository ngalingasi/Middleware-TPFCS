import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import Badge from '../../components/ui/badge/Badge';
import Button from '../../components/ui/button/Button';
import { paymentsApi } from '../../api/payments';
import type { GepgPagination, Payment } from '../../types/gepg';

export default function PaymentsListPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [pagination, setPagination] = useState<GepgPagination | null>(null);
  const [page, setPage] = useState(1);
  const [paymentType, setPaymentType] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    paymentsApi
      .list({ page, limit: 20, paymentType: paymentType || undefined })
      .then((res) => {
        setPayments(res.data.data);
        setPagination(res.data.pagination);
      })
      .finally(() => setLoading(false));
  }, [page, paymentType]);

  return (
    <div>
      <PageMeta title="Payments | Tanzania Police Force Corporation Sole" description="All payment notifications received from GePG" />
      <PageBreadcrumb pageTitle="Payments" />

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
          <select
            value={paymentType}
            onChange={(e) => {
              setPaymentType(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          >
            <option value="">All channels</option>
            <option value="ONLINE">Online</option>
            <option value="OFFLINE">Offline</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-100 dark:bg-white/[0.05]">
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Receipt</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Bill</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Payer</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Amount</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Channel</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Type</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-4 text-center text-sm text-gray-400">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && payments.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-4 text-center text-sm text-gray-400">
                    No payments found
                  </td>
                </tr>
              )}
              {payments.map((p) => (
                <tr key={p.id} className="odd:bg-white even:bg-gray-50 dark:odd:bg-transparent dark:even:bg-white/[0.03]">
                  <td className="px-3 py-2 text-sm">
                    <Link to={`/payments/${p.id}`} className="text-brand-600 hover:underline dark:text-brand-400">
                      {p.pay_ref_id}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-sm">
                    <Link to={`/bills/${p.bill_id}`} className="text-gray-700 hover:underline dark:text-gray-300">
                      {p.bill_id}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">{p.payer_name}</td>
                  <td className="px-3 py-2 text-sm font-medium text-gray-800 dark:text-white/90">
                    {p.currency} {Number(p.paid_amount).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{p.used_payment_channel}</td>
                  <td className="px-3 py-2">
                    <Badge color={p.payment_type === 'ONLINE' ? 'primary' : 'light'} size="sm">
                      {p.payment_type}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(p.transaction_datetime).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 p-4 text-sm dark:border-gray-800">
            <span className="text-gray-500 dark:text-gray-400">
              Page {pagination.page} of {pagination.pages} ({pagination.total} total)
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
