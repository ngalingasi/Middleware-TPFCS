import { useEffect, useState } from 'react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import Button from '../../components/ui/button/Button';
import { Modal } from '../../components/ui/modal';
import { useModal } from '../../hooks/useModal';
import Label from '../../components/form/Label';
import Input from '../../components/form/input/InputField';
import Switch from '../../components/form/switch/Switch';
import { gfsCodesApi } from '../../api/gfsCodes';
import type { GfsCodeRecord } from '../../types/gepg';
import { toast } from '../../components/tpfcs/Toast';

export default function GfsCodesPage() {
  const createModal = useModal();
  const [codes, setCodes] = useState<GfsCodeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');

  const load = () => {
    setLoading(true);
    gfsCodesApi
      .listAdmin(1, 100)
      .then((res) => setCodes(res.data.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async () => {
    if (!code.trim()) {
      toast.error('GFS code is required');
      return;
    }
    setSubmitting(true);
    try {
      await gfsCodesApi.create(code.trim(), description.trim() || undefined);
      toast.success('GFS code added');
      setCode('');
      setDescription('');
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
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Status</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Added</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Enable/Disable</th>
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
                    <Switch defaultChecked={record.status === 'ACTIVE'} onChange={() => handleToggle(record)} />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button
                      onClick={() => handleDelete(record)}
                      className="text-gray-500 hover:text-error-500 dark:text-gray-400 dark:hover:text-error-500"
                    >
                      Delete
                    </button>
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
