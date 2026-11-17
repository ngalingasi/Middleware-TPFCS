// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Secret box: encrypts webhook signing secrets in the database
// └──────────────────────────────────────────────────────────────────────────┘

const crypto = require('crypto');

// Signing secrets must be readable by the bridge (to sign), so they are
// encrypted rather than hashed. The key comes from WEBHOOK_ENCRYPTION_KEY,
// or JWT_SECRET when that is not set.
function key() {
  const source = process.env.WEBHOOK_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!source) throw new Error('Set WEBHOOK_ENCRYPTION_KEY or JWT_SECRET in .env');
  return crypto.createHash('sha256').update(source).digest();
}

function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}

function decrypt(stored) {
  const raw = Buffer.from(stored, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
}

function newSecret() {
  return `whsec_${crypto.randomBytes(32).toString('hex')}`;
}

module.exports = { encrypt, decrypt, newSecret };
