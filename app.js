const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const sessionRoutes = require('./routes/sessionRoutes');
const WaMessagesRoutes = require('./routes/WaMessagesRoutes');
const sessionController = require('./controllers/sessionController');
const config = require('./config/config');
const sessionTokenMiddleware = require('./middleware/sessionTokenMiddleware');
const checkAuthorizedDomainsMiddleware = require('./middleware/authorizedDomainsMiddleware');
const app = express();
app.use(bodyParser.json());

app.use(checkAuthorizedDomainsMiddleware);
app.use(sessionTokenMiddleware);
app.use(sessionRoutes);

app.use(WaMessagesRoutes);
setInterval(() => {
    sessionController.updateSessions();
}, 1000 * 60 * 10);
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
