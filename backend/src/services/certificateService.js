// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 18/11/2026
// │ Certificate service: certificates uploaded on the Settings page
// └──────────────────────────────────────────────────────────────────────────┘

const crypto = require('crypto');
const forge = require('node-forge');
const db = require('../config/database');
const secretBox = require('./secretBox');

const KINDS = {
  signing: { column: 'SIGNING', label: 'Your signing certificate' },
  'gepg-public': { column: 'GEPG_PUBLIC', label: 'GePG\'s public certificate' }
};

const MAX_BYTES = 100 * 1024;
const REFRESH_MS = 30 * 1000;

// What the rest of the server reads. Both are plain PEM text, filled by load().
let signing = null;
let gepgPublic = null;
let rows = new Map();

class CertificateError extends Error {}

const fingerprintOf = (der) => crypto.createHash('sha256').update(der).digest('hex').toUpperCase().match(/../g).join(':');

function firstCertificate(p12) {
  const bags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  return bags[0] && bags[0].cert;
}

function privateKeyOf(p12) {
  const shrouded = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [];
  const plain = p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || [];
  const bag = shrouded[0] || plain[0];
  return bag && bag.key;
}

// Opens an uploaded signing file and returns the key as PEM plus what to show about it.
function readSigning(buffer, password) {
  const text = buffer.toString('utf8');
  if (text.includes('-----BEGIN')) {
    if (!/-----BEGIN (RSA |ENCRYPTED )?PRIVATE KEY-----/.test(text)) {
      throw new CertificateError('This PEM file has no private key. Upload the PKCS#12 (.p12 / .pfx) file you were given, or the private key itself.');
    }
    if (/ENCRYPTED/.test(text)) throw new CertificateError('This private key is password protected. Upload the .p12 / .pfx file instead.');
    try {
      crypto.createPrivateKey(text);
    } catch (e) {
      throw new CertificateError('Could not read the private key in this file.');
    }
    return { pem: text, subject: null, validTo: null, fingerprint: null };
  }

  let p12;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(buffer.toString('binary')), password || '');
  } catch (e) {
    throw new CertificateError(password ? 'Could not open the file: wrong password or not a PKCS#12 (.p12 / .pfx) file.' : 'Could not open the file. If it has a password, enter it.');
  }
  const key = privateKeyOf(p12);
  if (!key) throw new CertificateError('There is no private key inside this file, so it cannot sign.');
  const cert = firstCertificate(p12);
  if (cert && cert.validity.notAfter < new Date()) {
    throw new CertificateError(`This certificate expired on ${cert.validity.notAfter.toISOString().slice(0, 10)}. GePG would reject everything signed with it.`);
  }
  const cn = cert && cert.subject.getField('CN');
  return {
    pem: forge.pki.privateKeyToPem(key),
    subject: cn ? cn.value : null,
    validTo: cert ? cert.validity.notAfter : null,
    fingerprint: cert ? fingerprintOf(Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes(), 'binary')) : null
  };
}

// GePG sends a certificate as PEM or as DER (.cer / .crt); we keep it as PEM.
function readGepgPublic(buffer) {
  const text = buffer.toString('utf8');
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text)) {
    throw new CertificateError('That is a private key. Upload GePG\'s public certificate here, never a private key.');
  }
  let x509;
  try {
    x509 = new crypto.X509Certificate(buffer);
  } catch (e) {
    throw new CertificateError('Could not read it as a certificate. Use the .pem, .cer or .crt file GePG gave you.');
  }
  if (new Date(x509.validTo) < new Date()) {
    throw new CertificateError(`This certificate expired on ${new Date(x509.validTo).toISOString().slice(0, 10)}.`);
  }
  const cn = /CN=([^\n]+)/.exec(x509.subject);
  return { pem: x509.toString(), subject: cn ? cn[1] : null, validTo: new Date(x509.validTo), fingerprint: x509.fingerprint256 };
}

// Turns a stored row back into usable PEM; null when it cannot be read.
function usable(kind, row) {
  try {
    if (kind === 'signing') {
      const password = row.password_enc ? secretBox.decrypt(row.password_enc) : '';
      return readSigning(row.content, password).pem;
    }
    return readGepgPublic(row.content).pem;
  } catch (e) {
    console.error(`Stored ${kind} certificate cannot be used:`, e.message);
    return null;
  }
}

async function load() {
  const [list] = await db.query('SELECT * FROM certificates');
  rows = new Map(list.map((r) => [r.kind, r]));
  signing = rows.has('SIGNING') ? usable('signing', rows.get('SIGNING')) : null;
  gepgPublic = rows.has('GEPG_PUBLIC') ? usable('gepg-public', rows.get('GEPG_PUBLIC')) : null;
}

function startAutoRefresh() {
  const timer = setInterval(() => load().catch((e) => console.error('Certificate refresh failed:', e.message)), REFRESH_MS);
  timer.unref();
}

async function save(kind, { fileName, data, password }, userId) {
  const def = KINDS[kind];
  if (!def) throw new CertificateError('Unknown certificate type');
  if (!data || typeof data !== 'string') throw new CertificateError('Choose a file to upload');
  const buffer = Buffer.from(data, 'base64');
  if (buffer.length === 0) throw new CertificateError('The file is empty');
  if (buffer.length > MAX_BYTES) throw new CertificateError('The file is too large for a certificate (limit 100 KB)');

  const info = kind === 'signing' ? readSigning(buffer, password) : readGepgPublic(buffer);
  const stored = kind === 'signing' ? buffer : Buffer.from(info.pem, 'utf8');
  const passwordEnc = kind === 'signing' && password ? secretBox.encrypt(password) : null;

  await db.query(
    `INSERT INTO certificates (kind, file_name, content, password_enc, subject, valid_to, fingerprint, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE file_name = VALUES(file_name), content = VALUES(content), password_enc = VALUES(password_enc),
       subject = VALUES(subject), valid_to = VALUES(valid_to), fingerprint = VALUES(fingerprint), uploaded_by = VALUES(uploaded_by), uploaded_at = NOW()`,
    [def.column, String(fileName || 'certificate').slice(0, 255), stored, passwordEnc, info.subject, info.validTo, info.fingerprint, userId || null]
  );
  await load();
  return def.label;
}

async function remove(kind) {
  const def = KINDS[kind];
  if (!def) throw new CertificateError('Unknown certificate type');
  const [result] = await db.query('DELETE FROM certificates WHERE kind = ?', [def.column]);
  await load();
  return result.affectedRows > 0;
}

// What the Settings page shows about an uploaded certificate (never the file or password).
function uploaded(kind) {
  const row = rows.get(KINDS[kind].column);
  if (!row) return null;
  return {
    fileName: row.file_name,
    subject: row.subject,
    validTo: row.valid_to,
    fingerprint: row.fingerprint,
    uploadedAt: row.uploaded_at,
    usable: (kind === 'signing' ? signing : gepgPublic) !== null
  };
}

module.exports = {
  KINDS,
  CertificateError,
  load,
  startAutoRefresh,
  save,
  remove,
  uploaded,
  signingKey: () => signing,
  gepgPublicPem: () => gepgPublic
};
