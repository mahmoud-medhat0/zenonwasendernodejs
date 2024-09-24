const MultiSessionManager = require('../services/multiSessionManager');
const sessionManager = new MultiSessionManager();
const SessionModel = require('../models/SessionModel');

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
exports.initialize = async (sessionId) => {

    console.log("initializing for : ", sessionId);

    const client = new Client({
        puppeteer: {
            headless: true,
            args: [ '--no-sandbox', '--disable-gpu', ],
        },
        authStrategy: new LocalAuth({ clientId: sessionId })
    });

    client.on('ready', async () => {
        console.log(`Client is ready for session ${sessionId}`);
        let sessionModel = new SessionModel();
        await sessionModel.updateBySessionId(sessionId, 'status', 'ready');
    });
    client.on('error', (error) => {
        console.error(`Client error for session ${sessionId}:`, error);
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
    });
    await client.initialize();
    let sessionModel = new SessionModel();
    let status =await (await sessionModel.getBySessionId(sessionId)).status;
    while (status !== 'ready') {
        if (status === 'ready') {
            return;
        }
        console.log(`Waiting for client to be ready for session ${sessionId}`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        sessionModel = new SessionModel();
        status = await(await sessionModel.getBySessionId(sessionId)).status;
    }
    return client;
}
exports.createSession = async (req, res) => {

    console.log("createSession", req.body);
    const sessionId = String(req.body.wa_session_id);
    if (!sessionId) {
        return res.status(400).send({ success: false, message: 'Invalid sessionId' });
    }
    try {
        console.log("Session ID not found, creating session");
        await sessionModel.updateBySessionId(sessionId, 'status', 'creating');
        await sessionManager.createSession(sessionId);
        res.status(200).send({ success: true, message: 'Session created', sessionId });
    } catch (error) {
        console.error("Error creating session", error);
        res.status(500).send({ success: false, message: 'Failed to create session', error: error.message });
    }
};

exports.getSession = (req, res) => {
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

exports.getQrCode = (req, res) => {
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
exports.updateSessions = (req, res) => {
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