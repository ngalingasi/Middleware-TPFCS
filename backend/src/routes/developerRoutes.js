// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Developer routes
// └──────────────────────────────────────────────────────────────────────────┘

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const controller = require('../controllers/developerController');

router.use(authenticate, authorize('ADMIN'));

router.get('/docs', controller.getDocs);
router.get('/files/:id', controller.downloadFile);

module.exports = router;
