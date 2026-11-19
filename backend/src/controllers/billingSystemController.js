// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Billing systems controller
// └──────────────────────────────────────────────────────────────────────────┘

const { clientIp } = require('../utils/clientIp');
const BillingSystem = require('../models/BillingSystem');
const ApiKey = require('../models/ApiKey');
const eventService = require('../services/eventService');
const GfsCode = require('../models/GfsCode');
const ActivityLog = require('../models/ActivityLog');

const CODE_PATTERN = /^[A-Z][A-Z0-9]{1,11}$/;

// http or https, no embedded password, so the URL is safe to show in the dashboard
function checkCallbackUrl(value) {
  if (!value) return { value: null };
  let url;
  try {
    url = new URL(value);
  } catch (error) {
    return { error: 'Callback URL is not a valid address' };
  }
  if (!['http:', 'https:'].includes(url.protocol)) return { error: 'Callback URL must start with http:// or https://' };
  if (url.username || url.password) return { error: 'Do not put a user name or password in the URL' };
  if (value.length > 500) return { error: 'Callback URL is too long' };
  return { value: url.toString() };
}

function validate(body, { creating }) {
  const errors = {};
  const out = {};

  if (creating) {
    out.code = String(body.code || '').trim().toUpperCase();
    if (!CODE_PATTERN.test(out.code)) errors.code = 'Use 2 to 12 capital letters and digits, starting with a letter';
  }

  out.name = String(body.name || '').trim();
  if (!out.name) errors.name = 'Name is required';
  else if (out.name.length > 100) errors.name = 'At most 100 characters';

  out.description = String(body.description || '').trim().slice(0, 255);
  out.contact = String(body.contact || '').trim().slice(0, 150);

  const url = checkCallbackUrl(String(body.callbackUrl || '').trim());
  if (url.error) errors.callbackUrl = url.error;
  out.callbackUrl = url.value;

  out.retryWindowHours = body.retryWindowHours === undefined ? BillingSystem.DEFAULT_RETRY_WINDOW : Number(body.retryWindowHours);
  if (!BillingSystem.RETRY_WINDOWS.includes(out.retryWindowHours)) errors.retryWindowHours = 'Choose one of the listed retry windows';

  if (!creating) {
    out.status = body.status;
    if (!['ACTIVE', 'DISABLED'].includes(out.status)) errors.status = 'Status must be ACTIVE or DISABLED';
  }

  return { errors, out };
}

function publicView(system) {
  const { webhook_secret, ...rest } = system;
  return rest;
}

