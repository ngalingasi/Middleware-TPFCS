#!/usr/bin/env node
/**
 * Reset Admin Password Script
 * 
 * This script resets the admin password to 'admin123'
 * Run this if you're having login issues
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function resetAdminPassword() {
  let connection;
  
  try {
    console.log('Connecting to database...');
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });
    
    console.log('Connected to database');
    
    // Generate new hash for 'admin123'
    console.log('Generating password hash for: admin123');
    const newPassword = 'admin123';
    const hash = await bcrypt.hash(newPassword, 10);
    
    console.log(`Generated hash: ${hash}`);
    
    // Update admin password
    console.log('Updating admin password...');
    const [result] = await connection.query(
      'UPDATE users SET password = ? WHERE username = ?',
      [hash, 'admin']
    );
    
    if (result.affectedRows === 0) {
      console.log('No admin user found. Creating admin user...');
      
      await connection.query(
        `INSERT INTO users (username, email, password, full_name, role, status) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['admin', 'admin@gepg-bridge.local', hash, 'System Administrator', 'ADMIN', 'ACTIVE']
      );
      
      console.log('Admin user created');
    } else {
      console.log('Admin password updated successfully');
    }
    
    // Verify the user
    const [users] = await connection.query(
      'SELECT username, email, role, status FROM users WHERE username = ?',
      ['admin']
    );
    
    console.log('\nAdmin User Details:');
    console.table(users);
    
    console.log('\nPassword reset complete!');
    console.log('\nLogin Credentials:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('\nTry logging in at: http://localhost:5173');
    
  } catch (error) {
    console.error('Error:', error.message);
    
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.log('\nUsers table does not exist.');
      console.log('   Run migration first: npm run migrate');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('\nCannot connect to database.');
      console.log('   Check if MySQL is running and .env credentials are correct');
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

resetAdminPassword();
