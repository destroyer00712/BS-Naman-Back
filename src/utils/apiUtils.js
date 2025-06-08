const fetch = require('node-fetch');
const FormData = require('form-data');
const whatsappConfig = require('../config/whatsapp');
const logger = require('./logger');

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
  const startTime = Date.now();
  logger.info('Starting getMediaDetails request', { 
    mediaId: mediaId ? `${mediaId.substring(0, 10)}***` : 'null',
    function: 'getMediaDetails'
  });

  try {
    const url = `https://graph.facebook.com/v17.0/${mediaId}`;
    logger.debug('Making WhatsApp API request', { 
      url,
      hasToken: !!CONFIG.WHATSAPP_ACCESS_TOKEN,
      function: 'getMediaDetails'
    });

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${CONFIG.WHATSAPP_ACCESS_TOKEN}`
      }
    });

    const responseTime = Date.now() - startTime;
    
    if (!response.ok) {
      logger.error('WhatsApp API request failed', {
        status: response.status,
        statusText: response.statusText,
        mediaId: mediaId ? `${mediaId.substring(0, 10)}***` : 'null',
        responseTime,
        function: 'getMediaDetails'
      });
      throw new Error(`WhatsApp API request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    logger.info('getMediaDetails completed successfully', {
      mediaId: mediaId ? `${mediaId.substring(0, 10)}***` : 'null',
      mimeType: result.mime_type,
      fileSize: result.file_size,
      hasUrl: !!result.url,
      responseTime,
      function: 'getMediaDetails'
    });

    return result;
    // Response: { url, mime_type, sha256, file_size, id }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('getMediaDetails failed', {
      error: error.message,
      stack: error.stack,
      mediaId: mediaId ? `${mediaId.substring(0, 10)}***` : 'null',
      responseTime,
      function: 'getMediaDetails'
    });
    throw error;
  }
};

/**
 * Media Proxy API - Fetch FB Media Content
 * @param {string} facebookMediaUrl - The Facebook media URL
 * @returns {Promise<Blob>} Binary blob data
 */
const fetchProxiedMedia = async (facebookMediaUrl) => {
  const startTime = Date.now();
  logger.info('Starting fetchProxiedMedia request', { 
    hasUrl: !!facebookMediaUrl,
    urlLength: facebookMediaUrl ? facebookMediaUrl.length : 0,
    function: 'fetchProxiedMedia'
  });

  try {
    const proxyUrl = `https://bsgold.chatloom.in/api/proxy-fb-media?url=${encodeURIComponent(facebookMediaUrl)}`;
    
    logger.debug('Making proxy media request', { 
      proxyUrl: proxyUrl.substring(0, 100) + '...',
      function: 'fetchProxiedMedia'
    });

    const response = await fetch(proxyUrl);
    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      logger.error('Proxy media request failed', {
        status: response.status,
        statusText: response.statusText,
        responseTime,
        function: 'fetchProxiedMedia'
      });
      throw new Error(`Proxy media request failed: ${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();
    
    logger.info('fetchProxiedMedia completed successfully', {
      blobSize: blob.size,
      blobType: blob.type,
      responseTime,
      function: 'fetchProxiedMedia'
    });

    return blob;
    // Response: Binary blob data
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('fetchProxiedMedia failed', {
      error: error.message,
      stack: error.stack,
      responseTime,
      function: 'fetchProxiedMedia'
    });
    throw error;
  }
};

/**
 * Media Upload API - Store Permanently
 * @param {Blob} blob - The media blob
 * @param {string} mimeType - MIME type of the media
 * @param {string} fileExtension - File extension
 * @returns {Promise<Object>} Upload result with permanentUrl and success status
 */
const uploadMedia = async (blob, mimeType, fileExtension) => {
  const startTime = Date.now();
  logger.info('Starting uploadMedia request', { 
    blobSize: blob ? blob.size : 0,
    mimeType,
    fileExtension,
    function: 'uploadMedia'
  });

  try {
    const formData = new FormData();
    const filename = `media_${Date.now()}${fileExtension}`;
    formData.append('file', blob, filename);
    formData.append('type', mimeType);

    logger.debug('Prepared form data for upload', {
      filename,
      mimeType,
      hasBlob: !!blob,
      function: 'uploadMedia'
    });

    const uploadUrl = `${CONFIG.API_ROOT}/api/media/upload`;
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      logger.error('Media upload request failed', {
        status: response.status,
        statusText: response.statusText,
        uploadUrl,
        responseTime,
        function: 'uploadMedia'
      });
      throw new Error(`Media upload failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    logger.info('uploadMedia completed successfully', {
      filename,
      permanentUrl: result.permanentUrl,
      success: result.success,
      responseTime,
      function: 'uploadMedia'
    });

    return result;
    // Response: { permanentUrl: "/uploads/media/filename.ext", success: true }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('uploadMedia failed', {
      error: error.message,
      stack: error.stack,
      mimeType,
      fileExtension,
      responseTime,
      function: 'uploadMedia'
    });
    throw error;
  }
};

