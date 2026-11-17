const express = require('express');
const router = express.Router();
const authenticateAny = require('../middleware/authenticateAny');
const { listCodes } = require('../utils/gepgCodes');

/**
 * @route   GET /api/gepg-codes
 * @desc    GePG response code catalogue, so the dashboard (and child
 *          systems) can show a description next to every code GePG returns.
 * @access  Dashboard (JWT) or child system (X-Api-Key)
 */
router.get('/', authenticateAny, (req, res) => {
  res.json({ success: true, data: listCodes() });
});

module.exports = router;
