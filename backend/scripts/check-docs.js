// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Checks that the documentation still matches the routes and examples
// └──────────────────────────────────────────────────────────────────────────┘

const vm = require('vm');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const v1Routes = require('../src/routes/v1Routes');
const { buildDocs, EXAMPLE_TIMESTAMP } = require('../src/utils/apiDocs');
const { sign, EVENT_TYPES } = require('../src/utils/webhookConfig');
const { files, allEndpoints } = require('../src/services/docsGenerator');

let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

const docs = buildDocs({ baseUrl: 'http://localhost:5001' });
const endpoints = allEndpoints(docs);

// 1. every route is documented, and every documented endpoint is a route
const actual = new Set(
  v1Routes.stack.filter((l) => l.route).flatMap((l) =>
    Object.keys(l.route.methods).map((m) => `${m.toUpperCase()} /api/v1${l.route.path.replace(/:(\w+)/g, '{$1}')}`))
);
const documented = new Set(endpoints.map((e) => `${e.method} ${e.path}`));
const undocumented = [...actual].filter((r) => !documented.has(r));
const missing = [...documented].filter((r) => !actual.has(r));
check('every /api/v1 route is documented', undocumented.length === 0, undocumented.join(', '));
check('every documented endpoint exists', missing.length === 0, missing.join(', '));

// 2. every endpoint has the basics
endpoints.forEach((e) => {
  const ok = e.title && e.summary && e.responses.length > 0 && e.responses.some((r) => r.status >= 200 && r.status < 300) &&
    e.responses.every((r) => r.status && r.title && r.body) && (e.method === 'GET' || e.id !== 'x');
  check(`${e.method} ${e.path} has a title, summary, and success and error examples`, !!ok);
});

// 3. every event has a sample of the right type
EVENT_TYPES.forEach((type) => {
  const e = docs.events.find((x) => x.type === type);
  check(`event ${type} has a sample`, !!e && e.sample.type === type && !!e.sample.id && !!e.sample.createdAt);
});

// 4. the signature test vector is what the signing code produces
const v = docs.delivery.testVector;
check('test vector signature matches the signing code', v.signature === sign(v.secret, v.timestamp, v.body));
check('test vector header has the documented shape', v.header === `t=${EXAMPLE_TIMESTAMP},v1=${v.signature}`);

// 5. the code samples really verify the test vector (clock fixed to the vector's time)
const fixedDate = class extends Date { static now() { return EXAMPLE_TIMESTAMP * 1000; } };
const nodeVerify = vm.runInNewContext(`${docs.delivery.verify.samples.node}; verify`, { require, Buffer, Date: fixedDate });
check('Node sample accepts the test vector', nodeVerify(v.body, v.header, v.secret) === true);
check('Node sample rejects a tampered body', nodeVerify(v.body + ' ', v.header, v.secret) === false);
check('Node sample rejects a wrong secret', nodeVerify(v.body, v.header, 'whsec_wrong') === false);
check('Node sample rejects an old timestamp', vm.runInNewContext(`${docs.delivery.verify.samples.node}; verify`, { require, Buffer, Date })(v.body, v.header, v.secret) === false);

const tryRun = (cmd, args, input) => {
  try { return execFileSync(cmd, args, { input, encoding: 'utf8' }).trim(); } catch (error) { return error.code === 'ENOENT' ? null : `error: ${error.message.slice(0, 80)}`; }
};
const php = docs.delivery.verify.samples.php.replace('time()', String(EXAMPLE_TIMESTAMP)) +
  `\n$b = file_get_contents('php://stdin'); echo (verify($b, ${JSON.stringify(v.header)}, ${JSON.stringify(v.secret)}) ? 'true' : 'false') . ',' . (verify($b . ' ', ${JSON.stringify(v.header)}, ${JSON.stringify(v.secret)}) ? 'true' : 'false');`;
const phpResult = tryRun('php', ['-r', php.replace(/^<\?php\s*/, '')], v.body);
if (phpResult === null) console.log('skip PHP sample (php is not installed)');
else check('PHP sample accepts the test vector and rejects a tampered body', phpResult === 'true,false', phpResult);

const py = docs.delivery.verify.samples.python.replace('time.time()', String(EXAMPLE_TIMESTAMP)) +
  `\nimport sys\nb = sys.stdin.buffer.read()\nprint(verify(b, ${JSON.stringify(v.header)}, ${JSON.stringify(v.secret)}), verify(b + b' ', ${JSON.stringify(v.header)}, ${JSON.stringify(v.secret)}))`;
const pyResult = tryRun('python3', ['-I', '-c', py], v.body);
if (pyResult === null) console.log('skip Python sample (python3 is not installed)');
else check('Python sample accepts the test vector and rejects a tampered body', pyResult === 'True False', pyResult);

// 6. the generated files are valid and complete
const generated = Object.fromEntries(files(docs).map((f) => [f.id, f]));
const parse = (id) => { try { return JSON.parse(generated[id].content); } catch (e) { return null; } };
const postman = parse('postman');
const insomnia = parse('insomnia');
const openapi = parse('openapi');
check('Postman collection is valid and has every endpoint and delivery sample',
  !!postman && postman.item.flatMap((f) => f.item).length === endpoints.length + docs.events.length + 1);
check('Insomnia export is valid and has every endpoint and delivery sample',
  !!insomnia && insomnia.resources.filter((r) => r._type === 'request').length === endpoints.length + docs.events.length + 1);
check('OpenAPI file is valid with every operation and event',
  !!openapi && Object.values(openapi.paths).reduce((n, p) => n + Object.keys(p).length, 0) === endpoints.length && Object.keys(openapi.webhooks).length === EVENT_TYPES.length);
check('Markdown guide mentions every endpoint', endpoints.every((e) => generated.markdown.content.includes(`\`${e.method} ${e.path}\``)));

console.log(failed ? `\n${failed} check(s) failed` : '\nAll documentation checks passed');
process.exit(failed ? 1 : 0);
