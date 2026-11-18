// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Developer page: the API and delivery documentation to share with billing systems
// └──────────────────────────────────────────────────────────────────────────┘

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import Badge from '../../components/ui/badge/Badge';
import Button from '../../components/ui/button/Button';
import { toast } from '../../components/tpfcs/Toast';
import { developerApi } from '../../api/developer';
import { gepgErrorMessage } from '../../utils/gepgError';
import type { DeveloperData, DocEndpoint, DocGroup } from '../../types/gepg';

const TABS = [
  { id: 'start', label: 'Getting started' },
  { id: 'auth', label: 'Authentication' },
  { id: 'bills', label: 'Bills' },
  { id: 'payments', label: 'Payments and events feed' },
  { id: 'delivery', label: 'Delivery (webhooks)' },
  { id: 'errors', label: 'Errors' },
  { id: 'downloads', label: 'Downloads' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const th = 'px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-gray-300';
const card = 'rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]';
const selectClass =
  'h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90';

const METHOD_COLOR: Record<string, 'info' | 'success' | 'warning'> = { GET: 'info', POST: 'success' };

function CodeBlock({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      {label && <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>}
      <pre className="max-h-96 overflow-auto rounded-lg bg-gray-50 p-3 pr-16 text-xs leading-relaxed text-gray-800 dark:bg-white/[0.04] dark:text-gray-200">{text}</pre>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className={`absolute right-2 ${label ? 'top-7' : 'top-2'} rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300`}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: Array<Array<React.ReactNode>> }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-100 dark:bg-white/[0.05]">
            {head.map((h) => (
              <th key={h} className={th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2 align-top text-gray-700 dark:text-gray-300">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const mono = (text: string) => <code className="text-xs text-gray-800 dark:text-white/90">{text}</code>;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={card}>
      <h3 className="mb-3 text-base font-medium text-gray-800 dark:text-white/90">{title}</h3>
      <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">{children}</div>
    </section>
  );
}

function EndpointCard({ ep }: { ep: DocEndpoint }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full flex-wrap items-center gap-3 p-3 text-left">
        <Badge size="sm" color={METHOD_COLOR[ep.method] ?? 'warning'}>{ep.method}</Badge>
        <code className="text-sm text-gray-800 dark:text-white/90">{ep.path}</code>
        <span className="text-sm text-gray-500 dark:text-gray-400">{ep.title}</span>
        <span className="ml-auto text-xs text-gray-400">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-gray-100 p-4 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-300">
          <p>{ep.summary}</p>
          {ep.notes?.map((n) => (
            <p key={n} className="rounded-lg bg-warning-50 p-3 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400">{n}</p>
          ))}

          <div>
            <p className="mb-1 text-xs font-medium text-gray-500">Header on every call</p>
            <div>{mono('X-Api-Key: YOUR_API_KEY')}</div>
            {ep.body && <div>{mono('Content-Type: application/json')}</div>}
          </div>

          {ep.params && ep.params.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-gray-500">Parameters</p>
              <Table
                head={['Name', 'In', 'Required', 'Description', 'Example']}
                rows={ep.params.map((p) => [mono(p.name), p.in, p.required ? 'yes' : 'no', p.description, mono(p.example)])}
              />
            </div>
          )}

          {ep.body && (
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-xs font-medium text-gray-500">Request body (JSON)</p>
                <Table
                  head={['Field', 'Type', 'Required', 'Description']}
                  rows={ep.body.fields.map((f) => [mono(f.name), f.type, f.required ? 'yes' : 'no', f.description])}
                />
              </div>
              <CodeBlock label="Example body" text={JSON.stringify(ep.body.example, null, 2)} />
            </div>
          )}

          <CodeBlock label="Request with curl" text={ep.curl} />

          <div className="space-y-3">
            <p className="text-xs font-medium text-gray-500">Responses</p>
            {ep.responses.map((r, i) => (
              <div key={i}>
                <p className="mb-1 flex items-center gap-2">
                  <Badge size="sm" color={r.status < 300 ? 'success' : 'error'}>{r.status}</Badge>
                  <span>{r.title}</span>
                </p>
                <CodeBlock text={JSON.stringify(r.body, null, 2)} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Groups({ groups }: { groups: DocGroup[] }) {
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section key={g.id} className={card}>
          <h3 className="text-base font-medium text-gray-800 dark:text-white/90">{g.title}</h3>
          <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">{g.description}</p>
          <div className="space-y-2">
            {g.endpoints.map((ep) => (
              <EndpointCard key={ep.id} ep={ep} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

const LANGS: Array<[string, string]> = [['node', 'Node.js'], ['php', 'PHP'], ['python', 'Python']];

function LanguageTabs({ samples }: { samples: Record<string, string> }) {
  const [lang, setLang] = useState('node');
  return (
    <div>
      <div className="mb-2 flex gap-2">
        {LANGS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setLang(id)}
            className={`rounded-md px-3 py-1 text-xs ${lang === id ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-300'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <CodeBlock text={samples[lang]} />
    </div>
  );
}

export default function DeveloperPage() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'start') as TabId;
  const systemId = params.get('systemId') ?? '';

  const [data, setData] = useState<DeveloperData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState('');

  useEffect(() => {
    setLoading(true);
    developerApi
      .docs(systemId || undefined)
      .then((res) => setData(res.data.data))
      .catch((err) => toast.error('Failed to load the documentation', gepgErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [systemId]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  const download = async (id: string, name: string) => {
    setDownloading(id);
    try {
      await developerApi.download(id, name, systemId || undefined);
    } catch (err) {
      toast.error('Download failed', gepgErrorMessage(err));
    } finally {
      setDownloading('');
    }
  };

  if (loading && !data) return <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>;
  if (!data) return <p className="text-sm text-error-500">The documentation could not be loaded</p>;

  const { docs } = data;
  const group = (id: string) => docs.groups.filter((g) => g.id === id);
  const d = docs.delivery;

  return (
    <div>
      <PageMeta title="Developer | Tanzania Police Force Corporation Sole" description="API and delivery documentation for billing systems" />
      <PageBreadcrumb pageTitle="Developer" />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-gray-500 dark:text-gray-400">
          Everything a billing system's team needs to connect. Pick a system to fill in its code and callback URL, then share the pages or the files under Downloads.
        </p>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          Written for
          <select className={selectClass} value={systemId} onChange={(e) => setParam('systemId', e.target.value)}>
            <option value="">Any billing system (examples)</option>
            {data.systems.map((s) => (
              <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setParam('tab', t.id === 'start' ? '' : t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t.id ? 'border-brand-500 font-medium text-brand-600 dark:text-brand-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {tab === 'start' && (
          <>
            <Section title="How it fits together">
              <p>
                The bridge sits between a billing system and GePG. The system sends bills to the bridge; the bridge sends them to GePG, and tells the system when GePG answers and when a payment arrives.
              </p>
              <pre className="rounded-lg bg-gray-50 p-3 text-xs text-gray-800 dark:bg-white/[0.04] dark:text-gray-200">{`billing system --bill--------> bridge --signed bill--> GePG
billing system <--events------ bridge <--payment------- GePG
billing system --"is it paid?"--> bridge`}</pre>
              <p>Base URL: {mono(docs.baseUrl)}{docs.system && <> · written for <strong>{docs.system.name}</strong> ({mono(docs.system.code)})</>}</p>
            </Section>
            <Section title="Getting started">
              <ol className="list-decimal space-y-2 pl-5">
                {docs.gettingStarted.map((s) => (
                  <li key={s.title}><span className="font-medium text-gray-800 dark:text-white/90">{s.title}.</span> {s.text}</li>
                ))}
              </ol>
            </Section>
            <Groups groups={group('start')} />
          </>
        )}

        {tab === 'auth' && (
          <Section title="Authentication">
            <p>{docs.authentication.text}</p>
            <CodeBlock text={`${docs.authentication.header}: YOUR_API_KEY`} />
            <ul className="list-disc space-y-1 pl-5">
              {docs.authentication.rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p>An admin creates keys on the Billing Systems page (Keys). A key is shown once, so it has to be copied when it is made.</p>
          </Section>
        )}

        {tab === 'bills' && <Groups groups={group('bills')} />}

        {tab === 'payments' && <Groups groups={[...group('payments'), ...group('events')]} />}

        {tab === 'delivery' && (
          <>
            <Section title="How deliveries work">
              <p>{d.summary}</p>
              <ul className="list-disc space-y-1 pl-5">
                {d.rules.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <p>Your callback URL: {mono(d.callbackUrl)}</p>
            </Section>

            <Section title="What the bridge sends">
              <Table head={['Header', 'Meaning', 'Example']} rows={d.headers.map((h) => [mono(h.name), h.description, <span className="break-all">{mono(h.example)}</span>])} />
              <CodeBlock label="Sample request (the body is exactly what is signed)" text={d.sampleRequest.text} />
              <CodeBlock label="The same body, formatted" text={d.sampleRequest.bodyPretty} />
            </Section>

            <Section title="What your system answers">
              <p>Any status from 200 to 299 confirms the delivery. The body of your answer is ignored.</p>
              <div className="grid gap-3 lg:grid-cols-2">
                {d.sampleResponses.map((r) => (
                  <div key={r.status} className="space-y-1">
                    <p className="flex items-center gap-2">
                      <Badge size="sm" color={r.status < 300 ? 'success' : 'error'}>{r.status}</Badge>
                      <span className="font-medium text-gray-800 dark:text-white/90">{r.title}</span>
                    </p>
                    <CodeBlock text={r.text} />
                    <p className="text-xs text-gray-500 dark:text-gray-400">{r.result}</p>
                  </div>
                ))}
              </div>
              <p className="font-medium text-gray-800 dark:text-white/90">Counted as a failure (the bridge tries again later):</p>
              <ul className="list-disc space-y-1 pl-5">
                {d.failures.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </Section>

            <Section title="Check the signature">
              <ol className="list-decimal space-y-1 pl-5">
                {d.verify.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <p className="font-medium text-gray-800 dark:text-white/90">Checking a delivery</p>
              <LanguageTabs samples={d.verify.samples} />
              <p className="font-medium text-gray-800 dark:text-white/90">A minimal receiving endpoint</p>
              <LanguageTabs samples={d.verify.receiverSamples} />
            </Section>

            <Section title="Test your signature code">
              <p>{d.testVector.description}</p>
              <Table
                head={['Item', 'Value']}
                rows={[
                  ['Signing secret (example only)', <span className="break-all">{mono(d.testVector.secret)}</span>],
                  ['Timestamp (t)', mono(String(d.testVector.timestamp))],
                  ['Text that is signed', 'the timestamp, a dot, then the body below'],
                  ['Expected signature (v1)', <span className="break-all">{mono(d.testVector.signature)}</span>],
                ]}
              />
              <CodeBlock label="Body" text={d.testVector.body} />
              <CodeBlock label="Header" text={`X-Bridge-Signature: ${d.testVector.header}`} />
              <p>The same values are in the file GePG_Bridge_Webhook_Test.json under Downloads.</p>
            </Section>

            <Section title="Retries">
              <p>{d.retries.text}</p>
              <p>After each failed try the bridge waits: {d.retries.scheduleText}.</p>
              <Table
                head={['Retry window', 'Notes']}
                rows={d.retries.windows.map((w) => [w.text, w.default ? 'Default. An admin can change it for each billing system.' : ''])}
              />
            </Section>

            <Section title="The events">
              <p>Each event has the same outer shape: an id, a type, createdAt, the bill, and details that depend on the type.</p>
              <div className="space-y-3">
                {docs.events.map((e) => (
                  <details key={e.type} className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                    <summary className="cursor-pointer">
                      <code className="text-sm font-medium text-gray-800 dark:text-white/90">{e.type}</code>
                      <span className="ml-2 text-gray-500 dark:text-gray-400">{e.when}</span>
                    </summary>
                    <div className="mt-3">
                      <CodeBlock text={e.sampleText} />
                    </div>
                  </details>
                ))}
              </div>
            </Section>
          </>
        )}

        {tab === 'errors' && (
          <>
            <Section title="Response statuses">
              <Table head={['Status', 'Meaning']} rows={docs.errors.http.map((e) => [mono(String(e.status)), e.meaning])} />
            </Section>
            <Section title="GePG codes">
              <p>{docs.errors.codesNote}</p>
              <Table head={['Code', 'Meaning']} rows={docs.errors.gepgCodes.map((c) => [mono(c.code), c.description])} />
            </Section>
          </>
        )}

        {tab === 'downloads' && (
          <Section title="Files to share">
            <p>
              {docs.system
                ? `These files are written for ${docs.system.name}: its code, its callback URL and this server's address are filled in.`
                : 'These files use example values. Pick a billing system above to fill in its code and callback URL.'}{' '}
              They never contain a real API key or signing secret.
            </p>
            <Table
              head={['File', 'What it is', '']}
              rows={[
                ['BILLING_SYSTEM_INTEGRATION.md', 'The full guide: endpoints, events, delivery, errors', 'markdown'],
                ['GePG_Bridge_Postman_Collection.json', 'Postman collection with saved responses and self-signing sample deliveries', 'postman'],
                ['GePG_Bridge_Insomnia.json', 'Insomnia workspace', 'insomnia'],
                ['GePG_Bridge_OpenAPI.json', 'OpenAPI 3.1 for Swagger, Redoc and code generators (events under webhooks)', 'openapi'],
                ['GePG_Bridge_Webhook_Test.json', 'Fixed secret, body and signature to test signature code against', 'webhook-test'],
              ].map(([name, what, id]) => [
                mono(name),
                what,
                <Button key={id} size="sm" variant="outline" disabled={downloading === id} onClick={() => download(id, name)}>
                  {downloading === id ? 'Preparing…' : 'Download'}
                </Button>,
              ])}
            />
          </Section>
        )}

        {tab === 'downloads' && (
          <Section title="For the GePG team">
            <p>
              GePG sends three kinds of message to the bridge: the answer to a bill, a payment notification, and the summary of a day's payments. These files give GePG the three
              addresses to call, a sample of each message, and exactly what the bridge answers. They are separate from the files above because they are for GePG, not for billing systems.
              The addresses use this server's address ({mono(docs.baseUrl)}); if GePG reaches the bridge by another address, replace it in the files.
            </p>
            <Table
              head={['File', 'What it is', '']}
              rows={[
                ['GePG_Callbacks_Guide.md', 'The call back URLs to register, the request format, signing, samples and the bridge\'s answers, and how to test with a key of your own', 'gepg-guide'],
                ['GePG_Callbacks_Postman_Collection.json', 'Postman: each sample message with the possible answers saved on it', 'gepg-postman'],
                ['GePG_Callbacks_Insomnia.json', 'Insomnia: the same samples', 'gepg-insomnia'],
              ].map(([name, what, id]) => [
                mono(name),
                what,
                <Button key={id} size="sm" variant="outline" disabled={downloading === id} onClick={() => download(id, name)}>
                  {downloading === id ? 'Preparing…' : 'Download'}
                </Button>,
              ])}
            />
          </Section>
        )}
      </div>
    </div>
  );
}
