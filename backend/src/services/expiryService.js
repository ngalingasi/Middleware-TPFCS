// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Expiry job: marks approved bills past their expiry date as EXPIRED
// └──────────────────────────────────────────────────────────────────────────┘

const Bill = require('../models/Bill');

const CHECK_EVERY_MS = 10 * 60 * 1000;

async function run() {
  try {
    const expired = await Bill.expireDue();
    if (expired > 0) console.log(`Expired ${expired} bill(s)`);
  } catch (error) {
    console.error('Expiry job error:', error.message);
  }
}

function startExpiryJob() {
  run();
  setInterval(run, CHECK_EVERY_MS).unref();
}

module.exports = { startExpiryJob, run };
