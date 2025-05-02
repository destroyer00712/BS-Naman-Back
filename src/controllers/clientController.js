const pool = require('../config/db');

/**
 * Create a new client
 */
const createClient = async (req, res) => {
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
};

/**
 * Get all clients
 */
const getAllClients = async (req, res) => {
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
};

/**
 * Get client by phone number
 */
const getClientByPhone = async (req, res) => {
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
};

/**
 * Update client details
 */
const updateClient = async (req, res) => {
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
};

/**
 * Delete client
 */
const deleteClient = async (req, res) => {
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
};

module.exports = {
  createClient,
  getAllClients,
  getClientByPhone,
  updateClient,
  deleteClient
}; 