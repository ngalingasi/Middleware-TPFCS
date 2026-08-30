const crypto = require('crypto');
const db = require('../config/database');

const KEY_PREFIX = 'gpg_live_';

class ApiKey {
  /**
   * Generates a new key, returning both the plaintext (shown to the user
   * exactly once) and the hash that gets persisted. We never store the
   * plaintext key anywhere.
   */
  generateKey() {
    const secret = crypto.randomBytes(32).toString('hex');
    const plaintextKey = `${KEY_PREFIX}${secret}`;
    const keyHash = crypto.createHash('sha256').update(plaintextKey).digest('hex');
    return { plaintextKey, keyHash, keyPrefix: `${KEY_PREFIX}${secret.slice(0, 4)}...${secret.slice(-4)}` };
  }

  hash(plaintextKey) {
    return crypto.createHash('sha256').update(plaintextKey).digest('hex');
  }

  async create({ name, keyHash, keyPrefix, createdBy }) {
    const [result] = await db.query(
      `INSERT INTO api_keys (name, key_prefix, key_hash, created_by, status)
       VALUES (?, ?, ?, ?, 'ACTIVE')`,
      [name, keyPrefix, keyHash, createdBy]
    );
    return result.insertId;
  }

  async findAll() {
    const [rows] = await db.query(
      `SELECT k.id, k.name, k.key_prefix, k.status, k.last_used_at, k.created_at, u.username as created_by_username
       FROM api_keys k
       LEFT JOIN users u ON k.created_by = u.id
       ORDER BY k.created_at DESC`
    );
    return rows;
  }

  async findById(id) {
    const [rows] = await db.query('SELECT * FROM api_keys WHERE id = ?', [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Used by the (optional) apiKeyAuth middleware to validate an incoming
   * X-Api-Key header against stored hashes.
   */
  async findActiveByHash(keyHash) {
    const [rows] = await db.query(
      `SELECT * FROM api_keys WHERE key_hash = ? AND status = 'ACTIVE'`,
      [keyHash]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  async setStatus(id, status) {
    await db.query('UPDATE api_keys SET status = ? WHERE id = ?', [status, id]);
  }

  async touchLastUsed(id) {
    await db.query('UPDATE api_keys SET last_used_at = NOW() WHERE id = ?', [id]);
  }

  async delete(id) {
    await db.query('DELETE FROM api_keys WHERE id = ?', [id]);
  }
}

module.exports = new ApiKey();
