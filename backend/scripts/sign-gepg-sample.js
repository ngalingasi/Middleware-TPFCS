// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Signs the GePG callback samples with a test key, for testing the callbacks end to end
// └──────────────────────────────────────────────────────────────────────────┘

const fs = require('fs');
const path = require('path');
const digitalSignature = require('../src/utils/digitalSignature');
const { buildCallbackDocs, envelope } = require('../src/utils/gepgCallbackDocs');

// usage: node scripts/sign-gepg-sample.js <private-key.pem> [base-url]
//        node scripts/sign-gepg-sample.js <private-key.pem> --print bill_ok
const keyPath = process.argv[2];
if (!keyPath) {
  console.error('Usage: node scripts/sign-gepg-sample.js <private-key.pem> [base-url | --print <sample id>]');
  process.exit(1);
}

const printIndex = process.argv.indexOf('--print');
const baseUrl = process.argv[3] && printIndex === -1 ? process.argv[3] : 'http://localhost:5001';
const callbacks = buildCallbackDocs({ baseUrl }).callbacks;
const samples = callbacks.flatMap((c) => c.samples.map((s) => ({ ...s, callback: c })));

// the signature covers the message exactly as it sits between <Gepg> and <signature>
const sign = (smp) => digitalSignature.signMessage(smp.xml.trim(), path.resolve(keyPath));

if (printIndex !== -1) {
  const smp = samples.find((s) => s.id === process.argv[printIndex + 1]);
  if (!smp) {
    console.error(`Unknown sample. Choose one of: ${samples.map((s) => s.id).join(', ')}`);
    process.exit(1);
  }
  console.log(envelope(smp.xml, sign(smp)));
  process.exit(0);
}

const values = [{ key: 'base_url', value: baseUrl, enabled: true }];
samples.forEach((smp) => {
  values.push({ key: `sig_${smp.id}`, value: sign(smp), enabled: true });
  console.log(`signed ${smp.id.padEnd(16)} POST ${smp.callback.path}`);
});

fs.writeFileSync('gepg-callbacks-test-environment.json', JSON.stringify({
  id: 'gepg-callbacks-test', name: 'GePG callbacks (local test signatures)', values, _postman_variable_scope: 'environment'
}, null, 2));
console.log('\nWrote gepg-callbacks-test-environment.json: import it in Postman.');
console.log('The bridge only accepts these if the GePG certificate it uses (uploaded in Settings > Certificates, or GEPG_PUBLIC_CERT_PATH) matches this key.');
