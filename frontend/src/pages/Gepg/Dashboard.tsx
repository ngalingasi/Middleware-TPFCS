import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import ComponentCard from '../../components/common/ComponentCard';
import Badge from '../../components/ui/badge/Badge';
import { gepgDashboardApi } from '../../api/gepgDashboard';
import type { DashboardData } from '../../types/gepg';

function formatCurrency(value?: number) {
  const n = Number(value ?? 0);
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{sub}</p>}
    </div>
  );
}

export default function GepgDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    gepgDashboardApi
      .statistics()
      .then((res) => setData(res.data.data))
      .catch(() => setError('Failed to load dashboard statistics'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageMeta title="Dashboard | Tanzania Police Force Corporation Sole" description="Tanzania Police Force Corporation Sole dashboard" />
      <PageBreadcrumb pageTitle="Dashboard" />

      {loading && <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>}
      {error && <p className="text-sm text-error-500">{error}</p>}

      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Bills" value={String(data.bills.total_bills)} sub={`${data.bills.pending_bills} pending`} />
            <StatCard
              label="Total Billed"
              value={formatCurrency(data.bills.total_billed_amount)}
              sub={`${formatCurrency(data.bills.total_paid_amount)} collected`}
            />
            <StatCard label="Total Payments" value={String(data.payments.total_payments)} sub={`${data.payments.today_payments} today`} />
            <StatCard
              label="Total Collected"
              value={formatCurrency(data.payments.total_collected)}
              sub={`${formatCurrency(data.payments.today_amount)} today`}
            />
          </div>

          <ComponentCard title="Recent Payments" desc="Latest payment notifications received from GePG">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-100 dark:bg-white/[0.05]">
                    <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Receipt</th>
                    <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Bill</th>
                    <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Payer</th>
                    <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Amount</th>
                    <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {data.recentPayments.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-sm text-gray-400">
                        No payments yet
                      </td>
                    </tr>
                  )}
                  {data.recentPayments.map((p) => (
                    <tr key={p.pay_ref_id ?? `${p.bill_id}-${p.transaction_datetime}`} className="odd:bg-white even:bg-gray-50 dark:odd:bg-transparent dark:even:bg-white/[0.03]">
                      <td className="px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300">{p.pay_ref_id}</td>
                      <td className="px-2 py-1.5 text-sm">
                        <Link to={`/bills/${p.bill_id}`} className="text-brand-600 hover:underline dark:text-brand-400">
                          {p.bill_id}
                        </Link>
                      </td>
                      <td className="px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300">{p.payer_name}</td>
                      <td className="px-2 py-1.5 text-sm font-medium text-gray-800 dark:text-white/90">
                        {formatCurrency(p.paid_amount)}
                      </td>
                      <td className="px-2 py-1.5 text-sm text-gray-500 dark:text-gray-400">{p.transaction_datetime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ComponentCard>

          <div className="flex flex-wrap gap-2">
            <Badge color="success">{data.bills.approved_bills} approved</Badge>
            <Badge color="warning">{data.bills.pending_bills} pending</Badge>
            <Badge color="error">{data.bills.cancelled_bills} cancelled</Badge>
            <Badge color="primary">{data.bills.paid_bills} paid</Badge>
          </div>
        </div>
      )}
    </div>
  );
}
