// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Outbox routes
// └──────────────────────────────────────────────────────────────────────────┘

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const controller = require('../controllers/outboxController');

router.use(authenticate, authorize('ADMIN'));

router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/:id/replay', controller.replay);

module.exports = router;
