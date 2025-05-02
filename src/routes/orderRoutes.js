const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

// Create order
router.post('/', orderController.createOrder);

// Get all orders
router.get('/', orderController.getAllOrders);

// Get pending orders for a worker
router.get('/worker/:phoneNumber/pending', orderController.getWorkerPendingOrders);

// Reassign worker to an order
router.put('/:orderId/reassign', orderController.reassignWorker);

// Update order
router.put('/:orderId', orderController.updateOrder);

// Delete order
router.delete('/:orderId', orderController.deleteOrder);

module.exports = router; 