// =============================================
// SSP Books Backend - Express Server
// =============================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { getEnv, getIntEnv } = require('./config/env');

const authRoutes = require('./routes/auth');
const courseRoutes = require('./routes/courses');
const categoryRoutes = require('./routes/categories');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();
const HOST = getEnv('HOST', '0.0.0.0');
const PORT = getIntEnv('PORT', 5000);
const PUBLIC_API_URL = getEnv('PUBLIC_API_URL', `http://localhost:${PORT}/api`);

// =============================================
// Security Middleware
// =============================================
app.use(helmet());
app.use(cors({
  origin: getEnv('CORS_ORIGIN', 'http://localhost:3000'),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: getIntEnv('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  max: getIntEnv('RATE_LIMIT_MAX', 100),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
});
app.use('/api/', limiter);

// =============================================
// Body Parsing & Logging
// =============================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// =============================================
// Health Check
// =============================================
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'SSP Books API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
  });
});

// =============================================
// API Routes
// =============================================
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);

// =============================================
// Error Handling
// =============================================
app.use(notFound);
app.use(errorHandler);

// =============================================
// Start Server
// =============================================
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, HOST, () => {
    console.log(`
    ╔══════════════════════════════════════════╗
    ║                                          ║
    ║   📚 SSP Books API Server               ║
    ║   🚀 Running on port ${PORT}              ║
    ║   🌍 Environment: ${(process.env.NODE_ENV || 'development').padEnd(18)}║
    ║   📡 API: ${PUBLIC_API_URL.padEnd(28)}║
    ║                                          ║
    ╚══════════════════════════════════════════╝
    `);
  });
}

module.exports = app;
