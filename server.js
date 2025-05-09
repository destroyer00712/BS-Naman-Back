require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const winston = require('winston');
const fs = require('fs');
const path = require('path');
const { runMigrations } = require('./src/migrations');

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} ${level}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Make logger available globally
global.logger = logger;

// Initialize database and run migrations
(async () => {
  try {
    await runMigrations();
    logger.info('Database initialized and migrations completed successfully');
  } catch (error) {
    logger.error('Database initialization failed:', error);
    process.exit(1);
  }
})();

// Import routes
const orderRoutes = require('./src/routes/orderRoutes');
const workerRoutes = require('./src/routes/workerRoutes');
const clientRoutes = require('./src/routes/clientRoutes');
const messageRoutes = require('./src/routes/messageRoutes');

// Import middleware
const errorHandler = require('./src/middleware/errorHandler');

// Enable CORS for all origins
app.use(cors());

// Middleware
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
  });
  
  next();
});

// Socket.io request handler - prevent 404 errors for socket.io requests
app.use('/socket.io', (req, res) => {
  res.status(200).send('Socket.io is not implemented on this server');
});

// Route middlewares
app.use('/api/orders', orderRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/messages', messageRoutes);

// Error handler middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});