const db = require('../config/database');

class UserSession {
  async create({ userId, token, ipAddress, userAgent, expiresAt }) {
    await db.query(
      `INSERT INTO user_sessions (user_id, token, ip_address, user_agent, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, token, ipAddress, userAgent, expiresAt]
    );
  }

  async findValidByToken(token) {
    const [sessions] = await db.query(
      `SELECT s.*, u.username, u.email, u.role, u.status
       FROM user_sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = ? AND s.expires_at > NOW()`,
      [token]
    );
    return sessions.length > 0 ? sessions[0] : null;
  }

  async deleteByToken(token) {
    await db.query('DELETE FROM user_sessions WHERE token = ?', [token]);
  }

  async deleteAllForUserExcept(userId, keepToken) {
    await db.query('DELETE FROM user_sessions WHERE user_id = ? AND token != ?', [userId, keepToken]);
  }

  async deleteAllForUser(userId) {
    await db.query('DELETE FROM user_sessions WHERE user_id = ?', [userId]);
  }

  async findActiveForUser(userId) {
    const [sessions] = await db.query(
      `SELECT id, ip_address, user_agent, created_at, expires_at
       FROM user_sessions
       WHERE user_id = ? AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [userId]
    );
    return sessions;
  }
}

module.exports = new UserSession();
