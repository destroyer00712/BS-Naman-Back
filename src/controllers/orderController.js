const pool = require('../config/db');
const { generateOrderId } = require('../utils/orderUtils');
const { sendWorkerAssignmentMessage, sendWorkerRemovalMessage, getWorkerPhoneNumbers } = require('../utils/whatsappUtils');

/**
 * Create a new order
 */
const createOrder = async (req, res) => {
  try {
    const { client_details, jewellery_details, worker_phone, employee_code } = req.body;
    
    // Only client_details.phone and jewellery_details are required
    if (!client_details?.phone || !jewellery_details) {
      return res.status(400).json({ 
        error: 'Missing required fields: client_details.phone and jewellery_details are required' 
      });
    }

    const connection = await pool.getConnection();

    try {
      // Verify employee exists only if employee_code is provided
      if (employee_code) {
        const [employeeExists] = await connection.execute(
          'SELECT id FROM employees WHERE id = ?',
          [employee_code]
        );

        if (employeeExists.length === 0) {
          return res.status(404).json({ error: 'Employee not found' });
        }
      }

      await connection.beginTransaction();

      const [result] = await connection.execute(
        'INSERT INTO orders (client_phone, jewellery_details, worker_phone, employee_code) VALUES (?, ?, ?, ?)',
        [client_details.phone, JSON.stringify(jewellery_details), worker_phone || null, employee_code || null]
      );

      const orderId = generateOrderId(result.insertId);

      await connection.execute(
        'UPDATE orders SET id = ? WHERE order_number = ?',
        [orderId, result.insertId]
      );

      await connection.commit();

      // If worker is assigned, send WhatsApp notification
      if (worker_phone) {
        const orderDetails = {
          order_id: orderId,
          jewellery_details
        };

        // Get all phone numbers for the worker
        const workerPhones = await getWorkerPhoneNumbers(connection, worker_phone);
        
        // Send assignment messages to all worker phone numbers
        for (const phone of workerPhones) {
          await sendWorkerAssignmentMessage(phone, orderDetails);
        }
      }

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
};

/**
 * Get all orders
 */
const getAllOrders = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    try {
      const [orders] = await connection.execute(
        `SELECT 
          o.id,
          o.client_phone,
          o.worker_phone,
          o.employee_code,
          o.jewellery_details,
          o.created_at,
          o.updated_at,
          e.name as employee_name
        FROM orders o
        LEFT JOIN employees e ON o.employee_code = e.id
        ORDER BY o.created_at DESC`
      );

      const formattedOrders = orders.map(order => ({
        order_id: order.id,
        client_details: {
          phone: order.client_phone
        },
        worker_phone: order.worker_phone,
        employee_details: {
          code: order.employee_code,
          name: order.employee_name
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
};

/**
 * Get pending orders for a worker
 */
const getWorkerPendingOrders = async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Worker phone number is required' });
    }

    const connection = await pool.getConnection();
    
    try {
      const [orders] = await connection.execute(
        `SELECT 
          o.id,
          o.client_phone,
          o.worker_phone,
          o.employee_code,
          o.jewellery_details,
          o.created_at,
          o.updated_at,
          e.name as employee_name
        FROM orders o
        LEFT JOIN employees e ON o.employee_code = e.id
        WHERE o.worker_phone = ? AND JSON_EXTRACT(o.jewellery_details, '$.status') = 'pending'
        ORDER BY o.created_at DESC`,
        [phoneNumber]
      );

      const formattedOrders = orders.map(order => ({
        order_id: order.id,
        client_details: {
          phone: order.client_phone
        },
        worker_phone: order.worker_phone,
        employee_details: {
          code: order.employee_code,
          name: order.employee_name
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
    console.error('Error fetching worker pending orders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Reassign a worker to an order
 */
const reassignWorker = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { worker_phone } = req.body;
    
    if (!worker_phone) {
      return res.status(400).json({ error: 'Worker phone number is required' });
    }

    const connection = await pool.getConnection();

    try {
      // Check if order exists and get current details
      const [orderExists] = await connection.execute(
        'SELECT id, worker_phone, jewellery_details FROM orders WHERE id = ?',
        [orderId]
      );

      if (orderExists.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
      }

      const currentOrder = orderExists[0];
      const previousWorkerPhone = currentOrder.worker_phone;
      const parsedJewelleryDetails = JSON.parse(currentOrder.jewellery_details);

      // Check if worker exists
      const [workerExists] = await connection.execute(
        'SELECT phone_number FROM worker_phones WHERE phone_number = ?',
        [worker_phone]
      );

      if (workerExists.length === 0) {
        return res.status(404).json({ error: 'Worker not found' });
      }

      // Update the order with the new worker
      await connection.execute(
        'UPDATE orders SET worker_phone = ? WHERE id = ?',
        [worker_phone, orderId]
      );

      // Get the updated order
      const [updatedOrder] = await connection.execute(
        `SELECT 
          id,
          client_phone,
          worker_phone,
          jewellery_details,
          created_at,
          updated_at
        FROM orders 
        WHERE id = ?`,
        [orderId]
      );

      const formattedOrder = {
        order_id: updatedOrder[0].id,
        client_details: {
          phone: updatedOrder[0].client_phone
        },
        worker_phone: updatedOrder[0].worker_phone,
        jewellery_details: JSON.parse(updatedOrder[0].jewellery_details),
        created_at: updatedOrder[0].created_at,
        updated_at: updatedOrder[0].updated_at
      };

      // Send WhatsApp messages if worker has changed
      if (previousWorkerPhone && previousWorkerPhone !== worker_phone) {
        // Get all phone numbers for the previous worker
        const previousWorkerPhones = await getWorkerPhoneNumbers(connection, previousWorkerPhone);
        
        // Send messages to all phone numbers of the previous worker
        for (const phone of previousWorkerPhones) {
          await sendWorkerRemovalMessage(phone, formattedOrder);
        }
      }

      // Get all phone numbers for the new worker
      const newWorkerPhones = await getWorkerPhoneNumbers(connection, worker_phone);
      
      // Send messages to all phone numbers of the new worker
      for (const phone of newWorkerPhones) {
        await sendWorkerAssignmentMessage(phone, formattedOrder);
      }

      res.json({
        message: 'Worker reassigned successfully',
        order: formattedOrder
      });

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error reassigning worker:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Update an existing order
 */
const updateOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { client_details, jewellery_details, worker_phone } = req.body;
    
    if (!client_details?.phone && !jewellery_details && !worker_phone) {
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

      if (worker_phone !== undefined) {
        updates.push('worker_phone = ?');
        values.push(worker_phone || null);
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
        worker_phone: updatedOrder[0].worker_phone,
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
};

/**
 * Delete an order
 */
const deleteOrder = async (req, res) => {
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
};

module.exports = {
  createOrder,
  getAllOrders,
  getWorkerPendingOrders,
  reassignWorker,
  updateOrder,
  deleteOrder
}; 