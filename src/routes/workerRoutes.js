const express = require('express');
const router = express.Router();
const workerController = require('../controllers/workerController');

// Create worker
router.post('/', workerController.createWorker);

// Get all workers
router.get('/', workerController.getAllWorkers);

// Get worker by phone number
router.get('/:phoneNumber', workerController.getWorkerByPhone);

// Update worker
router.put('/:phoneNumber', workerController.updateWorker);

// Delete worker
router.delete('/:phoneNumber', workerController.deleteWorker);

// Delete specific phone number from worker
router.delete('/:workerId/phone/:phoneNumber', workerController.deleteWorkerPhone);

// Reassign order to a different worker
router.post('/reassign/:orderId/:newWorkerPhone', workerController.reassignWorker);

module.exports = router; 