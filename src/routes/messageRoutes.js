const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');

// Save message
router.post('/', messageController.saveMessage);

// Get all messages
router.get('/', messageController.getAllMessages);

// Get messages by order ID
router.get('/order/:orderId', messageController.getMessagesByOrderId);

module.exports = router; 