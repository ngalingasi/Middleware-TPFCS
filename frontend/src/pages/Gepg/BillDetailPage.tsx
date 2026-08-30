import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import ComponentCard from '../../components/common/ComponentCard';
import Badge from '../../components/ui/badge/Badge';
import Button from '../../components/ui/button/Button';
import { Modal } from '../../components/ui/modal';
import { useModal } from '../../hooks/useModal';
import Label from '../../components/form/Label';
import Input from '../../components/form/input/InputField';
import { billsApi } from '../../api/bills';
import type { Bill, BillStatus } from '../../types/gepg';
import { toast } from '../../components/tpfcs/Toast';

const STATUS_COLOR: Record<BillStatus, 'success' | 'warning' | 'error' | 'primary' | 'light'> = {
  PENDING: 'warning',
  APPROVED: 'primary',
  PAID: 'success',
  REJECTED: 'error',
  CANCELLED: 'light',
  EXPIRED: 'light',
};

export default function BillDetailPage() {
  const { billId } = useParams<{ billId: string }>();
  const navigate = useNavigate();
  const cancelModal = useModal();

  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const load = () => {
    if (!billId) return;
    setLoading(true);
    billsApi
      .get(billId)
      .then((res) => setBill(res.data.data))
      .catch(() => toast.error('Failed to load bill'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [billId]);

  const handleSubmit = async () => {
    if (!billId) return;
    setSubmitting(true);
    try {
      await billsApi.submit(billId);
      toast.success('Submitted to GePG', 'Waiting for GePG to process the bill. Status updates automatically once processed.');
      load();
    } catch (err: any) {
      toast.error('Submission failed', err?.response?.data?.message ?? 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!billId || !cancelReason.trim()) return;
    setSubmitting(true);
    try {
      await billsApi.cancel(billId, cancelReason.trim());
      toast.success('Bill cancelled');
      cancelModal.closeModal();
      load();
    } catch (err: any) {
      toast.error('Cancellation failed', err?.response?.data?.message ?? 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>;
  if (!bill) return <p className="text-sm text-error-500">Bill not found</p>;

  const canSubmit = bill.status === 'PENDING' && !bill.payment_control_number;
  const canCancel = bill.status === 'PENDING' || bill.status === 'APPROVED';

  return (
    <div>
      <PageMeta title={`Bill ${bill.bill_id} | Tanzania Police Force Corporation Sole`} description="Bill detail" />
      <PageBreadcrumb pageTitle={`Bill ${bill.bill_id}`} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Badge color={STATUS_COLOR[bill.status]}>{bill.status}</Badge>
        {bill.payment_control_number && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Control No. <span className="font-medium text-gray-800 dark:text-white/90">{bill.payment_control_number}</span>
          </span>
        )}
        <div className="ml-auto flex gap-2">
          {canSubmit && (
            <Button size="sm" onClick={handleSubmit} disabled={submitting}>
              Submit to GePG
            </Button>
          )}
          {canCancel && (
            <Button size="sm" variant="outline" onClick={cancelModal.openModal} disabled={submitting}>
              Cancel Bill
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <ComponentCard title="Bill Items">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-100 dark:bg-white/[0.05]">
                    <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Item Ref</th>
                    <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">GFS Code</th>
                    <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Amount</th>
                    <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Misc Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {(bill.items ?? []).map((item, idx) => (
                    <tr key={idx} className="odd:bg-white even:bg-gray-50 dark:odd:bg-transparent dark:even:bg-white/[0.03]">
                      <td className="px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300">{item.bill_item_ref}</td>
                      <td className="px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300">{item.gfs_code}</td>
                      <td className="px-2 py-1.5 text-sm font-medium text-gray-800 dark:text-white/90">
                        {Number(item.bill_item_amount).toLocaleString()}
                      </td>
                      <td className="px-2 py-1.5 text-sm text-gray-500 dark:text-gray-400">
                        {Number(item.bill_item_misc_amount ?? 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ComponentCard>

          {(bill.transaction_status || bill.transaction_status_code) && (
            <ComponentCard title="GePG Transaction Status" desc="Latest status code returned by GePG">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Transaction Status</p>
                  <p className="font-medium text-gray-800 dark:text-white/90">{bill.transaction_status ?? '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Status Code</p>
                  <p className="font-medium text-gray-800 dark:text-white/90">{bill.transaction_status_code ?? '—'}</p>
                </div>
              </div>
            </ComponentCard>
          )}
        </div>

        <div className="space-y-4">
          <ComponentCard title="Payer">
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400">Name</p>
                <p className="font-medium text-gray-800 dark:text-white/90">{bill.payer_name}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Payer ID</p>
                <p className="font-medium text-gray-800 dark:text-white/90">{bill.payer_id}</p>
              </div>
              {bill.payer_cell_num && (
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Phone</p>
                  <p className="font-medium text-gray-800 dark:text-white/90">{bill.payer_cell_num}</p>
                </div>
              )}
              {bill.payer_email && (
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Email</p>
                  <p className="font-medium text-gray-800 dark:text-white/90">{bill.payer_email}</p>
                </div>
              )}
            </div>
          </ComponentCard>

          <ComponentCard title="Amounts">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Bill Amount</span>
                <span className="font-medium text-gray-800 dark:text-white/90">
                  {bill.currency} {Number(bill.bill_amount).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Misc Amount</span>
                <span className="font-medium text-gray-800 dark:text-white/90">
                  {Number(bill.misc_amount ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-3 dark:border-gray-800">
                <span className="text-gray-500 dark:text-gray-400">Expiry Date</span>
                <span className="font-medium text-gray-800 dark:text-white/90">
                  {new Date(bill.bill_expiry_date).toLocaleDateString()}
                </span>
              </div>
            </div>
          </ComponentCard>
        </div>
      </div>

      <Modal
        isOpen={cancelModal.isOpen}
        onClose={cancelModal.closeModal}
        className="relative w-full max-w-md rounded-3xl bg-white p-6 dark:bg-gray-900"
      >
        <h4 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">Cancel Bill</h4>
        <Label>Cancellation reason</Label>
        <Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="e.g. Duplicate bill" />
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={cancelModal.closeModal}>
            Close
          </Button>
          <Button onClick={handleCancel} disabled={submitting || !cancelReason.trim()}>
            Confirm Cancellation
          </Button>
        </div>
      </Modal>
    </div>
  );
}