/**
 * Enhanced Media Content Fetcher for Forwarding
 * Fetches media from Facebook and uploads to permanent storage for reliable forwarding
 * @param {string} mediaId - WhatsApp media ID
 * @returns {Promise<Object>} Permanent media data with URL and type
 */
const fetchMediaContentForForwarding = async (mediaId) => {
  const startTime = Date.now();
  logger.info('Starting fetchMediaContentForForwarding flow', { 
    mediaId: mediaId ? `${mediaId.substring(0, 10)}***` : 'null',
    function: 'fetchMediaContentForForwarding'
  });

  try {
    // Step 1: Get media details from WhatsApp
    logger.debug('Step 1: Getting media details for forwarding', { 
      mediaId: mediaId ? `${mediaId.substring(0, 10)}***` : 'null',
      function: 'fetchMediaContentForForwarding'
    });
    const mediaDetails = await getMediaDetails(mediaId);
    
    // Step 2: Fetch media content through proxy
    logger.debug('Step 2: Fetching media content for forwarding', { 
      hasUrl: !!mediaDetails.url,
      mimeType: mediaDetails.mime_type,
      fileSize: mediaDetails.file_size,
      function: 'fetchMediaContentForForwarding'
    });
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
      'audio/ogg': '.ogg',
      'audio/mp4': '.m4a'
    };
    const fileExtension = extensionMap[mimeType] || `.${mimeType.split('/')[1]}`;
    
    logger.debug('Step 3: Determined file extension for forwarding', { 
      mimeType,
      fileExtension,
      blobSize: blob.size,
      function: 'fetchMediaContentForForwarding'
    });
    
    // Step 4: Upload to permanent storage
    logger.debug('Step 4: Uploading media for forwarding', { 
      mimeType,
      fileExtension,
      blobSize: blob.size,
      function: 'fetchMediaContentForForwarding'
    });
    const uploadResult = await uploadMedia(blob, mimeType, fileExtension);
    
    // Step 5: Return permanent URL for forwarding
    const result = {
      url: `${CONFIG.API_ROOT}${uploadResult.permanentUrl}`,
      type: mimeType,
      isPermanent: true,
      filename: `media_${Date.now()}${fileExtension}`,
      size: blob.size
    };

    const responseTime = Date.now() - startTime;
    logger.info('fetchMediaContentForForwarding completed successfully', {
      mediaId: mediaId ? `${mediaId.substring(0, 10)}***` : 'null',
      permanentUrl: result.url,
      mimeType: result.type,
      fileSize: result.size,
      totalProcessingTime: responseTime,
      function: 'fetchMediaContentForForwarding'
    });

    return result;
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    // If permanent upload fails, try to fallback to Facebook URL
    logger.warn('Permanent media upload failed, attempting fallback', {
      error: error.message,
      mediaId: mediaId ? `${mediaId.substring(0, 10)}***` : 'null',
      processingTime: responseTime,
      function: 'fetchMediaContentForForwarding'
    });

    try {
      // Fallback: Get media details and return Facebook URL
      const mediaDetails = await getMediaDetails(mediaId);
      const fallbackResult = {
        url: mediaDetails.url,
        type: mediaDetails.mime_type,
        isPermanent: false,
        isFallback: true
      };

      logger.warn('Using Facebook URL as fallback for forwarding', {
        mediaId: mediaId ? `${mediaId.substring(0, 10)}***` : 'null',
        fallbackUrl: 'Facebook URL (truncated)',
        function: 'fetchMediaContentForForwarding'
      });

      return fallbackResult;

    } catch (fallbackError) {
      logger.error('Both permanent upload and fallback failed', {
        originalError: error.message,
        fallbackError: fallbackError.message,
        stack: error.stack,
        mediaId: mediaId ? `${mediaId.substring(0, 10)}***` : 'null',
        totalProcessingTime: responseTime,
        function: 'fetchMediaContentForForwarding'
      });
      throw error; // Throw original error
    }
  }
};

