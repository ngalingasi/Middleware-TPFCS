import { useEffect, useState } from 'react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import Button from '../../components/ui/button/Button';
import { Modal } from '../../components/ui/modal';
import { useModal } from '../../hooks/useModal';
import Label from '../../components/form/Label';
import Input from '../../components/form/input/InputField';
import Switch from '../../components/form/switch/Switch';
import { apiKeysApi } from '../../api/apiKeys';
import type { ApiKeyRecord } from '../../types/gepg';
import { toast } from '../../components/tpfcs/Toast';

export default function ApiKeysPage() {
  const createModal = useModal();
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Holds the plaintext key right after creation - shown once, never again.
  const [revealedKey, setRevealedKey] = useState<{ name: string; key: string } | null>(null);

  const load = () => {
    setLoading(true);
    apiKeysApi
      .list()
      .then((res) => setKeys(res.data.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Key name is required');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await apiKeysApi.create(name.trim());
      setRevealedKey({ name: data.data.name, key: data.data.key });
      setName('');
      createModal.closeModal();
      load();
    } catch (err: any) {
      toast.error('Failed to create API key', err?.response?.data?.message ?? 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (key: ApiKeyRecord) => {
    const newStatus = key.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    try {
      await apiKeysApi.setStatus(key.id, newStatus);
      load();
    } catch {
      toast.error('Failed to update API key');
    }
  };

  const handleDelete = async (key: ApiKeyRecord) => {
    if (!window.confirm(`Delete "${key.name}"? Any system using this key will lose access immediately.`)) return;
    try {
      await apiKeysApi.delete(key.id);
      toast.success('API key deleted');
      load();
    } catch {
      toast.error('Failed to delete API key');
    }
  };

  const handleCopy = async (text: string, id: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div>
      <PageMeta title="API Keys | Tanzania Police Force Corporation Sole" description="Manage API keys for machine-to-machine access" />
      <PageBreadcrumb pageTitle="API Keys" />

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
          <div>
            <h3 className="text-base font-medium text-gray-800 dark:text-white/90">API Keys</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Keys grant programmatic access to this bridge's REST API (X-Api-Key header), separate from dashboard logins.
            </p>
          </div>
          <Button onClick={createModal.openModal}>+ Add API Key</Button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-100 dark:bg-white/[0.05]">
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Name</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Key</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Status</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Created</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Last used</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Enable/Disable</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300">Action</th>
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
              {!loading && keys.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-4 text-center text-sm text-gray-400">
                    No API keys yet
                  </td>
                </tr>
              )}
              {keys.map((key) => (
                <tr key={key.id} className="odd:bg-white even:bg-gray-50 dark:odd:bg-transparent dark:even:bg-white/[0.03]">
                  <td className="px-3 py-2 text-sm whitespace-nowrap text-gray-700 dark:text-gray-300">{key.name}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <code className="text-sm text-gray-500 dark:text-gray-400">{key.key_prefix}</code>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        key.status === 'ACTIVE'
                          ? 'bg-green-50 text-green-600 dark:bg-green-500/15 dark:text-green-500'
                          : 'bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500'
                      }`}
                    >
                      {key.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">
                    {new Date(key.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">
                    {key.last_used_at ? new Date(key.last_used_at).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Switch defaultChecked={key.status === 'ACTIVE'} onChange={() => handleToggle(key)} />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button
                      onClick={() => handleDelete(key)}
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

      {/* Create modal */}
      <Modal
        isOpen={createModal.isOpen}
        onClose={createModal.closeModal}
        className="relative w-full max-w-[600px] rounded-3xl bg-white p-6 sm:m-0 lg:p-10 dark:bg-gray-900"
      >
        <h4 className="text-title-sm mb-1 font-semibold text-gray-800 dark:text-white/90">Generate API key</h4>
        <p className="mb-7 text-sm leading-6 text-gray-500 dark:text-gray-400">
          Name your key so you can recognize it later. The key value is only shown once, immediately after creation.
        </p>
        <div>
          <Label>Key name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Backoffice billing system" />
        </div>
        <div className="mt-8 flex w-full flex-col items-center justify-between gap-3 sm:flex-row">
          <Button type="button" variant="outline" className="w-full" onClick={createModal.closeModal}>
            Close
          </Button>
          <Button type="button" className="w-full" onClick={handleCreate} disabled={submitting}>
            {submitting ? 'Generating…' : 'Generate API key'}
          </Button>
        </div>
      </Modal>

      {/* One-time reveal modal */}
      <Modal
        isOpen={!!revealedKey}
        onClose={() => setRevealedKey(null)}
        className="relative w-full max-w-[600px] rounded-3xl bg-white p-6 sm:m-0 lg:p-10 dark:bg-gray-900"
      >
        {revealedKey && (
          <>
            <h4 className="text-title-sm mb-1 font-semibold text-gray-800 dark:text-white/90">
              "{revealedKey.name}" created
            </h4>
            <p className="mb-5 text-sm leading-6 text-error-600 dark:text-error-400">
              Copy this key now. For security, it will not be shown again.
            </p>
            <div className="flex items-center gap-3">
              <input
                readOnly
                value={revealedKey.key}
                className="h-9 w-full min-w-0 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              />
              <Button type="button" size="sm" onClick={() => handleCopy(revealedKey.key, -1)}>
                {copiedId === -1 ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <div className="mt-8 flex justify-end">
              <Button type="button" onClick={() => setRevealedKey(null)}>
                Done
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