async function list(req, res) {
  try {
    res.json({
      success: true,
      data: {
        systems: await BillingSystem.findAll(),
        retryWindows: BillingSystem.RETRY_WINDOWS,
        defaultRetryWindow: BillingSystem.DEFAULT_RETRY_WINDOW
      }
    });
  } catch (error) {
    console.error('List billing systems error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// the signing secret is returned once, here, and never again
async function create(req, res) {
  try {
    const { errors, out } = validate(req.body || {}, { creating: true });
    if (Object.keys(errors).length) return res.status(400).json({ success: false, message: 'Some values are not valid', errors });

    if (await BillingSystem.findByCode(out.code)) {
      return res.status(409).json({ success: false, message: 'Some values are not valid', errors: { code: 'This code is already used' } });
    }

    const { id, secret } = await BillingSystem.create({ ...out, createdBy: req.user.id });
    res.status(201).json({
      success: true,
      message: 'Billing system created. Copy the signing secret now: it will not be shown again.',
      data: { system: publicView(await BillingSystem.findById(id)), secret }
    });
  } catch (error) {
    console.error('Create billing system error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

async function update(req, res) {
  try {
    const system = await BillingSystem.findById(req.params.id);
    if (!system) return res.status(404).json({ success: false, message: 'Billing system not found' });

    const { errors, out } = validate(req.body || {}, { creating: false });
    if (Object.keys(errors).length) return res.status(400).json({ success: false, message: 'Some values are not valid', errors });

    await BillingSystem.update(system.id, out);
    res.json({ success: true, message: 'Saved', data: publicView(await BillingSystem.findById(system.id)) });
  } catch (error) {
    console.error('Update billing system error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

async function rotateSecret(req, res) {
  try {
    const system = await BillingSystem.findById(req.params.id);
    if (!system) return res.status(404).json({ success: false, message: 'Billing system not found' });

    const secret = await BillingSystem.rotateSecret(system.id);
    res.json({ success: true, message: 'New signing secret created. Copy it now: it will not be shown again.', data: { secret } });
  } catch (error) {
    console.error('Rotate secret error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

async function keys(req, res) {
  try {
    const all = await ApiKey.findAll();
    res.json({ success: true, data: all.filter((k) => String(k.billing_system_id) === String(req.params.id)) });
  } catch (error) {
    console.error('List system keys error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

async function sendTest(req, res) {
  try {
    const system = await BillingSystem.findById(req.params.id);
    if (!system) return res.status(404).json({ success: false, message: 'Billing system not found' });

    res.json({ success: true, data: await eventService.sendTest(system) });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    console.error('Test event error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

async function replayDead(req, res) {
  try {
    const count = await eventService.replayDead(req.params.id);
    res.json({ success: true, message: `${count} event(s) queued again`, data: { count } });
  } catch (error) {
    console.error('Replay dead events error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

function audit(req, system, description, data) {
  return ActivityLog.create({
    user_id: req.user.id, action: 'GFS_LINK', entity_type: 'billing_system', entity_id: system.code, description,
    ip_address: clientIp(req), user_agent: req.headers['user-agent'], request_data: data, response_data: null, status: 'SUCCESS'
  });
}

// the codes this system may bill with, and the others that could be linked to it
async function gfsCodes(req, res) {
  try {
    const system = await BillingSystem.findById(req.params.id);
    if (!system) return res.status(404).json({ success: false, message: 'Billing system not found' });
    res.json({ success: true, data: await GfsCode.linkedAndAvailable(system.id) });
  } catch (error) {
    console.error('List system GFS codes error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// a code belongs to one system, so linking one that belongs to another moves it
async function linkGfsCodes(req, res) {
  try {
    const system = await BillingSystem.findById(req.params.id);
    if (!system) return res.status(404).json({ success: false, message: 'Billing system not found' });

    const ids = Array.isArray(req.body.codeIds) ? [...new Set(req.body.codeIds.map(Number).filter(Number.isInteger))] : [];
    if (ids.length === 0) return res.status(400).json({ success: false, message: 'Choose at least one GFS code' });

    const before = await GfsCode.linkToSystem(system.id, ids);
    const moved = before.filter((b) => b.previous_id && b.previous_id !== system.id);
    const added = before.filter((b) => b.previous_id !== system.id);

    if (added.length > 0) {
      await audit(req, system,
        `Linked ${added.map((b) => b.code).join(', ')} to ${system.code}${moved.length ? ` (moved from ${moved.map((m) => `${m.code}: ${m.previous_code}`).join(', ')})` : ''}`,
        { codeIds: ids, moved });
    }
    res.json({ success: true, message: `${added.length} code(s) linked to ${system.code}`, data: { linked: added.length, moved: moved.map((m) => ({ code: m.code, from: m.previous_code })) } });
  } catch (error) {
    console.error('Link GFS codes error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

async function unlinkGfsCode(req, res) {
  try {
    const system = await BillingSystem.findById(req.params.id);
    if (!system) return res.status(404).json({ success: false, message: 'Billing system not found' });

    const code = await GfsCode.findById(req.params.codeId);
    if (!code || code.billing_system_id !== system.id) {
      return res.status(404).json({ success: false, message: 'That GFS code is not linked to this billing system' });
    }

    await GfsCode.unlink(system.id, code.id);
    await audit(req, system, `Unlinked ${code.code} from ${system.code}`, { codeId: code.id });
    res.json({ success: true, message: `${code.code} unlinked from ${system.code}` });
  } catch (error) {
    console.error('Unlink GFS code error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = { list, create, update, rotateSecret, keys, sendTest, replayDead, gfsCodes, linkGfsCodes, unlinkGfsCode };
