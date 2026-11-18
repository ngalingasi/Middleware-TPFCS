// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Docs generator: Markdown, OpenAPI, Postman and Insomnia from the one list
// └──────────────────────────────────────────────────────────────────────────┘

const { EXAMPLE_SECRET } = require('../utils/apiDocs');
const { buildCallbackDocs } = require('../utils/gepgCallbackDocs');

const json = (value) => JSON.stringify(value, null, 2);

function allEndpoints(docs) {
  return docs.groups.flatMap((g) => g.endpoints.map((e) => ({ ...e, groupTitle: g.title })));
}

// {billId} in a path becomes the example value
function examplePath(ep) {
  return ep.path.replace(/\{(\w+)\}/g, (_, name) => {
    const p = (ep.params || []).find((x) => x.name === name);
    return p ? p.example : name;
  });
}

function curlFor(ep, docs) {
  const query = (ep.params || []).filter((p) => p.in === 'query').slice(0, 2).map((p) => `${p.name}=${p.example}`).join('&');
  const lines = [`curl -X ${ep.method} '${docs.baseUrl}${examplePath(ep)}${query ? `?${query}` : ''}' \\`, "  -H 'X-Api-Key: YOUR_API_KEY'"];
  if (ep.body) {
    lines[1] += ' \\';
    lines.push("  -H 'Content-Type: application/json' \\", `  -d '${json(ep.body.example)}'`);
  }
  return lines.join('\n');
}

function code(text, lang = '') {
  return ['```' + lang, text, '```'].join('\n');
}

function table(headers, rows) {
  const clean = (v) => String(v === undefined || v === null ? '' : v).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  return [`| ${headers.join(' | ')} |`, `|${headers.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(clean).join(' | ')} |`)].join('\n');
}

// ---------------------------------------------------------------- Markdown

