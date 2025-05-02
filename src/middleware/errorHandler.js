/**
 * Global error handling middleware
 */
const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  // Log error details
  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query,
    ip: req.ip
  });

  // Determine status code
  const statusCode = err.statusCode || 500;
  
  // Send error response
  res.status(statusCode).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'An error occurred' 
      : err.message,
    status: statusCode
  });
};

module.exports = errorHandler; 