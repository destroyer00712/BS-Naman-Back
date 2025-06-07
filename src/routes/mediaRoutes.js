const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();
const logger = require('../utils/logger');
const whatsappConfig = require('../config/whatsapp');

/**
 * Proxy Facebook WhatsApp Media Content
 * Endpoint to fetch media from Facebook and proxy it to avoid CORS issues
 * 
 * @route GET /api/proxy-fb-media
 * @param {string} url - Query parameter containing encoded Facebook media URL
 * @returns {Binary|JSON} Media content or error response
 */
router.get('/proxy-fb-media', async (req, res) => {
  const startTime = Date.now();
  const clientIP = req.ip || req.connection.remoteAddress;
  
  logger.info('Starting media proxy request', {
    clientIP,
    userAgent: req.get('User-Agent'),
    function: 'proxy-fb-media'
  });

  try {
    // 1. Validate URL parameter
    const { url } = req.query;
    
    if (!url) {
      logger.warn('Media proxy request missing URL parameter', {
        clientIP,
        query: req.query,
        function: 'proxy-fb-media'
      });
      
      return res.status(400).json({
        error: 'Missing required parameter: url',
        message: 'Please provide a Facebook media URL in the url query parameter',
        code: 'MISSING_URL_PARAMETER'
      });
    }

    // 2. Decode and validate Facebook URL
    let decodedUrl;
    try {
      decodedUrl = decodeURIComponent(url);
    } catch (decodeError) {
      logger.error('Failed to decode URL parameter', {
        error: decodeError.message,
        clientIP,
        rawUrl: url.substring(0, 100) + '...',
        function: 'proxy-fb-media'
      });
      
      return res.status(400).json({
        error: 'Invalid URL parameter',
        message: 'URL parameter could not be decoded',
        code: 'INVALID_URL_ENCODING'
      });
    }

    // 3. Security validation - ensure URL is from Facebook domain
    const allowedDomains = [
      'lookaside.fbsbx.com',
      'scontent.whatsapp.net',
      'mmg.whatsapp.net',
      'pps.whatsapp.net'
    ];
    
    const urlObj = new URL(decodedUrl);
    const isValidDomain = allowedDomains.some(domain => 
      urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
    );

    if (!isValidDomain) {
      logger.warn('Media proxy request to unauthorized domain', {
        domain: urlObj.hostname,
        clientIP,
        function: 'proxy-fb-media'
      });
      
      return res.status(403).json({
        error: 'Forbidden domain',
        message: 'URL must be from an authorized Facebook/WhatsApp domain',
        code: 'UNAUTHORIZED_DOMAIN'
      });
    }

    logger.debug('Making Facebook media request', {
      domain: urlObj.hostname,
      hasToken: !!whatsappConfig.WHATSAPP_ACCESS_TOKEN,
      urlLength: decodedUrl.length,
      function: 'proxy-fb-media'
    });

    // 4. Set CORS headers early
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    // 5. Make request to Facebook with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const facebookResponse = await fetch(decodedUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${whatsappConfig.WHATSAPP_ACCESS_TOKEN}`,
        'User-Agent': 'BSGold-Media-Proxy/1.0'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    // 6. Handle Facebook API errors
    if (!facebookResponse.ok) {
      logger.error('Facebook media request failed', {
        status: facebookResponse.status,
        statusText: facebookResponse.statusText,
        domain: urlObj.hostname,
        responseTime,
        clientIP,
        function: 'proxy-fb-media'
      });

      return res.status(502).json({
        error: 'Facebook request failed',
        message: `Facebook returned ${facebookResponse.status}: ${facebookResponse.statusText}`,
        code: 'FACEBOOK_REQUEST_FAILED',
        details: {
          status: facebookResponse.status,
          statusText: facebookResponse.statusText
        }
      });
    }

    // 7. Get content type and size from Facebook response
    const contentType = facebookResponse.headers.get('content-type') || 'application/octet-stream';
    const contentLength = facebookResponse.headers.get('content-length');
    const lastModified = facebookResponse.headers.get('last-modified');
    const etag = facebookResponse.headers.get('etag');

    // 8. Set response headers
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600', // 1 hour cache
      'Access-Control-Allow-Origin': '*',
      'X-Proxy-Cache': 'MISS',
      'X-Media-Source': 'Facebook',
      'X-Response-Time': `${responseTime}ms`
    });

    // Set content length if available
    if (contentLength) {
      res.set('Content-Length', contentLength);
    }

    // Set cache headers if available
    if (lastModified) {
      res.set('Last-Modified', lastModified);
    }
    if (etag) {
      res.set('ETag', etag);
    }

    logger.info('Streaming Facebook media content', {
      contentType,
      contentLength: contentLength || 'unknown',
      domain: urlObj.hostname,
      responseTime,
      clientIP,
      function: 'proxy-fb-media'
    });

    // 9. Stream the response directly to client
    facebookResponse.body.pipe(res);

    // 10. Handle streaming completion
    facebookResponse.body.on('end', () => {
      const totalTime = Date.now() - startTime;
      logger.info('Media proxy completed successfully', {
        contentType,
        contentLength: contentLength || 'unknown',
        totalTime,
        clientIP,
        function: 'proxy-fb-media'
      });
    });

    // Handle streaming errors
    facebookResponse.body.on('error', (streamError) => {
      const totalTime = Date.now() - startTime;
      logger.error('Media streaming failed', {
        error: streamError.message,
        contentType,
        totalTime,
        clientIP,
        function: 'proxy-fb-media'
      });
      
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Streaming failed',
          message: 'Failed to stream media content',
          code: 'STREAM_ERROR'
        });
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    // Handle specific error types
    if (error.name === 'AbortError') {
      logger.error('Media proxy request timeout', {
        error: error.message,
        responseTime,
        clientIP,
        function: 'proxy-fb-media'
      });
      
      return res.status(408).json({
        error: 'Request timeout',
        message: 'Facebook media request timed out after 30 seconds',
        code: 'REQUEST_TIMEOUT'
      });
    }

    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      logger.error('Network error accessing Facebook', {
        error: error.message,
        code: error.code,
        responseTime,
        clientIP,
        function: 'proxy-fb-media'
      });
      
      return res.status(502).json({
        error: 'Network error',
        message: 'Unable to connect to Facebook servers',
        code: 'NETWORK_ERROR'
      });
    }

    // Generic server error
    logger.error('Media proxy server error', {
      error: error.message,
      stack: error.stack,
      responseTime,
      clientIP,
      function: 'proxy-fb-media'
    });

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while proxying media',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  }
});

/**
 * Handle OPTIONS requests for CORS preflight
 */
router.options('/proxy-fb-media', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.sendStatus(200);
});

/**
 * Health check endpoint for the media proxy service
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'media-proxy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

module.exports = router; 