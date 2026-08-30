import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import Badge from '../../components/ui/badge/Badge';
import Button from '../../components/ui/button/Button';
import { billsApi } from '../../api/bills';
import type { Bill, BillStatus, GepgPagination } from '../../types/gepg';

const STATUS_COLOR: Record<BillStatus, 'success' | 'warning' | 'error' | 'primary' | 'light'> = {
  PENDING: 'warning',
  APPROVED: 'primary',
  PAID: 'success',
  REJECTED: 'error',
  CANCELLED: 'light',
  EXPIRED: 'light',
};

export default function BillsListPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [pagination, setPagination] = useState<GepgPagination | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    billsApi
      .list({ page, limit: 20, status: status || undefined })
      .then((res) => {
        setBills(res.data.data);
        setPagination(res.data.pagination);
      })
      .finally(() => setLoading(false));
  }, [page, status]);

  return (
    <div>
      <PageMeta title="Bills | Tanzania Police Force Corporation Sole" description="All bills submitted to GePG" />
      <PageBreadcrumb pageTitle="Bills" />

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          >
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="PAID">Paid</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="EXPIRED">Expired</option>
          </select>

          <Link to="/bills/new">
            <Button>+ New Bill</Button>
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-100 dark:bg-white/[0.05]">
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Bill ID</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Payer</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Amount</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Control No.</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Status</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Expiry</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-center text-sm text-gray-400">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && bills.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-center text-sm text-gray-400">
                    No bills found
                  </td>
                </tr>
              )}
              {bills.map((bill) => (
                <tr key={bill.bill_id} className="odd:bg-white even:bg-gray-50 dark:odd:bg-transparent dark:even:bg-white/[0.03]">
                  <td className="px-3 py-2 text-sm">
                    <Link to={`/bills/${bill.bill_id}`} className="text-brand-600 hover:underline dark:text-brand-400">
                      {bill.bill_id}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">{bill.payer_name}</td>
                  <td className="px-3 py-2 text-sm font-medium text-gray-800 dark:text-white/90">
                    {bill.currency} {Number(bill.bill_amount).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                    {bill.payment_control_number ?? '—'}
                  </td>
                  <td className="px-3 py-2">
                    <Badge color={STATUS_COLOR[bill.status]} size="sm">
                      {bill.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(bill.bill_expiry_date).toLocaleDateString()}
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
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
