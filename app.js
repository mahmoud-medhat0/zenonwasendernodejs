import express from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';
import sessionRoutes from './routes/sessionRoutes.js';
import WaMessagesRoutes from './routes/WaMessagesRoutes.js';
import config from './config/config.js';
import sessionTokenMiddleware from './middleware/sessionTokenMiddleware.js';
import checkAuthorizedDomainsMiddleware from './middleware/authorizedDomainsMiddleware.js';
import ProcessManager from './processesfiles/processManager.js';
import { getAllSessions } from './utils/requestsfunctions.js';

console.log('Starting application...');
// Start the WhatsApp client in a separate process
const sessions = await getAllSessions();
sessions.forEach(async (session) => {
    // Ensure all client sessions are started using async/await
    const sessionId = session.session_id;
    console.log(`Initializing session: ${sessionId}`);
    try {
        const processManager = new ProcessManager();
        await processManager.startClientSession(sessionId);
    } catch (error) {
        console.error(`Error starting session ${sessionId}:`, error);
    }
});

const app = express();
app.use(bodyParser.json());

app.use(checkAuthorizedDomainsMiddleware);
// app.use(sessionTokenMiddleware);
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
