require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

// Web Sockets
const http = require('http');
const { Server } = require('socket.io');

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only audio, video, and image files
  const allowedTypes = ['audio/', 'video/', 'image/'];
  if (allowedTypes.some(type => file.mimetype.startsWith(type))) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only audio, video, and image files are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 16 * 1024 * 1024 // 16MB limit
  }
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",  
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], 
        allowedHeaders: ['Content-Type', 'Authorization'] 
    }
});

app.use(express.json());

app.use(cors({
  origin: '*', // This allows all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Allowed HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization'] // Allowed headers
}));

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Test route to verify server is working
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is working!' });
});

// Media upload endpoint
app.post('/api/media/upload', upload.single('file'), async (req, res) => {
  console.log('Received upload request');
  console.log('Request headers:', req.headers);
  console.log('Request body:', req.body);
  console.log('Request file:', req.file);
  
  try {
    if (!req.file) {
      console.log('No file in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const connection = await pool.getConnection();
    try {
      // Store file metadata in database
      const [result] = await connection.execute(
        'INSERT INTO media_files (file_name, original_name, mime_type, file_size, storage_url) VALUES (?, ?, ?, ?, ?)',
        [
          req.file.filename,
          req.file.originalname,
          req.file.mimetype,
          req.file.size,
          `/uploads/${req.file.filename}` // This will be the URL to access the file
        ]
      );

      console.log('File uploaded successfully:', result);
      res.status(201).json({
        permanentUrl: `/uploads/${req.file.filename}`,
        fileId: result.insertId,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype
      });

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error uploading file:', error);
    // If there's an error, delete the uploaded file
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }
    res.status(500).json({ error: 'Error uploading file', details: error.message });
  }
});

// Socket Connection
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Helper function for order ID generation
function generateOrderId(orderNumber) {
    const year = new Date().getFullYear().toString().slice(-2);
    const hexNumber = orderNumber.toString(16).toUpperCase().padStart(5, '0');
    return `BS${year}${hexNumber}`;
  }
  
  // ================== ORDER ENDPOINTS ==================
  
  // Create order
  app.post('/api/orders', async (req, res) => {
    try {
      const { client_details, jewellery_details } = req.body;
  
      if (!client_details?.phone || !jewellery_details) {
        return res.status(400).json({
          error: 'Missing required fields'
        });
      }
  
      const connection = await pool.getConnection();
  
      try {
        await connection.beginTransaction();
  
        const [result] = await connection.execute(
          'INSERT INTO orders (client_phone, jewellery_details) VALUES (?, ?)',
          [client_details.phone, JSON.stringify(jewellery_details)]
        );
  
        const orderId = generateOrderId(result.insertId);
  
        await connection.execute(
          'UPDATE orders SET id = ? WHERE order_number = ?',
          [orderId, result.insertId]
        );
  
        await connection.commit();
  
        const newOrder = {
          id: orderId, // Use the generated orderId
          client_details, // Include client details
          jewellery_details // Include jewellery details
        };
  
        io.emit('newOrder', newOrder);
  
        res.status(201).json({
          message: 'Order created successfully',
          order_id: orderId,
          created_at: new Date()
        });
  
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
  
    } catch (error) {
      console.error('Error creating order:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Get all orders
  app.get('/api/orders', async (req, res) => {
    try {
      const connection = await pool.getConnection();
      
      try {
        const [orders] = await connection.execute(
          `SELECT 
            id,
            client_phone,
            jewellery_details,
            created_at,
            updated_at
          FROM orders 
          ORDER BY created_at DESC`
        );
  
        const formattedOrders = orders.map(order => ({
          order_id: order.id,
          client_details: {
            phone: order.client_phone
          },
          jewellery_details: JSON.parse(order.jewellery_details),
          created_at: order.created_at,
          updated_at: order.updated_at
        }));
  
        res.json({ orders: formattedOrders });
  
      } finally {
        connection.release();
      }
  
    } catch (error) {
      console.error('Error fetching orders:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Update order
  app.put('/api/orders/:orderId', async (req, res) => {
    try {
      const { orderId } = req.params;
      const { client_details, jewellery_details } = req.body;
      
      if (!client_details?.phone && !jewellery_details) {
        return res.status(400).json({ 
          error: 'At least one field must be provided for update' 
        });
      }
  
      const connection = await pool.getConnection();
  
      try {
        const [orderExists] = await connection.execute(
          'SELECT id FROM orders WHERE id = ?',
          [orderId]
        );
  
        if (orderExists.length === 0) {
          return res.status(404).json({ error: 'Order not found' });
        }
  
        const updates = [];
        const values = [];
  
        if (client_details?.phone) {
          updates.push('client_phone = ?');
          values.push(client_details.phone);
        }
  
        if (jewellery_details) {
          updates.push('jewellery_details = ?');
          values.push(JSON.stringify(jewellery_details));
        }
  
        values.push(orderId);
  
        await connection.execute(
          `UPDATE orders SET ${updates.join(', ')} WHERE id = ?`,
          values
        );
  
        const [updatedOrder] = await connection.execute(
          `SELECT * FROM orders WHERE id = ?`,
          [orderId]
        );
  
        const formattedOrder = {
          order_id: updatedOrder[0].id,
          client_details: {
            phone: updatedOrder[0].client_phone
          },
          jewellery_details: JSON.parse(updatedOrder[0].jewellery_details),
          created_at: updatedOrder[0].created_at,
          updated_at: updatedOrder[0].updated_at
        };
  
        res.json({
          message: 'Order updated successfully',
          order: formattedOrder
        });
  
      } finally {
        connection.release();
      }
  
    } catch (error) {
      console.error('Error updating order:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Delete order
  app.delete('/api/orders/:orderId', async (req, res) => {
    try {
      const { orderId } = req.params;
      const connection = await pool.getConnection();
  
      try {
        const [orderExists] = await connection.execute(
          'SELECT id FROM orders WHERE id = ?',
          [orderId]
        );
  
        if (orderExists.length === 0) {
          return res.status(404).json({ error: 'Order not found' });
        }
  
        await connection.execute(
          'DELETE FROM orders WHERE id = ?',
          [orderId]
        );
  
        res.json({
          message: 'Order deleted successfully',
          order_id: orderId
        });
  
      } finally {
        connection.release();
      }
  
    } catch (error) {
      console.error('Error deleting order:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // ================== WORKER ENDPOINTS ==================
  
  // Create worker
  app.post('/api/workers', async (req, res) => {
    try {
      const { name, phone_number } = req.body;
      
      if (!name || !phone_number) {
        return res.status(400).json({ 
          error: 'Name and phone number are required' 
        });
      }
  
      const connection = await pool.getConnection();
  
      try {
        const [existing] = await connection.execute(
          'SELECT phone_number FROM workers WHERE phone_number = ?',
          [phone_number]
        );
  
        if (existing.length > 0) {
          return res.status(409).json({
            error: 'Worker with this phone number already exists'
          });
        }
  
        await connection.execute(
          'INSERT INTO workers (name, phone_number) VALUES (?, ?)',
          [name, phone_number]
        );
  
        res.status(201).json({
          message: 'Worker created successfully',
          worker: {
            name,
            phone_number,
            created_at: new Date()
          }
        });
  
      } finally {
        connection.release();
      }
  
    } catch (error) {
      console.error('Error creating worker:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Get all workers
  app.get('/api/workers', async (req, res) => {
    try {
      const connection = await pool.getConnection();
      
      try {
        const [workers] = await connection.execute(
          `SELECT * FROM workers ORDER BY created_at DESC`
        );
  
        res.json({ workers });
  
      } finally {
        connection.release();
      }
  
    } catch (error) {
      console.error('Error fetching workers:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Get worker by phone number
  app.get('/api/workers/:phoneNumber', async (req, res) => {
    try {
      const { phoneNumber } = req.params;
      const connection = await pool.getConnection();
  
      try {
        const [workers] = await connection.execute(
          'SELECT * FROM workers WHERE phone_number = ?',
          [phoneNumber]
        );
  
        if (workers.length === 0) {
          return res.status(404).json({ error: 'Worker not found' });
        }
  
        res.json({ worker: workers[0] });
  
      } finally {
        connection.release();
      }
  
    } catch (error) {
      console.error('Error fetching worker:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Update worker
  app.put('/api/workers/:phoneNumber', async (req, res) => {
    try {
      const { phoneNumber } = req.params;
      const { name } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: 'Name is required for update' });
      }
  
      const connection = await pool.getConnection();
  
      try {
        const [workerExists] = await connection.execute(
          'SELECT phone_number FROM workers WHERE phone_number = ?',
          [phoneNumber]
        );
  
        if (workerExists.length === 0) {
          return res.status(404).json({ error: 'Worker not found' });
        }
  
        await connection.execute(
          'UPDATE workers SET name = ? WHERE phone_number = ?',
          [name, phoneNumber]
        );
  
        const [updatedWorker] = await connection.execute(
          'SELECT * FROM workers WHERE phone_number = ?',
          [phoneNumber]
        );
  
        res.json({
          message: 'Worker updated successfully',
          worker: updatedWorker[0]
        });
  
      } finally {
        connection.release();
      }
  
    } catch (error) {
      console.error('Error updating worker:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Delete worker
  app.delete('/api/workers/:phoneNumber', async (req, res) => {
    try {
      const { phoneNumber } = req.params;
      const connection = await pool.getConnection();
  
      try {
        const [workerExists] = await connection.execute(
          'SELECT phone_number FROM workers WHERE phone_number = ?',
          [phoneNumber]
        );
  
        if (workerExists.length === 0) {
          return res.status(404).json({ error: 'Worker not found' });
        }
  
        await connection.execute(
          'DELETE FROM workers WHERE phone_number = ?',
          [phoneNumber]
        );
  
        res.json({
          message: 'Worker deleted successfully',
          phone_number: phoneNumber
        });
  
      } finally {
        connection.release();
      }
  
    } catch (error) {
      console.error('Error deleting worker:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
// ================== CLIENT ENDPOINTS ==================

// Create client
app.post('/api/clients', async (req, res) => {
    try {
      const { name, phone_number } = req.body;
      
      if (!name || !phone_number) {
        return res.status(400).json({ 
          error: 'Name and phone number are required' 
        });
      }
  
      const connection = await pool.getConnection();
  
      try {
        const [existing] = await connection.execute(
          'SELECT phone_number FROM clients WHERE phone_number = ?',
          [phone_number]
        );
  
        if (existing.length > 0) {
          return res.status(409).json({
            error: 'Client with this phone number already exists'
          });
        }
  
        await connection.execute(
          'INSERT INTO clients (name, phone_number) VALUES (?, ?)',
          [name, phone_number]
        );
  
        res.status(201).json({
          message: 'Client created successfully',
          client: {
            name,
            phone_number,
            created_at: new Date()
          }
        });
  
      } finally {
        connection.release();
      }
  
    } catch (error) {
      console.error('Error creating client:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Get all clients
  app.get('/api/clients', async (req, res) => {
    try {
      const connection = await pool.getConnection();
      
      try {
        const [clients] = await connection.execute(
          `SELECT * FROM clients ORDER BY created_at DESC`
        );
  
        res.json({ clients });
  
      } finally {
        connection.release();
      }
  
    } catch (error) {
      console.error('Error fetching clients:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Get client by phone number
  app.get('/api/clients/:phoneNumber', async (req, res) => {
    try {
      const { phoneNumber } = req.params;
      const connection = await pool.getConnection();
  
      try {
        const [clients] = await connection.execute(
          'SELECT * FROM clients WHERE phone_number = ?',
          [phoneNumber]
        );
  
        if (clients.length === 0) {
          return res.status(404).json({ error: 'Client not found' });
        }
  
        res.json({ client: clients[0] });
  
      } finally {
        connection.release();
      }
  
    } catch (error) {
      console.error('Error fetching client:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Update client
  app.put('/api/clients/:phoneNumber', async (req, res) => {
    try {
      const { phoneNumber } = req.params;
      const { name } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: 'Name is required for update' });
      }
  
      const connection = await pool.getConnection();
  
      try {
        const [clientExists] = await connection.execute(
          'SELECT phone_number FROM clients WHERE phone_number = ?',
          [phoneNumber]
        );
  
        if (clientExists.length === 0) {
          return res.status(404).json({ error: 'Client not found' });
        }
  
        await connection.execute(
          'UPDATE clients SET name = ? WHERE phone_number = ?',
          [name, phoneNumber]
        );
  
        const [updatedClient] = await connection.execute(
          'SELECT * FROM clients WHERE phone_number = ?',
          [phoneNumber]
        );
  
        res.json({
          message: 'Client updated successfully',
          client: updatedClient[0]
        });
  
      } finally {
        connection.release();
      }
  
    } catch (error) {
      console.error('Error updating client:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Delete client
  app.delete('/api/clients/:phoneNumber', async (req, res) => {
    try {
      const { phoneNumber } = req.params;
      const connection = await pool.getConnection();
  
      try {
        const [clientExists] = await connection.execute(
          'SELECT phone_number FROM clients WHERE phone_number = ?',
          [phoneNumber]
        );
  
        if (clientExists.length === 0) {
          return res.status(404).json({ error: 'Client not found' });
        }
  
        await connection.execute(
          'DELETE FROM clients WHERE phone_number = ?',
          [phoneNumber]
        );
  
        res.json({
          message: 'Client deleted successfully',
          phone_number: phoneNumber
        });
  
      } finally {
        connection.release();
      }
  
    } catch (error) {
      console.error('Error deleting client:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  // ================== MESSAGE ENDPOINTS ==================

// Save message
app.post('/api/messages', async (req, res) => {
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

     // Emit the new message to all connected clients
        const newMessage = message[0];
         io.emit(`newMessage:${order_id}`, newMessage);
         io.emit('newMessage', newMessage);
  
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
  });
  
  // Get all messages
  app.get('/api/messages', async (req, res) => {
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

         // Emit messages list to clients
         io.emit('allMessages', messages);
  
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
  });
  
  // Get messages by order ID
  app.get('/api/messages/order/:orderId', async (req, res) => {
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

                 // Emit messages for the specific order
                 io.emit(`messagesForOrder:${orderId}`, messages);
  
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
  });
  
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something broke!' });
  });
  
  // Start server
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });