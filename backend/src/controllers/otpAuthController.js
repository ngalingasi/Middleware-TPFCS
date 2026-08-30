const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const UserSession = require('../models/UserSession');
const Otp = require('../models/Otp');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');

const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10);

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function maskEmail(email) {
  return email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(Math.max(b.length, 3)) + c);
}

function maskPhone(phone) {
  const clean = String(phone).replace(/\D/g, '');
  if (clean.length < 6) return '****';
  return clean.slice(0, 3) + '*'.repeat(clean.length - 6) + clean.slice(-3);
}

/**
 * POST /api/auth/validate-credentials
 * Step 1 of 3 - checks username/password, returns available OTP channels
 * (masked email/phone) without sending anything yet.
 */
async function validateCredentials(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { login, password } = req.body;

    const user = await User.findByUsernameOrEmail(login);
    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.must_change_password) {
      return res.status(200).json({
        success: false,
        mustChangePassword: true,
        message: 'You must change your password before continuing',
      });
    }

    const channels = [];
    if (user.email) channels.push({ type: 'email', display: maskEmail(user.email), label: 'Email' });
    if (user.mobile) channels.push({ type: 'sms', display: maskPhone(user.mobile), label: 'SMS' });

    if (channels.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No OTP delivery channel is configured for this account. Contact an administrator.',
      });
    }

    return res.json({
      success: true,
      message: 'Credentials valid. Please choose an OTP delivery channel.',
      data: { channels },
    });
  } catch (error) {
    console.error('validateCredentials error:', error);
    res.status(500).json({ success: false, message: 'Failed to validate credentials' });
  }
}

/**
 * POST /api/auth/send-otp
 * Step 2 of 3 - generates and delivers the OTP over the chosen channel.
 */
async function sendOtp(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { login, channel } = req.body;

    if (!['email', 'sms'].includes(channel)) {
      return res.status(400).json({ success: false, message: 'channel must be "email" or "sms"' });
    }

    const user = await User.findByUsernameOrEmail(login);

    // Don't reveal whether the account exists
    if (!user || user.status !== 'ACTIVE') {
      return res.json({ success: true, message: 'If the account exists, an OTP has been sent' });
    }

    Otp.cleanExpired().catch(() => {});

    const otpCode = generateOtp();
    await Otp.saveOtp({ email: user.email, otpCode, expiryMinutes: OTP_EXPIRY_MINUTES });

    if (channel === 'email') {
      await emailService.sendOtpEmail(user.email, otpCode, OTP_EXPIRY_MINUTES);
      return res.json({
        success: true,
        message: 'OTP sent to your email',
        data: { channel: 'email', maskedContact: maskEmail(user.email) },
      });
    }

    // channel === 'sms'
    if (!user.mobile) {
      return res.status(400).json({ success: false, message: 'No phone number on record for this account' });
    }

    await smsService.sendSmsBrandBox(
      `Your Middleware login OTP is: ${otpCode}. Valid for ${OTP_EXPIRY_MINUTES} minutes. Do not share this code.`,
      [user.mobile]
    );

    return res.json({
      success: true,
      message: 'OTP sent via SMS',
      data: { channel: 'sms', maskedContact: maskPhone(user.mobile) },
    });
  } catch (error) {
    console.error('sendOtp error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to send OTP' });
  }
}

/**
 * POST /api/auth/verify-otp
 * Step 3 of 3 - verifies the OTP and issues the same JWT + session the
 * plain /auth/login endpoint issues (single long-lived token, no refresh
 * token - this app doesn't have a refresh-token endpoint at all, so
 * issuing one here would be a dead end for the frontend).
 */
async function verifyOtp(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { login, otp } = req.body;

    const user = await User.findByUsernameOrEmail(login);
    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({ success: false, message: 'Invalid or expired OTP' });
    }

    const validOtp = await Otp.findValid({ email: user.email, otpCode: otp });
    if (!validOtp) {
      return res.status(401).json({ success: false, message: 'Invalid or expired OTP. Please request a new one.' });
    }

    await Otp.markUsed(validOtp.id);

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await UserSession.create({
      userId: user.id,
      token,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      expiresAt,
    });

    await User.updateLastLogin(user.id);

    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error('verifyOtp error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify OTP' });
  }
}

module.exports = { validateCredentials, sendOtp, verifyOtp };
