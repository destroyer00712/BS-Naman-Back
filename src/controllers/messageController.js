const pool = require('../config/db');

/**
 * Save a new message
 */
const saveMessage = async (req, res) => {
  try {
    const { order_id, content, media_id, sender_type } = req.body;
    
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

      // Insert message
      const [result] = await connection.execute(
        'INSERT INTO messages (order_id, content, media_id, sender_type) VALUES (?, ?, ?, ?)',
        [order_id, content, media_id || null, sender_type]
      );

      // Fetch the created message
      const [message] = await connection.execute(
        'SELECT * FROM messages WHERE message_id = ?',
        [result.insertId]
      );

      res.status(201).json({
        message: 'Message saved successfully',
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

      // Fetch messages for the order
      const [messages] = await connection.execute(
        `SELECT 
          message_id,
          order_id,
          content,
          media_id,
          sender_type,
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

module.exports = {
  saveMessage,
  getAllMessages,
  getMessagesByOrderId
}; 