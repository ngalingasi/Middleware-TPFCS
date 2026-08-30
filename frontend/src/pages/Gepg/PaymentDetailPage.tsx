import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import ComponentCard from '../../components/common/ComponentCard';
import Badge from '../../components/ui/badge/Badge';
import { paymentsApi } from '../../api/payments';
import type { Payment } from '../../types/gepg';

export default function PaymentDetailPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!paymentId) return;
    paymentsApi
      .get(paymentId)
      .then((res) => setPayment(res.data.data))
      .finally(() => setLoading(false));
  }, [paymentId]);

  if (loading) return <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>;
  if (!payment) return <p className="text-sm text-error-500">Payment not found</p>;

  return (
    <div>
      <PageMeta title={`Payment ${payment.pay_ref_id} | Tanzania Police Force Corporation Sole`} description="Payment detail" />
      <PageBreadcrumb pageTitle={`Payment ${payment.pay_ref_id}`} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <ComponentCard title="Transaction">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400">Transaction ID</p>
                <p className="font-medium text-gray-800 dark:text-white/90">{payment.transaction_id}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Payment Ref ID</p>
                <p className="font-medium text-gray-800 dark:text-white/90">{payment.pay_ref_id}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Bill</p>
                <Link to={`/bills/${payment.bill_id}`} className="font-medium text-brand-600 hover:underline dark:text-brand-400">
                  {payment.bill_id}
                </Link>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Control Number</p>
                <p className="font-medium text-gray-800 dark:text-white/90">{payment.payment_control_number ?? '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Channel</p>
                <p className="font-medium text-gray-800 dark:text-white/90">{payment.used_payment_channel ?? '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Type</p>
                <Badge color={payment.payment_type === 'ONLINE' ? 'primary' : 'light'} size="sm">
                  {payment.payment_type}
                </Badge>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Date/Time</p>
                <p className="font-medium text-gray-800 dark:text-white/90">
                  {new Date(payment.transaction_datetime).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Status</p>
                <Badge color={payment.status === 'ACKNOWLEDGED' ? 'success' : 'warning'} size="sm">
                  {payment.status}
                </Badge>
              </div>
            </div>
          </ComponentCard>

          {payment.payment_type === 'OFFLINE' && (
            <ComponentCard title="PSP (Payment Service Provider)">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">PSP Name</p>
                  <p className="font-medium text-gray-800 dark:text-white/90">{payment.psp_name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">PSP Receipt No.</p>
                  <p className="font-medium text-gray-800 dark:text-white/90">{payment.psp_receipt_number ?? '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Credited Account</p>
                  <p className="font-medium text-gray-800 dark:text-white/90">{payment.credited_account_number ?? '—'}</p>
                </div>
              </div>
            </ComponentCard>
          )}
        </div>

        <div className="space-y-4">
          <ComponentCard title="Amount">
            <p className="text-3xl font-bold text-gray-800 dark:text-white/90">
              {payment.currency} {Number(payment.paid_amount).toLocaleString()}
            </p>
            {payment.bill_amount && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                of {payment.currency} {Number(payment.bill_amount).toLocaleString()} billed
              </p>
            )}
          </ComponentCard>

          <ComponentCard title="Payer">
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400">Name</p>
                <p className="font-medium text-gray-800 dark:text-white/90">{payment.payer_name ?? '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Phone</p>
                <p className="font-medium text-gray-800 dark:text-white/90">{payment.payer_cell_num ?? '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Email</p>
                <p className="font-medium text-gray-800 dark:text-white/90">{payment.payer_email ?? '—'}</p>
              </div>
            </div>
          </ComponentCard>
        </div>
      </div>
    </div>
  );
}
