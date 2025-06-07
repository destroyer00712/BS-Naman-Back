const fetch = require('node-fetch');
const FormData = require('form-data');
const whatsappConfig = require('../config/whatsapp');

// ============================================
// CONFIGURATION CONSTANTS
// ============================================
const CONFIG = {
  API_ROOT: process.env.API_ROOT || 'https://bsgold-api.chatloom.in',
  WHATSAPP_ACCESS_TOKEN: whatsappConfig.WHATSAPP_ACCESS_TOKEN,
  WHATSAPP_PHONE_ID: whatsappConfig.WHATSAPP_PHONE_ID,
  WHATSAPP_API_ROOT: whatsappConfig.WHATSAPP_API_ROOT,
  
  ENDPOINTS: {
    WHATSAPP_MEDIA: (mediaId) => `https://graph.facebook.com/v17.0/${mediaId}`,
    ORDER_MESSAGES: (orderId) => `/api/orders/${orderId}/messages`,
    MESSAGES: '/api/messages',
    MEDIA_UPLOAD: '/api/media/upload',
    CLIENTS: (phone) => `/api/clients/${phone}`,
    WORKERS: (phone) => `/api/workers/${phone}`
  },
  
  MEDIA_TYPES: {
    AUDIO: 'audio/mpeg',
    IMAGE: 'image/jpeg',
    VIDEO: 'video/mp4'
  },
  
  SENDER_COLORS: {
    client: '#e3f2fd',
    worker: '#f3e5f5',
    enterprise: '#e8f5e8',
    forwarded: '#fff3e0'
  }
};

// ============================================
// MEDIA DISPLAY APIs - Complete Reference
// ============================================

/**
 * Get WhatsApp Media Details
 * @param {string} mediaId - The media ID from WhatsApp
 * @returns {Promise<Object>} Media details with url, mime_type, sha256, file_size, id
 */
const getMediaDetails = async (mediaId) => {
  const response = await fetch(`https://graph.facebook.com/v17.0/${mediaId}`, {
    headers: {
      'Authorization': `Bearer ${CONFIG.WHATSAPP_ACCESS_TOKEN}`
    }
  });
  
  return await response.json();
  // Response: { url, mime_type, sha256, file_size, id }
};

/**
 * Media Proxy API - Fetch FB Media Content
 * @param {string} facebookMediaUrl - The Facebook media URL
 * @returns {Promise<Blob>} Binary blob data
 */
const fetchProxiedMedia = async (facebookMediaUrl) => {
  const proxyUrl = `https://bsgold.chatloom.in/api/proxy-fb-media?url=${encodeURIComponent(facebookMediaUrl)}`;
  const response = await fetch(proxyUrl);
  
  return await response.blob();
  // Response: Binary blob data
};

/**
 * Media Upload API - Store Permanently
 * @param {Blob} blob - The media blob
 * @param {string} mimeType - MIME type of the media
 * @param {string} fileExtension - File extension
 * @returns {Promise<Object>} Upload result with permanentUrl and success status
 */
const uploadMedia = async (blob, mimeType, fileExtension) => {
  const formData = new FormData();
  formData.append('file', blob, `media_${Date.now()}${fileExtension}`);
  formData.append('type', mimeType);
  
  const response = await fetch(`${CONFIG.API_ROOT}/api/media/upload`, {
    method: 'POST',
    body: formData
  });
  
  return await response.json();
  // Response: { permanentUrl: "/uploads/media/filename.ext", success: true }
};

/**
 * Get Order Messages
 * @param {string} orderId - The order ID
 * @returns {Promise<Object>} Messages for the order
 */
const getOrderMessages = async (orderId) => {
  const response = await fetch(`${CONFIG.API_ROOT}/api/orders/${orderId}/messages`);
  return await response.json();
  // Response: { 
  //   messages: [
  //     {
  //       message_id, order_id, content, sender_type,
  //       media_id?, media_type?, created_at, recipients?
  //     }
  //   ]
  // }
};

