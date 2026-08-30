const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
require('dotenv').config();

const billRoutes = require('./routes/billRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const reconciliationRoutes = require('./routes/reconciliationRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const logsRoutes = require('./routes/logsRoutes');
const apiKeyRoutes = require('./routes/apiKeyRoutes');
const activityLogger = require('./middleware/activityLogger');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));

// XML body parser for GePG webhooks - GePG posts raw XML, not JSON, to
// every one of these callback URLs. Previously only /api/payments/webhook
// was covered, so the bill-response and reconciliation-response webhooks
// (added below) would have had their bodies mangled by express.json().
app.use('/api/bills/webhook', express.text({ type: '*/xml' }));
app.use('/api/payments/webhook', express.text({ type: '*/xml' }));
app.use('/api/reconciliation/webhook', express.text({ type: '*/xml' }));

// Body parser middleware (for all other, JSON, routes)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Activity logger middleware (log all requests)
app.use(activityLogger);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reconciliation', reconciliationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/api-keys', apiKeyRoutes);

// Health check route
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'GePG Bridge API is running',
    timestamp: new Date().toISOString()
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'GePG Bridge API',
    version: '1.0.0',
    description: 'Government Electronic Payment Gateway Integration Bridge',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      logs: '/api/logs',
      bills: '/api/bills',
      payments: '/api/payments',
      reconciliation: '/api/reconciliation',
      dashboard: '/api/dashboard',
      apiKeys: '/api/api-keys',
      health: '/health'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║              GePG Bridge API Server                       ║
║                                                           ║
║  Server running on port ${PORT}                        ║
║  Environment: ${process.env.NODE_ENV || 'development'}                           ║
║                                                           ║
║  Endpoints:                                            ║
║     - Bills:       http://localhost:${PORT}/api/bills      ║
║     - Payments:    http://localhost:${PORT}/api/payments   ║
║     - Dashboard:   http://localhost:${PORT}/api/dashboard  ║
║     - Health:      http://localhost:${PORT}/health         ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
