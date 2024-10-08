import WAClient from '../clients/waClient.js'; // Assuming you have a WhatsApp API client
// Function to send a WhatsApp message by session ID
const sendMessageBySessionId = async (sessionId, message, phoneNumber) => {
    try {
        console.log(sessionId, message, phoneNumber);
        const waClient = new WAClient();
        const response = await waClient.sendMessage(sessionId, message, phoneNumber);
        console.log(response);
        return response;
    } catch (error) {
        console.error('Error sending message:', error);
        throw new Error(`Failed to send message: ${error.message}`);
    }
};
// Function to initialize a WhatsApp session
const initializeSession = async (sessionId) => {

    try {
        const response = await waClient.initializeSession(sessionId);
        return response;
    } catch (error) {
        throw new Error(`Failed to initialize session: ${error.message}`);
    }
};

// Function to terminate a WhatsApp session
const terminateSession = async (sessionId) => {
    try {
        const response = await waClient.terminateSession(sessionId);
        return response;
    } catch (error) {
        throw new Error(`Failed to terminate session: ${error.message}`);
    }
};

module.exports = {
    sendMessageBySessionId,
    initializeSession,
    terminateSession,
};
