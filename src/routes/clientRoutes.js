const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');

// Create client
router.post('/', clientController.createClient);

// Get all clients
router.get('/', clientController.getAllClients);

// Get client by phone number
router.get('/:phoneNumber', clientController.getClientByPhone);

// Update client
router.put('/:phoneNumber', clientController.updateClient);

// Delete client
router.delete('/:phoneNumber', clientController.deleteClient);

module.exports = router; 