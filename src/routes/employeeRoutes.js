const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');

// Create employee
router.post('/', employeeController.createEmployee);

// Get all employees
router.get('/', employeeController.getAllEmployees);

// Get employee by phone number
router.get('/:phoneNumber', employeeController.getEmployeeByPhone);

// Update employee
router.put('/:phoneNumber', employeeController.updateEmployee);

// Delete employee
router.delete('/:phoneNumber', employeeController.deleteEmployee);

module.exports = router; 