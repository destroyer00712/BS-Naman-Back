# Facebook WhatsApp Media Proxy API

## Overview
A secure Node.js Express endpoint that proxies Facebook WhatsApp media content to avoid CORS issues when accessing media from the frontend.

**Endpoint:** `GET /api/proxy-fb-media`  
**Domain:** `https://bsgold-api.chatloom.in`

## Features

✅ **CORS Support** - Eliminates cross-origin issues  
✅ **Security Validation** - Only allows authorized Facebook domains  
✅ **Streaming** - Efficient memory usage for large files  
✅ **Comprehensive Logging** - Full request/response tracking  
✅ **Error Handling** - Detailed error responses with codes  
✅ **Performance Monitoring** - Response time tracking  
✅ **Cache Headers** - Optimal browser caching  
✅ **Timeout Protection** - 30-second request timeout  

## API Specification

### Request
```http
GET /api/proxy-fb-media?url={encoded_facebook_url}
```

### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | URL-encoded Facebook media URL |

### Response Headers
```http
Content-Type: {original_mime_type}
Access-Control-Allow-Origin: *
Cache-Control: public, max-age=3600
X-Media-Source: Facebook
X-Response-Time: {time_in_ms}ms
```

### Success Response
- **Status:** `200 OK`
- **Body:** Binary media content (image/video/audio)

### Error Responses

#### Missing URL Parameter
```json
{
  "error": "Missing required parameter: url",
  "message": "Please provide a Facebook media URL in the url query parameter",
  "code": "MISSING_URL_PARAMETER"
}
```

#### Invalid Domain
```json
{
  "error": "Forbidden domain",
  "message": "URL must be from an authorized Facebook/WhatsApp domain",
  "code": "UNAUTHORIZED_DOMAIN"
}
```

#### Facebook Request Failed
```json
{
  "error": "Facebook request failed",
  "message": "Facebook returned 404: Not Found",
  "code": "FACEBOOK_REQUEST_FAILED",
  "details": {
    "status": 404,
    "statusText": "Not Found"
  }
}
```

## Usage Examples

### JavaScript/Frontend
```javascript
// Using the proxy to fetch WhatsApp media
const mediaUrl = 'https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=123&ext=456&hash=abc';
const encodedUrl = encodeURIComponent(mediaUrl);
const proxyUrl = `https://bsgold-api.chatloom.in/api/proxy-fb-media?url=${encodedUrl}`;

// Fetch and display image
const img = document.createElement('img');
img.src = proxyUrl;
document.body.appendChild(img);

// Or fetch as blob for processing
fetch(proxyUrl)
  .then(response => response.blob())
  .then(blob => {
    const objectUrl = URL.createObjectURL(blob);
    // Use objectUrl as needed
  });
```

### curl Example
```bash
curl -X GET "https://bsgold-api.chatloom.in/api/proxy-fb-media?url=https%3A//lookaside.fbsbx.com/whatsapp_business/attachments/%3Fmid%3D726438933217292%26ext%3D1749324492%26hash%3DATtSwKfwMxo4ibnoS_clWj_i5SMx9n5iXkVDGUeRweX37w" \
  -H "Accept: */*"
```

### Using with apiUtils.js
```javascript
const { fetchProxiedMedia } = require('./src/utils/apiUtils');

// This function already uses the proxy internally
const blob = await fetchProxiedMedia(facebookMediaUrl);
```

## Security Features

### Domain Validation
Only these domains are allowed:
- `lookaside.fbsbx.com`
- `scontent.whatsapp.net`
- `mmg.whatsapp.net`
- `pps.whatsapp.net`

### Request Validation
- URL parameter must be properly encoded
- URLs must be valid and parseable
- Only GET requests allowed (except OPTIONS for CORS)

### Rate Limiting (Recommended)
Consider implementing rate limiting for production:
```javascript
// Example with express-rate-limit
const rateLimit = require('express-rate-limit');

const mediaProxyLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many media proxy requests from this IP'
});

