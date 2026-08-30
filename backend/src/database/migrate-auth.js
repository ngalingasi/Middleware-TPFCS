const mysql = require('mysql2/promise');
require('dotenv').config();

const authMigrations = `
USE ${process.env.DB_NAME};

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(200),
  mobile VARCHAR(20),
  role ENUM('ADMIN', 'USER', 'VIEWER') DEFAULT 'USER',
  status ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED') DEFAULT 'ACTIVE',
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  last_login DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_username (username),
  INDEX idx_email (email),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Idempotent upgrade path, same reasoning as migrate.js
ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile VARCHAR(20) AFTER full_name;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER status;

-- User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Activity logs table (enhanced)
CREATE TABLE IF NOT EXISTS activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id VARCHAR(100),
  description TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  request_data JSON,
  response_data JSON,
  status VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_entity_type (entity_type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert default admin user
-- Password: admin123 (hashed with bcrypt)
INSERT INTO users (username, email, password, full_name, role, status) VALUES
('admin', 'admin@gepg-bridge.local', '$2b$10$1UYQtg.JL0Rodt0xfPCLfe3CkwuM0G9eMowrZrPJft039mGU0mcwW', 'System Administrator', 'ADMIN', 'ACTIVE')
ON DUPLICATE KEY UPDATE password=VALUES(password);

-- Insert sample users
INSERT INTO users (username, email, password, full_name, role, status) VALUES
('user1', 'user1@gepg-bridge.local', '$2b$10$1UYQtg.JL0Rodt0xfPCLfe3CkwuM0G9eMowrZrPJft039mGU0mcwW', 'John Doe', 'USER', 'ACTIVE'),
('viewer', 'viewer@gepg-bridge.local', '$2b$10$1UYQtg.JL0Rodt0xfPCLfe3CkwuM0G9eMowrZrPJft039mGU0mcwW', 'Jane Viewer', 'VIEWER', 'ACTIVE')
ON DUPLICATE KEY UPDATE password=VALUES(password);
`;

async function runAuthMigrations() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT || 3306,
      multipleStatements: true
    });

    console.log('Running authentication migrations...');
    await connection.query(authMigrations);
    console.log('Authentication migrations completed successfully!');
    console.log('\nDefault users created:');
    console.log('   Admin    - username: admin,  password: admin123');
    console.log('   User     - username: user1,  password: admin123');
    console.log('   Viewer   - username: viewer, password: admin123');

  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runAuthMigrations();
