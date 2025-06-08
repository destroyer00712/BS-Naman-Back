const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');

// Save message (supports forwarding fields)
router.post('/', messageController.saveMessage);

// Get all messages
router.get('/', messageController.getAllMessages);

// Get message by ID (with forwarding details)
router.get('/:messageId', messageController.getMessageById);

// Get messages by order ID
router.get('/order/:orderId', messageController.getMessagesByOrderId);

// Get forwarded messages for a specific order
router.get('/order/:orderId/forwarded', messageController.getForwardedMessages);

module.exports = router; 