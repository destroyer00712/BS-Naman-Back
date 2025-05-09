const pool = require('../config/db');
const bcrypt = require('bcrypt');
const { generateEmployeeId } = require('../utils/employeeUtils');

/**
 * Create a new employee
 */
const createEmployee = async (req, res) => {
  try {
    const { name, phone_number, password } = req.body;
    
    if (!name || !phone_number || !password) {
      return res.status(400).json({ 
        error: 'Name, phone number, and password are required' 
      });
    }

    const connection = await pool.getConnection();

    try {
      // Check if phone number already exists
      const [existing] = await connection.execute(
        'SELECT phone_number FROM employees WHERE phone_number = ?',
        [phone_number]
      );

      if (existing.length > 0) {
        return res.status(409).json({
          error: 'Employee with this phone number already exists'
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Generate employee ID
      const employeeId = generateEmployeeId();

      await connection.execute(
        'INSERT INTO employees (id, name, phone_number, password) VALUES (?, ?, ?, ?)',
        [employeeId, name, phone_number, hashedPassword]
      );

      res.status(201).json({
        message: 'Employee created successfully',
        employee: {
          id: employeeId,
          name,
          phone_number,
          created_at: new Date()
        }
      });

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get all employees
 */
const getAllEmployees = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    try {
      const [employees] = await connection.execute(
        `SELECT id, name, phone_number, created_at, updated_at 
         FROM employees 
         ORDER BY created_at DESC`
      );

      res.json({ employees });

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get employee by phone number
 */
const getEmployeeByPhone = async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const connection = await pool.getConnection();

    try {
      const [employees] = await connection.execute(
        `SELECT id, name, phone_number, created_at, updated_at 
         FROM employees 
         WHERE phone_number = ?`,
        [phoneNumber]
      );

      if (employees.length === 0) {
        return res.status(404).json({ error: 'Employee not found' });
      }

      res.json({ employee: employees[0] });

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Update employee details
 */
const updateEmployee = async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const { name, password } = req.body;
    
    if (!name && !password) {
      return res.status(400).json({ 
        error: 'At least one field must be provided for update' 
      });
    }

    const connection = await pool.getConnection();

    try {
      const [employeeExists] = await connection.execute(
        'SELECT id FROM employees WHERE phone_number = ?',
        [phoneNumber]
      );

      if (employeeExists.length === 0) {
        return res.status(404).json({ error: 'Employee not found' });
      }

      const updates = [];
      const values = [];

      if (name) {
        updates.push('name = ?');
        values.push(name);
      }

      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        updates.push('password = ?');
        values.push(hashedPassword);
      }

      values.push(phoneNumber);

      await connection.execute(
        `UPDATE employees SET ${updates.join(', ')} WHERE phone_number = ?`,
        values
      );

      const [updatedEmployee] = await connection.execute(
        `SELECT id, name, phone_number, created_at, updated_at 
         FROM employees 
         WHERE phone_number = ?`,
        [phoneNumber]
      );

      res.json({
        message: 'Employee updated successfully',
        employee: updatedEmployee[0]
      });

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Delete employee
 */
const deleteEmployee = async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const connection = await pool.getConnection();

    try {
      const [employeeExists] = await connection.execute(
        'SELECT id FROM employees WHERE phone_number = ?',
        [phoneNumber]
      );

      if (employeeExists.length === 0) {
        return res.status(404).json({ error: 'Employee not found' });
      }

      await connection.execute(
        'DELETE FROM employees WHERE phone_number = ?',
        [phoneNumber]
      );

      res.json({
        message: 'Employee deleted successfully',
        phone_number: phoneNumber
      });

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  createEmployee,
  getAllEmployees,
  getEmployeeByPhone,
  updateEmployee,
  deleteEmployee
}; 