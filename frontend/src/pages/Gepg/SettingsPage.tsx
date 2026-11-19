// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Settings page: service provider details, with the meaning of each
// └──────────────────────────────────────────────────────────────────────────┘

import { useEffect, useState } from 'react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import ComponentCard from '../../components/common/ComponentCard';
import Badge from '../../components/ui/badge/Badge';
import Button from '../../components/ui/button/Button';
import Label from '../../components/form/Label';
import Input from '../../components/form/input/InputField';
import Modal from '../../components/tpfcs/Modal';
import { toast } from '../../components/tpfcs/Toast';
import { ENVIRONMENT_CHANGED } from '../../components/gepg/EnvironmentBanner';
import { gepgSettingsApi } from '../../api/gepgSettings';
import { gepgErrorMessage } from '../../utils/gepgError';
import type { CertificateStatus, SettingField, SettingGroup, SettingSource, SettingsData } from '../../types/gepg';

const SOURCE_LABEL: Record<SettingSource, { text: string; color: 'success' | 'light' | 'warning' }> = {
  database: { text: 'Set here', color: 'success' },
  env: { text: 'From .env', color: 'light' },
  default: { text: 'Default', color: 'light' },
  unset: { text: 'Not set', color: 'warning' },
};

const CERT_COLOR: Record<CertificateStatus['status'], 'success' | 'warning' | 'error'> = {
  ok: 'success',
  expiring: 'warning',
  expired: 'error',
  missing: 'error',
  unreadable: 'error',
};

const TERMS: Array<[string, string]> = [
  ['SP', 'Service Provider: your institution, the one that issues bills and gets paid'],
  ['PSP', 'Payment Service Provider: the bank or mobile network the payer pays through'],
  ['GFS', 'Government Financial Statistics code: the revenue type of a bill item'],
  ['Control number', 'The number GePG gives each bill; the payer uses it to pay'],
  ['UAT', 'User Acceptance Testing: GePG\'s test system, as opposed to production'],
];

const CERT_HELP: Record<CertificateStatus['kind'], string> = {
  signing: 'Signs every message sent to GePG. Upload the .p12 / .pfx file and its password, or generate a new one here and send its public part to GePG.',
  'gepg-public': 'Checks that messages really come from GePG. Upload the .pem, .cer, .crt or .pfx file GePG gave you (a password only if the file has one).',
};

const selectClass =
  'h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90';

