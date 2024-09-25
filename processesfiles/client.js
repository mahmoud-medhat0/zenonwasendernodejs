const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const SessionModel = require('../models/SessionModel');
const WaSendedMessages = require('../models/WaSendedMessages');
const fs = require('fs');
const path = require('path');

let client;
const sessionId = process.argv[2];

function initializeClient() {
    client = new Client({
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--disable-setuid-sandbox', '--no-first-run', '--no-zygote', '--single-process', '--force-device-scale-factor=2']
        },
        authStrategy: new LocalAuth({ clientId: sessionId })
    });

    client.on('ready', () => {
        const sessionModel = new SessionModel();
        sessionModel.updateBySessionId(sessionId, 'status', 'ready');
        process.send({ sessionId, type: 'ready', message: `Client is ready for session ${sessionId}` });
    });

    client.on('auth_failure', async (msg) => {
        const sessionModel = new SessionModel();
        await sessionModel.updateBySessionId(sessionId, 'status', 'auth_failure');
        process.send({ sessionId, type: 'auth_failure', message: `Authentication failure: ${msg}` });
    });

    client.on('disconnected', async (reason) => {
        const sessionModel = new SessionModel();
        await sessionModel.updateBySessionId(sessionId, 'status', 'disconnected');
        await sessionModel.updateBySessionId(sessionId, 'phone_number', null);
        await sessionModel.updateBySessionId(sessionId, 'qrcode', null);
        process.send({ sessionId, type: 'disconnected', message: `Client disconnected: ${reason}` });
        process.exit(); // Terminate the child process when disconnected
    });

    client.on('message_sent', (message) => {
        process.send({ sessionId, type: 'message_sent', message: `Message sent: ${message}` });
    });

    client.on('message', (message) => {
        client.sendMessage(message.from, message.body)
            .then(() => process.send({ sessionId, type: 'message_sent', message: `Replied to ${message.from} with: ${message.body}` }))
            .catch(err => process.send({ sessionId, type: 'error', message: `Error replying to message: ${err.message}` }));
    });

    client.on('qr', async (qrReceived, asciiQR) => {
        try {
            const qrCodeDataUrl = await qrcode.toDataURL(qrReceived);
            const sessionModel = new SessionModel();
            await sessionModel.updateBySessionId(sessionId, 'qrcode', qrCodeDataUrl);
            await sessionModel.updateBySessionId(sessionId, 'status', 'Initializing');
            console.log(`New QR RECEIVED for session ${sessionId}`);
        } catch (error) {
            console.log("Error updating QRCODE", error);
        }
    });

    client.on('error', (error) => {
        console.log("Error", error);
        if (error.message.includes('Execution context was destroyed')) {
            console.log("Reinitializing client due to execution context destruction");
            retryDestroyAndInitializeClient();
        } else {
            client.destroy().catch(err => console.log("Error destroying client", err));
        }
    });

    client.initialize();
}

function retryDestroyAndInitializeClient(retries = 5, delay = 1000) {
    client.destroy().then(() => {
        initializeClient();
    }).catch(err => {
        if (retries > 0) {
            console.log(`Retrying to destroy client in ${delay}ms... (${retries} retries left)`);
            setTimeout(() => retryDestroyAndInitializeClient(retries - 1, delay), delay);
        } else {
            console.log("Failed to destroy client after multiple attempts", err);
        }
    });
}

initializeClient();

process.on('message', (message) => {
    const { type, payload } = message;
    console.log(`Received message from parent:`, message);
    switch (type) {
        case 'send_message':
            const { to, body } = payload;
            console.log(`Sending message to ${to}: ${body}`);
            client.sendMessage(to, body)
                .then(async (result) => {
                    console.log("result of send message", result.id.id);
                    const waSendedMessages = new WaSendedMessages();
                    await waSendedMessages.create({ wa_session_id: sessionId, message: body, message_id: result.id.id, phone_number: to });
                    process.send({ sessionId, type: 'message_sent', message: `Message sent to ${to}` });
                    return { sessionId: sessionId, message: body, phoneNumber: to, status: 'sent', messageSent: result };
                })
                .catch(err => process.send({ sessionId, type: 'error', message: `Error sending message: ${err.message}` }));
            break;
        case 'check_number_is_registered':
            let phoneNumber = message.payload;
            process.send({ message: message });
            process.send({ sessionId, type: 'phoneNumber', message: `Phone number: ${phoneNumber}` });
            if (phoneNumber && phoneNumber.includes('@c.us')) {
                phoneNumber = phoneNumber;
            }
            else {
                phoneNumber = phoneNumber + '@c.us';
            }
            return client.getNumberId(phoneNumber)
                .then(async (result) => {
                    process.send({ sessionId, type: 'number_id', message: `Number ID: ${result}` });
                    process.send({ result });
                    return result == null ? false : true;
                })
                .catch(err => process.send({ sessionId, type: 'error', message: `Error getting number ID: ${err.message}` }));
            break;
    }
});
