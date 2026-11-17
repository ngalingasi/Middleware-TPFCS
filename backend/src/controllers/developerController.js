// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Developer documentation controller
// └──────────────────────────────────────────────────────────────────────────┘

const BillingSystem = require('../models/BillingSystem');
const { buildDocs } = require('../utils/apiDocs');
const generator = require('../services/docsGenerator');

// the address the billing systems should call: this server, as the dashboard reached it
function baseUrlOf(req) {
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol).split(',')[0];
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}`;
}

// docs written for one billing system when systemId is given, generic otherwise
async function docsFor(req) {
  let system = null;
  if (req.query.systemId) {
    const found = await BillingSystem.findById(req.query.systemId);
    if (found) system = { code: found.code, name: found.name, callback_url: found.callback_url };
  }
  return buildDocs({ baseUrl: baseUrlOf(req), system });
}

async function getDocs(req, res) {
  try {
    const docs = await docsFor(req);
    docs.groups.forEach((g) => g.endpoints.forEach((e) => { e.curl = generator.curlFor(e, docs); }));

    const systems = (await BillingSystem.findAll()).map((s) => ({ id: s.id, code: s.code, name: s.name }));
    const files = generator.files(docs).map((f) => ({ id: f.id, name: f.name }));
    res.json({ success: true, data: { docs, systems, files } });
  } catch (error) {
    console.error('Developer docs error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

async function downloadFile(req, res) {
  try {
    const file = generator.files(await docsFor(req)).find((f) => f.id === req.params.id);
    if (!file) return res.status(404).json({ success: false, message: 'No such file' });

    res.set('Content-Type', `${file.type}; charset=utf-8`);
    res.set('Content-Disposition', `attachment; filename="${file.name}"`);
    res.send(file.content);
  } catch (error) {
    console.error('Developer download error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = { getDocs, downloadFile };