function toMarkdown(docs) {
  const d = docs.delivery;
  const out = [];
  out.push(`# ${docs.title}`, '');
  out.push('The bridge sits between your billing system and GePG. You send bills to the bridge; the bridge sends them to GePG, and tells you when GePG answers and when a payment arrives.', '');
  out.push(code('billing system --bill--------> bridge --signed bill--> GePG\nbilling system <--events------ bridge <--payment------- GePG\nbilling system --"is it paid?"--> bridge'), '');
  if (docs.system) out.push(`This copy is written for **${docs.system.name}** (system code \`${docs.system.code}\`).`, '');
  out.push(`Base URL: \`${docs.baseUrl}\``, '');

  out.push('## 1. Getting started', '');
  docs.gettingStarted.forEach((s, i) => out.push(`${i + 1}. **${s.title}.** ${s.text}`));
  out.push('');

  out.push('## 2. Authentication', '', docs.authentication.text, '');
  docs.authentication.rules.forEach((r) => out.push(`- ${r}`));
  out.push('');

  out.push('## 3. Endpoints', '');
  docs.groups.forEach((g) => {
    out.push(`### ${g.title}`, '', g.description, '');
    g.endpoints.forEach((ep) => {
      out.push(`#### ${ep.title}`, '', `\`${ep.method} ${ep.path}\``, '', ep.summary, '');
      (ep.notes || []).forEach((n) => out.push(`> ${n}`, ''));
      if (ep.params && ep.params.length) {
        out.push(table(['Parameter', 'In', 'Required', 'Description', 'Example'], ep.params.map((p) => [`\`${p.name}\``, p.in, p.required ? 'yes' : 'no', p.description, `\`${p.example}\``])), '');
      }
      if (ep.body) {
        out.push('Request body (JSON):', '');
        out.push(table(['Field', 'Type', 'Required', 'Description'], ep.body.fields.map((f) => [`\`${f.name}\``, f.type, f.required ? 'yes' : 'no', f.description])), '');
        out.push('Example:', '', code(json(ep.body.example), 'json'), '');
      }
      out.push('Request with curl:', '', code(curlFor(ep, docs), 'bash'), '');
      ep.responses.forEach((r) => out.push(`Response ${r.status}: ${r.title}`, '', code(json(r.body), 'json'), ''));
    });
  });

  out.push('## 4. Events', '', 'Your billing system is told what happens to its bills with these events. They are sent to your callback URL (section 5) and are also in the events feed (`GET /api/v1/events`).', '');
  out.push(table(['Event', 'When'], docs.events.filter((e) => e.type !== 'system.test').map((e) => [`\`${e.type}\``, e.when])), '');
  docs.events.forEach((e) => out.push(`#### ${e.type}`, '', code(e.sampleText, 'json'), ''));

  out.push('## 5. Receiving events (delivery)', '', d.summary, '', `Your callback URL: \`${d.callbackUrl}\``, '');
  out.push('### What the bridge sends', '', table(['Header', 'Meaning', 'Example'], d.headers.map((h) => [`\`${h.name}\``, h.description, `\`${h.example}\``])), '');
  out.push('Sample request (the body is exactly what is signed):', '', code(d.sampleRequest.text, 'http'), '');
  out.push('The same body, formatted:', '', code(d.sampleRequest.bodyPretty, 'json'), '');
  out.push('### What your system answers', '');
  d.sampleResponses.forEach((r) => out.push(`**${r.title}**`, '', code(r.text, 'http'), '', `${r.result}`, ''));
  out.push('Counted as a failure (the bridge tries again later):', '');
  d.failures.forEach((f) => out.push(`- ${f}`));
  out.push('');
  out.push('### Check the signature', '');
  d.verify.steps.forEach((s, i) => out.push(`${i + 1}. ${s}`));
  out.push('');
  Object.entries(d.verify.samples).forEach(([lang, text]) => out.push(`${lang[0].toUpperCase()}${lang.slice(1)}:`, '', code(text, lang === 'node' ? 'js' : lang), ''));
  out.push('A minimal receiving endpoint:', '');
  Object.entries(d.verify.receiverSamples).forEach(([lang, text]) => out.push(`${lang[0].toUpperCase()}${lang.slice(1)}:`, '', code(text, lang === 'node' ? 'js' : lang), ''));
  out.push('### Test your signature code', '', d.testVector.description, '');
  out.push(table(['Item', 'Value'], [['Signing secret', `\`${d.testVector.secret}\``], ['Timestamp (t)', `\`${d.testVector.timestamp}\``], ['Signed text', 'the timestamp, a dot, then the body below'], ['Expected signature (v1)', `\`${d.testVector.signature}\``], ['Header', `\`${d.testVector.header}\``]]), '');
  out.push('Body:', '', code(d.testVector.body, 'json'), '');
  out.push('### Retries', '', d.retries.text, '');
  out.push(`After each failed try the bridge waits: ${d.retries.scheduleText}.`, '');
  out.push(`Retry windows an admin can choose: ${d.retries.windows.map((w) => w.text + (w.default ? ' (default)' : '')).join(', ')}.`, '');
  d.rules.forEach((r) => out.push(`- ${r}`));
  out.push('');

  out.push('## 6. Errors', '', table(['Status', 'Meaning'], docs.errors.http.map((e) => [e.status, e.meaning])), '', docs.errors.codesNote, '');
  out.push(table(['GePG code', 'Meaning'], docs.errors.gepgCodes.map((c) => [`\`${c.code}\``, c.description])), '');
  return out.join('\n');
}

// ----------------------------------------------------------------- OpenAPI

function schemaOf(value) {
  if (Array.isArray(value)) return { type: 'array', items: value.length ? schemaOf(value[0]) : {} };
  if (value === null) return { type: ['string', 'null'] };
  if (typeof value === 'object') {
    return { type: 'object', properties: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, schemaOf(v)])) };
  }
  if (typeof value === 'number') return { type: Number.isInteger(value) ? 'integer' : 'number' };
  return { type: typeof value };
}

