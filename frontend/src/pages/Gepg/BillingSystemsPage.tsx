// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Billing systems page: who sends bills through the bridge
// └──────────────────────────────────────────────────────────────────────────┘

import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import Badge from '../../components/ui/badge/Badge';
import Button from '../../components/ui/button/Button';
import Label from '../../components/form/Label';
import Input from '../../components/form/input/InputField';
import Modal from '../../components/tpfcs/Modal';
import { toast } from '../../components/tpfcs/Toast';
import { billingSystemsApi } from '../../api/billingSystems';
import { apiKeysApi } from '../../api/apiKeys';
import { gepgErrorMessage } from '../../utils/gepgError';
import { FEATURES } from '../../config/features';
import type { ApiKeyRecord, BillingSystem, BillingSystemInput, GfsLinks } from '../../types/gepg';

const selectClass =
  'h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90';

const th = 'px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300';

function windowLabel(hours: number, defaultHours: number) {
  const text = hours % 24 === 0 && hours >= 168 ? `${hours / 24} days` : `${hours} hours`;
  return hours === defaultHours ? `${text} (recommended)` : text;
}

const EMPTY: BillingSystemInput = { code: '', name: '', description: '', contact: '', callbackUrl: '', retryWindowHours: 72, status: 'ACTIVE' };

function Field({ label, help, error, children }: { label: string; help: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {error ? <p className="mt-1 text-xs text-error-500">{error}</p> : <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{help}</p>}
    </div>
  );
}

