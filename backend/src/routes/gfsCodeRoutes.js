// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ GFS code routes
// └──────────────────────────────────────────────────────────────────────────┘

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const authenticateAny = require('../middleware/authenticateAny');
const gfsCodeController = require('../controllers/gfsCodeController');

router.get('/', authenticateAny, gfsCodeController.getActiveGfsCodes);

router.get('/admin', authenticate, authorize('ADMIN'), gfsCodeController.getGfsCodesAdmin);

router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  [
    body('code').notEmpty().withMessage('Code is required').isLength({ max: 20 }).withMessage('Code must be 20 characters or fewer')
  ],
  gfsCodeController.createGfsCode
);

router.patch(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  [body('status').optional().isIn(['ACTIVE', 'INACTIVE']).withMessage('status must be ACTIVE or INACTIVE')],
  gfsCodeController.updateGfsCode
);

router.delete('/:id', authenticate, authorize('ADMIN'), gfsCodeController.deleteGfsCode);

module.exports = router;