function toOpenApi(docs) {
  const paths = {};
  allEndpoints(docs).forEach((ep) => {
    const op = {
      operationId: ep.id,
      tags: [ep.groupTitle],
      summary: ep.title,
      description: [ep.summary, ...(ep.notes || [])].join('\n\n'),
      parameters: (ep.params || []).map((p) => ({
        name: p.name, in: p.in, required: p.in === 'path' ? true : !!p.required, description: p.description,
        schema: { type: 'string' }, example: p.example
      })),
      responses: {}
    };
    if (ep.body) {
      const topLevel = ep.body.fields.filter((f) => !f.name.includes('.') && !f.name.includes(','));
      const schema = schemaOf(ep.body.example);
      schema.required = topLevel.filter((f) => f.required).map((f) => f.name);
      op.requestBody = { required: true, description: ep.body.description, content: { 'application/json': { schema, example: ep.body.example } } };
    }
    ep.responses.forEach((r) => {
      const key = String(r.status);
      op.responses[key] = op.responses[key] || { description: r.title, content: { 'application/json': { schema: schemaOf(r.body), example: r.body } } };
    });
    const path = ep.path;
    paths[path] = paths[path] || {};
    paths[path][ep.method.toLowerCase()] = op;
  });

  const webhooks = {};
  docs.events.forEach((e) => {
    webhooks[e.type] = {
      post: {
        summary: e.type, description: e.when,
        parameters: docs.delivery.headers.filter((h) => h.name.startsWith('X-Bridge')).map((h) => ({ name: h.name, in: 'header', required: true, description: h.description, schema: { type: 'string' }, example: h.example })),
        requestBody: { required: true, content: { 'application/json': { schema: schemaOf(e.sample), example: e.sample } } },
        responses: { 200: { description: 'Accepted. Any 2xx status confirms delivery; the body is ignored.' } }
      }
    };
  });

  return {
    openapi: '3.1.0',
    info: { title: docs.title, version: '1.0.0', description: 'Send bills to GePG through the bridge and get told when they are approved or paid. Events are described under webhooks.' },
    servers: [{ url: docs.baseUrl }],
    security: [{ ApiKeyAuth: [] }],
    components: { securitySchemes: { ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-Api-Key', description: docs.authentication.text } } },
    paths,
    webhooks
  };
}

// ----------------------------------------------------------------- Postman

const POSTMAN_VARS = { '{billId}': '{{bill_id}}', '{paymentId}': '{{payment_id}}' };

function postmanPath(path) {
  return Object.entries(POSTMAN_VARS).reduce((p, [k, v]) => p.replace(k, v), path);
}

// bills that are created get a fresh reference each run, so the same request can be sent again
function postmanBody(ep) {
  const body = JSON.parse(JSON.stringify(ep.body.example));
  if (ep.id === 'createBill' || ep.id === 'reuseBill') body.billId = 'INV-{{$timestamp}}';
  if (ep.id === 'bulkBills') body.bills.forEach((b, i) => { b.billId = `INV-{{$timestamp}}-${i + 1}`; });
  return json(body);
}

function postmanTests(ep) {
  const lines = [`pm.test('Status is ${ep.responses[0].status}', () => pm.response.to.have.status(${ep.responses[0].status}));`];
  if (ep.id === 'createBill' || ep.id === 'reuseBill') lines.push("if (pm.response.code === 201) pm.collectionVariables.set('bill_id', pm.response.json().bill.billId);");
  if (ep.id === 'listPayments') lines.push("const d = pm.response.json().data; if (d.length) pm.collectionVariables.set('payment_id', d[0].id);");
  if (ep.id === 'getEvents') lines.push("pm.collectionVariables.set('events_cursor', pm.response.json().data.nextCursor);");
  return lines;
}

function postmanRequest(ep, docs) {
  const query = (ep.params || []).filter((p) => p.in === 'query').map((p) => ({
    key: p.name,
    value: ep.id === 'getEvents' && p.name === 'after' ? '{{events_cursor}}' : p.example,
    description: p.description,
    disabled: !p.required && !(ep.id === 'getEvents')
  }));
  const path = postmanPath(ep.path);
  const raw = `{{base_url}}${path}${query.filter((q) => !q.disabled).length ? '?' + query.filter((q) => !q.disabled).map((q) => `${q.key}=${q.value}`).join('&') : ''}`;
  const request = {
    method: ep.method,
    header: ep.body ? [{ key: 'Content-Type', value: 'application/json' }] : [],
    url: { raw, host: ['{{base_url}}'], path: path.split('/').filter(Boolean), ...(query.length ? { query } : {}) },
    description: [ep.summary, ...(ep.notes || [])].join('\n\n')
  };
  if (ep.body) request.body = { mode: 'raw', raw: postmanBody(ep), options: { raw: { language: 'json' } } };

  return {
    name: ep.title,
    request,
    event: [{ listen: 'test', script: { type: 'text/javascript', exec: postmanTests(ep) } }],
    response: ep.responses.map((r) => ({
      name: `${r.status} ${r.title}`,
      originalRequest: request,
      status: String(r.status),
      code: r.status,
      _postman_previewlanguage: 'json',
      header: [{ key: 'Content-Type', value: 'application/json' }],
      body: json(r.body)
    }))
  };
}

const DELIVERY_SCRIPT = [
  '// sign this delivery with a fresh timestamp, the way the bridge does',
  'const body = pm.request.body.raw;',
  'const t = Math.floor(Date.now() / 1000);',
  "const secret = pm.collectionVariables.get('webhook_secret');",
  "const sig = CryptoJS.HmacSHA256(t + '.' + body, secret).toString(CryptoJS.enc.Hex);",
  "pm.request.headers.upsert({ key: 'X-Bridge-Timestamp', value: String(t) });",
  "pm.request.headers.upsert({ key: 'X-Bridge-Signature', value: 't=' + t + ',v1=' + sig });"
];

function deliveryRequest(event, docs, signed) {
  const headers = (signed ? {} : {}) && [
    { key: 'Content-Type', value: 'application/json' },
    { key: 'User-Agent', value: 'GePG-Bridge/1.0' },
    { key: 'X-Bridge-Event', value: event.type },
    { key: 'X-Bridge-Event-Id', value: event.sample.id },
    { key: 'X-Bridge-Delivery-Attempt', value: '1' },
    { key: 'X-Bridge-Timestamp', value: 'set by the script' },
    { key: 'X-Bridge-Signature', value: 'set by the script' }
  ];
  return {
    name: event.type,
    event: [
      { listen: 'prerequest', script: { type: 'text/javascript', exec: DELIVERY_SCRIPT } },
      { listen: 'test', script: { type: 'text/javascript', exec: ["pm.test('Your system answered 2xx', () => pm.expect(pm.response.code).to.be.within(200, 299));"] } }
    ],
    request: {
      method: 'POST', header: headers,
      url: { raw: '{{callback_url}}', host: ['{{callback_url}}'] },
      body: { mode: 'raw', raw: JSON.stringify(event.sample), options: { raw: { language: 'json' } } },
      description: `${event.when}\n\nSent to your own callback URL with a fresh signature made from the webhook_secret variable.`
    }
  };
}

function toPostman(docs) {
  const d = docs.delivery;
  const vector = d.testVector;
  return {
    info: {
      name: 'GePG Bridge - Billing System API (v1)',
      description: `${docs.authentication.text}\n\nSet api_key (from your admin) and base_url. For the sample deliveries, set callback_url (your endpoint) and webhook_secret (your system's signing secret).`,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    auth: { type: 'apikey', apikey: [{ key: 'key', value: 'X-Api-Key', type: 'string' }, { key: 'value', value: '{{api_key}}', type: 'string' }, { key: 'in', value: 'header', type: 'string' }] },
    variable: [
      { key: 'base_url', value: docs.baseUrl },
      { key: 'api_key', value: 'PASTE_YOUR_API_KEY' },
      { key: 'bill_id', value: 'INV-1001' },
      { key: 'payment_id', value: '1' },
      { key: 'events_cursor', value: '0' },
      { key: 'callback_url', value: d.callbackUrl },
      { key: 'webhook_secret', value: EXAMPLE_SECRET }
    ],
    item: [
      ...docs.groups.map((g) => ({ name: g.title, description: g.description, item: g.endpoints.map((ep) => postmanRequest(ep, docs)) })),
      {
        name: 'Sample deliveries (to YOUR callback URL)',
        description: 'These send the bridge\'s sample events to your own endpoint, signed with a fresh timestamp from the webhook_secret variable. Use them to build and test your receiver before connecting for real.',
        item: [
          ...docs.events.map((e) => deliveryRequest(e, docs)),
          {
            name: 'Signature test vector (fixed timestamp)',
            request: {
              method: 'POST',
              header: [
                { key: 'Content-Type', value: 'application/json' },
                { key: 'X-Bridge-Event', value: 'payment.received' },
                { key: 'X-Bridge-Event-Id', value: '184' },
                { key: 'X-Bridge-Delivery-Attempt', value: '1' },
                { key: 'X-Bridge-Timestamp', value: String(vector.timestamp) },
                { key: 'X-Bridge-Signature', value: vector.header }
              ],
              url: { raw: '{{callback_url}}', host: ['{{callback_url}}'] },
              body: { mode: 'raw', raw: vector.body, options: { raw: { language: 'json' } } },
              description: `Signed with the example secret ${vector.secret} at a fixed time. Your receiver should accept it only if you skip the 5-minute clock check for this one test.`
            }
          }
        ]
      }
    ]
  };
}

// ---------------------------------------------------------------- Insomnia

function toInsomnia(docs) {
  const d = docs.delivery;
  const vector = d.testVector;
  const wrk = 'wrk_gepg_bridge_billing_api';
  const resources = [
    { _id: wrk, _type: 'workspace', name: 'GePG Bridge - Billing System API (v1)', description: docs.authentication.text, scope: 'collection' },
    {
      _id: 'env_gepg_bridge_base', _type: 'environment', parentId: wrk, name: 'Base Environment',
      data: { base_url: docs.baseUrl, api_key: 'PASTE_YOUR_API_KEY', bill_id: 'INV-1001', payment_id: '1', events_cursor: '0', callback_url: d.callbackUrl }
    }
  ];

  const sub = (path) => path.replace('{billId}', '{{ _.bill_id }}').replace('{paymentId}', '{{ _.payment_id }}');
  let order = 0;

  docs.groups.forEach((g) => {
    const groupId = `fld_${g.id}`;
    resources.push({ _id: groupId, _type: 'request_group', parentId: wrk, name: g.title, description: g.description, metaSortKey: order++ });
    g.endpoints.forEach((ep) => {
      const query = (ep.params || []).filter((p) => p.in === 'query');
      const request = {
        _id: `req_${ep.id}`, _type: 'request', parentId: groupId, name: ep.title, method: ep.method,
        url: `{{ _.base_url }}${sub(ep.path)}`,
        description: [ep.summary, ...(ep.notes || [])].join('\n\n'),
        headers: [{ name: 'X-Api-Key', value: '{{ _.api_key }}' }, ...(ep.body ? [{ name: 'Content-Type', value: 'application/json' }] : [])],
        parameters: query.map((p) => ({ name: p.name, value: ep.id === 'getEvents' && p.name === 'after' ? '{{ _.events_cursor }}' : p.example, disabled: !p.required && ep.id !== 'getEvents' })),
        authentication: {}, metaSortKey: order++
      };
      if (ep.body) {
        let text = json(ep.body.example);
        if (ep.id === 'createBill' || ep.id === 'reuseBill') text = text.replace('"INV-1001"', `"INV-{% now 'millis', '' %}"`).replace('"INV-1003"', `"INV-{% now 'millis', '' %}"`);
        request.body = { mimeType: 'application/json', text };
      }
      resources.push(request);
    });
  });

  const deliveryGroup = 'fld_sample_deliveries';
  resources.push({
    _id: deliveryGroup, _type: 'request_group', parentId: wrk, name: 'Sample deliveries (to YOUR callback URL)',
    description: 'The bridge\'s sample events, sent to your own callback_url. Insomnia cannot compute the signature, so these carry the fixed test-vector signature: skip the 5-minute clock check while testing with them, or use the Postman collection which signs each one freshly.',
    metaSortKey: order++
  });
  docs.events.forEach((e) => {
    resources.push({
      _id: `req_delivery_${e.type.replace(/\W/g, '_')}`, _type: 'request', parentId: deliveryGroup, name: e.type, method: 'POST',
      url: '{{ _.callback_url }}',
      description: e.when,
      headers: [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'X-Bridge-Event', value: e.type },
        { name: 'X-Bridge-Event-Id', value: e.sample.id },
        { name: 'X-Bridge-Delivery-Attempt', value: '1' }
      ],
      body: { mimeType: 'application/json', text: JSON.stringify(e.sample) }, authentication: {}, metaSortKey: order++
    });
  });
  resources.push({
    _id: 'req_delivery_test_vector', _type: 'request', parentId: deliveryGroup, name: 'Signature test vector (fixed timestamp)', method: 'POST',
    url: '{{ _.callback_url }}',
    description: `Signed with the example secret ${vector.secret} at a fixed time.`,
    headers: [
      { name: 'Content-Type', value: 'application/json' },
      { name: 'X-Bridge-Event', value: 'payment.received' },
      { name: 'X-Bridge-Event-Id', value: '184' },
      { name: 'X-Bridge-Delivery-Attempt', value: '1' },
      { name: 'X-Bridge-Timestamp', value: String(vector.timestamp) },
      { name: 'X-Bridge-Signature', value: vector.header }
    ],
    body: { mimeType: 'application/json', text: vector.body }, authentication: {}, metaSortKey: order++
  });

  return { _type: 'export', __export_format: 4, __export_date: '2026-11-18T00:00:00.000Z', __export_source: 'gepg-bridge:developer-docs', resources };
}


// ------------------------------------------------------ GePG callbacks

function toGepgMarkdown(cb) {
  const out = [];
  out.push(`# ${cb.title}`, '');
  out.push('These are the messages GePG sends to the bridge, and what the bridge answers. They are the call back URLs the GePG v5 specification asks an institution to provide (section 1.3).', '');

  out.push('## 1. URLs to give GePG', '', table(['For', 'URL'], cb.urlsToRegister.map((u) => [u.for, u.url])), '');
  out.push('## 2. The request', '', table(['', ''], [['Method', cb.request.method], ['Content-Type', cb.request.contentType], ['Body', cb.request.body]]).replace(/^\|  \|  \|\n\|---\|---\|\n/, '| Item | Value |\n|---|---|\n'), '');
  out.push('### Signing', '');
  cb.signing.forEach((x) => out.push(`- ${x}`));
  out.push('', '### How the bridge behaves', '');
  cb.behaviour.forEach((x) => out.push(`- ${x}`));
  out.push('');

  cb.callbacks.forEach((c, i) => {
    out.push(`## ${i + 3}. ${c.name}`, '', `\`POST ${c.path}\` (spec section ${c.specSection}, message \`${c.root}\`)`, '');
    out.push(`**When:** ${c.when}`, '', `**What the bridge does:** ${c.effect}`, '', `URL: \`${c.url}\``, '');
    c.samples.forEach((smp) => out.push(`### Sample: ${smp.title}`, '', code(smp.envelopeText, 'xml'), ''));
    out.push('### What the bridge answers', '', `The answer repeats the ${c.ackRef} (or ReqId) of the message it replies to, and carries its own AckId. Shown for the first sample.`, '');
    out.push(table(['Code', 'HTTP status', 'Meaning'], c.answers.map((a) => [`\`${a.statusCode}\``, a.httpStatus, a.meaning])), '');
    c.answers.forEach((a) => out.push(`**${a.statusCode}** (HTTP ${a.httpStatus}):`, '', code(a.xml, 'xml'), ''));
  });

  out.push('## Testing the callbacks yourself', '');
  out.push(`The samples carry the placeholder \`${cb.placeholder}\` instead of a real signature, so the bridge answers them with 7303. That is a useful test by itself. To see 7101 you need messages signed with a key the bridge trusts:`, '');
  out.push(code([
    '# 1. make a test key and certificate',
    'openssl req -x509 -newkey rsa:2048 -nodes -keyout gepg-test-key.pem -out gepg-test-cert.pem -days 30 -subj "/CN=gepg-test"',
    '',
    '# 2. in backend/.env, temporarily point GEPG_PUBLIC_CERT_PATH at the test certificate, then restart the bridge',
    'GEPG_PUBLIC_CERT_PATH=./gepg-test-cert.pem',
    '',
    '# 3. sign every sample; this also writes a Postman environment with the signatures',
    'cd backend',
    'node scripts/sign-gepg-sample.js ../gepg-test-key.pem'
  ].join('\n'), 'bash'), '');
  out.push('Import the environment it writes (`gepg-callbacks-test-environment.json`) in Postman. In Insomnia, copy the `sig_...` values into the environment. Create the bill the sample refers to first (the BillId must exist), or the bridge answers 7317. Put the real `GEPG_PUBLIC_CERT_PATH` back afterwards.', '');
  return out.join('\n');
}

function gepgSampleBody(smp, varStyle) {
  return smp.envelopeText.replace('>SignatureGoesHere<', `>${varStyle(smp.id)}<`);
}

function gepgCallbackItems(cb, bodyOf) {
  return cb.callbacks.flatMap((c) => c.samples.map((smp) => ({ c, smp, body: bodyOf(smp) })));
}

function toGepgPostman(cb) {
  return {
    info: {
      name: 'GePG Bridge - GePG callbacks (GePG to the bridge)',
      description: `What GePG posts to the bridge, with the bridge's possible answers saved on each request. The samples use the placeholder signature, so the bridge answers 7303 until the sig_ variables hold real signatures (see GePG_Callbacks_Guide.md).`,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    variable: [{ key: 'base_url', value: cb.baseUrl }, ...cb.callbacks.flatMap((c) => c.samples.map((s) => ({ key: `sig_${s.id}`, value: cb.placeholder })))],
    item: cb.callbacks.map((c) => ({
      name: c.name,
      description: `${c.when}\n\n${c.effect}`,
      item: c.samples.map((smp) => {
        const request = {
          method: 'POST',
          header: [{ key: 'Content-Type', value: 'application/xml' }],
          url: { raw: `{{base_url}}${c.path}`, host: ['{{base_url}}'], path: c.path.split('/').filter(Boolean) },
          body: { mode: 'raw', raw: gepgSampleBody(smp, (id) => `{{sig_${id}}}`), options: { raw: { language: 'xml' } } },
          description: `${smp.title}. Spec section ${c.specSection}.`
        };
        return {
          name: smp.title,
          event: [{ listen: 'test', script: { type: 'text/javascript', exec: ["pm.test('The bridge answered with an acknowledgement', () => pm.expect(pm.response.text()).to.include('<AckStsCode>'));"] } }],
          request,
          response: c.answers.map((a) => ({
            name: `${a.statusCode} ${a.meaning}`, originalRequest: request, status: String(a.httpStatus), code: a.httpStatus,
            _postman_previewlanguage: 'xml', header: [{ key: 'Content-Type', value: 'application/xml' }], body: a.xml
          }))
        };
      })
    }))
  };
}

function toGepgInsomnia(cb) {
  const wrk = 'wrk_gepg_callbacks';
  const resources = [
    { _id: wrk, _type: 'workspace', name: 'GePG Bridge - GePG callbacks (GePG to the bridge)', description: 'What GePG posts to the bridge. Samples use the placeholder signature until the sig_ values are replaced (see GePG_Callbacks_Guide.md).', scope: 'collection' },
    {
      _id: 'env_gepg_callbacks', _type: 'environment', parentId: wrk, name: 'Base Environment',
      data: { base_url: cb.baseUrl, ...Object.fromEntries(cb.callbacks.flatMap((c) => c.samples.map((s) => [`sig_${s.id}`, cb.placeholder]))) }
    }
  ];
  let order = 0;
  cb.callbacks.forEach((c) => {
    const group = `fld_${c.id}`;
    resources.push({ _id: group, _type: 'request_group', parentId: wrk, name: c.name, description: `${c.when}\n\n${c.effect}`, metaSortKey: order++ });
    c.samples.forEach((smp) => {
      resources.push({
        _id: `req_${smp.id}`, _type: 'request', parentId: group, name: smp.title, method: 'POST',
        url: `{{ _.base_url }}${c.path}`,
        description: `${smp.title}. Spec section ${c.specSection}.\n\nPossible answers:\n${c.answers.map((a) => `${a.statusCode} (HTTP ${a.httpStatus}): ${a.xml}`).join('\n')}`,
        headers: [{ name: 'Content-Type', value: 'application/xml' }],
        body: { mimeType: 'application/xml', text: gepgSampleBody(smp, (id) => `{{ _.sig_${id} }}`) },
        authentication: {}, metaSortKey: order++
      });
    });
  });
  return { _type: 'export', __export_format: 4, __export_date: '2026-11-18T00:00:00.000Z', __export_source: 'gepg-bridge:gepg-callbacks', resources };
}

// ------------------------------------------------------------------- files

function webhookTestFile(docs) {
  const v = docs.delivery.testVector;
  return {
    description: v.description,
    algorithm: 'HMAC-SHA256 over "<timestamp>.<body>", hex',
    secret: v.secret,
    timestamp: v.timestamp,
    body: v.body,
    signedText: v.signedText,
    expectedSignature: v.signature,
    header: v.header
  };
}

// name, type and content of every file the Developer page can download
function files(docs) {
  const callbacks = buildCallbackDocs({ baseUrl: docs.baseUrl });
  return [
    { id: 'markdown', name: 'BILLING_SYSTEM_INTEGRATION.md', type: 'text/markdown', content: toMarkdown(docs) },
    { id: 'openapi', name: 'GePG_Bridge_OpenAPI.json', type: 'application/json', content: json(toOpenApi(docs)) + '\n' },
    { id: 'postman', name: 'GePG_Bridge_Postman_Collection.json', type: 'application/json', content: json(toPostman(docs)) + '\n' },
    { id: 'insomnia', name: 'GePG_Bridge_Insomnia.json', type: 'application/json', content: json(toInsomnia(docs)) + '\n' },
    { id: 'webhook-test', name: 'GePG_Bridge_Webhook_Test.json', type: 'application/json', content: json(webhookTestFile(docs)) + '\n' },
    { id: 'gepg-guide', audience: 'gepg', name: 'GePG_Callbacks_Guide.md', type: 'text/markdown', content: toGepgMarkdown(callbacks) },
    { id: 'gepg-postman', audience: 'gepg', name: 'GePG_Callbacks_Postman_Collection.json', type: 'application/json', content: json(toGepgPostman(callbacks)) + '\n' },
    { id: 'gepg-insomnia', audience: 'gepg', name: 'GePG_Callbacks_Insomnia.json', type: 'application/json', content: json(toGepgInsomnia(callbacks)) + '\n' }
  ];
}

module.exports = { files, curlFor, toMarkdown, toOpenApi, toPostman, toInsomnia, toGepgMarkdown, toGepgPostman, toGepgInsomnia, allEndpoints };
