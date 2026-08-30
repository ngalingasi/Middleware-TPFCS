const db = require('../config/database');

/**
 * Backs the 3-step OTP login flow: validate-credentials -> send-otp -> verify-otp.
 *
 * Note on expires_at: rather than computing the expiry timestamp in JS
 * (which is fragile across Node/MySQL timezone mismatches - the source
 * this was adapted from had a hand-rolled "+3 hours EAT offset" hack to
 * compensate for exactly that), this lets MySQL compute both NOW() and
 * the expiry in the same session timezone via DATE_ADD(NOW(), ...).
 */
class Otp {
  async saveOtp({ email, otpCode, expiryMinutes }) {
    // Invalidate any previous unused OTP for this email first
    await db.query('UPDATE otp_verifications SET used = 1 WHERE email = ? AND used = 0', [email]);

    const [result] = await db.query(
      `INSERT INTO otp_verifications (email, otp_code, expires_at, used)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), 0)`,
      [email, otpCode, expiryMinutes]
    );
    return { id: result.insertId };
  }

  async findValid({ email, otpCode }) {
    const [rows] = await db.query(
      `SELECT * FROM otp_verifications
       WHERE email = ? AND otp_code = ? AND used = 0 AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [email, otpCode]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  async markUsed(id) {
    await db.query('UPDATE otp_verifications SET used = 1 WHERE id = ?', [id]);
  }

  async cleanExpired() {
    await db.query('DELETE FROM otp_verifications WHERE expires_at < NOW()');
  }
}

module.exports = new Otp();
