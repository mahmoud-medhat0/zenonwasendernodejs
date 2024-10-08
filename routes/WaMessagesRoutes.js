import express from 'express';
const router = express.Router();
import messagesController from '../controllers/messagesController.js';

// Route to send a WhatsApp message by session ID
router.post('/send-wa-message', messagesController.sendMessageBySessionId);

// Route to initialize a WhatsApp session
// router.post('/initialize-session', messagesController.initializeSession);

// // Route to terminate a WhatsApp session
// router.post('/terminate-session', messagesController.terminateSession);

export default router;
