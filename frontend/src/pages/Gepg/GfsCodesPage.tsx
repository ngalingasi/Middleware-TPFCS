// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ GFS codes page
// └──────────────────────────────────────────────────────────────────────────┘

import { useEffect, useState } from 'react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import Button from '../../components/ui/button/Button';
import { Modal } from '../../components/ui/modal';
import { useModal } from '../../hooks/useModal';
import Label from '../../components/form/Label';
import Input from '../../components/form/input/InputField';
import RowActions from '../../components/common/RowActions';
import { gfsCodesApi } from '../../api/gfsCodes';
import { billingSystemsApi } from '../../api/billingSystems';
import type { BillingSystem, GfsCodeRecord } from '../../types/gepg';
import { toast } from '../../components/tpfcs/Toast';

export default function GfsCodesPage() {
  const createModal = useModal();
  const [codes, setCodes] = useState<GfsCodeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [systems, setSystems] = useState<BillingSystem[]>([]);
  const [systemId, setSystemId] = useState('');

  const load = () => {
    setLoading(true);
    gfsCodesApi
      .listAdmin(1, 100)
      .then((res) => setCodes(res.data.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);
  useEffect(() => {
    billingSystemsApi.list().then((res) => setSystems(res.data.data.systems)).catch(() => setSystems([]));
  }, []);

  const handleCreate = async () => {
    if (!code.trim()) {
      toast.error('GFS code is required');
      return;
    }
    setSubmitting(true);
    try {
      await gfsCodesApi.create(code.trim(), description.trim() || undefined, systemId ? Number(systemId) : null);
      toast.success('GFS code added');
      setCode('');
      setDescription('');
      setSystemId('');
      createModal.closeModal();
      load();
    } catch (err: any) {
      toast.error('Failed to add GFS code', err?.response?.data?.message ?? 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (record: GfsCodeRecord) => {
    const newStatus = record.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await gfsCodesApi.update(record.id, { status: newStatus });
      load();
    } catch {
      toast.error('Failed to update GFS code');
    }
  };

  const handleDelete = async (record: GfsCodeRecord) => {
    if (
      !window.confirm(
        `Delete GFS code "${record.code}"? Bills already created with this code are unaffected - prefer disabling it instead if it may have been used before.`
      )
    )
      return;
    try {
      await gfsCodesApi.delete(record.id);
      toast.success('GFS code deleted');
      load();
    } catch {
      toast.error('Failed to delete GFS code');
    }
  };

  return (
    <div>
      <PageMeta title="GFS Codes | Tanzania Police Force Corporation Sole" description="Manage the master list of valid GFS codes for bill items" />
      <PageBreadcrumb pageTitle="GFS Codes" />

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
          <div>
            <h3 className="text-base font-medium text-gray-800 dark:text-white/90">GFS Codes</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Only ACTIVE codes here can be used on a new bill item - by the dashboard's Create Bill form or by a
              child system calling the API directly.
            </p>
          </div>
          <Button onClick={createModal.openModal}>+ Add GFS Code</Button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-100 dark:bg-white/[0.05]">
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Code</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Description</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Billing system</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Status</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Added</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Action</th>
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
              {!loading && codes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-center text-sm text-gray-400">
                    No GFS codes yet - add one so it appears in the Create Bill dropdown.
                  </td>
                </tr>
              )}
              {codes.map((record) => (
                <tr key={record.id} className="odd:bg-white even:bg-gray-50 dark:odd:bg-transparent dark:even:bg-white/[0.03]">
                  <td className="px-3 py-2 text-sm whitespace-nowrap text-gray-700 dark:text-gray-300">
                    <code>{record.code}</code>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{record.description || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <select
                      className={`rounded-lg border px-2 py-1 text-xs ${record.billing_system_id ? 'border-gray-300 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300' : 'border-warning-300 bg-warning-50 text-warning-700'}`}
                      value={record.billing_system_id ?? ''}
                      title={record.billing_system_id ? 'The only billing system that can use this code' : 'Not linked: no billing system can use this code yet'}
                      onChange={async (e) => {
                        const next = e.target.value ? Number(e.target.value) : null;
                        if (record.billing_system_id && !window.confirm(next ? `Move ${record.code} from ${record.billing_system_code} to another billing system? ${record.billing_system_code} can no longer bill with it.` : `Unlink ${record.code} from ${record.billing_system_code}? It can no longer bill with it.`)) return;
                        try {
                          await gfsCodesApi.update(record.id, { billingSystemId: next });
                          toast.success('GFS code updated');
                          load();
                        } catch (err: any) {
                          toast.error('Could not change it', err?.response?.data?.message ?? 'Unknown error');
                        }
                      }}
                    >
                      <option value="">Not linked</option>
                      {systems.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        record.status === 'ACTIVE'
                          ? 'bg-green-50 text-green-600 dark:bg-green-500/15 dark:text-green-500'
                          : 'bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500'
                      }`}
                    >
                      {record.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">
                    {record.created_at ? new Date(record.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <RowActions
                      actions={[
                        { label: record.status === 'ACTIVE' ? 'Disable' : 'Enable', onClick: () => handleToggle(record) },
                        { label: 'Delete', onClick: () => handleDelete(record), danger: true },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={createModal.isOpen}
        onClose={createModal.closeModal}
        className="relative w-full max-w-[600px] rounded-3xl bg-white p-6 sm:m-0 lg:p-10 dark:bg-gray-900"
      >
        <h4 className="text-title-sm mb-1 font-semibold text-gray-800 dark:text-white/90">Add GFS code</h4>
        <p className="mb-7 text-sm leading-6 text-gray-500 dark:text-gray-400">
          The code itself can't be edited after creation - delete and re-add if it was entered wrong.
        </p>
        <div className="space-y-4">
          <div>
            <Label>GFS Code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. 140206" />
          </div>
          <div>
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Traffic Fines" />
          </div>
          <div>
            <Label>Billing system</Label>
            <select
              className="h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              value={systemId}
              onChange={(e) => setSystemId(e.target.value)}
            >
              <option value="">Not linked yet</option>
              {systems.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} - {s.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              A code belongs to one billing system, and a billing system can only bill with its own codes. You can also link codes from the system's own page.
            </p>
          </div>
        </div>
        <div className="mt-8 flex w-full flex-col items-center justify-between gap-3 sm:flex-row">
          <Button type="button" variant="outline" className="w-full" onClick={createModal.closeModal}>
            Close
          </Button>
          <Button type="button" className="w-full" onClick={handleCreate} disabled={submitting}>
            {submitting ? 'Adding…' : 'Add GFS Code'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