app.use('/api/proxy-fb-media', mediaProxyLimit);
```

## Performance Considerations

### Streaming
- Uses Node.js streams to pipe Facebook response directly to client
- Minimal memory usage even for large video files
- No intermediate buffering

### Caching
- Sets `Cache-Control: public, max-age=3600` (1 hour)
- Forwards `Last-Modified` and `ETag` headers from Facebook
- Browser caching reduces server load

### Timeout Protection
- 30-second timeout prevents hanging requests
- AbortController for clean request cancellation

## Monitoring & Logging

### Request Logging
```json
{
  "level": "info",
  "message": "Starting media proxy request",
  "clientIP": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "function": "proxy-fb-media"
}
```

### Success Logging
```json
{
  "level": "info",
  "message": "Media proxy completed successfully",
  "contentType": "image/jpeg",
  "contentLength": "245760",
  "totalTime": 1250,
  "clientIP": "192.168.1.100",
  "function": "proxy-fb-media"
}
```

### Error Logging
```json
{
  "level": "error",
  "message": "Facebook media request failed",
  "status": 404,
  "statusText": "Not Found",
  "domain": "lookaside.fbsbx.com",
  "responseTime": 890,
  "clientIP": "192.168.1.100",
  "function": "proxy-fb-media"
}
```

## Health Check

### Endpoint
```http
GET /api/health
```

### Response
```json
{
  "status": "healthy",
  "service": "media-proxy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0"
}
```

## Testing

Run the test suite:
```bash
node test-media-proxy.js
```

Test scenarios:
1. ✅ Health check endpoint
2. ✅ Missing URL parameter validation
3. ✅ Invalid domain rejection
4. ✅ Valid Facebook URL proxying
5. ✅ CORS OPTIONS handling

## Error Codes Reference

| Code | Status | Description |
|------|--------|-------------|
| `MISSING_URL_PARAMETER` | 400 | URL query parameter not provided |
| `INVALID_URL_ENCODING` | 400 | URL parameter could not be decoded |
| `UNAUTHORIZED_DOMAIN` | 403 | URL domain not in allowed list |
| `REQUEST_TIMEOUT` | 408 | Facebook request timed out (30s) |
| `FACEBOOK_REQUEST_FAILED` | 502 | Facebook returned error status |
| `NETWORK_ERROR` | 502 | Network connectivity issue |
| `STREAM_ERROR` | 500 | Error during content streaming |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server error |

## Dependencies

- `express` - Web framework
- `node-fetch` - HTTP client for Facebook requests
- `winston` - Logging (via existing logger)

## Configuration

The endpoint uses the existing WhatsApp configuration:
```javascript
// src/config/whatsapp.js
const whatsappConfig = {
  WHATSAPP_ACCESS_TOKEN: 'EAATMXEvo8GwBOy...',
  // ... other config
};
```

## Production Deployment

### Environment Variables
```bash
# Optional: Set API root if different
export API_ROOT=https://bsgold-api.chatloom.in

# Ensure WhatsApp token is set
export WHATSAPP_ACCESS_TOKEN=your_token_here
```

### Reverse Proxy (Nginx)
```nginx
location /api/proxy-fb-media {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Increase timeouts for large media files
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}
```

### PM2 Configuration
```json
{
  "name": "bsgold-api",
  "script": "server.js",
  "instances": "max",
  "exec_mode": "cluster",
  "env": {
    "NODE_ENV": "production",
    "PORT": 3000
  }
}
```

## Integration with Frontend

### React Example
```jsx
import { useState, useEffect } from 'react';

function MediaViewer({ facebookMediaUrl }) {
  const [proxyUrl, setProxyUrl] = useState('');
  
  useEffect(() => {
    if (facebookMediaUrl) {
      const encoded = encodeURIComponent(facebookMediaUrl);
      setProxyUrl(`https://bsgold-api.chatloom.in/api/proxy-fb-media?url=${encoded}`);
    }
  }, [facebookMediaUrl]);
  
  return (
    <img 
      src={proxyUrl} 
      alt="WhatsApp Media"
      onError={(e) => console.error('Media load failed:', e)}
    />
  );
}
```

### Vue.js Example
```vue
<template>
  <img :src="proxyUrl" alt="WhatsApp Media" @error="handleError" />
</template>

<script>
export default {
  props: ['facebookMediaUrl'],
  computed: {
    proxyUrl() {
      if (!this.facebookMediaUrl) return '';
      const encoded = encodeURIComponent(this.facebookMediaUrl);
      return `https://bsgold-api.chatloom.in/api/proxy-fb-media?url=${encoded}`;
    }
  },
  methods: {
    handleError(event) {
      console.error('Media load failed:', event);
    }
  }
}
</script>
```

## Support

For issues or questions about the media proxy endpoint:
1. Check the logs in `/logs/combined.log` and `/logs/error.log`
2. Verify WhatsApp Access Token is valid
3. Test with the provided test script
4. Check network connectivity to Facebook domains

---

**Version:** 1.0.0  
**Last Updated:** January 2024  
**Maintainer:** BSGold Development Team 