function CopyBox({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 dark:bg-white/[0.04]">
      <code className="min-w-0 flex-1 break-all text-xs text-gray-800 dark:text-white/90">{value}</code>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}

export default function BillingSystemsPage() {
  const [systems, setSystems] = useState<BillingSystem[]>([]);
  const [windows, setWindows] = useState<number[]>([72]);
  const [defaultWindow, setDefaultWindow] = useState(72);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<BillingSystem | 'new' | null>(null);
  const [form, setForm] = useState<BillingSystemInput>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [secret, setSecret] = useState<{ title: string; value: string; code?: string } | null>(null);
  const [keysFor, setKeysFor] = useState<BillingSystem | null>(null);
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [testing, setTesting] = useState<number | null>(null);

  // GFS codes: which ones this system may bill with
  const [gfsFor, setGfsFor] = useState<BillingSystem | null>(null);
  const [gfs, setGfs] = useState<GfsLinks | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [gfsSearch, setGfsSearch] = useState('');

  const load = () =>
    billingSystemsApi
      .list()
      .then((res) => {
        setSystems(res.data.data.systems);
        setWindows(res.data.data.retryWindows);
        setDefaultWindow(res.data.data.defaultRetryWindow);
      })
      .catch((err) => toast.error('Failed to load billing systems', gepgErrorMessage(err)))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setForm({ ...EMPTY, retryWindowHours: defaultWindow });
    setErrors({});
    setEditing('new');
  };

  const openEdit = (s: BillingSystem) => {
    setForm({
      name: s.name,
      description: s.description ?? '',
      contact: s.contact ?? '',
      callbackUrl: s.callback_url ?? '',
      retryWindowHours: s.retry_window_hours,
      status: s.status,
    });
    setErrors({});
    setEditing(s);
  };

  const set = (patch: Partial<BillingSystemInput>) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      if (editing === 'new') {
        const res = await billingSystemsApi.create(form);
        setSecret({ title: `Signing secret for ${res.data.data.system.code}`, value: res.data.data.secret, code: res.data.data.system.code });
      } else if (editing) {
        await billingSystemsApi.update(editing.id, form);
        toast.success('Saved');
      }
      setEditing(null);
      load();
    } catch (err: any) {
      setErrors(err?.response?.data?.errors ?? {});
      toast.error('Not saved', gepgErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const rotate = async (s: BillingSystem) => {
    if (!window.confirm(`Create a new signing secret for ${s.code}? Deliveries are signed with the new one straight away, so the system must be updated with it.`)) return;
    try {
      const res = await billingSystemsApi.rotateSecret(s.id);
      setSecret({ title: `New signing secret for ${s.code}`, value: res.data.data.secret });
    } catch (err) {
      toast.error('Could not create a new secret', gepgErrorMessage(err));
    }
  };

  const sendTest = async (s: BillingSystem) => {
    setTesting(s.id);
    try {
      const { data } = await billingSystemsApi.test(s.id);
      const r = data.data;
      if (r.ok) toast.success(`${s.code} answered ${r.httpStatus}`, `${r.durationMs} ms. The signed test event arrived.`);
      else toast.error(`${s.code} did not accept the test event`, r.httpStatus ? `It answered ${r.httpStatus}` : (r.error ?? 'No answer'));
    } catch (err) {
      toast.error('Test not sent', gepgErrorMessage(err));
    } finally {
      setTesting(null);
      load();
    }
  };

  const replayDead = async (s: BillingSystem) => {
    try {
      const { data } = await billingSystemsApi.replayDead(s.id);
      toast.success(data.message ?? 'Queued');
      load();
    } catch (err) {
      toast.error('Could not queue them', gepgErrorMessage(err));
    }
  };

  const loadGfs = (s: BillingSystem) =>
    billingSystemsApi.gfsCodes(s.id).then((res) => setGfs(res.data.data)).catch((err) => toast.error('Could not load the GFS codes', gepgErrorMessage(err)));

  const openGfs = (s: BillingSystem) => {
    setGfsFor(s);
    setGfs(null);
    setPicked(new Set());
    setGfsSearch('');
    loadGfs(s);
  };

  const togglePick = (id: number) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const linkPicked = async () => {
    if (!gfsFor || !gfs || picked.size === 0) return;
    // a code belongs to one system, so taking one from another system needs a yes
    const moving = gfs.available.filter((c) => picked.has(c.id) && c.billing_system_id);
    if (moving.length > 0 && !window.confirm(`${moving.map((c) => `${c.code} (now ${c.billing_system_code})`).join(', ')} will be taken away from the system that has it now. Continue?`)) return;
    try {
      const { data } = await billingSystemsApi.linkGfsCodes(gfsFor.id, [...picked]);
      toast.success(`${data.data.linked} GFS code(s) linked to ${gfsFor.code}`);
      setPicked(new Set());
      loadGfs(gfsFor);
      load();
    } catch (err) {
      toast.error('Could not link them', gepgErrorMessage(err));
    }
  };

  const unlinkGfs = async (codeId: number, codeText: string) => {
    if (!gfsFor) return;
    if (!window.confirm(`Unlink ${codeText} from ${gfsFor.code}? ${gfsFor.code} can no longer bill with it; bills already made are not changed.`)) return;
    try {
      await billingSystemsApi.unlinkGfsCode(gfsFor.id, codeId);
      toast.success(`${codeText} unlinked`);
      loadGfs(gfsFor);
      load();
    } catch (err) {
      toast.error('Could not unlink it', gepgErrorMessage(err));
    }
  };

  const openKeys = (s: BillingSystem) => {
    setKeysFor(s);
    setKeys([]);
    setNewKeyName('');
    billingSystemsApi.keys(s.id).then((res) => setKeys(res.data.data));
  };

  const createKey = async () => {
    if (!keysFor || !newKeyName.trim()) return;
    try {
      const { data } = await apiKeysApi.create(newKeyName.trim(), keysFor.id);
      setNewKey(data.data.key);
      setNewKeyName('');
      billingSystemsApi.keys(keysFor.id).then((res) => setKeys(res.data.data));
      load();
    } catch (err) {
      toast.error('Could not create the key', gepgErrorMessage(err));
    }
  };

  return (
    <div>
      <PageMeta title="Billing Systems | Tanzania Police Force Corporation Sole" description="Billing systems that send bills through the bridge" />
      <PageBreadcrumb pageTitle="Billing Systems" />

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
          <div className="max-w-3xl">
            <h3 className="text-base font-medium text-gray-800 dark:text-white/90">Billing systems</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              A billing system is an application that sends its bills to GePG through this bridge. When GePG answers or a payment arrives, the bridge sends an event to the
              system's callback URL and keeps it in the <Link to="/outbox" className="text-brand-600 hover:underline dark:text-brand-400">Outbox</Link>. A system without a
              callback URL collects its events itself from the events feed.
            </p>
          </div>
          <Button onClick={openNew}>+ Add billing system</Button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-100 dark:bg-white/[0.05]">
                <th className={th}>Code</th>
                <th className={th}>Name</th>
                <th className={th}>Status</th>
                <th className={th}>Delivery</th>
                <th className={th}>Keys</th>
                <th className={th}>GFS codes</th>
                <th className={th}>Bills</th>
                <th className={th}>Queue</th>
                <th className={th}>Last delivered</th>
                <th className={th}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading && (
                <tr>
                  <td colSpan={10} className="px-4 py-4 text-center text-sm text-gray-400">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && systems.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-sm text-gray-400">
                    No billing systems yet. Add one, then create an API key for it.
                  </td>
                </tr>
              )}
              {systems.map((s) => (
                <tr key={s.id} className="odd:bg-white even:bg-gray-50 dark:odd:bg-transparent dark:even:bg-white/[0.03]">
                  <td className="px-3 py-2 text-sm font-semibold text-gray-800 dark:text-white/90">{s.code}</td>
                  <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                    {s.name}
                    {s.contact && <span className="block text-xs text-gray-400">{s.contact}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <Badge size="sm" color={s.status === 'ACTIVE' ? 'success' : 'error'}>
                      {s.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                    {s.callback_url ? (
                      <span className="break-all" title={`Retries for ${windowLabel(s.retry_window_hours, defaultWindow)}`}>
                        {s.callback_url}
                      </span>
                    ) : (
                      <Badge size="sm" color="light">
                        Pull only
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                    {s.active_keys === 0 ? (
                      <Badge size="sm" color="warning">
                        None
                      </Badge>
                    ) : (
                      s.active_keys
                    )}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                    {s.gfs_code_count === 0 ? (
                      <Badge size="sm" color="warning">None: cannot bill</Badge>
                    ) : (
                      s.gfs_code_count
                    )}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">{s.bill_count}</td>
                  <td className="px-3 py-2 text-sm">
                    <Link to={`/outbox?systemId=${s.id}`} className="hover:underline">
                      {s.pending_events > 0 && <Badge size="sm" color="warning">{s.pending_events} waiting</Badge>}{' '}
                      {s.dead_events > 0 && <Badge size="sm" color="error">{s.dead_events} failed</Badge>}
                      {s.pending_events === 0 && s.dead_events === 0 && <span className="text-gray-400">clear</span>}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">
                    {s.last_delivered_at ? new Date(s.last_delivered_at).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-brand-600 dark:text-brand-400">
                      <button onClick={() => openEdit(s)} className="hover:underline">Edit</button>
                      <button onClick={() => openKeys(s)} className="hover:underline">Keys</button>
                      <button onClick={() => openGfs(s)} className="hover:underline">GFS codes</button>
                      <button onClick={() => sendTest(s)} disabled={!s.callback_url || testing === s.id} className="hover:underline disabled:text-gray-300 disabled:no-underline" title={s.callback_url ? 'Send a signed test event now' : 'Set a callback URL first'}>
                        {testing === s.id ? 'Sending…' : 'Test'}
                      </button>
                      {s.dead_events > 0 && s.callback_url && (
                        <button onClick={() => replayDead(s)} className="hover:underline">Retry failed</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {FEATURES.developer && (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          Setting up a system? Share the endpoints, delivery details and sample requests from{' '}
          <Link to="/developer?tab=delivery" className="text-brand-600 hover:underline dark:text-brand-400">Developer</Link>.
        </p>
      )}

      <Modal isOpen={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add billing system' : `Edit ${editing ? editing.code : ''}`} size="lg">
        <div className="space-y-4">
          {editing === 'new' && (
            <Field label="Code" help="2 to 12 capital letters and digits. It goes in front of every bill id sent to GePG (ICDV-INV-1001), so two systems can use the same invoice numbers. It cannot be changed later." error={errors.code}>
              <Input size="md" value={form.code ?? ''} placeholder="ICDV" error={!!errors.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} />
            </Field>
          )}
          <Field label="Name" help="What people call this system." error={errors.name}>
            <Input size="md" value={form.name} placeholder="ICDV Management" error={!!errors.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="Description" help="Optional.">
            <Input size="md" value={form.description ?? ''} onChange={(e) => set({ description: e.target.value })} />
          </Field>
          <Field label="Contact" help="Who to call when deliveries to it fail. Optional.">
            <Input size="md" value={form.contact ?? ''} placeholder="Name, email or phone" onChange={(e) => set({ contact: e.target.value })} />
          </Field>
          <Field label="Callback URL" help="Where the bridge sends events, http or https. Leave empty if the system will fetch its events from the events feed instead." error={errors.callbackUrl}>
            <Input size="md" value={form.callbackUrl ?? ''} placeholder="https://billing.example.com/gepg/events" error={!!errors.callbackUrl} onChange={(e) => set({ callbackUrl: e.target.value })} />
          </Field>
          <Field label="Retry window" help="How long the bridge keeps trying to deliver an event that is not accepted. After that it is marked failed and can be retried by hand." error={errors.retryWindowHours}>
            <select className={selectClass} value={form.retryWindowHours} onChange={(e) => set({ retryWindowHours: Number(e.target.value) })}>
              {windows.map((h) => (
                <option key={h} value={h}>{windowLabel(h, defaultWindow)}</option>
              ))}
            </select>
          </Field>
          {editing !== 'new' && (
            <>
              <Field label="Status" help="A disabled system's keys stop working and its deliveries wait until it is enabled again." error={errors.status}>
                <select className={selectClass} value={form.status} onChange={(e) => set({ status: e.target.value as 'ACTIVE' | 'DISABLED' })}>
                  <option value="ACTIVE">Active</option>
                  <option value="DISABLED">Disabled</option>
                </select>
              </Field>
              <div className="rounded-lg bg-gray-50 p-3 text-sm dark:bg-white/[0.04]">
                <p className="font-medium text-gray-800 dark:text-white/90">Signing secret</p>
                <p className="mb-2 text-gray-500 dark:text-gray-400">Used to sign every delivery. It is only shown when created. Make a new one if it is lost or exposed.</p>
                <Button type="button" size="sm" variant="outline" onClick={() => editing && rotate(editing)}>
                  Create a new signing secret
                </Button>
              </div>
            </>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="button" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!secret} onClose={() => setSecret(null)} title={secret?.title ?? ''} size="md">
        {secret && (
          <div className="space-y-4 text-sm">
            <p className="text-gray-600 dark:text-gray-300">Copy this now: it is not shown again. The billing system uses it to check that deliveries really come from the bridge.</p>
            <CopyBox value={secret.value} />
            {secret.code && <p className="text-gray-500 dark:text-gray-400">Next: create an API key for {secret.code} (Keys) so it can send bills.</p>}
            <div className="flex justify-end">
              <Button type="button" onClick={() => setSecret(null)}>I have copied it</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!gfsFor} onClose={() => setGfsFor(null)} title={`GFS codes for ${gfsFor?.code ?? ''}`} size="lg">
        {gfsFor && (
          <div className="space-y-5 text-sm">
            <p className="text-gray-500 dark:text-gray-400">
              {gfsFor.name} can only bill with the GFS codes linked here; a bill using any other code is refused. A code belongs to one billing system, so two systems can never mix up each other's revenue.
            </p>

            <div>
              <p className="mb-2 font-medium text-gray-800 dark:text-white/90">Linked to {gfsFor.code}</p>
              {!gfs && <p className="text-gray-400">Loading…</p>}
              {gfs && gfs.linked.length === 0 && (
                <p className="rounded-lg bg-warning-50 p-3 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400">None yet, so {gfsFor.code} cannot send any bill. Add codes below.</p>
              )}
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {gfs?.linked.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                    <span>
                      <code className="font-medium text-gray-800 dark:text-white/90">{c.code}</code>
                      <span className="ml-2 text-gray-500 dark:text-gray-400">{c.description || ''}</span>
                      {c.status !== 'ACTIVE' && <span className="ml-2"><Badge size="sm" color="error">Switched off</Badge></span>}
                    </span>
                    <button onClick={() => unlinkGfs(c.id, c.code)} className="text-gray-500 hover:text-error-500 dark:text-gray-400">Unlink</button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mb-2 font-medium text-gray-800 dark:text-white/90">Add codes</p>
              <Input size="md" value={gfsSearch} placeholder="Search by code or description" onChange={(e) => setGfsSearch(e.target.value)} />
              <ul className="mt-2 max-h-64 divide-y divide-gray-100 overflow-auto rounded-lg border border-gray-100 dark:divide-gray-800 dark:border-gray-800">
                {gfs && gfs.available.length === 0 && <li className="p-3 text-gray-400">Every GFS code is already linked here. New codes are added on the GFS Codes page.</li>}
                {gfs?.available
                  .filter((c) => `${c.code} ${c.description ?? ''}`.toLowerCase().includes(gfsSearch.trim().toLowerCase()))
                  .map((c) => (
                    <li key={c.id}>
                      <label className="flex cursor-pointer items-center gap-3 p-2.5 hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                        <input type="checkbox" checked={picked.has(c.id)} onChange={() => togglePick(c.id)} className="h-4 w-4 rounded border-gray-300" />
                        <span className="flex-1">
                          <code className="font-medium text-gray-800 dark:text-white/90">{c.code}</code>
                          <span className="ml-2 text-gray-500 dark:text-gray-400">{c.description || ''}</span>
                        </span>
                        {c.billing_system_code ? (
                          <Badge size="sm" color="warning">now {c.billing_system_code}: will move</Badge>
                        ) : (
                          <Badge size="sm" color="light">not linked</Badge>
                        )}
                      </label>
                    </li>
                  ))}
              </ul>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">{picked.size} selected</span>
                <Button type="button" onClick={linkPicked} disabled={picked.size === 0}>Link selected to {gfsFor.code}</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!keysFor} onClose={() => { setKeysFor(null); setNewKey(null); }} title={`API keys for ${keysFor?.code ?? ''}`} size="lg">
        {keysFor && (
          <div className="space-y-4 text-sm">
            <p className="text-gray-500 dark:text-gray-400">A key lets {keysFor.name} call the bridge. It only works for this system and only sees this system's bills.</p>
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {keys.length === 0 && <li className="py-2 text-gray-400">No keys yet</li>}
              {keys.map((k) => (
                <li key={k.id} className="flex items-center justify-between py-2">
                  <span><span className="font-medium text-gray-800 dark:text-white/90">{k.name}</span> <code className="text-xs text-gray-500">{k.key_prefix}</code></span>
                  <span className="text-xs text-gray-500">{k.status} · last used {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : 'never'}</span>
                </li>
              ))}
            </ul>
            {newKey && (
              <div>
                <p className="mb-1 font-medium text-gray-800 dark:text-white/90">New key: copy it now, it is not shown again</p>
                <CopyBox value={newKey} />
              </div>
            )}
            <div className="flex gap-2">
              <Input size="md" value={newKeyName} placeholder="Key name, e.g. Production server" onChange={(e) => setNewKeyName(e.target.value)} />
              <Button type="button" onClick={createKey} disabled={!newKeyName.trim()}>Create key</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
