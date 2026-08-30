const mysql = require('mysql2/promise');
require('dotenv').config();

const migrations = `
-- Create database if not exists
CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME};

USE ${process.env.DB_NAME};

-- Bills table
CREATE TABLE IF NOT EXISTS bills (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bill_id VARCHAR(100) UNIQUE NOT NULL,
  sub_sp_code VARCHAR(10),
  sp_sys_id VARCHAR(10),
  bill_amount DECIMAL(15, 2) NOT NULL,
  misc_amount DECIMAL(15, 2) DEFAULT 0,
  bill_expiry_date DATETIME NOT NULL,
  payer_id VARCHAR(50),
  payer_name VARCHAR(200),
  payer_cell_num VARCHAR(12),
  payer_email VARCHAR(100),
  bill_description TEXT,
  currency VARCHAR(3) DEFAULT 'TZS',
  bill_equiv_amount DECIMAL(15, 2),
  reminder_flag BOOLEAN DEFAULT TRUE,
  bill_pay_option TINYINT DEFAULT 1,
  payment_control_number VARCHAR(12),
  status ENUM('PENDING', 'APPROVED', 'REJECTED', 'PAID', 'CANCELLED', 'EXPIRED') DEFAULT 'PENDING',
  transaction_status VARCHAR(2),
  transaction_status_code VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_bill_id (bill_id),
  INDEX idx_control_number (payment_control_number),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Bill items table
CREATE TABLE IF NOT EXISTS bill_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bill_id VARCHAR(100) NOT NULL,
  bill_item_ref VARCHAR(50),
  use_item_ref_on_pay CHAR(1) DEFAULT 'N',
  bill_item_amount DECIMAL(15, 2) NOT NULL,
  bill_item_equiv_amount DECIMAL(15, 2),
  bill_item_misc_amount DECIMAL(15, 2) DEFAULT 0,
  gfs_code VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bill_id) REFERENCES bills(bill_id) ON DELETE CASCADE,
  INDEX idx_bill_id (bill_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_id VARCHAR(100) UNIQUE,
  sp_code VARCHAR(5),
  pay_ref_id VARCHAR(100),
  bill_id VARCHAR(100),
  payment_control_number VARCHAR(12),
  bill_amount DECIMAL(15, 2),
  paid_amount DECIMAL(15, 2),
  bill_pay_option VARCHAR(10),
  currency VARCHAR(3),
  transaction_datetime DATETIME,
  used_payment_channel VARCHAR(50),
  payer_cell_num VARCHAR(12),
  payer_name VARCHAR(200),
  payer_email VARCHAR(100),
  psp_receipt_number VARCHAR(100),
  psp_name VARCHAR(100),
  credited_account_number VARCHAR(30),
  payment_type ENUM('OFFLINE', 'ONLINE') DEFAULT 'OFFLINE',
  authorization_code VARCHAR(100),
  status ENUM('PENDING', 'ACKNOWLEDGED', 'PROCESSED') DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (bill_id) REFERENCES bills(bill_id),
  INDEX idx_transaction_id (transaction_id),
  INDEX idx_bill_id (bill_id),
  INDEX idx_control_number (payment_control_number),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Reconciliation requests table
CREATE TABLE IF NOT EXISTS reconciliation_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reconciliation_request_id VARCHAR(15) UNIQUE NOT NULL,
  sp_code VARCHAR(5),
  sp_sys_id VARCHAR(10),
  transaction_date DATE NOT NULL,
  reconciliation_option TINYINT,
  status ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') DEFAULT 'PENDING',
  status_code VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_request_id (reconciliation_request_id),
  INDEX idx_transaction_date (transaction_date),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Reconciliation transactions table
CREATE TABLE IF NOT EXISTS reconciliation_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reconciliation_request_id VARCHAR(15),
  sp_bill_id VARCHAR(50),
  bill_control_number VARCHAR(12),
  psp_transaction_id VARCHAR(100),
  paid_amount DECIMAL(15, 2),
  currency VARCHAR(3),
  pay_ref_id VARCHAR(100),
  transaction_datetime DATETIME,
  credited_account_number VARCHAR(15),
  used_payment_channel VARCHAR(50),
  psp_name VARCHAR(100),
  psp_code VARCHAR(10),
  depositor_cell_num VARCHAR(12),
  depositor_name VARCHAR(100),
  depositor_email VARCHAR(100),
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reconciliation_request_id) REFERENCES reconciliation_requests(reconciliation_request_id),
  INDEX idx_request_id (reconciliation_request_id),
  INDEX idx_bill_id (sp_bill_id),
  INDEX idx_control_number (bill_control_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- API logs table
CREATE TABLE IF NOT EXISTS api_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  endpoint VARCHAR(191),
  method VARCHAR(10),
  request_body TEXT,
  response_body TEXT,
  status_code INT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_endpoint (endpoint),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- System configurations table
CREATE TABLE IF NOT EXISTS system_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  config_key VARCHAR(191) UNIQUE NOT NULL,
  config_value TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

-- Idempotent upgrade path: CREATE TABLE IF NOT EXISTS above is a no-op if
-- the users table already exists from an earlier migration run, so these
-- ALTER statements make sure mobile/must_change_password land either way.
-- Requires MySQL 8.0.29+ or MariaDB 10.0.2+ for "ADD COLUMN IF NOT EXISTS".
ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile VARCHAR(20) AFTER full_name;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER status;

-- User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(191) UNIQUE NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id VARCHAR(100),
  description TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  request_data TEXT,
  response_data TEXT,
  status VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_entity_type (entity_type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert default admin user (password: admin123)
-- Hash generated with: bcrypt.hash('admin123', 10)
INSERT INTO users (username, email, password, full_name, role, status) VALUES
('admin', 'admin@gepg-bridge.local', '$2b$10$1UYQtg.JL0Rodt0xfPCLfe3CkwuM0G9eMowrZrPJft039mGU0mcwW', 'System Administrator', 'ADMIN', 'ACTIVE')
ON DUPLICATE KEY UPDATE password=VALUES(password);

-- Insert sample users (password: admin123 for all)
INSERT INTO users (username, email, password, full_name, role, status) VALUES
('user1', 'user1@gepg-bridge.local', '$2b$10$1UYQtg.JL0Rodt0xfPCLfe3CkwuM0G9eMowrZrPJft039mGU0mcwW', 'John Doe', 'USER', 'ACTIVE'),
('viewer', 'viewer@gepg-bridge.local', '$2b$10$1UYQtg.JL0Rodt0xfPCLfe3CkwuM0G9eMowrZrPJft039mGU0mcwW', 'Jane Viewer', 'VIEWER', 'ACTIVE')
ON DUPLICATE KEY UPDATE password=VALUES(password);

-- Insert default configurations
INSERT INTO system_config (config_key, config_value, description) VALUES
('gepg_endpoint_bill_submission', 'http://<gepgIP>:<port>/api/bill/sigqrequest', 'GePG Bill Submission Endpoint'),
('gepg_endpoint_bill_reuse', 'http://<gepgIP>:<port>/api/bill/sigqrequest_reuse', 'GePG Bill Control Number Reuse Endpoint'),
('gepg_endpoint_bill_update', 'http://<gepgIP>:<port>/api/bill/sigqrequest_change', 'GePG Bill Update Endpoint'),
('gepg_endpoint_bill_cancellation', 'http://<gepgIP>:<port>/api/bill/sigcancel_request', 'GePG Bill Cancellation Endpoint'),
('gepg_endpoint_reconciliation', 'http://<gepgIP>:<port>/api/reconciliations/sig_sp_qrequest', 'GePG Reconciliation Endpoint')
ON DUPLICATE KEY UPDATE config_value=VALUES(config_value);

-- OTP verifications table - backs the 3-step OTP login flow
-- (validate-credentials -> send-otp -> verify-otp)
CREATE TABLE IF NOT EXISTS otp_verifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(100) NOT NULL,
  otp_code VARCHAR(6) NOT NULL,
  expires_at DATETIME NOT NULL,
  used TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_otp (email, otp_code, used),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- API keys table — for machine-to-machine access to this bridge's REST API
-- (separate from user_sessions, which is for the dashboard's human JWT login)
CREATE TABLE IF NOT EXISTS api_keys (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  key_prefix VARCHAR(20) NOT NULL,
  key_hash VARCHAR(255) NOT NULL,
  status ENUM('ACTIVE', 'DISABLED') DEFAULT 'ACTIVE',
  created_by INT,
  last_used_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_key_hash (key_hash),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

async function runMigrations() {
  let connection;
  try {
    // Create connection without database selection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT || 3306,
      multipleStatements: true
    });

    console.log('Running database migrations...');
    await connection.query(migrations);
    console.log('Migrations completed successfully!');
    console.log('\nTables created:');
    console.log('   - bills, bill_items, payments');
    console.log('   - reconciliation_requests, reconciliation_transactions');
    console.log('   - api_logs, system_config');
    console.log('   - users, user_sessions, activity_logs');
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

// Run migrations
runMigrations();