/**
 * Forward Message with Permanent Media URLs
 * @param {Object} message - Original message to forward
 * @param {string} targetOrderId - Target order ID to forward to
 * @param {string} recipientPhone - Recipient's phone number
 * @param {string} senderType - Type of sender forwarding the message
 * @returns {Promise<Object>} Forward result with message and WhatsApp send status
 */
const forwardMessage = async (message, targetOrderId, recipientPhone, senderType = 'enterprise') => {
  const startTime = Date.now();
  logger.info('Starting forwardMessage request', { 
    originalMessageId: message.message_id,
    targetOrderId,
    recipientPhone: recipientPhone ? `***${recipientPhone.slice(-4)}` : 'null',
    senderType,
    hasMediaId: !!message.media_id,
    function: 'forwardMessage'
  });

  try {
    let messageContent = message.content;
    let templateComponents = [{
      type: "body", 
      parameters: [
        { type: "text", text: targetOrderId },
        { type: "text", text: messageContent }
      ]
    }];

    // Handle media messages
    if (message.media_id) {
      logger.debug('Processing media message for forwarding', {
        mediaId: message.media_id ? `${message.media_id.substring(0, 10)}***` : 'null',
        function: 'forwardMessage'
      });

      try {
        // Fetch media and get permanent URL
        const mediaData = await fetchMediaContentForForwarding(message.media_id);
        
        // Update message content to include permanent media URL
        const mediaText = `[Media: ${mediaData.type}] ${mediaData.url}`;
        messageContent = message.content ? `${message.content}\n\n${mediaText}` : mediaText;
        
        templateComponents = [{
          type: "body", 
          parameters: [
            { type: "text", text: targetOrderId },
            { type: "text", text: messageContent }
          ]
        }];

        logger.info('Media processed for forwarding', {
          mediaId: message.media_id ? `${message.media_id.substring(0, 10)}***` : 'null',
          permanentUrl: mediaData.url,
          isPermanent: mediaData.isPermanent,
          isFallback: mediaData.isFallback || false,
          function: 'forwardMessage'
        });

      } catch (mediaError) {
        logger.error('Failed to process media for forwarding', {
          error: mediaError.message,
          mediaId: message.media_id ? `${message.media_id.substring(0, 10)}***` : 'null',
          function: 'forwardMessage'
        });
        
        // Continue with text-only forwarding
        const mediaErrorText = `[Media processing failed - ID: ${message.media_id}]`;
        messageContent = message.content ? `${message.content}\n\n${mediaErrorText}` : mediaErrorText;
      }
    }

    // Send WhatsApp message
    logger.debug('Sending forwarded WhatsApp message', {
      recipientPhone: recipientPhone ? `***${recipientPhone.slice(-4)}` : 'null',
      targetOrderId,
      function: 'forwardMessage'
    });

    const whatsappResult = await sendWhatsAppMessage(recipientPhone, messageContent, targetOrderId);

    // Save forwarded message to database
    const messageData = {
      order_id: targetOrderId,
      content: messageContent,
      sender_type: senderType,
      forwarded_from: message.sender_type,
      original_message_id: message.message_id
    };

    logger.debug('Saving forwarded message to database', {
      targetOrderId,
      senderType,
      forwardedFrom: message.sender_type,
      originalMessageId: message.message_id,
      function: 'forwardMessage'
    });

    const saveResult = await saveMessage(messageData);

    const responseTime = Date.now() - startTime;
    logger.info('forwardMessage completed successfully', {
      originalMessageId: message.message_id,
      newMessageId: saveResult.message_id,
      targetOrderId,
      recipientPhone: recipientPhone ? `***${recipientPhone.slice(-4)}` : 'null',
      whatsappMessageId: whatsappResult.messages ? whatsappResult.messages[0]?.id : null,
      totalProcessingTime: responseTime,
      function: 'forwardMessage'
    });

    return {
      success: true,
      originalMessage: message,
      forwardedMessage: {
        message_id: saveResult.message_id,
        order_id: targetOrderId,
        content: messageContent,
        sender_type: senderType,
        forwarded_from: message.sender_type,
        original_message_id: message.message_id
      },
      whatsappResult,
      processingTime: responseTime
    };

  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('forwardMessage failed', {
      error: error.message,
      stack: error.stack,
      originalMessageId: message.message_id,
      targetOrderId,
      recipientPhone: recipientPhone ? `***${recipientPhone.slice(-4)}` : 'null',
      totalProcessingTime: responseTime,
      function: 'forwardMessage'
    });
    throw error;
  }
};

