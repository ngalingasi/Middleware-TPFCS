const bcrypt = require('bcrypt');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const UserSession = require('../models/UserSession');

async function getUsers(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const result = await User.findAll(page, limit);
    res.json({ success: true, data: result.data, pagination: result.pagination });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: 'Failed to get users' });
  }
}

async function getUserById(req, res) {
  try {
    const { id } = req.params;

    if (req.user.role !== 'ADMIN' && req.user.id !== parseInt(id)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, message: 'Failed to get user' });
  }
}

async function updateUser(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const existing = await User.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const updated = await User.update(id, req.body);
    if (!updated) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    const user = await User.findById(id);
    res.json({ success: true, message: 'User updated successfully', data: user });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
}

async function deleteUser(req, res) {
  try {
    const { id } = req.params;

    if (req.user.id === parseInt(id)) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    }

    const existing = await User.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await User.delete(id);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
}

async function resetPassword(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { newPassword } = req.body;

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.updatePassword(id, hashedPassword);
    await UserSession.deleteAllForUser(id);

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
}

async function getUserSessions(req, res) {
  try {
    const { id } = req.params;

    if (req.user.role !== 'ADMIN' && req.user.id !== parseInt(id)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const sessions = await UserSession.findActiveForUser(id);
    res.json({ success: true, data: sessions });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ success: false, message: 'Failed to get sessions' });
  }
}

module.exports = { getUsers, getUserById, updateUser, deleteUser, resetPassword, getUserSessions };