/**
 * Get Client Details
 * @param {string} phoneNumber - Client's phone number
 * @returns {Promise<Object>} Client details
 */
const getClientDetails = async (phoneNumber) => {
  const response = await fetch(`${CONFIG.API_ROOT}/api/clients/${phoneNumber}`);
  return await response.json();
  // Response: { client: { name, phone, ...other_details } }
};

/**
 * Get Worker Details
 * @param {string} workerPhone - Worker's phone number
 * @returns {Promise<Object>} Worker details
 */
const getWorkerDetails = async (workerPhone) => {
  const response = await fetch(`${CONFIG.API_ROOT}/api/workers/${workerPhone}`);
  return await response.json();
  // Response: { worker: { phones: [{ phone_number }], ...other_details } }
};

/**
 * Save Message API
 * @param {Object} messageData - Message data to save
 * @returns {Promise<Object>} Save result with success status and message_id
 */
const saveMessage = async (messageData) => {
  const response = await fetch(`${CONFIG.API_ROOT}/api/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      order_id: messageData.order_id,
      content: messageData.content,
      sender_type: messageData.sender_type,
      forwarded_from: messageData.forwarded_from, // optional
      original_message_id: messageData.original_message_id // optional
    })
  });
  
  return await response.json();
  // Response: { success: true, message_id: "new_message_id" }
};

/**
 * Send WhatsApp Message
 * @param {string} phoneNumber - Recipient's phone number
 * @param {string} messageContent - Message content
 * @param {string} orderId - Order ID for template
 * @returns {Promise<Object>} Send result
 */
const sendWhatsAppMessage = async (phoneNumber, messageContent, orderId) => {
  const response = await fetch(`https://graph.facebook.com/v17.0${CONFIG.WHATSAPP_PHONE_ID}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CONFIG.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phoneNumber.replace(/\D/g, ''),
      type: "template",
      template: {
        name: "update_sending",
        language: { code: "en" },
        components: [{
          type: "body",
          parameters: [
            { type: "text", text: orderId },
            { type: "text", text: messageContent }
          ]
        }]
      }
    })
  });
  
  return await response.json();
  // Response: { 
  //   messaging_product: "whatsapp",
  //   contacts: [{ input, wa_id }],
  //   messages: [{ id }]
  // }
};

// ============================================
// COMPLETE MEDIA PROCESSING FLOW
// ============================================

/**
 * Process Media Message - Complete flow from WhatsApp media to permanent storage
 * @param {string} mediaId - WhatsApp media ID
 * @returns {Promise<Object>} Permanent URL and media type
 */
const processMediaMessage = async (mediaId) => {
  try {
    // Step 1: Get media details from WhatsApp
    const mediaDetails = await getMediaDetails(mediaId);
    
    // Step 2: Fetch media content through proxy
    const blob = await fetchProxiedMedia(mediaDetails.url);
    
    // Step 3: Determine file extension from MIME type
    const mimeType = mediaDetails.mime_type || 'application/octet-stream';
    const extensionMap = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'video/mp4': '.mp4',
      'video/quicktime': '.mov',
      'audio/mpeg': '.mp3',
      'audio/ogg': '.ogg'
    };
    const fileExtension = extensionMap[mimeType] || `.${mimeType.split('/')[1]}`;
    
    // Step 4: Upload to permanent storage
    const uploadResult = await uploadMedia(blob, mimeType, fileExtension);
    
    // Step 5: Return permanent URL
    return {
      url: `https://bsgold-api.chatloom.in${uploadResult.permanentUrl}`,
      type: mimeType
    };
    
  } catch (error) {
    console.error('Error processing media:', error);
    throw error;
  }
};

module.exports = {
  CONFIG,
  getMediaDetails,
  fetchProxiedMedia,
  uploadMedia,
  getOrderMessages,
  getClientDetails,
  getWorkerDetails,
  saveMessage,
  sendWhatsAppMessage,
  processMediaMessage
}; 