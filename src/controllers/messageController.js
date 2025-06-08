const pool = require('../config/db');

/**
 * Save a new message
 */
const saveMessage = async (req, res) => {
  try {
    const { 
      order_id, 
      content, 
      media_id, 
      sender_type, 
      forwarded_from, 
      original_message_id 
    } = req.body;
    
    // Validate required fields
    if (!order_id || !content || !sender_type) {
      return res.status(400).json({ 
        error: 'order_id, content, and sender_type are required' 
      });
    }

    // Validate sender_type
    const validSenderTypes = ['enterprise', 'client', 'worker'];
    if (!validSenderTypes.includes(sender_type)) {
      return res.status(400).json({ 
        error: 'Invalid sender_type. Must be enterprise, client, or worker' 
      });
    }

    const connection = await pool.getConnection();

    try {
      // Check if order exists
      const [orderExists] = await connection.execute(
        'SELECT id FROM orders WHERE id = ?',
        [order_id]
      );

      if (orderExists.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
      }

      // Insert message with forwarding support
      const [result] = await connection.execute(
        `INSERT INTO messages 
         (order_id, content, media_id, sender_type, forwarded_from, original_message_id) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          order_id, 
          content, 
          media_id || null, 
          sender_type,
          forwarded_from || null,
          original_message_id || null
        ]
      );

      // Fetch the created message
      const [message] = await connection.execute(
        `SELECT 
          message_id,
          order_id,
          content,
          media_id,
          sender_type,
          forwarded_from,
          original_message_id,
          created_at
        FROM messages 
        WHERE message_id = ?`,
        [result.insertId]
      );

      res.status(201).json({
        message: 'Message saved successfully',
        message_id: result.insertId,
        success: true,
        data: message[0]
      });

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error saving message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get all messages
 */
const getAllMessages = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    try {
      const [messages] = await connection.execute(
        `SELECT 
          message_id,
          order_id,
          content,
          media_id,
          sender_type,
          forwarded_from,
          original_message_id,
          created_at
        FROM messages 
        ORDER BY created_at DESC`
      );

      res.json({ 
        count: messages.length,
        messages 
      });

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get messages by order ID
 */
const getMessagesByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params;
    const connection = await pool.getConnection();

    try {
      // Check if order exists
      const [orderExists] = await connection.execute(
        'SELECT id FROM orders WHERE id = ?',
        [orderId]
      );

      if (orderExists.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
      }

      // Fetch messages for the order with forwarding information
      const [messages] = await connection.execute(
        `SELECT 
          message_id,
          order_id,
          content,
          media_id,
          sender_type,
          forwarded_from,
          original_message_id,
          created_at
        FROM messages 
        WHERE order_id = ?
        ORDER BY created_at ASC`,
        [orderId]
      );

      res.json({ 
        order_id: orderId,
        count: messages.length,
        messages 
      });

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error fetching messages for order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get message by ID with forwarding details
 */
const getMessageById = async (req, res) => {
  try {
    const { messageId } = req.params;
    const connection = await pool.getConnection();

    try {
      // Fetch message with potential original message details
      const [message] = await connection.execute(
        `SELECT 
          m.message_id,
          m.order_id,
          m.content,
          m.media_id,
          m.sender_type,
          m.forwarded_from,
          m.original_message_id,
          m.created_at,
          orig.content as original_content,
          orig.sender_type as original_sender_type,
          orig.created_at as original_created_at
        FROM messages m
        LEFT JOIN messages orig ON m.original_message_id = orig.message_id
        WHERE m.message_id = ?`,
        [messageId]
      );

      if (message.length === 0) {
        return res.status(404).json({ error: 'Message not found' });
      }

      const messageData = message[0];
      
      // Structure the response
      const response = {
        message_id: messageData.message_id,
        order_id: messageData.order_id,
        content: messageData.content,
        media_id: messageData.media_id,
        sender_type: messageData.sender_type,
        forwarded_from: messageData.forwarded_from,
        original_message_id: messageData.original_message_id,
        created_at: messageData.created_at,
        is_forwarded: !!messageData.forwarded_from
      };

      // Include original message details if this is a forwarded message
      if (messageData.original_message_id && messageData.original_content) {
        response.original_message = {
          content: messageData.original_content,
          sender_type: messageData.original_sender_type,
          created_at: messageData.original_created_at
        };
      }

      res.json({ 
        message: response
      });

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error fetching message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get forwarded messages for a specific order
 */
const getForwardedMessages = async (req, res) => {
  try {
    const { orderId } = req.params;
    const connection = await pool.getConnection();

    try {
      // Check if order exists
      const [orderExists] = await connection.execute(
        'SELECT id FROM orders WHERE id = ?',
        [orderId]
      );

      if (orderExists.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
      }

      // Fetch only forwarded messages for the order
      const [messages] = await connection.execute(
        `SELECT 
          m.message_id,
          m.order_id,
          m.content,
          m.media_id,
          m.sender_type,
          m.forwarded_from,
          m.original_message_id,
          m.created_at,
          orig.order_id as original_order_id,
          orig.content as original_content,
          orig.sender_type as original_sender_type
        FROM messages m
        LEFT JOIN messages orig ON m.original_message_id = orig.message_id
        WHERE m.order_id = ? AND m.forwarded_from IS NOT NULL
        ORDER BY m.created_at ASC`,
        [orderId]
      );

      const forwardedMessages = messages.map(msg => ({
        message_id: msg.message_id,
        order_id: msg.order_id,
        content: msg.content,
        media_id: msg.media_id,
        sender_type: msg.sender_type,
        forwarded_from: msg.forwarded_from,
        original_message_id: msg.original_message_id,
        created_at: msg.created_at,
        original_message: {
          order_id: msg.original_order_id,
          content: msg.original_content,
          sender_type: msg.original_sender_type
        }
      }));

      res.json({ 
        order_id: orderId,
        count: forwardedMessages.length,
        forwarded_messages: forwardedMessages
      });

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error fetching forwarded messages for order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  saveMessage,
  getAllMessages,
  getMessagesByOrderId,
  getMessageById,
  getForwardedMessages
}; 