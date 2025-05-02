const pool = require('../config/db');
const logger = require('../utils/logger');
const fetch = require('node-fetch');

/**
 * Create a new worker
 */
const createWorker = async (req, res) => {
  logger.info('Creating new worker', { body: req.body });
  
  try {
    const { name, primary_phone, secondary_phone } = req.body;
    
    if (!name || !primary_phone) {
      logger.warn('Missing required fields for worker creation', { body: req.body });
      return res.status(400).json({ 
        error: 'Name and primary phone number are required' 
      });
    }

    const connection = await pool.getConnection();

    try {
      // Check if phone numbers already exist
      const [existingPrimary] = await connection.execute(
        'SELECT phone_number FROM worker_phones WHERE phone_number = ?',
        [primary_phone]
      );

      if (existingPrimary.length > 0) {
        logger.warn('Primary phone number already exists', { phone: primary_phone });
        return res.status(409).json({
          error: 'Worker with this primary phone number already exists'
        });
      }

      if (secondary_phone) {
        const [existingSecondary] = await connection.execute(
          'SELECT phone_number FROM worker_phones WHERE phone_number = ?',
          [secondary_phone]
        );

        if (existingSecondary.length > 0) {
          logger.warn('Secondary phone number already exists', { phone: secondary_phone });
          return res.status(409).json({
            error: 'Worker with this secondary phone number already exists'
          });
        }
      }

      // Start transaction
      await connection.beginTransaction();

      // Insert worker
      const [workerResult] = await connection.execute(
        'INSERT INTO workers (name) VALUES (?)',
        [name]
      );
      
      const workerId = workerResult.insertId;
      
      // Insert primary phone
      await connection.execute(
        'INSERT INTO worker_phones (worker_id, phone_number, is_primary) VALUES (?, ?, ?)',
        [workerId, primary_phone, true]
      );
      
      // Insert secondary phone if provided
      if (secondary_phone) {
        await connection.execute(
          'INSERT INTO worker_phones (worker_id, phone_number, is_primary) VALUES (?, ?, ?)',
          [workerId, secondary_phone, false]
        );
      }
      
      // Commit transaction
      await connection.commit();

      logger.info('Worker created successfully', { 
        workerId, 
        name, 
        primary_phone,
        secondary_phone 
      });

      res.status(201).json({
        message: 'Worker created successfully',
        worker: {
          id: workerId,
          name,
          phones: [
            { phone_number: primary_phone, is_primary: true },
            ...(secondary_phone ? [{ phone_number: secondary_phone, is_primary: false }] : [])
          ],
          created_at: new Date()
        }
      });

    } catch (error) {
      // Rollback transaction on error
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    logger.error('Error creating worker:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get all workers
 */
const getAllWorkers = async (req, res) => {
  logger.info('Fetching all workers');
  
  try {
    const connection = await pool.getConnection();
    
    try {
      // Get all workers with their phone numbers
      const [workers] = await connection.execute(`
        SELECT w.id, w.name, w.created_at, w.updated_at
        FROM workers w
        ORDER BY w.created_at DESC
      `);

      // Get all phone numbers
      const [phones] = await connection.execute(`
        SELECT wp.worker_id, wp.phone_number, wp.is_primary
        FROM worker_phones wp
      `);

      // Map phone numbers to workers
      const workersWithPhones = workers.map(worker => {
        const workerPhones = phones.filter(phone => phone.worker_id === worker.id);
        return {
          ...worker,
          phones: workerPhones.map(phone => ({
            phone_number: phone.phone_number,
            is_primary: !!phone.is_primary
          }))
        };
      });

      logger.info(`Found ${workers.length} workers`);
      res.json({ workers: workersWithPhones });

    } finally {
      connection.release();
    }

  } catch (error) {
    logger.error('Error fetching workers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get worker by phone number (primary or secondary)
 */
const getWorkerByPhone = async (req, res) => {
  const { phoneNumber } = req.params;
  logger.info('Fetching worker by phone number', { phoneNumber });
  
  try {
    const connection = await pool.getConnection();

    try {
      // Find worker by phone number
      const [workerPhones] = await connection.execute(`
        SELECT wp.worker_id
        FROM worker_phones wp
        WHERE wp.phone_number = ?
      `, [phoneNumber]);

      if (workerPhones.length === 0) {
        logger.warn('Worker not found for phone number', { phoneNumber });
        return res.status(404).json({ error: 'Worker not found' });
      }

      const workerId = workerPhones[0].worker_id;

      // Get worker details
      const [workers] = await connection.execute(`
        SELECT w.id, w.name, w.created_at, w.updated_at
        FROM workers w
        WHERE w.id = ?
      `, [workerId]);

      // Get all phone numbers for the worker
      const [phones] = await connection.execute(`
        SELECT wp.phone_number, wp.is_primary
        FROM worker_phones wp
        WHERE wp.worker_id = ?
      `, [workerId]);

      const worker = {
        ...workers[0],
        phones: phones.map(phone => ({
          phone_number: phone.phone_number,
          is_primary: !!phone.is_primary
        }))
      };

      logger.info('Worker found', { workerId });
      res.json({ worker });

    } finally {
      connection.release();
    }

  } catch (error) {
    logger.error('Error fetching worker:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Update worker details
 */
const updateWorker = async (req, res) => {
  const { phoneNumber } = req.params;
  const { name, primary_phone, secondary_phone } = req.body;
  
  logger.info('Updating worker', { 
    phoneNumber, 
    requestBody: req.body 
  });
  
  try {
    if (!name) {
      logger.warn('Name is required for update', { body: req.body });
      return res.status(400).json({ error: 'Name is required for update' });
    }

    const connection = await pool.getConnection();

    try {
      // Find worker by phone number
      const [workerPhones] = await connection.execute(`
        SELECT wp.worker_id, wp.is_primary
        FROM worker_phones wp
        WHERE wp.phone_number = ?
      `, [phoneNumber]);

      if (workerPhones.length === 0) {
        logger.warn('Worker not found for update', { phoneNumber });
        return res.status(404).json({ error: 'Worker not found' });
      }

      const workerId = workerPhones[0].worker_id;
      
      // Begin transaction
      await connection.beginTransaction();

      // Update worker name
      await connection.execute(
        'UPDATE workers SET name = ? WHERE id = ?',
        [name, workerId]
      );

      // Update phone numbers if provided
      if (primary_phone) {
        // Check if primary phone already exists for another worker
        const [existingPrimary] = await connection.execute(`
          SELECT wp.worker_id 
          FROM worker_phones wp
          WHERE wp.phone_number = ? AND wp.worker_id != ?
        `, [primary_phone, workerId]);

        if (existingPrimary.length > 0) {
          await connection.rollback();
          logger.warn('Primary phone already exists for another worker', { 
            phone: primary_phone, 
            existingWorkerId: existingPrimary[0].worker_id 
          });
          return res.status(409).json({
            error: 'Primary phone number already exists for another worker'
          });
        }

        // Get current primary phone
        const [currentPrimary] = await connection.execute(`
          SELECT phone_number FROM worker_phones 
          WHERE worker_id = ? AND is_primary = true
        `, [workerId]);

        if (currentPrimary.length > 0 && currentPrimary[0].phone_number !== primary_phone) {
          // Set current primary to non-primary
          await connection.execute(`
            UPDATE worker_phones 
            SET is_primary = false 
            WHERE worker_id = ? AND is_primary = true
          `, [workerId]);

          // Check if new primary exists as secondary
          const [existingSecondary] = await connection.execute(`
            SELECT id FROM worker_phones
            WHERE worker_id = ? AND phone_number = ?
          `, [workerId, primary_phone]);

          if (existingSecondary.length > 0) {
            // Update existing secondary to primary
            await connection.execute(`
              UPDATE worker_phones
              SET is_primary = true
              WHERE id = ?
            `, [existingSecondary[0].id]);
          } else {
            // Add new primary
            await connection.execute(`
              INSERT INTO worker_phones (worker_id, phone_number, is_primary)
              VALUES (?, ?, true)
            `, [workerId, primary_phone]);
          }
        }
      }

      // Update secondary phone
      if (secondary_phone) {
        // Check if secondary already exists for another worker
        const [existingSecondary] = await connection.execute(`
          SELECT wp.worker_id 
          FROM worker_phones wp
          WHERE wp.phone_number = ? AND wp.worker_id != ?
        `, [secondary_phone, workerId]);

        if (existingSecondary.length > 0) {
          await connection.rollback();
          logger.warn('Secondary phone already exists for another worker', { 
            phone: secondary_phone, 
            existingWorkerId: existingSecondary[0].worker_id 
          });
          return res.status(409).json({
            error: 'Secondary phone number already exists for another worker'
          });
        }

        // Check if phone exists for this worker
        const [existingPhone] = await connection.execute(`
          SELECT id, is_primary FROM worker_phones
          WHERE worker_id = ? AND phone_number = ?
        `, [workerId, secondary_phone]);

        // Don't add if it's already a primary
        if (existingPhone.length === 0 || !existingPhone[0].is_primary) {
          // Add new secondary phone if it doesn't exist
          if (existingPhone.length === 0) {
            await connection.execute(`
              INSERT INTO worker_phones (worker_id, phone_number, is_primary)
              VALUES (?, ?, false)
            `, [workerId, secondary_phone]);
          }
        }
      }

      // Commit transaction
      await connection.commit();

      // Get updated worker data
      const [updatedWorker] = await connection.execute(`
        SELECT w.id, w.name, w.created_at, w.updated_at
        FROM workers w
        WHERE w.id = ?
      `, [workerId]);

      const [updatedPhones] = await connection.execute(`
        SELECT wp.phone_number, wp.is_primary
        FROM worker_phones wp
        WHERE wp.worker_id = ?
      `, [workerId]);

      const worker = {
        ...updatedWorker[0],
        phones: updatedPhones.map(phone => ({
          phone_number: phone.phone_number,
          is_primary: !!phone.is_primary
        }))
      };

      logger.info('Worker updated successfully', { workerId });
      res.json({
        message: 'Worker updated successfully',
        worker
      });

    } catch (error) {
      // Rollback on error
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    logger.error('Error updating worker:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Delete worker
 */
const deleteWorker = async (req, res) => {
  const { phoneNumber } = req.params;
  logger.info('Deleting worker', { phoneNumber });
  
  try {
    const connection = await pool.getConnection();

    try {
      // Find worker by phone number
      const [workerPhones] = await connection.execute(`
        SELECT wp.worker_id
        FROM worker_phones wp
        WHERE wp.phone_number = ?
      `, [phoneNumber]);

      if (workerPhones.length === 0) {
        logger.warn('Worker not found for deletion', { phoneNumber });
        return res.status(404).json({ error: 'Worker not found' });
      }

      const workerId = workerPhones[0].worker_id;

      // Begin transaction
      await connection.beginTransaction();

      // Delete worker (cascade will delete phone numbers)
      await connection.execute(
        'DELETE FROM workers WHERE id = ?',
        [workerId]
      );

      // Commit transaction
      await connection.commit();

      logger.info('Worker deleted successfully', { workerId, phoneNumber });
      res.json({
        message: 'Worker deleted successfully',
        worker_id: workerId,
        phone_number: phoneNumber
      });

    } catch (error) {
      // Rollback on error
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    logger.error('Error deleting worker:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Delete specific phone number from a worker
 */
const deleteWorkerPhone = async (req, res) => {
  const { workerId, phoneNumber } = req.params;
  logger.info('Deleting specific phone number from worker', { workerId, phoneNumber });
  
  try {
    const connection = await pool.getConnection();

    try {
      // Check if worker exists
      const [workerExists] = await connection.execute(
        'SELECT id FROM workers WHERE id = ?',
        [workerId]
      );

      if (workerExists.length === 0) {
        logger.warn('Worker not found for phone deletion', { workerId });
        return res.status(404).json({ error: 'Worker not found' });
      }

      // Check if phone number exists for this worker
      const [phoneExists] = await connection.execute(
        'SELECT id, is_primary FROM worker_phones WHERE worker_id = ? AND phone_number = ?',
        [workerId, phoneNumber]
      );

      if (phoneExists.length === 0) {
        logger.warn('Phone number not found for worker', { workerId, phoneNumber });
        return res.status(404).json({ error: 'Phone number not found for this worker' });
      }

      const isPrimary = phoneExists[0].is_primary;

      // Count total phone numbers for this worker
      const [totalPhones] = await connection.execute(
        'SELECT COUNT(*) as count FROM worker_phones WHERE worker_id = ?',
        [workerId]
      );

      if (totalPhones[0].count <= 1) {
        logger.warn('Cannot delete the only phone number', { workerId, phoneNumber });
        return res.status(400).json({ 
          error: 'Cannot delete the only phone number. Worker must have at least one phone number.' 
        });
      }

      // Begin transaction
      await connection.beginTransaction();

      // Delete the phone number
      await connection.execute(
        'DELETE FROM worker_phones WHERE worker_id = ? AND phone_number = ?',
        [workerId, phoneNumber]
      );

      // If deleted number was primary, assign primary to another number
      if (isPrimary) {
        logger.info('Primary phone deleted, reassigning primary status', { workerId });
        
        // Get another phone number for this worker
        const [anotherPhone] = await connection.execute(
          'SELECT id FROM worker_phones WHERE worker_id = ? LIMIT 1',
          [workerId]
        );

        if (anotherPhone.length > 0) {
          // Make this phone primary
          await connection.execute(
            'UPDATE worker_phones SET is_primary = true WHERE id = ?',
            [anotherPhone[0].id]
          );
        }
      }

      // Commit transaction
      await connection.commit();

      // Get updated worker data
      const [updatedWorker] = await connection.execute(
        'SELECT id, name, created_at, updated_at FROM workers WHERE id = ?',
        [workerId]
      );

      const [updatedPhones] = await connection.execute(
        'SELECT phone_number, is_primary FROM worker_phones WHERE worker_id = ?',
        [workerId]
      );

      logger.info('Phone number deleted successfully', { workerId, phoneNumber });
      res.json({
        message: 'Phone number deleted successfully',
        worker: {
          ...updatedWorker[0],
          phones: updatedPhones.map(phone => ({
            phone_number: phone.phone_number,
            is_primary: !!phone.is_primary
          }))
        }
      });

    } catch (error) {
      // Rollback on error
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    logger.error('Error deleting phone number:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Reassign an order to a different worker
 */
const reassignWorker = async (req, res) => {
  const { orderId, newWorkerPhone } = req.params;
  logger.info('Reassigning order to a different worker', { orderId, newWorkerPhone });
  
  try {
    const connection = await pool.getConnection();

    try {
      // Check if order exists
      const [orderExists] = await connection.execute(
        'SELECT id, worker_phone FROM orders WHERE id = ?',
        [orderId]
      );

      if (orderExists.length === 0) {
        logger.warn('Order not found for reassignment', { orderId });
        return res.status(404).json({ error: 'Order not found' });
      }

      const oldWorkerPhone = orderExists[0].worker_phone;
      
      // Verify the new worker exists
      const [newWorkerExists] = await connection.execute(`
        SELECT wp.worker_id 
        FROM worker_phones wp
        WHERE wp.phone_number = ?
      `, [newWorkerPhone]);

      if (newWorkerExists.length === 0) {
        logger.warn('New worker not found for reassignment', { newWorkerPhone });
        return res.status(404).json({ error: 'New worker not found' });
      }

      const newWorkerId = newWorkerExists[0].worker_id;

      // Get new worker's primary phone if the provided phone isn't primary
      const [newWorkerPrimaryPhone] = await connection.execute(`
        SELECT wp.phone_number
        FROM worker_phones wp
        WHERE wp.worker_id = ? AND wp.is_primary = true
      `, [newWorkerId]);

      const newWorkerPrimaryNumber = newWorkerPrimaryPhone[0].phone_number;

      // Begin transaction
      await connection.beginTransaction();

      // Update the order with the new worker's primary phone
      await connection.execute(
        'UPDATE orders SET worker_phone = ? WHERE id = ?',
        [newWorkerPrimaryNumber, orderId]
      );

      // Get order details for notification
      const [order] = await connection.execute(
        'SELECT * FROM orders WHERE id = ?',
        [orderId]
      );

      // Commit transaction
      await connection.commit();

      // After successful DB update, send WhatsApp notifications
      if (oldWorkerPhone) {
        try {
          // Send notification to old worker
          await sendWorkerChangedNotification(oldWorkerPhone, order[0]);
          logger.info('Notification sent to old worker', { phone: oldWorkerPhone, orderId });
        } catch (notificationError) {
          logger.error('Error sending notification to old worker:', notificationError);
          // Continue with the process even if notification fails
        }
      }

      try {
        // Send notification to new worker
        await sendWorkerAssignmentNotification(newWorkerPrimaryNumber, order[0]);
        logger.info('Notification sent to new worker', { phone: newWorkerPrimaryNumber, orderId });
      } catch (notificationError) {
        logger.error('Error sending notification to new worker:', notificationError);
        // Continue with the process even if notification fails
      }

      logger.info('Order reassigned successfully', { 
        orderId, 
        oldWorkerPhone, 
        newWorkerPhone: newWorkerPrimaryNumber 
      });

      res.json({
        message: 'Order reassigned successfully',
        order_id: orderId,
        old_worker_phone: oldWorkerPhone,
        new_worker_phone: newWorkerPrimaryNumber
      });

    } catch (error) {
      // Rollback on error
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    logger.error('Error reassigning order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Send worker assignment notification via WhatsApp
 */
const sendWorkerAssignmentNotification = async (workerPhone, order) => {
  const config = {
    WHATSAPP_API_ROOT: 'https://graph.facebook.com/v18.0',
    WHATSAPP_ACCESS_TOKEN: 'EAATMXEvo8GwBOyJtYfhZCyeFWtuBxX8z236OT8mZC2ArAXiGMf9hOHQz44i6Y0XOxqWwuUL7wVTEfAv5hDfCWDsGNIgMqxg5cmomBgpkVZA3s0xaGXLGb7AftsOXFGMf1T7WkZB54T5VZAsQ0bGJCy8IKvJlysZBTZC1QPI8h5laEIQ5rbLEtMZBTC50coCnkjxwcwZDZD',
    WHATSAPP_PHONE_ID: '/489702420894118',
  };

  try {
    // Parse jewellery_details if it's a string
    const jewelleryDetails = typeof order.jewellery_details === 'string' 
      ? JSON.parse(order.jewellery_details) 
      : order.jewellery_details;

    const response = await fetch(`${config.WHATSAPP_API_ROOT}${config.WHATSAPP_PHONE_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: workerPhone,
        type: "template",
        template: {
          name: "worker_assignment",
          language: {
            code: "en"
          },
          components: [
            {
              type: "body",
              parameters: [
                {
                  type: "text",
                  text: order.id
                },
                {
                  type: "text",
                  text: jewelleryDetails.name || "Not specified"
                },
                {
                  type: "text",
                  text: jewelleryDetails.weight || "Not specified"
                },
                {
                  type: "text",
                  text: jewelleryDetails.melting || "Not specified"
                },
                {
                  type: "text",
                  text: jewelleryDetails.special || "No special instructions"
                }
              ]
            }
          ]
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      logger.error('WhatsApp API error (assignment):', errorData);
      throw new Error(`WhatsApp API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    logger.error('Error sending worker assignment notification:', error);
    throw error;
  }
};

/**
 * Send worker changed notification via WhatsApp
 */
const sendWorkerChangedNotification = async (workerPhone, order) => {
  const config = {
    WHATSAPP_API_ROOT: 'https://graph.facebook.com/v18.0',
    WHATSAPP_ACCESS_TOKEN: 'EAATMXEvo8GwBOyJtYfhZCyeFWtuBxX8z236OT8mZC2ArAXiGMf9hOHQz44i6Y0XOxqWwuUL7wVTEfAv5hDfCWDsGNIgMqxg5cmomBgpkVZA3s0xaGXLGb7AftsOXFGMf1T7WkZB54T5VZAsQ0bGJCy8IKvJlysZBTZC1QPI8h5laEIQ5rbLEtMZBTC50coCnkjxwcwZDZD',
    WHATSAPP_PHONE_ID: '/489702420894118',
  };

  try {
    const response = await fetch(`${config.WHATSAPP_API_ROOT}${config.WHATSAPP_PHONE_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: workerPhone,
        type: "template",
        template: {
          name: "worker_changed",
          language: {
            code: "en"
          },
          components: [
            {
              type: "body",
              parameters: [
                {
                  type: "text",
                  text: order.id
                }
              ]
            }
          ]
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      logger.error('WhatsApp API error (changed):', errorData);
      throw new Error(`WhatsApp API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    logger.error('Error sending worker changed notification:', error);
    throw error;
  }
};

module.exports = {
  createWorker,
  getAllWorkers,
  getWorkerByPhone,
  updateWorker,
  deleteWorker,
  deleteWorkerPhone,
  reassignWorker
}; 