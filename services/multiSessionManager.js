// import { Client, LocalAuth } from 'whatsapp-web.js';
import fs from 'fs';
import path from 'path';
import config from '../config/config.js';
import qrcode from 'qrcode';
import ProcessManager from '../processesfiles/processManager.js';
import { getAllSessions,getBySessionId } from '../utils/requestsfunctions.js';
class MultiSessionManager {
    constructor() {
        this.sessions = {};
        this.initializeSessions();
    }

    async initializeSessions() {
        try {
            const sessions = await getAllSessions();
            if (sessions) {
            sessions.forEach((session) => {
                    this.sessions[session.session_id] = session;
                });
            }
        } catch (err) {
            console.error('Error loading sessions from database', err);
            this.sessions = {};
        }
    }
    createSession(sessionId) {
        console.log("Arrived to method createSession", sessionId);
        const client = new Client({
            puppeteer: {
                headless: true,
                args: [ '--no-sandbox', '--disable-gpu', ],
            },
            authStrategy: new LocalAuth({ clientId: sessionId })
        });
        client.on('qr', async (qrReceived, asciiQR) => {
            try {
                const qrCodeDataUrl = await qrcode.toDataURL(qrReceived);
                const sessionModel = new SessionModel();
                sessionModel.updateBySessionId(sessionId, 'qrcode', qrCodeDataUrl);
                console.log(`QR RECEIVED for session ${sessionId}`);
            } catch (error) {
                console.log("Error updating QRCODE", error);
            }
        });
        client.on('ready', async () => {

            await client.sendMessage('201148422820@c.us', `Client is ready for session ${sessionId}`);
            const sessionModel = new SessionModel();
            sessionModel.updateBySessionId(sessionId, 'status', 'ready');
            console.log(`Client is ready for session ${sessionId}`);
            const userInfo = await client.info;
            const phoneNumber = userInfo.wid.user;
            sessionModel.updateBySessionId(sessionId, 'phone_number', phoneNumber);
            //add the phone number to the process manager
            client.destroy();
            ProcessManager.startClientSession(sessionId);
        });
        client.on('authenticated', async () => {
            const sessionModel = new SessionModel();
            sessionModel.updateBySessionId(sessionId, 'status', 'authenticated');
            console.log(`Client is authenticated for session ${sessionId}`);
        });
        client.on('auth_failure', async (msg) => {
            const sessionModel = new SessionModel();
            sessionModel.updateBySessionId(sessionId, 'status', 'auth_failure');
            console.error(`Authentication failure for session ${sessionId}`, msg);
        });
        client.on('disconnected', async (reason) => {
            const sessionModel = new SessionModel();
            sessionModel.updateBySessionId(sessionId, 'status', 'disconnected');
            console.log(`Client disconnected for session ${sessionId}`, reason);
            delete this.sessions[sessionId];
        });
        client.on('message', async (msg) => {
            await client.sendMessage(msg.from, msg.body);
            console.log(`Message received in session ${sessionId}:`, msg.body);
        });

        client.initialize();
        return client;
    }

    async getSession(sessionId) {
        try {
            const results = await getBySessionId(sessionId);
            return results[0];
        } catch (err) {
            console.error(`Error getting session ${sessionId}`, err);
            return null;
        }
    }

    deleteSession(sessionId) {
        if (this.sessions[sessionId]) {
            this.sessions[sessionId].destroy();
            delete this.sessions[sessionId];
        }
    }
    async getQrCode(sessionId) {
        const sessionModel = new SessionModel();
        try {
            const results = await new Promise((resolve, reject) => {
                sessionModel.getBySessionId(sessionId, (err, results) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(results);
                    }
                });
            });
            return results[0].qrcode;
        } catch (err) {
            console.error(`Error getting QR code for session ${sessionId}`, err);
            return null;
        }
    }
    generateQrCode(sessionId) {

        const qrcode = this.getQrCode(sessionId);
        return qrcode;
    }
    initializeSession(sessionId) {
        const sessionModel = new SessionModel();
        const client = new Client({
            puppeteer: {
                headless: true,
                args: [ '--no-sandbox', '--disable-gpu', ],
            },
            authStrategy: new LocalAuth({ clientId: sessionId })
        });
        client.initialize();
        sessionModel.updateBySessionId(sessionId, 'status', 'ready');
        console.log(`Client is ready for session ${sessionId}`);
        return client;
    }
}



// const writeSessionsToFile = (sessions) => {

//     const sessionsFilePath = path.join(__dirname, '../data/sessions.json');
//     fs.writeFileSync(sessionsFilePath, JSON.stringify(sessions, null, 2));
// };


export default MultiSessionManager;