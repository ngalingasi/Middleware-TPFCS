// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Database migration
// └──────────────────────────────────────────────────────────────────────────┘

const mysql = require('mysql2/promise');
require('dotenv').config();

const migrations = `
-- Create database if not exists
CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME};

USE ${process.env.DB_NAME};

-- Bills table
CREATE TABLE IF NOT EXISTS bills (
  id INT AUTO_INCREMENT PRIMARY KEY,
  -- the child system's own reference; becomes BillId/GrpBillId for GePG, must stay unique
  bill_id VARCHAR(100) UNIQUE NOT NULL,
  sub_sp_code VARCHAR(10),
  -- v4 leftover, effectively always NULL (SysCode comes from env now)
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
  ref_bill_id VARCHAR(100),
  coll_sp VARCHAR(10),
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

-- v5 columns (nullable, older rows predate them). Needs MySQL 8.0.29+ / MariaDB 10.0.2+ for IF NOT EXISTS
ALTER TABLE bills ADD COLUMN IF NOT EXISTS cust_tin VARCHAR(20) AFTER payer_id;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS cust_id_typ VARCHAR(5) AFTER cust_tin;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS cust_accnt VARCHAR(50) AFTER cust_id_typ;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS coll_cent_code VARCHAR(20) AFTER cust_accnt;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS min_pay_amt DECIMAL(15, 2) AFTER bill_equiv_amount;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS exch_rate DECIMAL(15, 2) AFTER min_pay_amt;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS pay_plan TINYINT AFTER bill_pay_option;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS pay_lim_typ TINYINT AFTER pay_plan;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS pay_lim_amt DECIMAL(15, 2) AFTER pay_lim_typ;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS coll_psp VARCHAR(100) AFTER pay_lim_amt;

ALTER TABLE bill_items ADD COLUMN IF NOT EXISTS ref_bill_id VARCHAR(100) AFTER gfs_code;
ALTER TABLE bill_items ADD COLUMN IF NOT EXISTS coll_sp VARCHAR(10) AFTER ref_bill_id;

ALTER TABLE payments ADD COLUMN IF NOT EXISTS psp_code VARCHAR(10) AFTER psp_name;

ALTER TABLE reconciliation_requests MODIFY COLUMN reconciliation_option TINYINT NULL;

ALTER TABLE reconciliation_transactions ADD COLUMN IF NOT EXISTS bill_amount DECIMAL(15, 2) AFTER paid_amount;
ALTER TABLE reconciliation_transactions ADD COLUMN IF NOT EXISTS bill_pay_option VARCHAR(10) AFTER bill_amount;

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

-- CREATE TABLE IF NOT EXISTS skips an existing users table, so add these columns separately
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

-- settings are saved from the Settings page; old seeded endpoint rows held placeholders and would override .env
DELETE FROM system_config WHERE config_value LIKE '%<gepgIP>%';

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

-- GFS codes master list, bill items are checked against the ACTIVE ones.
-- No FK from bill_items on purpose: old bills may predate this list, and codes are disabled rather than deleted
CREATE TABLE IF NOT EXISTS gfs_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  description VARCHAR(255),
  status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_code (code),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- spec 4.6 says GfsCode is String(20), VARCHAR(10) would truncate
ALTER TABLE bill_items MODIFY COLUMN gfs_code VARCHAR(20) NOT NULL;

-- widen columns that were too small for v5 values (ReqId ~20 chars, SpCode 7, control numbers up to 20 digits).
-- reconciliation_request_id is in a foreign key, so both sides change with FK checks off
SET FOREIGN_KEY_CHECKS = 0;
ALTER TABLE reconciliation_requests MODIFY COLUMN reconciliation_request_id VARCHAR(100) NOT NULL;
ALTER TABLE reconciliation_transactions MODIFY COLUMN reconciliation_request_id VARCHAR(100);
SET FOREIGN_KEY_CHECKS = 1;

ALTER TABLE reconciliation_requests MODIFY COLUMN sp_code VARCHAR(10);
ALTER TABLE reconciliation_requests MODIFY COLUMN sp_sys_id VARCHAR(20);
ALTER TABLE reconciliation_transactions MODIFY COLUMN bill_control_number VARCHAR(20);
ALTER TABLE reconciliation_transactions MODIFY COLUMN credited_account_number VARCHAR(50);
ALTER TABLE reconciliation_transactions MODIFY COLUMN depositor_cell_num VARCHAR(15);
ALTER TABLE bills MODIFY COLUMN sp_sys_id VARCHAR(20);
ALTER TABLE bills MODIFY COLUMN payment_control_number VARCHAR(20);
ALTER TABLE payments MODIFY COLUMN sp_code VARCHAR(10);
ALTER TABLE payments MODIFY COLUMN payment_control_number VARCHAR(20);
ALTER TABLE payments MODIFY COLUMN credited_account_number VARCHAR(50);
ALTER TABLE payments MODIFY COLUMN payer_cell_num VARCHAR(15);

-- Who raised the bill; printed as "Prepared By" on the bill (GePG bill guide
-- requires the name of the person who issued it).
ALTER TABLE bills ADD COLUMN IF NOT EXISTS generated_by VARCHAR(30) AFTER payer_email;

-- billing systems that use this bridge, and the events sent back to them
CREATE TABLE IF NOT EXISTS billing_systems (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(12) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255),
  contact VARCHAR(150),
  status ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
  callback_url VARCHAR(500),
  webhook_secret TEXT,
  retry_window_hours INT NOT NULL DEFAULT 72,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS billing_system_id INT NULL AFTER name;
ALTER TABLE api_keys ADD INDEX IF NOT EXISTS idx_api_keys_system (billing_system_id);

-- billing_system_id is the owner; external_ref is the owner's own reference (bill_id is code + '-' + ref)
ALTER TABLE bills ADD COLUMN IF NOT EXISTS billing_system_id INT NULL AFTER generated_by;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS external_ref VARCHAR(100) NULL AFTER billing_system_id;
ALTER TABLE bills ADD INDEX IF NOT EXISTS idx_bills_system (billing_system_id);
ALTER TABLE bills ADD UNIQUE INDEX IF NOT EXISTS uq_bills_system_ref (billing_system_id, external_ref);

CREATE TABLE IF NOT EXISTS outbound_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  billing_system_id INT NOT NULL,
  type VARCHAR(40) NOT NULL,
  bill_id VARCHAR(100) NULL,
  payload MEDIUMTEXT NOT NULL,
  delivery_status ENUM('PENDING', 'DELIVERED', 'DEAD', 'PULL_ONLY') NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  next_attempt_at DATETIME NULL,
  deadline_at DATETIME NULL,
  last_attempt_at DATETIME NULL,
  last_http_status INT NULL,
  last_error VARCHAR(500) NULL,
  delivered_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_events_due (delivery_status, next_attempt_at),
  INDEX idx_events_system (billing_system_id, id),
  INDEX idx_events_bill (bill_id),
  FOREIGN KEY (billing_system_id) REFERENCES billing_systems(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS event_deliveries (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  event_id BIGINT NOT NULL,
  attempt INT NOT NULL,
  url VARCHAR(500),
  http_status INT NULL,
  ok TINYINT(1) NOT NULL DEFAULT 0,
  error VARCHAR(500) NULL,
  response_snippet VARCHAR(500) NULL,
  duration_ms INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_deliveries_event (event_id),
  FOREIGN KEY (event_id) REFERENCES outbound_events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- a GFS code belongs to one billing system (one system, many codes); a system may only bill with its own codes
ALTER TABLE gfs_codes ADD COLUMN IF NOT EXISTS billing_system_id INT NULL AFTER description;
ALTER TABLE gfs_codes ADD INDEX IF NOT EXISTS idx_gfs_system (billing_system_id);

-- the first payment used to mark a bill PAID even when it was only partial; undo that
UPDATE bills b SET b.status = 'APPROVED'
WHERE b.status = 'PAID'
  AND EXISTS (SELECT 1 FROM payments p WHERE p.bill_id = b.bill_id)
  AND (SELECT SUM(p.paid_amount) FROM payments p WHERE p.bill_id = b.bill_id) < b.bill_amount;
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

runMigrations();
