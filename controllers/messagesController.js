const express = require('express');
const router = express.Router();
const waClient = require('../clients/waClient'); // Assuming you have a service for WhatsApp

// Method to send WhatsApp message by session ID
exports.sendMessageBySessionId = async (req, res) => {
    const { sessionId, message, phoneNumber,phoneNumber2 } = req.body;

    if (!sessionId || !message || !phoneNumber) {
        return res.status(400).json({ error: 'Session ID, message and phone number are required' });
    }

    try {
        const result = await waClient.sendMessage(sessionId, message, phoneNumber,phoneNumber2);
        res.status(200).json({ success: true, result });

        console.log('Final Step : Message sent:', result);
    } catch (error) {
        res.status(500).json({ error: 'Failed to send message', details: error.message });

    }
};
