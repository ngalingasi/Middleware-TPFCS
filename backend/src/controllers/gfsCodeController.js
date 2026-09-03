const { validationResult } = require('express-validator');
const GfsCode = require('../models/GfsCode');

/**
 * GET /api/gfs-codes
 * ACTIVE codes only - what the bill-create dropdown and any child system
 * use to discover which GFS codes this bridge currently accepts.
 */
async function getActiveGfsCodes(req, res) {
  try {
    const codes = await GfsCode.findAllActive();
    res.json({ success: true, data: codes });
  } catch (error) {
    console.error('Get active GFS codes error:', error);
    res.status(500).json({ success: false, message: 'Failed to get GFS codes' });
  }
}

/**
 * GET /api/gfs-codes/admin
 * Full paginated list, all statuses, for the admin management page.
 */
async function getGfsCodesAdmin(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await GfsCode.findAllAdmin(page, limit, { status: req.query.status });
    res.json({ success: true, data: result.data, pagination: result.pagination });
  } catch (error) {
    console.error('Get GFS codes error:', error);
    res.status(500).json({ success: false, message: 'Failed to get GFS codes' });
  }
}

/**
 * POST /api/gfs-codes
 */
async function createGfsCode(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
    }

    const { code, description } = req.body;
    const id = await GfsCode.create({ code: code.trim(), description, createdBy: req.user.id });

    res.status(201).json({
      success: true,
      message: 'GFS code created',
      data: { id, code: code.trim(), description: description || null, status: 'ACTIVE' }
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'This GFS code already exists' });
    }
    console.error('Create GFS code error:', error);
    res.status(500).json({ success: false, message: 'Failed to create GFS code' });
  }
}

/**
 * PATCH /api/gfs-codes/:id
 * Body: { description?, status? } - the code itself is not editable, only
 * its description/status; delete and recreate if the code was wrong.
 */
async function updateGfsCode(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
    }

    const { id } = req.params;
    const existing = await GfsCode.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'GFS code not found' });
    }

    await GfsCode.update(id, { description: req.body.description, status: req.body.status });
    res.json({ success: true, message: 'GFS code updated' });
  } catch (error) {
    console.error('Update GFS code error:', error);
    res.status(500).json({ success: false, message: 'Failed to update GFS code' });
  }
}

/**
 * DELETE /api/gfs-codes/:id
 */
async function deleteGfsCode(req, res) {
  try {
    const { id } = req.params;
    const existing = await GfsCode.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'GFS code not found' });
    }

    await GfsCode.delete(id);
    res.json({ success: true, message: 'GFS code deleted' });
  } catch (error) {
    console.error('Delete GFS code error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete GFS code' });
  }
}

module.exports = {
  getActiveGfsCodes,
  getGfsCodesAdmin,
  createGfsCode,
  updateGfsCode,
  deleteGfsCode
};
