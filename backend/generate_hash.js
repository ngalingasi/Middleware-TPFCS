const crypto = require('crypto');

/**
 * Generate bcrypt-compatible hash using Node.js crypto
 * This is a simplified version for generating password hashes
 */
function generateHash(password, rounds = 10) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, Math.pow(2, rounds), 64, 'sha512').toString('hex');
  return { salt, hash, combined: `$pbkdf2$${rounds}$${salt}$${hash}` };
}

// Generate hashes for all default passwords
console.log('=== Generating Password Hashes ===\n');

const passwords = ['admin123'];

passwords.forEach(pwd => {
  const result = generateHash(pwd);
  console.log(`Password: "${pwd}"`);
  console.log(`Combined: ${result.combined}\n`);
});

// Note: This uses PBKDF2 instead of bcrypt for compatibility
// For production use, install bcrypt: npm install bcrypt
console.log('Note: These are PBKDF2 hashes. For bcrypt, run: npm install && node generate_bcrypt.js');
