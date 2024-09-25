const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const sessionRoutes = require('./routes/sessionRoutes');
const WaMessagesRoutes = require('./routes/WaMessagesRoutes');
const sessionController = require('./controllers/sessionController');
const multiSessionManager = require('./services/multiSessionManager');
const config = require('./config/config');
const sessionTokenMiddleware = require('./middleware/sessionTokenMiddleware');
const checkAuthorizedDomainsMiddleware = require('./middleware/authorizedDomainsMiddleware');
const { fork } = require('child_process');
const path = require('path');
const SessionModel = require('./models/SessionModel');
const ProcessManager = require('./processesfiles/processManager'); // Correct import of ProcessManager

console.log('Starting application...');
// Start the WhatsApp client in a separate process
const sessions = new SessionModel();
sessions.getAll(async (err, sessionList) => {
    if (err) {
        console.error('Error fetching sessions:', err);
        return;
    }
    // Ensure all client sessions are started using async/await
    for (const session of sessionList) {
        const sessionId = session.session_id;
        console.log(`Initializing session: ${sessionId}`);
        try {
            await ProcessManager.startClientSession(sessionId);
        } catch (error) {
            console.error(`Error starting session ${sessionId}:`, error);
        }
    }
});

const app = express();
app.use(bodyParser.json());

app.use(checkAuthorizedDomainsMiddleware);
app.use(sessionTokenMiddleware);
app.use(sessionRoutes);

app.use(WaMessagesRoutes);

app.listen(config.port, () => {
    console.log(`Server is running on port ${config.port}`);
});

const TELEGRAM_BOT_TOKEN = '8024748251:AAF6KKBsAYTCw4g0Y4HkZqTBIDWUItQehAk'; // Replace with your bot token
const TELEGRAM_CHAT_ID = '948449142'; // Replace with your chat ID

function sendTelegramMessage(message) {
    axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
    }).catch(error => console.error('Error sending message to Telegram:', error));
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    sendTelegramMessage(`Error: ${error.message}\nStack: ${error.stack}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    sendTelegramMessage(`Unhandled Rejection: ${reason}`);
});

console.log('Application setup complete.');
