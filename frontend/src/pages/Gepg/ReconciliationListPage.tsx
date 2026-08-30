import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import Badge from '../../components/ui/badge/Badge';
import Button from '../../components/ui/button/Button';
import { Modal } from '../../components/ui/modal';
import { useModal } from '../../hooks/useModal';
import Label from '../../components/form/Label';
import Input from '../../components/form/input/InputField';
import GepgDatePicker from '../../components/form/GepgDatePicker';
import { reconciliationApi } from '../../api/reconciliation';
import type { GepgPagination, ReconciliationRequest, ReconciliationStatus } from '../../types/gepg';
import { toast } from '../../components/tpfcs/Toast';

const STATUS_COLOR: Record<ReconciliationStatus, 'success' | 'warning' | 'error' | 'primary'> = {
  PENDING: 'warning',
  PROCESSING: 'primary',
  COMPLETED: 'success',
  FAILED: 'error',
};

export default function ReconciliationListPage() {
  const newRequestModal = useModal();
  const [requests, setRequests] = useState<ReconciliationRequest[]>([]);
  const [pagination, setPagination] = useState<GepgPagination | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [transactionDate, setTransactionDate] = useState('');
  const [reconciliationOption, setReconciliationOption] = useState<1 | 2>(1);

  const load = () => {
    setLoading(true);
    reconciliationApi
      .list({ page, limit: 20 })
      .then((res) => {
        setRequests(res.data.data);
        setPagination(res.data.pagination);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [page]);

  const handleSubmitRequest = async () => {
    if (!transactionDate) {
      toast.error('Please select a transaction date');
      return;
    }
    setSubmitting(true);
    try {
      await reconciliationApi.submitRequest(transactionDate, reconciliationOption);
      toast.success('Reconciliation request submitted', 'GePG will send the results asynchronously once processed.');
      newRequestModal.closeModal();
      setTransactionDate('');
      load();
    } catch (err: any) {
      toast.error('Failed to submit request', err?.response?.data?.message ?? 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageMeta title="Reconciliation | Tanzania Police Force Corporation Sole" description="Reconciliation requests and results" />
      <PageBreadcrumb pageTitle="Reconciliation" />

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex items-center justify-between border-b border-gray-100 p-4 dark:border-gray-800">
          <div>
            <h3 className="text-base font-medium text-gray-800 dark:text-white/90">Reconciliation Requests</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Compare GePG's payment records against yours for a given date
            </p>
          </div>
          <Button onClick={newRequestModal.openModal}>+ New Request</Button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-100 dark:bg-white/[0.05]">
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Request ID</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Transaction Date</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Option</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Status</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Status Code</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-sm text-gray-400">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && requests.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-sm text-gray-400">
                    No reconciliation requests yet
                  </td>
                </tr>
              )}
              {requests.map((r) => (
                <tr key={r.reconciliation_request_id} className="odd:bg-white even:bg-gray-50 dark:odd:bg-transparent dark:even:bg-white/[0.03]">
                  <td className="px-3 py-2 text-sm">
                    <Link
                      to={`/reconciliation/${r.reconciliation_request_id}`}
                      className="text-brand-600 hover:underline dark:text-brand-400"
                    >
                      {r.reconciliation_request_id}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">{r.transaction_date}</td>
                  <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                    {r.reconciliation_option === 1 ? 'Successful transactions' : 'Exception report'}
                  </td>
                  <td className="px-3 py-2">
                    <Badge color={STATUS_COLOR[r.status]} size="sm">
                      {r.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{r.status_code ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 p-4 text-sm dark:border-gray-800">
            <span className="text-gray-500 dark:text-gray-400">
              Page {pagination.page} of {pagination.pages}
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

      <Modal
        isOpen={newRequestModal.isOpen}
        onClose={newRequestModal.closeModal}
        className="relative w-full max-w-md rounded-3xl bg-white p-6 dark:bg-gray-900"
      >
        <h4 className="mb-1 text-lg font-semibold text-gray-800 dark:text-white/90">New Reconciliation Request</h4>
        <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
          GePG will process this asynchronously - results appear here once received.
        </p>

        <div className="space-y-4">
          <div>
            <Label>Transaction Date</Label>
            <GepgDatePicker value={transactionDate} onChange={setTransactionDate} placeholder="Select transaction date" />
          </div>
          <div>
            <Label>Option</Label>
            <select
              value={reconciliationOption}
              onChange={(e) => setReconciliationOption(Number(e.target.value) as 1 | 2)}
              className="h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            >
              <option value={1}>Successful transactions</option>
              <option value={2}>Exception report</option>
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={newRequestModal.closeModal}>
            Close
          </Button>
          <Button type="button" onClick={handleSubmitRequest} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Request'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
