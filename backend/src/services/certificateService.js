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

// GePG sends its certificate as PEM, DER (.cer / .crt) or inside a PKCS#12 (.pfx).
// An expired one is still accepted: GePG's test certificates often are, and the
// signature check does not depend on the dates. The Settings page shows the warning.
function readGepgPublic(buffer, password) {
  const text = buffer.toString('utf8');
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text)) {
    throw new CertificateError('That is a private key. Upload GePG\'s public certificate here, never a private key.');
  }

  let x509;
  try {
    x509 = new crypto.X509Certificate(buffer);
  } catch (e) {
    x509 = fromPkcs12(buffer, password);
  }
  const cn = /CN=([^\n]+)/.exec(x509.subject);
  return { pem: x509.toString(), subject: cn ? cn[1] : null, validTo: new Date(x509.validTo), fingerprint: x509.fingerprint256 };
}

function fromPkcs12(buffer, password) {
  let p12;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(buffer.toString('binary')), password || '');
  } catch (e) {
    throw new CertificateError(password
      ? 'Could not open the file: wrong password, or it is not a certificate file.'
      : 'Could not read it as a certificate. Use the .pem, .cer, .crt or .pfx file GePG gave you (enter the password if it has one).');
  }
  const cert = firstCertificate(p12);
  if (!cert) throw new CertificateError('There is no certificate inside this file.');
  return new crypto.X509Certificate(forge.pki.certificateToPem(cert));
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

  const info = kind === 'signing' ? readSigning(buffer, password) : readGepgPublic(buffer, password);
  const stored = kind === 'signing' ? buffer : Buffer.from(info.pem, 'utf8');
  // only the signing file is opened again later; GePG's certificate is kept as plain PEM
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

// A new key pair and self-signed certificate for the signing slot. The key is made
// here, kept as a PKCS#12 with a random password (stored encrypted, like an upload),
// and never leaves the server; only the public certificate can be downloaded.
function generatedCertificate({ commonName, organization, country, years }) {
  const cn = String(commonName || '').trim();
  if (!/^[A-Za-z0-9 ._-]{1,64}$/.test(cn)) throw new CertificateError('Name: 1 to 64 letters, digits, spaces, dots, dashes or underscores');
  const org = String(organization || '').trim();
  if (org && !/^[A-Za-z0-9 ._,&()-]{1,64}$/.test(org)) throw new CertificateError('Organization: up to 64 letters, digits or simple punctuation');
  const c = String(country || '').trim().toUpperCase();
  if (c && !/^[A-Z]{2}$/.test(c)) throw new CertificateError('Country: two letters, for example TZ');
  const lifetime = Number(years || 2);
  if (!Number.isInteger(lifetime) || lifetime < 1 || lifetime > 10) throw new CertificateError('Valid for: 1 to 10 years');

  const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privateKey = forge.pki.privateKeyFromPem(pair.privateKey.export({ type: 'pkcs1', format: 'pem' }));
  const publicKey = forge.pki.publicKeyFromPem(pair.publicKey.export({ type: 'spki', format: 'pem' }));

  const cert = forge.pki.createCertificate();
  cert.publicKey = publicKey;
  cert.serialNumber = '01' + crypto.randomBytes(8).toString('hex');
  cert.validity.notBefore = new Date(Date.now() - 60 * 1000);
  cert.validity.notAfter = new Date(Date.now() + lifetime * 365 * 86400000);
  const name = [{ name: 'commonName', value: cn }];
  if (org) name.push({ name: 'organizationName', value: org });
  if (c) name.push({ name: 'countryName', value: c });
  cert.setSubject(name);
  cert.setIssuer(name);
  cert.sign(privateKey, forge.md.sha256.create());

  const password = crypto.randomBytes(16).toString('hex');
  const der = forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(privateKey, [cert], password, { algorithm: '3des' })).getBytes();
  return { fileName: `${cn.replace(/[^A-Za-z0-9._-]+/g, '-')}.p12`, data: Buffer.from(der, 'binary').toString('base64'), password };
}

async function generateSigning(options, userId) {
  const made = generatedCertificate(options || {});
  return save('signing', made, userId);
}

// The public half of the signing certificate, for sending to GePG. Null when the
// uploaded file is a bare private key (it has no certificate to share).
function signingPublic() {
  const row = rows.get('SIGNING');
  if (!row) return null;
  try {
    const text = row.content.toString('utf8');
    if (text.includes('-----BEGIN')) return null;
    const password = row.password_enc ? secretBox.decrypt(row.password_enc) : '';
    const cert = firstCertificate(forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(row.content.toString('binary')), password));
    if (!cert) return null;
    const pem = forge.pki.certificateToPem(cert);
    const subject = cert.subject.getField('CN');
    return { name: (subject ? subject.value : 'signing-certificate').replace(/[^A-Za-z0-9._-]+/g, '-'), pem, der: new crypto.X509Certificate(pem).raw.toString('base64') };
  } catch (e) {
    return null;
  }
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
  generateSigning,
  signingPublic,
  remove,
  uploaded,
  signingKey: () => signing,
  gepgPublicPem: () => gepgPublic
};
