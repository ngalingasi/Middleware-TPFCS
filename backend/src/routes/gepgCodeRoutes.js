// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ GePG codes routes
// └──────────────────────────────────────────────────────────────────────────┘

const express = require('express');
const router = express.Router();
const authenticateAny = require('../middleware/authenticateAny');
const { listCodes } = require('../utils/gepgCodes');

router.get('/', authenticateAny, (req, res) => {
  res.json({ success: true, data: listCodes() });
});

module.exports = router;
