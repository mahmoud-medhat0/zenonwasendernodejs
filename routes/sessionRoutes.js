import express from 'express';
const router = express.Router();
import sessionController from '../controllers/sessionController.js';

// Define the route for creating a session
router.post('/create', sessionController.createSession);
router.get('/session/:sessionId', sessionController.getSession);
// Add more routes as needed

export default router;