/**
 * Get Order Messages
 * @param {string} orderId - The order ID
 * @returns {Promise<Object>} Messages for the order
 */
const getOrderMessages = async (orderId) => {
  const startTime = Date.now();
  logger.info('Starting getOrderMessages request', { 
    orderId,
    function: 'getOrderMessages'
  });

  try {
    const url = `${CONFIG.API_ROOT}/api/orders/${orderId}/messages`;
    
    logger.debug('Making order messages request', { 
      url,
      orderId,
      function: 'getOrderMessages'
    });

    const response = await fetch(url);
    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      logger.error('Order messages request failed', {
        status: response.status,
        statusText: response.statusText,
        orderId,
        responseTime,
        function: 'getOrderMessages'
      });
      throw new Error(`Order messages request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    logger.info('getOrderMessages completed successfully', {
      orderId,
      messageCount: result.messages ? result.messages.length : 0,
      responseTime,
      function: 'getOrderMessages'
    });

    return result;
    // Response: { 
    //   messages: [
    //     {
    //       message_id, order_id, content, sender_type,
    //       media_id?, media_type?, created_at, recipients?
    //     }
    //   ]
    // }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('getOrderMessages failed', {
      error: error.message,
      stack: error.stack,
      orderId,
      responseTime,
      function: 'getOrderMessages'
    });
    throw error;
  }
};

/**
 * Get Client Details
 * @param {string} phoneNumber - Client's phone number
 * @returns {Promise<Object>} Client details
 */
const getClientDetails = async (phoneNumber) => {
  const startTime = Date.now();
  logger.info('Starting getClientDetails request', { 
    phoneNumber: phoneNumber ? `***${phoneNumber.slice(-4)}` : 'null',
    function: 'getClientDetails'
  });

  try {
    const url = `${CONFIG.API_ROOT}/api/clients/${phoneNumber}`;
    
    logger.debug('Making client details request', { 
      url: url.replace(phoneNumber, `***${phoneNumber.slice(-4)}`),
      function: 'getClientDetails'
    });

    const response = await fetch(url);
    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      logger.error('Client details request failed', {
        status: response.status,
        statusText: response.statusText,
        phoneNumber: phoneNumber ? `***${phoneNumber.slice(-4)}` : 'null',
        responseTime,
        function: 'getClientDetails'
      });
      throw new Error(`Client details request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    logger.info('getClientDetails completed successfully', {
      phoneNumber: phoneNumber ? `***${phoneNumber.slice(-4)}` : 'null',
      hasClient: !!result.client,
      clientName: result.client ? result.client.name : null,
      responseTime,
      function: 'getClientDetails'
    });

    return result;
    // Response: { client: { name, phone, ...other_details } }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('getClientDetails failed', {
      error: error.message,
      stack: error.stack,
      phoneNumber: phoneNumber ? `***${phoneNumber.slice(-4)}` : 'null',
      responseTime,
      function: 'getClientDetails'
    });
    throw error;
  }
};

