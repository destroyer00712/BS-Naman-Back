const express = require('express');
const fetch = require('node-fetch');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const logger = require('../utils/logger');
const whatsappConfig = require('../config/whatsapp');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'uploads', 'media');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '.bin';
    cb(null, 'media-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept common media types
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/quicktime',
      'audio/mpeg',
      'audio/mp4',
      'audio/ogg',
      'application/octet-stream'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      logger.warn('File type not allowed', {
        mimetype: file.mimetype,
        originalname: file.originalname,
        function: 'media-upload-filter'
      });
      cb(new Error('File type not allowed'), false);
    }
  }
});

/**
 * Media Upload Endpoint
 * Stores media files permanently for reliable access
 * 
 * @route POST /api/media/upload
 * @param {File} file - Media file to upload
 * @param {string} type - MIME type of the media
 * @returns {JSON} Upload result with permanent URL
 */
router.post('/media/upload', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  const clientIP = req.ip || req.connection.remoteAddress;
  
  logger.info('Starting media upload request', {
    clientIP,
    userAgent: req.get('User-Agent'),
    hasFile: !!req.file,
    mimeType: req.body.type,
    function: 'media-upload'
  });

  try {
    if (!req.file) {
      logger.warn('Media upload request missing file', {
        clientIP,
        body: req.body,
        function: 'media-upload'
      });
      
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please provide a file to upload',
        code: 'MISSING_FILE'
      });
    }

    const { type } = req.body;
    const uploadedFile = req.file;
    
    // Generate permanent URL path
    const permanentUrl = `/uploads/media/${uploadedFile.filename}`;
    
    logger.info('Media upload completed successfully', {
      filename: uploadedFile.filename,
      originalname: uploadedFile.originalname,
      mimetype: uploadedFile.mimetype,
      size: uploadedFile.size,
      permanentUrl,
      providedType: type,
      clientIP,
      responseTime: Date.now() - startTime,
      function: 'media-upload'
    });

    res.json({
      success: true,
      permanentUrl,
      filename: uploadedFile.filename,
      originalname: uploadedFile.originalname,
      mimetype: uploadedFile.mimetype || type,
      size: uploadedFile.size,
      uploadedAt: new Date().toISOString()
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('Media upload failed', {
      error: error.message,
      stack: error.stack,
      clientIP,
      responseTime,
      function: 'media-upload'
    });

    res.status(500).json({
      error: 'Upload failed',
      message: 'An error occurred while uploading the file',
      code: 'UPLOAD_ERROR'
    });
  }
});

/**
 * Serve uploaded media files
 * 
 * @route GET /uploads/media/:filename
 * @param {string} filename - Name of the media file
 * @returns {Binary} Media file content
 */
router.get('/uploads/media/:filename', (req, res) => {
  const { filename } = req.params;
  const clientIP = req.ip || req.connection.remoteAddress;
  
  logger.info('Serving media file', {
    filename,
    clientIP,
    userAgent: req.get('User-Agent'),
    function: 'serve-media'
  });

  try {
    const filePath = path.join(process.cwd(), 'uploads', 'media', filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      logger.warn('Media file not found', {
        filename,
        filePath,
        clientIP,
        function: 'serve-media'
      });
      
      return res.status(404).json({
        error: 'File not found',
        message: 'The requested media file does not exist',
        code: 'FILE_NOT_FOUND'
      });
    }

    // Get file stats
    const stats = fs.statSync(filePath);
    
    // Set appropriate headers
    res.set({
      'Content-Length': stats.size,
      'Cache-Control': 'public, max-age=31536000', // 1 year cache
      'Last-Modified': stats.mtime.toUTCString()
    });

    // Determine content type based on file extension
    const ext = path.extname(filename).toLowerCase();
    const contentTypeMap = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.mp3': 'audio/mpeg',
      '.m4a': 'audio/mp4',
      '.ogg': 'audio/ogg'
    };
    
    const contentType = contentTypeMap[ext] || 'application/octet-stream';
    res.set('Content-Type', contentType);

    logger.debug('Streaming media file', {
      filename,
      size: stats.size,
      contentType,
      clientIP,
      function: 'serve-media'
    });

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on('end', () => {
      logger.info('Media file served successfully', {
        filename,
        size: stats.size,
        contentType,
        clientIP,
        function: 'serve-media'
      });
    });

    fileStream.on('error', (error) => {
      logger.error('Error streaming media file', {
        error: error.message,
        filename,
        clientIP,
        function: 'serve-media'
      });
      
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Streaming error',
          message: 'Error occurred while serving the file',
          code: 'STREAM_ERROR'
        });
      }
    });

  } catch (error) {
    logger.error('Error serving media file', {
      error: error.message,
      stack: error.stack,
      filename,
      clientIP,
      function: 'serve-media'
    });

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Server error',
        message: 'An error occurred while serving the file',
        code: 'SERVER_ERROR'
      });
    }
  }
});

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