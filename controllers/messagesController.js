const express = require("express");
const router = express.Router();
const waClient = require("../clients/waClient"); // Assuming you have a service for WhatsApp

// Method to send WhatsApp message by session ID
exports.sendMessageBySessionId = async (req, res) => {
    const { sessionId, message, phoneNumber, phoneNumber2 } = req.body;

    if (!sessionId || !message || !phoneNumber) {
        return res
            .status(400)
            .json({ error: "Session ID, message and phone number are required" });
    }

    try {
            await waClient
            .sendMessage(sessionId, message, phoneNumber, phoneNumber2)
            .then((result) => {
                console.log("Final Step : Message sent:", result);
                if (result.error) {
                    res
                        .status(500)
                        .json({ error: "Failed to send message", details: result.error });
                } else {
                    res.status(200).json({ success: true, result });
                }
            })
            .catch((error) => {
                res
                    .status(500)
                    .json({ error: "Failed to send message", details: error.message });
            });
    } catch (error) {
        res
            .status(500)
            .json({ error: "Failed to send message", details: error.message });
    }
};