/**
 * Get Worker Details
 * @param {string} workerPhone - Worker's phone number
 * @returns {Promise<Object>} Worker details
 */
const getWorkerDetails = async (workerPhone) => {
  const startTime = Date.now();
  logger.info('Starting getWorkerDetails request', { 
    workerPhone: workerPhone ? `***${workerPhone.slice(-4)}` : 'null',
    function: 'getWorkerDetails'
  });

  try {
    const url = `${CONFIG.API_ROOT}/api/workers/${workerPhone}`;
    
    logger.debug('Making worker details request', { 
      url: url.replace(workerPhone, `***${workerPhone.slice(-4)}`),
      function: 'getWorkerDetails'
    });

    const response = await fetch(url);
    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      logger.error('Worker details request failed', {
        status: response.status,
        statusText: response.statusText,
        workerPhone: workerPhone ? `***${workerPhone.slice(-4)}` : 'null',
        responseTime,
        function: 'getWorkerDetails'
      });
      throw new Error(`Worker details request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    logger.info('getWorkerDetails completed successfully', {
      workerPhone: workerPhone ? `***${workerPhone.slice(-4)}` : 'null',
      hasWorker: !!result.worker,
      phoneCount: result.worker && result.worker.phones ? result.worker.phones.length : 0,
      responseTime,
      function: 'getWorkerDetails'
    });

    return result;
    // Response: { worker: { phones: [{ phone_number }], ...other_details } }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('getWorkerDetails failed', {
      error: error.message,
      stack: error.stack,
      workerPhone: workerPhone ? `***${workerPhone.slice(-4)}` : 'null',
      responseTime,
      function: 'getWorkerDetails'
    });
    throw error;
  }
};

/**
 * Save Message API
 * @param {Object} messageData - Message data to save
 * @returns {Promise<Object>} Save result with success status and message_id
 */
const saveMessage = async (messageData) => {
  const startTime = Date.now();
  logger.info('Starting saveMessage request', { 
    orderId: messageData.order_id,
    senderType: messageData.sender_type,
    hasContent: !!messageData.content,
    contentLength: messageData.content ? messageData.content.length : 0,
    hasForwardedFrom: !!messageData.forwarded_from,
    hasOriginalMessageId: !!messageData.original_message_id,
    function: 'saveMessage'
  });

  try {
    const url = `${CONFIG.API_ROOT}/api/messages`;
    const payload = {
      order_id: messageData.order_id,
      content: messageData.content,
      sender_type: messageData.sender_type,
      forwarded_from: messageData.forwarded_from, // optional
      original_message_id: messageData.original_message_id // optional
    };

    logger.debug('Making save message request', { 
      url,
      payloadKeys: Object.keys(payload),
      function: 'saveMessage'
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      logger.error('Save message request failed', {
        status: response.status,
        statusText: response.statusText,
        orderId: messageData.order_id,
        responseTime,
        function: 'saveMessage'
      });
      throw new Error(`Save message request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    logger.info('saveMessage completed successfully', {
      orderId: messageData.order_id,
      messageId: result.message_id,
      success: result.success,
      responseTime,
      function: 'saveMessage'
    });

    return result;
    // Response: { success: true, message_id: "new_message_id" }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('saveMessage failed', {
      error: error.message,
      stack: error.stack,
      orderId: messageData.order_id,
      senderType: messageData.sender_type,
      responseTime,
      function: 'saveMessage'
    });
    throw error;
  }
};

/**
 * Send WhatsApp Message
 * @param {string} phoneNumber - Recipient's phone number
 * @param {string} messageContent - Message content
 * @param {string} orderId - Order ID for template
 * @returns {Promise<Object>} Send result
 */
