const express = require('express');
const router = express.Router();
const messagesController = require('../controllers/messagesController');

// Route to send a WhatsApp message by session ID
router.post('/send-wa-message', messagesController.sendMessageBySessionId);

// Route to initialize a WhatsApp session
// router.post('/initialize-session', messagesController.initializeSession);

// // Route to terminate a WhatsApp session
// router.post('/terminate-session', messagesController.terminateSession);

module.exports = router;
