// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ GFS code controller
// └──────────────────────────────────────────────────────────────────────────┘

const { validationResult } = require('express-validator');
const GfsCode = require('../models/GfsCode');
const BillingSystem = require('../models/BillingSystem');
const ActivityLog = require('../models/ActivityLog');
const caller = require('../utils/caller');

async function getActiveGfsCodes(req, res) {
  try {
    // a billing system sees only the codes linked to it; dashboard users see all of them
    const system = caller.systemOf(req);
    const codes = await GfsCode.findAllActive(system ? system.id : undefined);
    res.json({ success: true, data: codes });
  } catch (error) {
    console.error('Get active GFS codes error:', error);
    res.status(500).json({ success: false, message: 'Failed to get GFS codes' });
  }
}

async function getGfsCodesAdmin(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await GfsCode.findAllAdmin(page, limit, {
      status: req.query.status,
      systemId: req.query.systemId,
      unlinked: req.query.unlinked === '1'
    });
    res.json({ success: true, data: result.data, pagination: result.pagination });
  } catch (error) {
    console.error('Get GFS codes error:', error);
    res.status(500).json({ success: false, message: 'Failed to get GFS codes' });
  }
}

async function createGfsCode(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
    }

    const { code, description } = req.body;
    const billingSystemId = req.body.billingSystemId ? Number(req.body.billingSystemId) : null;
    if (billingSystemId && !(await BillingSystem.findById(billingSystemId))) {
      return res.status(400).json({ success: false, message: 'Billing system not found' });
    }
    const id = await GfsCode.create({ code: code.trim(), description, createdBy: req.user.id, billingSystemId });

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

    // billingSystemId: null unlinks the code, a number moves it to that billing system
    let billingSystemId;
    let target = null;
    if ('billingSystemId' in req.body) {
      billingSystemId = req.body.billingSystemId ? Number(req.body.billingSystemId) : null;
      if (billingSystemId) {
        target = await BillingSystem.findById(billingSystemId);
        if (!target) return res.status(400).json({ success: false, message: 'Billing system not found' });
      }
    }

    await GfsCode.update(id, { description: req.body.description, status: req.body.status, billingSystemId });

    if (billingSystemId !== undefined && billingSystemId !== existing.billing_system_id) {
      await ActivityLog.create({
        user_id: req.user.id, action: 'GFS_LINK', entity_type: 'gfs_code', entity_id: existing.code,
        description: target ? `GFS code ${existing.code} linked to ${target.code}` : `GFS code ${existing.code} unlinked from its billing system`,
        ip_address: req.ip, user_agent: req.headers['user-agent'], request_data: { billingSystemId }, response_data: null, status: 'SUCCESS'
      });
    }
    res.json({ success: true, message: 'GFS code updated' });
  } catch (error) {
    console.error('Update GFS code error:', error);
    res.status(500).json({ success: false, message: 'Failed to update GFS code' });
  }
}

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
