// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Activity logger middleware
// └──────────────────────────────────────────────────────────────────────────┘

const db = require('../config/database');
const logService = require('../services/logService');
const { clientIp } = require('../utils/clientIp');

const logActivity = async (req, res, next) => {
  // by the time the response is done the router has stripped its prefix from req.path, so keep the full one now
  const fullPath = req.originalUrl.split('?')[0];
  // Store original functions
  const originalJson = res.json;
  const originalSend = res.send;

  let responseData = null;

  // Override json method
  res.json = function (data) {
    responseData = data;
    originalJson.call(this, data);
  };

  // Override send method
  res.send = function (data) {
    if (!responseData) {
      try {
        responseData = typeof data === 'string' ? data : JSON.stringify(data);
      } catch (e) {
        responseData = 'Response data not parseable';
      }
    }
    originalSend.call(this, data);
  };

  // Log after response is sent
  res.on('finish', async () => {
    try {
      const skipRoutes = ['/health', '/api/logs'];
      if (skipRoutes.some(route => fullPath.includes(route))) {
        return;
      }

      const logData = {
        user_id: req.user?.id || null,
        action: `${req.method} ${fullPath}`,
        entity_type: extractEntityType(fullPath),
        entity_id: extractEntityId(fullPath, req.body),
        description: generateDescription(req, fullPath),
        ip_address: clientIp(req),
        user_agent: req.headers['user-agent'],
        request_data: sanitizeData(req.body || req.query, false, fullPath),
        response_data: sanitizeData(responseData, true, fullPath),
        status: res.statusCode < 400 ? 'SUCCESS' : 'FAILED'
      };

      logService.audit(logData);

      // Insert log
      await db.query(
        `INSERT INTO activity_logs 
         (user_id, action, entity_type, entity_id, description, ip_address, 
          user_agent, request_data, response_data, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          logData.user_id,
          logData.action,
          logData.entity_type,
          logData.entity_id,
          logData.description,
          logData.ip_address,
          logData.user_agent,
          JSON.stringify(logData.request_data),
          JSON.stringify(logData.response_data),
          logData.status
        ]
      );

    } catch (error) {
      // Silently fail if activity_logs table doesn't exist yet
      if (error.code !== 'ER_NO_SUCH_TABLE') {
        console.error('Activity logging error:', error.message);
      }
      // Don't throw - logging failure shouldn't break the request
    }
  });

  next();
};

function extractEntityType(path) {
  if (path.includes('/bills')) return 'BILL';
  if (path.includes('/payments')) return 'PAYMENT';
  if (path.includes('/users')) return 'USER';
  if (path.includes('/auth')) return 'AUTH';
  if (path.includes('/dashboard')) return 'DASHBOARD';
  return 'SYSTEM';
}

function extractEntityId(path, body) {
  // Try to extract from path
  const pathMatch = path.match(/\/([^\/]+)$/);
  if (pathMatch && pathMatch[1] && !['create', 'list', 'all'].includes(pathMatch[1])) {
    return pathMatch[1];
  }

  // Try to extract from body
  if (body) {
    return body.billId || body.id || body.username || null;
  }

  return null;
}

function generateDescription(req, path) {
  const method = req.method;
  const user = req.user?.username || (req.apiKey ? `API key "${req.apiKey.name}"` : 'Anonymous');

  if (path.includes('/login')) return `${user} logged in`;
  if (path.includes('/logout')) return `${user} logged out`;
  if (path.includes('/bills/create')) return `${user} created a bill`;
  if (path.includes('/bills/cancel')) return `${user} cancelled a bill`;
  if (path.includes('/bills') && method === 'GET') return `${user} viewed bills`;
  if (path.includes('/payments') && method === 'GET') return `${user} viewed payments`;
  if (path.includes('/dashboard')) return `${user} accessed dashboard`;

  return `${user} performed ${method} on ${path}`;
}

// Everything is kept in full, except secrets and certificate files (a private key is no use for reconciliation).
function sanitizeData(data, isResponse = false, path = '') {
  if (!data) return null;
  if (/\/certificates\//.test(path)) return { note: 'certificate files and passwords are never logged' };

  // Convert to object if string
  let obj = data;
  if (typeof data === 'string') {
    try {
      obj = JSON.parse(data);
    } catch {
      return data;
    }
  }

  // Create a copy
  const sanitized = JSON.parse(JSON.stringify(obj));

  const sensitiveFields = ['password', 'token', 'secret', 'apikey', 'authorization', 'otp'];
  
  function removeSensitive(obj) {
    if (typeof obj !== 'object' || obj === null) return;
    
    for (const key in obj) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        obj[key] = '***REDACTED***';
      } else if (typeof obj[key] === 'object') {
        removeSensitive(obj[key]);
      }
    }
  }

  removeSensitive(sanitized);

  return sanitized;
}

module.exports = logActivity;
