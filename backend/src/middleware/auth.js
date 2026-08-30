const jwt = require('jsonwebtoken');
const db = require('../config/database');

/**
 * Verify JWT token and authenticate user
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.substring(7);

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if session exists and is valid
    const [sessions] = await db.query(
      `SELECT s.*, u.username, u.email, u.role, u.status 
       FROM user_sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = ? AND s.expires_at > NOW()`,
      [token]
    );

    if (sessions.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token.'
      });
    }

    const session = sessions[0];

    // Check if user is active
    if (session.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: 'User account is not active.'
      });
    }

    // Attach user info to request
    req.user = {
      id: decoded.userId,
      username: session.username,
      email: session.email,
      role: session.role
    };

    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired.'
      });
    }

    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed.'
    });
  }
};

/**
 * Check if user has required role
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. Insufficient permissions.'
      });
    }

    next();
  };
};

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const [sessions] = await db.query(
      `SELECT s.*, u.username, u.email, u.role 
       FROM user_sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = ? AND s.expires_at > NOW()`,
      [token]
    );

    if (sessions.length > 0) {
      req.user = {
        id: decoded.userId,
        username: sessions[0].username,
        email: sessions[0].email,
        role: sessions[0].role
      };
    }

    next();

  } catch (error) {
    // Continue without auth
    next();
  }
};

module.exports = {
  authenticate,
  authorize,
  optionalAuth
};
