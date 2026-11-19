// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Server entry point
// └──────────────────────────────────────────────────────────────────────────┘

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
const gfsCodeRoutes = require('./routes/gfsCodeRoutes');
const gepgCodeRoutes = require('./routes/gepgCodeRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const billingSystemRoutes = require('./routes/billingSystemRoutes');
const outboxRoutes = require('./routes/outboxRoutes');
const v1Routes = require('./routes/v1Routes');
const developerRoutes = require('./routes/developerRoutes');
const settings = require('./services/settingsService');
const certificates = require('./services/certificateService');
const eventService = require('./services/eventService');
const { startExpiryJob } = require('./services/expiryService');
const activityLogger = require('./middleware/activityLogger');
const messageLogger = require('./middleware/messageLogger');
const { startLogRetention } = require('./services/logRetention');

const app = express();

// Middleware
// Behind nginx the caller's address arrives in X-Forwarded-For. Only a trusted proxy may set it,
// otherwise anyone could write any address into the logs. Default: the proxy runs on this server.
const trustProxy = process.env.TRUST_PROXY || 'loopback';
app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy === 'true' ? true : trustProxy === 'false' ? false : trustProxy);

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));

app.use('/api/bills/webhook', express.text({ type: '*/xml' }));
app.use('/api/payments/webhook', express.text({ type: '*/xml' }));
app.use('/api/reconciliation/webhook', express.text({ type: '*/xml' }));

// Body parser middleware (for all other, JSON, routes). The text as received is kept for the message log.
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf.toString('utf8'); } }));
app.use(express.urlencoded({ extended: true }));

// Activity logger middleware (log all requests)
app.use(messageLogger);
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
app.use('/api/gfs-codes', gfsCodeRoutes);
app.use('/api/gepg-codes', gepgCodeRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/billing-systems', billingSystemRoutes);
app.use('/api/outbox', outboxRoutes);
app.use('/api/v1', v1Routes);
app.use('/api/developer', developerRoutes);

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
      gfsCodes: '/api/gfs-codes',
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

// load saved settings first so the first request already uses them
settings.load()
  .catch((error) => console.error('Could not load saved settings, using .env values:', error.message))
  .then(() => certificates.load().catch((error) => console.error('Could not load uploaded certificates (run npm run migrate?), using .env paths:', error.message)))
  .then(() => {
    settings.startAutoRefresh();
    certificates.startAutoRefresh();
    eventService.startWorker();
    startExpiryJob();
    startLogRetention();
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
  });

module.exports = app;