interface FieldRowProps {
  field: SettingField;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

function FieldRow({ field, value, error, onChange }: FieldRowProps) {
  const source = SOURCE_LABEL[field.source];
  const canUseEnv = field.source === 'database' && value !== '';

  return (
    <div className="grid gap-1.5 border-b border-gray-100 py-4 last:border-b-0 dark:border-gray-800 lg:grid-cols-[1fr_1.4fr] lg:gap-6">
      <div>
        <Label>
          {field.label} <span className="font-normal text-gray-500 dark:text-gray-400">({field.abbr})</span>
        </Label>
        <p className="text-sm text-gray-500 dark:text-gray-400">{field.meaning}</p>
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
          Example: {field.example} · Provided by: {field.providedBy}
        </p>
        {field.critical && field.affects && (
          <p className="mt-1 text-xs text-warning-600 dark:text-warning-400">Affects {field.affects}</p>
        )}
      </div>

      <div>
        {field.input === 'select' ? (
          <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
            <option value="">(not set)</option>
            {field.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <Input
            size="md"
            value={value}
            placeholder={field.example}
            error={!!error}
            hint={error}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          <Badge size="sm" color={source.color}>
            {source.text}
          </Badge>
          {field.hint && !error && <span className="text-gray-400 dark:text-gray-500">{field.hint}</span>}
          {canUseEnv && field.envValue && (
            <button type="button" className="text-brand-600 hover:underline dark:text-brand-400" onClick={() => onChange('')}>
              Clear and use .env value
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [certificates, setCertificates] = useState<CertificateStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmGroup, setConfirmGroup] = useState<SettingGroup | null>(null);
  const [uploadFor, setUploadFor] = useState<CertificateStatus | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState('');
  const [certError, setCertError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [gen, setGen] = useState({ commonName: '', organization: '', country: 'TZ', years: '2' });
  const [genError, setGenError] = useState('');

  useEffect(() => {
    gepgSettingsApi
      .get()
      .then((res) => setData(res.data.data))
      .catch((err) => toast.error('Failed to load settings', gepgErrorMessage(err)))
      .finally(() => setLoading(false));
    gepgSettingsApi
      .status()
      .then((res) => setCertificates(res.data.data.certificates))
      .catch(() => setCertificates([]));
  }, []);

  const valueOf = (f: SettingField) => (f.key in edits ? edits[f.key] : f.value);
  const changed = (group: SettingGroup) => group.fields.filter((f) => f.key in edits && edits[f.key] !== f.value);

  const setEdit = (key: string, value: string) => {
    setEdits((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const { [key]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const save = async (group: SettingGroup) => {
    const fields = changed(group);
    setSaving(true);
    try {
      const res = await gepgSettingsApi.update(Object.fromEntries(fields.map((f) => [f.key, edits[f.key]])));
      setData((prev) => (prev ? { ...prev, groups: res.data.data.groups } : prev));
      setEdits((prev) => {
        const next = { ...prev };
        fields.forEach((f) => delete next[f.key]);
        return next;
      });
      toast.success('Settings saved', group.title);
      if (fields.some((f) => f.key === 'gepg_environment')) window.dispatchEvent(new Event(ENVIRONMENT_CHANGED));
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, ...(err?.response?.data?.errors ?? {}) }));
      toast.error('Not saved', gepgErrorMessage(err));
    } finally {
      setSaving(false);
      setConfirmGroup(null);
    }
  };

  // codes GePG checks against its own records need a second look before saving
  const onSave = (group: SettingGroup) => {
    if (changed(group).some((f) => f.critical)) setConfirmGroup(group);
    else save(group);
  };

  const closeUpload = () => {
    setUploadFor(null);
    setFile(null);
    setCertPassword('');
    setCertError('');
  };

  const readAsBase64 = (f: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
      reader.onerror = () => reject(new Error('Could not read the file'));
      reader.readAsDataURL(f);
    });

  const uploadCertificate = async () => {
    if (!uploadFor || !file) return;
    setUploading(true);
    setCertError('');
    try {
      const res = await gepgSettingsApi.uploadCertificate(uploadFor.kind, {
        fileName: file.name,
        data: await readAsBase64(file),
        password: certPassword,
      });
      setCertificates(res.data.data.certificates);
      toast.success('Certificate saved', uploadFor.label);
      closeUpload();
    } catch (err) {
      setCertError(gepgErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const openGenerate = () => {
    setGen((g) => ({ ...g, commonName: g.commonName || (data?.groups.flatMap((x) => x.fields).find((f) => f.key === 'gepg_sp_name')?.value ?? '') }));
    setGenError('');
    setGenerateOpen(true);
  };

  const generateCertificate = async () => {
    const current = certificates.find((c) => c.kind === 'signing');
    if (current?.source === 'uploaded' && !window.confirm('This replaces the signing certificate that is uploaded now. GePG must then be given the new public certificate, or it will reject your requests. Continue?')) return;
    setGenerating(true);
    setGenError('');
    try {
      const res = await gepgSettingsApi.generateCertificate({
        commonName: gen.commonName,
        organization: gen.organization || undefined,
        country: gen.country || undefined,
        years: Number(gen.years),
      });
      setCertificates(res.data.data.certificates);
      toast.success('Certificate generated', 'Download its public part and send it to GePG');
      setGenerateOpen(false);
    } catch (err) {
      setGenError(gepgErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  };

  const downloadPublic = async (format: 'cer' | 'pem') => {
    try {
      const { name, pem, der } = (await gepgSettingsApi.signingPublicCertificate()).data.data;
      const blob =
        format === 'pem'
          ? new Blob([pem], { type: 'application/x-pem-file' })
          : new Blob([Uint8Array.from(atob(der), (ch) => ch.charCodeAt(0))], { type: 'application/pkix-cert' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${name}-public.${format}`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      toast.error('Nothing to download', gepgErrorMessage(err));
    }
  };

  const removeCertificate = async (cert: CertificateStatus) => {
    if (!window.confirm(`Remove the uploaded certificate (${cert.label})? The value in .env (if any) is used again.`)) return;
    try {
      const res = await gepgSettingsApi.removeCertificate(cert.kind);
      setCertificates(res.data.data.certificates);
      toast.success('Removed', cert.label);
    } catch (err) {
      toast.error('Could not remove it', gepgErrorMessage(err));
    }
  };

  if (loading) return <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>;
  if (!data) return <p className="text-sm text-error-500">Settings could not be loaded</p>;

  const environment = data.groups.flatMap((g) => g.fields).find((f) => f.key === 'gepg_environment');

  return (
    <div>
      <PageMeta title="Settings | Tanzania Police Force Corporation Sole" description="Service provider settings" />
      <PageBreadcrumb pageTitle="Settings" />

      <div className="space-y-4">
        <ComponentCard title="Terms used on this page">
          <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            {TERMS.map(([term, meaning]) => (
              <div key={term}>
                <dt className="inline font-semibold text-gray-800 dark:text-white/90">{term}</dt>
                <dd className="inline text-gray-500 dark:text-gray-400"> — {meaning}</dd>
              </div>
            ))}
          </dl>
          {environment?.value && (
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              This installation is set to <span className="font-semibold">{environment.value}</span>.
            </p>
          )}
        </ComponentCard>

        {data.groups.map((group) => {
          const dirty = changed(group).length > 0;
          return (
            <ComponentCard key={group.id} title={group.title} desc={group.description}>
              <div>
                {group.fields.map((field) => (
                  <FieldRow key={field.key} field={field} value={valueOf(field)} error={errors[field.key]} onChange={(v) => setEdit(field.key, v)} />
                ))}
              </div>
              <div className="mt-2 flex justify-end gap-2">
                {dirty && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setEdits((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !group.fields.some((f) => f.key === k))))}>
                    Discard
                  </Button>
                )}
                <Button type="button" size="sm" disabled={!dirty || saving} onClick={() => onSave(group)}>
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            </ComponentCard>
          );
        })}

        <ComponentCard title="Certificates" desc="Upload the files here. Each file is checked when you upload it. Only the password is kept encrypted; the file is never shown again.">
          <div className="space-y-4">
            {certificates.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">Status unavailable.</p>}
            {certificates.map((cert) => (
              <div key={cert.kind} className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-4 text-sm last:border-b-0 last:pb-0 dark:border-gray-800">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-gray-800 dark:text-white/90">{cert.label}</p>
                    <Badge size="sm" color={CERT_COLOR[cert.status]}>
                      {cert.status}
                    </Badge>
                    <Badge size="sm" color={cert.source === 'uploaded' ? 'success' : 'light'}>
                      {cert.source === 'uploaded' ? 'Uploaded' : 'From .env'}
                    </Badge>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400">{cert.message}</p>
                  <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                    {CERT_HELP[cert.kind]}
                    {cert.file ? ` · File: ${cert.file}` : ''}
                    {cert.subject ? ` · Name: ${cert.subject}` : ''}
                    {cert.uploadedAt ? ` · Uploaded ${new Date(cert.uploadedAt).toLocaleString()}` : ''}
                  </p>
                  {cert.fingerprint && <p className="mt-0.5 break-all font-mono text-[11px] text-gray-400 dark:text-gray-500">SHA-256 {cert.fingerprint}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {cert.kind === 'signing' && (
                    <Button type="button" size="sm" variant="outline" onClick={openGenerate}>
                      Generate
                    </Button>
                  )}
                  <Button type="button" size="sm" variant="outline" onClick={() => setUploadFor(cert)}>
                    {cert.source === 'uploaded' ? 'Replace' : 'Upload'}
                  </Button>
                  {cert.kind === 'signing' && cert.source === 'uploaded' && (
                    <>
                      <Button type="button" size="sm" variant="outline" onClick={() => downloadPublic('cer')}>
                        Public .cer
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => downloadPublic('pem')}>
                        Public .pem
                      </Button>
                    </>
                  )}
                  {cert.source === 'uploaded' && (
                    <Button type="button" size="sm" variant="outline" onClick={() => removeCertificate(cert)}>
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ComponentCard>

        <ComponentCard title="Kept on the server (.env)" desc="Secrets and server settings. They are never shown here and cannot be changed from this page.">
          <ul className="space-y-2 text-sm">
            {data.envOnly.map((item) => (
              <li key={item.name}>
                <span className="font-mono text-xs text-gray-800 dark:text-white/90">{item.name}</span>
                <span className="text-gray-500 dark:text-gray-400"> — {item.meaning}</span>
              </li>
            ))}
          </ul>
        </ComponentCard>
      </div>

      <Modal isOpen={generateOpen} onClose={() => setGenerateOpen(false)} title="Generate a signing certificate" size="md">
        <div className="space-y-4 text-sm">
          <p className="text-gray-600 dark:text-gray-300">
            The bridge makes a new key pair and a self-signed certificate. The private key stays on the server and cannot be downloaded. Afterwards download the public certificate and send it to GePG.
          </p>
          <div>
            <Label>Name (CN)</Label>
            <Input value={gen.commonName} onChange={(e) => setGen({ ...gen, commonName: e.target.value })} placeholder="e.g. TPFCS GePG Bridge" />
          </div>
          <div>
            <Label>Organization (optional)</Label>
            <Input value={gen.organization} onChange={(e) => setGen({ ...gen, organization: e.target.value })} placeholder="e.g. Tanzania Police Force Corporation Sole" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Country (2 letters)</Label>
              <Input value={gen.country} onChange={(e) => setGen({ ...gen, country: e.target.value })} placeholder="TZ" />
            </div>
            <div>
              <Label>Valid for (years)</Label>
              <Input value={gen.years} onChange={(e) => setGen({ ...gen, years: e.target.value })} placeholder="2" />
            </div>
          </div>
          {genError && <p className="rounded-lg bg-error-50 p-3 text-error-600 dark:bg-error-500/10 dark:text-error-500">{genError}</p>}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setGenerateOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={!gen.commonName.trim() || generating} onClick={generateCertificate}>
              {generating ? 'Generating…' : 'Generate'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!uploadFor} onClose={closeUpload} title={uploadFor ? `${uploadFor.source === 'uploaded' ? 'Replace' : 'Upload'}: ${uploadFor.label}` : ''} size="md">
        {uploadFor && (
          <div className="space-y-4 text-sm">
            <p className="text-gray-600 dark:text-gray-300">{CERT_HELP[uploadFor.kind]}</p>
            <div>
              <Label>File</Label>
              <input
                type="file"
                accept={uploadFor.kind === 'signing' ? '.p12,.pfx,.pem,.key' : '.pem,.cer,.crt,.pfx,.p12'}
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setCertError('');
                }}
                className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200 dark:text-gray-300 dark:file:bg-white/[0.06] dark:file:text-gray-200"
              />
            </div>
            <div>
              <Label>Password of the file</Label>
              <Input type="password" value={certPassword} onChange={(e) => setCertPassword(e.target.value)} placeholder="Leave empty if it has none" />
              <p className="mt-1 text-xs text-gray-400">{uploadFor.kind === 'signing' ? 'Kept encrypted on the server so the bridge can open the file. It is never shown again.' : 'Used once to open the file; it is not stored.'}</p>
            </div>
            {certError && <p className="rounded-lg bg-error-50 p-3 text-error-600 dark:bg-error-500/10 dark:text-error-500">{certError}</p>}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={closeUpload}>
                Cancel
              </Button>
              <Button type="button" disabled={!file || uploading} onClick={uploadCertificate}>
                {uploading ? 'Checking…' : 'Upload'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!confirmGroup} onClose={() => setConfirmGroup(null)} title="Confirm changes" size="md">
        {confirmGroup && (
          <div className="space-y-4 text-sm">
            <p className="text-gray-600 dark:text-gray-300">
              These values are checked by GePG against its own records. A wrong value makes GePG reject the requests that use it.
            </p>
            <ul className="space-y-2">
              {changed(confirmGroup).map((f) => (
                <li key={f.key} className="rounded-lg bg-gray-50 p-3 dark:bg-white/[0.04]">
                  <p className="font-medium text-gray-800 dark:text-white/90">{f.label}</p>
                  <p className="text-gray-500 dark:text-gray-400">
                    {f.value || '(empty)'} → <span className="font-semibold text-gray-800 dark:text-white/90">{edits[f.key] || '(use .env value)'}</span>
                  </p>
                  {f.critical && f.affects && <p className="text-xs text-warning-600 dark:text-warning-400">Affects {f.affects}</p>}
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setConfirmGroup(null)}>
                Cancel
              </Button>
              <Button type="button" disabled={saving} onClick={() => save(confirmGroup)}>
                {saving ? 'Saving…' : 'Confirm and save'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
