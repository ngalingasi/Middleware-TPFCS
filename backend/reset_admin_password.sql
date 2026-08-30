-- GePG Bridge - Reset Admin Password
-- Run this if you're having trouble logging in

USE gepg_bridge;

-- This hash is for password: admin123
-- Generated with bcrypt rounds=10
UPDATE users 
SET password = '$2b$10$5fJJgR7YJjN3LfHN6X4vCuJxjlJd7MJHvVy6yQjKZxLxU5qZ5L5KG' 
WHERE username = 'admin';

-- Verify the update
SELECT username, email, role, status FROM users WHERE username = 'admin';

-- You should see:
-- +----------+---------------------------+--------+--------+
-- | username | email                     | role   | status |
-- +----------+---------------------------+--------+--------+
-- | admin    | admin@gepg-bridge.local   | ADMIN  | ACTIVE |
-- +----------+---------------------------+--------+--------+

-- Now try logging in with:
-- Username: admin
-- Password: admin123
