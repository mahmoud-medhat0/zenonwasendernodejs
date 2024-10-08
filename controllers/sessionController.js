import MultiSessionManager from '../services/multiSessionManager.js';
const sessionManager = new MultiSessionManager();
import SessionModel from '../models/SessionModel.js';
import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import fs from 'fs';
import path from 'path';
import qrcode from "qrcode";

// Load sessions from database on startup
const sessionModel = new SessionModel();
sessionModel.getAll((err, sessions) => {
    if (err) {
        console.error('Error loading sessions from database', err);
        return;
    }
    sessions.forEach(session => {
        const existingSession = sessionManager.getSession(session.session_id);
        if (existingSession) {
            existingSession.status = session.status;
        }
    });
});

export const createSession = async (req, res) => {
    console.log("createSession", req.body);
    const sessionId = String(req.body.wa_session_id);
    if (!sessionId) {
        return res.status(400).send({ success: false, message: 'Invalid sessionId' });
    }
    try {
        console.log("Session ID not found, creating session");
        // Define the path for the session file
        const sessionFilePath = path.join(process.cwd(), `sessions/${sessionId}`);
        if (!fs.existsSync(sessionFilePath)) {
            fs.mkdirSync(sessionFilePath, { recursive: true });
        }
        const { state, saveCreds } = await useMultiFileAuthState(sessionFilePath)
        // Initialize the WhatsApp socket
        let sessionModel = new SessionModel();
        await sessionModel.create(sessionId, 'status', 'connecting');
        const socket = await makeWASocket({
            auth: state,
        });

        // Save the authentication state whenever it changes
        socket.ev.on('creds.update', saveCreds);
        // Handle connection updates
        socket.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect,qr } = update;
            if (qr) {
                console.log("QR:", qr);
                const qrDataURL = await qrcode.toDataURL(qr);
                let sessionModel = new SessionModel();
                await sessionModel.updateBySessionId(sessionId, 'qrcode', qrDataURL);
            }
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
                if (shouldReconnect) {
                    await this.createSession(sessionId);
                }
                // Reconnect logic here if needed
            } else if (connection === 'open') {
                console.log('opened connection');
                await sessionModel.updateBySessionId(sessionId, 'status', 'connected');
                await waClient.sendMessage(sessionId, 'connected', '601122222222@c.us');
            }
        });

        // Wait for authentication to complete
        await new Promise((resolve, reject) => {
            socket.ev.on('auth-state.update', (authState) => {
                if (authState === 'authenticated') {
                    resolve();
                } else if (authState === 'auth_failure') {
                    reject(new Error('Authentication failed'));
                }
            });
        });

        res.status(200).send({ success: true, message: 'Session created', sessionId });
    } catch (error) {
        console.error("Error creating session", error);
        res.status(500).send({ success: false, message: 'Failed to create session', error: error.message });
    }
};
export const getSession = (req, res) => {
    const sessionId = req.body.wa_session_id;
    if (!sessionId || typeof sessionId !== 'string') {
        return res.status(400).send({ message: 'Invalid sessionId' });
    }
    sessionModel.getBySessionId(sessionId, (err, session) => {
        if (err) {
            return res.status(500).send({ message: 'Error retrieving session', error: err.message });
        }
        if (session.length === 0) {
            return res.status(404).send({ message: 'Session not found' });
        }
        res.status(200).send({ message: 'Session found', session: session[0], status: session[0].status });
    });
};

export const getQrCode = (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId || typeof sessionId !== 'string') {
        return res.status(400).send({ message: 'Invalid sessionId' });
    }
    sessionModel.getBySessionId(sessionId, (err, session) => {
        if (err) {
            return res.status(500).send({ message: 'Error retrieving session', error: err.message });
        }
        if (session.length === 0) {
            return res.status(404).send({ message: 'Session not found' });
        }
        const qrcode = session[0].qrcode;
        res.status(200).send({ message: 'Session found', qrcode: qrcode });
    });
};
export const updateSessions = (req, res) => {
    let sessionModel = new SessionModel();
    sessionModel.getAll((err, sessions) => {
        if (err) {
            console.error('Error retrieving sessions', err);
            return;
        }
        sessions.forEach(async (session) => {
            let client = await sessionManager.initializeSession(session.session_id);
            client.destroy();
        });
    });
}

export default { createSession, getSession, getQrCode, updateSessions };
