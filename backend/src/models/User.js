const db = require('../config/database');

class User {
  async findByUsernameOrEmail(usernameOrEmail) {
    const [users] = await db.query(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [usernameOrEmail, usernameOrEmail]
    );
    return users.length > 0 ? users[0] : null;
  }

  async findById(id) {
    const [users] = await db.query(
      `SELECT id, username, email, full_name, role, status, last_login, created_at
       FROM users WHERE id = ?`,
      [id]
    );
    return users.length > 0 ? users[0] : null;
  }

  async findByIdWithPassword(id) {
    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    return users.length > 0 ? users[0] : null;
  }

  async findAll(page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const [countResult] = await db.query('SELECT COUNT(*) as total FROM users');
    const [users] = await db.query(
      `SELECT id, username, email, full_name, role, status, last_login, created_at
       FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    return {
      data: users,
      pagination: {
        page,
        limit,
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / limit)
      }
    };
  }

  async existsByUsernameOrEmail(username, email) {
    const [existing] = await db.query(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );
    return existing.length > 0;
  }

  async create({ username, email, hashedPassword, fullName, role }) {
    const [result] = await db.query(
      `INSERT INTO users (username, email, password, full_name, role)
       VALUES (?, ?, ?, ?, ?)`,
      [username, email, hashedPassword, fullName, role]
    );
    return { id: result.insertId, username, email, fullName, role };
  }

  async update(id, fields) {
    const updates = [];
    const values = [];

    if (fields.email) {
      updates.push('email = ?');
      values.push(fields.email);
    }
    if (fields.fullName) {
      updates.push('full_name = ?');
      values.push(fields.fullName);
    }
    if (fields.role) {
      updates.push('role = ?');
      values.push(fields.role);
    }
    if (fields.status) {
      updates.push('status = ?');
      values.push(fields.status);
    }

    if (updates.length === 0) return false;

    values.push(id);
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
    return true;
  }

  async updatePassword(id, hashedPassword) {
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id]);
  }

  async updateLastLogin(id) {
    await db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [id]);
  }

  async delete(id) {
    await db.query('DELETE FROM users WHERE id = ?', [id]);
  }
}

module.exports = new User();
