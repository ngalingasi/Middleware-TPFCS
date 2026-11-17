// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Settings controller
// └──────────────────────────────────────────────────────────────────────────┘

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const forge = require('node-forge');
const settings = require('../services/settingsService');
const ActivityLog = require('../models/ActivityLog');
const { ENV_ONLY } = require('../utils/settingsRegistry');

async function getSettings(req, res) {
  res.json({
    success: true,
    data: { groups: settings.getAll(), envOnly: ENV_ONLY }
  });
}

async function updateSettings(req, res) {
  try {
    const changes = await settings.update(req.body && req.body.values);

    if (changes.length > 0) {
      await ActivityLog.create({
        user_id: req.user.id,
        action: 'SETTINGS_UPDATE',
        entity_type: 'settings',
        entity_id: changes.map((c) => c.key).join(',').slice(0, 100),
        description: changes.map((c) => `${c.label}: "${c.from}" -> "${c.to}"`).join('; '),
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        request_data: changes,
        response_data: null,
        status: 'SUCCESS'
      });
    }

    res.json({ success: true, message: changes.length ? 'Settings saved' : 'Nothing changed', data: { changes, groups: settings.getAll() } });
  } catch (error) {
    if (error.fieldErrors) {
      return res.status(400).json({ success: false, message: error.message, errors: error.fieldErrors });
    }
    console.error('Update settings error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// any signed-in user: the layout shows a banner while this is UAT
async function getEnvironment(req, res) {
  res.json({ success: true, data: { environment: settings.get('gepg_environment') } });
}

function certificateStatus(label, file, notAfter, subject) {
  const daysLeft = Math.floor((notAfter - Date.now()) / 86400000);
  let status = 'ok';
  let message = `Valid until ${notAfter.toISOString().slice(0, 10)} (${daysLeft} days left)`;
  if (daysLeft < 0) {
    status = 'expired';
    message = `Expired on ${notAfter.toISOString().slice(0, 10)}. GePG rejects messages signed with it.`;
  } else if (daysLeft <= 30) {
    status = 'expiring';
    message = `Expires on ${notAfter.toISOString().slice(0, 10)} (${daysLeft} days left). Ask for a new one now.`;
  }
  return { label, file, status, message, subject, validTo: notAfter.toISOString(), daysLeft };
}

function missing(label, file, why) {
  return { label, file, status: 'missing', message: why };
}

function readSigningCertificate() {
  const label = 'Your signing certificate';
  const file = process.env.CERT_PATH;
  if (!file) return missing(label, '', 'CERT_PATH is not set in .env');
  if (!fs.existsSync(file)) return missing(label, path.basename(file), 'File not found on the server');

  try {
    if (/\.(pem|key)$/i.test(file)) {
      return { label, file: path.basename(file), status: 'ok', message: 'Private key file found (no expiry date inside)' };
    }
    const der = fs.readFileSync(file, 'binary');
    const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(der), process.env.CERT_PASSWORD || '');
    const bags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
    const cert = bags[0] && bags[0].cert;
    if (!cert) return { label, file: path.basename(file), status: 'unreadable', message: 'No certificate found inside the file' };
    const cn = cert.subject.getField('CN');
    return certificateStatus(label, path.basename(file), cert.validity.notAfter, cn ? cn.value : undefined);
  } catch (error) {
    return { label, file: path.basename(file), status: 'unreadable', message: 'Could not open it: wrong password or damaged file' };
  }
}

function readGepgCertificate() {
  const label = 'GePG\'s public certificate';
  const file = process.env.GEPG_PUBLIC_CERT_PATH;
  if (!file) return missing(label, '', 'GEPG_PUBLIC_CERT_PATH is not set in .env');
  if (!fs.existsSync(file)) return missing(label, path.basename(file), 'File not found on the server. Messages from GePG cannot be verified.');

  try {
    const cert = new crypto.X509Certificate(fs.readFileSync(file));
    const cn = /CN=([^\n]+)/.exec(cert.subject);
    return certificateStatus(label, path.basename(file), new Date(cert.validTo), cn ? cn[1] : undefined);
  } catch (error) {
    return { label, file: path.basename(file), status: 'unreadable', message: 'Could not read it as a certificate' };
  }
}

async function getStatus(req, res) {
  res.json({ success: true, data: { certificates: [readSigningCertificate(), readGepgCertificate()] } });
}

module.exports = { getSettings, updateSettings, getEnvironment, getStatus };
