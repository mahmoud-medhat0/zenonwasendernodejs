const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const MultiSessionManager = require('../services/multiSessionManager'); // Ensure correct path
const SessionModel = require('../models/SessionModel');

const sessionManager = new MultiSessionManager();
const sessionModel = new SessionModel();

// Global client instances and timeouts
const clientInstances = {};
const sessionTimeouts = {};
let sessions = {};

// Load sessions from database on startup
sessionModel.getAll((err, loadedSessions) => {
    if (err) {
        console.error('Error loading sessions from the database', err);
        return;
    }
    loadedSessions.forEach(session => {
        sessions[session.sessionId] = session;
    });
});

// WAClient class to handle WhatsApp client interactions
class WAClient {
    constructor(sessionId) {
        this.sessionId = sessionId;
        this.clientInstance = null;
    }

    async initialize() {
        console.log(`Initializing session ${this.sessionId}`);
        const client = new Client({
            puppeteer: {
                headless: true,
                args: ['--no-sandbox', '--disable-gpu', '--disable-setuid-sandbox']
            },
            authStrategy: new LocalAuth({ clientId: this.sessionId }) // Ensure session persistence
        });

        this.registerClientEvents(client);

        try {
            await client.initialize();
            await this.waitForClientReady();
        } catch (error) {
            console.error(`Failed to initialize client for session ${this.sessionId}:`, error);
            throw error;
        }
    }

    registerClientEvents(client) {
        client.on('qr', (qr) => {
            console.log(`QR Code received for session ${this.sessionId}: ${qr}`);
            // Optionally store the QR code in the database
        });

        client.on('ready', async () => {
            console.log(`Client is ready for session ${this.sessionId}`);
            this.clientInstance = client;
            clientInstances[this.sessionId] = client;
            sessionModel.updateBySessionId(this.sessionId, 'status', 'ready');
        });

        client.on('authenticated', () => {
            console.log(`Session ${this.sessionId} authenticated successfully.`);
            sessionModel.updateBySessionId(this.sessionId, 'status', 'authenticated');
        });

        client.on('auth_failure', (msg) => {
            console.error(`Authentication failure for session ${this.sessionId}:`, msg);
            sessionModel.updateBySessionId(this.sessionId, 'status', 'auth_failure');
        });

        client.on('disconnected', (reason) => {
            console.error(`Client disconnected for session ${this.sessionId}: ${reason}`);
            sessionModel.updateBySessionId(this.sessionId, 'status', 'disconnected');
            this.cleanup();
        });

        client.on('error', (error) => {
            console.error(`Client error for session ${this.sessionId}:`, error);
        });
    }

    async waitForClientReady() {
        let attempts = 0;
        const maxAttempts = 200; // Increase attempts to ensure enough time for client readiness
        while (!this.clientInstance && attempts < maxAttempts) {
            console.log(`Waiting for client instance to be ready for session ${this.sessionId} (attempt ${attempts + 1}/${maxAttempts})...`);
            await new Promise(resolve => setTimeout(resolve, 300)); // Increase wait time
            attempts++;
        }

        if (!this.clientInstance) {
            throw new Error(`Client instance for session ${this.sessionId} failed to initialize after ${attempts} attempts`);
        }
    }

    cleanup() {
        if (clientInstances[this.sessionId]) {
            clientInstances[this.sessionId].destroy();
            delete clientInstances[this.sessionId];
        }
        if (sessionTimeouts[this.sessionId]) {
            clearTimeout(sessionTimeouts[this.sessionId]);
            delete sessionTimeouts[this.sessionId];
        }
        sessions[this.sessionId] = { status: 'disconnected' };
    }
}

// Helper function to initialize a client
const initializeClient = async (sessionId) => {
    if (!clientInstances[sessionId]) {
        console.log(`Initializing client for session ${sessionId}`);
        const client = new WAClient(sessionId);
        try {
            await client.initialize(); // Wait for the client to be ready
        } catch (error) {
            console.error(`Failed to initialize client for session ${sessionId}:`, error);
            throw error;
        }
    }
};

// Function to reset session timeout
const resetSessionTimeout = (sessionId) => {
    if (sessionTimeouts[sessionId]) {
        clearTimeout(sessionTimeouts[sessionId]);
    }
    sessionTimeouts[sessionId] = setTimeout(() => {
        waClient.terminateSession(sessionId);
    }, 10 * 60 * 1000); // 10 minutes
};

// WhatsApp client manager with session lifecycle management
const waClient = {
    async initializeSession(sessionId) {
        try {
            await initializeClient(sessionId); // Ensure client is initialized
            const session = sessions[sessionId];
            await sessionModel.updateSession(sessionId, 'status', 'readyforsendmessage');
            return session;
        } catch (error) {
            console.error(`Failed to initialize session ${sessionId}:`, error);
            sessions[sessionId] = { status: 'failed' };
            return { sessionId, status: 'failed', error: error.message };
        }
    },

    async sendMessage(sessionId, phoneNumber, message) {
        let sessionData = await sessionModel.getBySessionId(sessionId);
        if (!sessionData || sessionData.status !== 'readyforsendmessage') {
            console.log(`Session ${sessionId} is not ready. Initializing now...`);
            await waClient.initializeSession(sessionId);
        }

        const clientInstance = clientInstances[sessionId];
        if (!clientInstance) {
            throw new Error(`Client instance for session ${sessionId} is not initialized`);
        }

        try {
            await clientInstance.sendMessage(`${phoneNumber}@c.us`, message);
            console.log(`Message sent to ${phoneNumber}: ${message}`);
            resetSessionTimeout(sessionId);
            return { sessionId, message, phoneNumber, status: 'sent' };
        } catch (error) {
            console.error(`Error sending message:`, error);
            return { sessionId, message, phoneNumber, status: 'failed', error: error.message };
        }
    },

    terminateSession(sessionId) {
        const session = sessionManager.getSession(sessionId);
        if (session) {
            session.status = 'terminated';
            console.log(`Session ${sessionId} terminated`);
            sessions[sessionId] = { status: 'terminated' };
            if (clientInstances[sessionId]) {
                clientInstances[sessionId].destroy();
                delete clientInstances[sessionId];
            }
            if (sessionTimeouts[sessionId]) {
                clearTimeout(sessionTimeouts[sessionId]);
                delete sessionTimeouts[sessionId];
            }
        }
    }
};

// Publicly exposed functions to interact with the client
const sendMessage = async (sessionId, message, phoneNumber) => {
    try {
        return await waClient.sendMessage(sessionId, phoneNumber, message);
    } catch (error) {
        console.error(`Error sending message:`, error);
        return { sessionId, message, phoneNumber, status: 'failed', error: error.message };
    }
};

const initializeSession = async (sessionId) => {
    return await waClient.initializeSession(sessionId);
};

const terminateSession = async (sessionId) => {
    return waClient.terminateSession(sessionId);
};

module.exports = {
    sendMessage,
    initializeSession,
    terminateSession,
};