const sendWhatsAppMessage = async (phoneNumber, messageContent, orderId) => {
  const startTime = Date.now();
  logger.info('Starting sendWhatsAppMessage request', { 
    phoneNumber: phoneNumber ? `***${phoneNumber.slice(-4)}` : 'null',
    orderId,
    messageLength: messageContent ? messageContent.length : 0,
    function: 'sendWhatsAppMessage'
  });

  try {
    const cleanPhoneNumber = phoneNumber.replace(/\D/g, '');
    const url = `https://graph.facebook.com/v17.0${CONFIG.WHATSAPP_PHONE_ID}/messages`;
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanPhoneNumber,
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
    };

    logger.debug('Making WhatsApp send message request', { 
      url,
      to: `***${cleanPhoneNumber.slice(-4)}`,
      templateName: payload.template.name,
      hasToken: !!CONFIG.WHATSAPP_ACCESS_TOKEN,
      function: 'sendWhatsAppMessage'
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      logger.error('WhatsApp send message request failed', {
        status: response.status,
        statusText: response.statusText,
        phoneNumber: `***${cleanPhoneNumber.slice(-4)}`,
        orderId,
        responseTime,
        function: 'sendWhatsAppMessage'
      });
      throw new Error(`WhatsApp send message failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    logger.info('sendWhatsAppMessage completed successfully', {
      phoneNumber: `***${cleanPhoneNumber.slice(-4)}`,
      orderId,
      messageId: result.messages ? result.messages[0]?.id : null,
      contactWaId: result.contacts ? result.contacts[0]?.wa_id : null,
      responseTime,
      function: 'sendWhatsAppMessage'
    });

    return result;
    // Response: { 
    //   messaging_product: "whatsapp",
    //   contacts: [{ input, wa_id }],
    //   messages: [{ id }]
    // }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('sendWhatsAppMessage failed', {
      error: error.message,
      stack: error.stack,
      phoneNumber: phoneNumber ? `***${phoneNumber.slice(-4)}` : 'null',
      orderId,
      responseTime,
      function: 'sendWhatsAppMessage'
    });
    throw error;
  }
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
  const startTime = Date.now();
  logger.info('Starting processMediaMessage flow', { 
    mediaId: mediaId ? `${mediaId.substring(0, 10)}***` : 'null',
    function: 'processMediaMessage'
  });

  try {
    // Step 1: Get media details from WhatsApp
    logger.debug('Step 1: Getting media details from WhatsApp', { 
      mediaId: mediaId ? `${mediaId.substring(0, 10)}***` : 'null',
      function: 'processMediaMessage'
    });
    const mediaDetails = await getMediaDetails(mediaId);
    
    // Step 2: Fetch media content through proxy
    logger.debug('Step 2: Fetching media content through proxy', { 
      hasUrl: !!mediaDetails.url,
      mimeType: mediaDetails.mime_type,
      fileSize: mediaDetails.file_size,
      function: 'processMediaMessage'
    });
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
    
    logger.debug('Step 3: Determined file extension', { 
      mimeType,
      fileExtension,
      blobSize: blob.size,
      function: 'processMediaMessage'
    });
    
    // Step 4: Upload to permanent storage
    logger.debug('Step 4: Uploading to permanent storage', { 
      mimeType,
      fileExtension,
      blobSize: blob.size,
      function: 'processMediaMessage'
    });
    const uploadResult = await uploadMedia(blob, mimeType, fileExtension);
    
    // Step 5: Return permanent URL
    const result = {
      url: `https://bsgold-api.chatloom.in${uploadResult.permanentUrl}`,
      type: mimeType
    };

    const responseTime = Date.now() - startTime;
    logger.info('processMediaMessage completed successfully', {
      mediaId: mediaId ? `${mediaId.substring(0, 10)}***` : 'null',
      finalUrl: result.url,
      mimeType: result.type,
      totalProcessingTime: responseTime,
      function: 'processMediaMessage'
    });

    return result;
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('processMediaMessage failed', {
      error: error.message,
      stack: error.stack,
      mediaId: mediaId ? `${mediaId.substring(0, 10)}***` : 'null',
      totalProcessingTime: responseTime,
      function: 'processMediaMessage'
    });
    throw error;
  }
};

module.exports = {
  CONFIG,
  getMediaDetails,
  fetchProxiedMedia,
  uploadMedia,
  fetchMediaContentForForwarding,
  forwardMessage,
  getOrderMessages,
  getClientDetails,
  getWorkerDetails,
  saveMessage,
  sendWhatsAppMessage,
  processMediaMessage
}; 