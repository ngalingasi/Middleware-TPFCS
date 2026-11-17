// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Billing systems routes
// └──────────────────────────────────────────────────────────────────────────┘

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const controller = require('../controllers/billingSystemController');

router.use(authenticate, authorize('ADMIN'));

router.get('/', controller.list);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.post('/:id/secret', controller.rotateSecret);
router.get('/:id/keys', controller.keys);
router.post('/:id/test', controller.sendTest);
router.post('/:id/replay-dead', controller.replayDead);

module.exports = router;
