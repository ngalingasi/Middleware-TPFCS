const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const authenticateAny = require('../middleware/authenticateAny');
const gfsCodeController = require('../controllers/gfsCodeController');

/**
 * @route   GET /api/gfs-codes
 * @desc    ACTIVE GFS codes only - used by the bill-create dropdown and by
 *          any child system to discover which codes this bridge accepts.
 * @access  Dashboard (JWT) or child system (X-Api-Key)
 */
router.get('/', authenticateAny, gfsCodeController.getActiveGfsCodes);

/**
 * @route   GET /api/gfs-codes/admin
 * @desc    Full paginated list, all statuses - for the admin management page.
 * @access  Admin only (JWT)
 */
router.get('/admin', authenticate, authorize('ADMIN'), gfsCodeController.getGfsCodesAdmin);

/**
 * @route   POST /api/gfs-codes
 * @desc    Add a GFS code to the master list.
 * @access  Admin only (JWT)
 */
router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  [
    body('code').notEmpty().withMessage('Code is required').isLength({ max: 20 }).withMessage('Code must be 20 characters or fewer')
  ],
  gfsCodeController.createGfsCode
);

/**
 * @route   PATCH /api/gfs-codes/:id
 * @desc    Update a code's description and/or ACTIVE/INACTIVE status.
 * @access  Admin only (JWT)
 */
router.patch(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  [body('status').optional().isIn(['ACTIVE', 'INACTIVE']).withMessage('status must be ACTIVE or INACTIVE')],
  gfsCodeController.updateGfsCode
);

/**
 * @route   DELETE /api/gfs-codes/:id
 * @desc    Remove a code from the master list. Prefer disabling
 *          (PATCH status=INACTIVE) if it may have been used on past bills -
 *          there is no FK tying historical bill_items to this table, so
 *          deleting here does not affect existing bills either way.
 * @access  Admin only (JWT)
 */
router.delete('/:id', authenticate, authorize('ADMIN'), gfsCodeController.deleteGfsCode);

module.exports = router;
