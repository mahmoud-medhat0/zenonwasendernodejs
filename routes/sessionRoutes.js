const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');

// Define the route for creating a session
router.post('/create', sessionController.createSession);
router.get('/session/:sessionId', sessionController.getSession);
// Add more routes as needed

module.exports = router;