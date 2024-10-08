import SessionModel from '../models/SessionModel.js';
import SessionNotValidNumbers from '../models/sessionNotValidNumbers.js';
import WaSendedMessages from '../models/WaSendedMessages.js';
const clientInstances = {};
const sessionTimeouts = {};
import ProcessManager from '../processesfiles/processManager.js'; // Import the ProcessManager
const processManager = new ProcessManager();
class WAClient {
    // async initialize(sessionId) {

    //     console.log("initializing for : ", sessionId);
    //     const client = new Client({
    //         puppeteer: {
    //             headless: true,
    //             args: [ '--no-sandbox', '--disable-gpu', ],
    //         },
    //         authStrategy: new LocalAuth({ clientId: sessionId })
    //     });

    //     client.on('ready', async () => {
    //         console.log(`Client is ready for session ${sessionId}`);
    //         let sessionModel = new SessionModel();
    //         await sessionModel.updateBySessionId(sessionId, 'status', 'readyforsendmessage');
    //         clientInstances[sessionId] = client;
    //         this.resetSessionTimeout(sessionId);
    //     });
    //     client.on('error', (error) => {
    //         console.error(`Client error for session ${sessionId}:`, error);
    //     });
    //     client.on('authenticated', async () => {
    //         const sessionModel = new SessionModel();
    //         sessionModel.updateBySessionId(sessionId, 'status', 'authenticated');
    //         console.log(`Client is authenticated for session ${sessionId}`);
    //     });
    //     client.on('auth_failure', async (msg) => {
    //         const sessionModel = new SessionModel();
    //         sessionModel.updateBySessionId(sessionId, 'status', 'auth_failure');
    //         console.error(`Authentication failure for session ${sessionId}`, msg);
    //     });
    //     client.on('disconnected', async (reason) => {
    //         const sessionModel = new SessionModel();
    //         sessionModel.updateBySessionId(sessionId, 'status', 'disconnected');
    //         console.log(`Client disconnected for session ${sessionId}`, reason);
    //     });
    //     await client.initialize();
    //     let sessionModel = new SessionModel();
    //     let status =await (await sessionModel.getBySessionId(sessionId)).status;
    //     console.log("first status", status);
    //     while (status !== 'readyforsendmessage') {
    //         if (status === 'readyforsendmessage') {
    //             return;
    //         }
    //         console.log(`Waiting for client to be ready for session ${sessionId}`);
    //         await new Promise((resolve) => setTimeout(resolve, 1000));
    //         sessionModel = new SessionModel();
    //         status = await(await sessionModel.getBySessionId(sessionId)).status;
    //         console.log("status", status);
    //     }
    // }
    async sendMessage(sessionId, message, phoneNumber, phoneNumber2) {
        let sessionModel = new SessionModel();
        let status = await (await sessionModel.getBySessionId(sessionId)).status;
        if (status === 'readyforsendmessage') {
            console.log(phoneNumber, phoneNumber2);
            try {
                if (phoneNumber.length < 16) {
                    console.log("first case");
                    const isRegistered = await this.CheckNumberIsRegistered(sessionId, phoneNumber);
                    if (isRegistered) {
                        let result = await processManager.sendMessageToClient(sessionId, 'send_message', { to: phoneNumber + '@c.us', body: message });
                        console.log("result", result);
                        return { sessionId, message, phoneNumber, status: 'sent', messageSent: result };
                    } else {
                        const messageSent = await processManager.sendMessageToClient(sessionId, 'send_message', { to: phoneNumber2 + '@c.us', body: message });
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        console.log(`Message sent: ${messageSent}`);
                        let waSendedMessages = new WaSendedMessages();
                        await waSendedMessages.create({ wa_session_id: sessionId, message: message, message_id: messageSent.id.id, phone_number: phoneNumber2 });
                        this.resetSessionTimeout(sessionId);
                        return { sessionId, message, phoneNumber2, status: 'sent', messageSent: messageSent.id.id };
                    }
                } else {
                    console.log("second case");
                    const isInGroup = await this.checkIInGroup(sessionId, phoneNumber);
                    console.log("isInGroup from checkIInGroup", isInGroup);
                    if (isInGroup) {
                        console.log(`Sending message to group: ${phoneNumber}`);
                        let result;
                        phoneNumber = phoneNumber.replace(/\s+/g, '')+'@g.us';
                        try {
                            result = await processManager.sendMessageToGroup(sessionId, phoneNumber, message);
                            console.log("result", result);
                        } catch (error) {
                            console.error("Error sending message to group:", error);
                            result = { error: error.message };
                        }
                        return { sessionId, message, phoneNumber, status: 'sent', messageSent: result };
                    } else {
                        this.resetSessionTimeout(sessionId);
                        let sessionNotValidNumbers = new SessionNotValidNumbers();
                        await sessionNotValidNumbers.create({ wa_session_id: sessionId, number: phoneNumber });
                        return { sessionId, message, phoneNumber, status: 'notregistered', error: 'notregistered' };
                    }
                }
            } catch (error) {
                console.error(`Error sending message:`, error);
                return { sessionId, message, phoneNumber, status: 'failed', error: error.message };
            }
        }
    }
    async sendMessageToGroup(sessionId, message, phoneNumber, phoneNumber2) {
        let result;
        try {
            result = await processManager.sendMessageToGroup(sessionId,phoneNumber, message, phoneNumber2);
            return result;
        } catch (error) {
            console.error("Error sending message to group:", error);
            result = { error: error.message };
        }
    }
    async resetSessionTimeout(sessionId) {
        if (sessionTimeouts[sessionId]) {
            clearTimeout(sessionTimeouts[sessionId]);

        }
        sessionTimeouts[sessionId] = setTimeout(() => {
            this.terminateSession(sessionId);
        }, 10 * 60 * 1000); // 10 minutes
    };  
    async terminateSession(sessionId) {
        const client = clientInstances[sessionId];
        if (client) {
            await client.destroy();
            let sessionModel = new SessionModel();
            await sessionModel.updateBySessionId(sessionId, 'status', 'terminated');
            delete clientInstances[sessionId];
            console.log(`Client for session ${sessionId} terminated`);
            return { sessionId, status: 'terminated' };
        }
    }
    async CheckNumberIsRegistered(sessionId,phoneNumber) {
        try {
            const isRegistered = await processManager.checkNumberIsRegistered(sessionId,phoneNumber);
            console.log("isRegistered from checkNumberIsRegistered", isRegistered);
            return isRegistered;
        } catch (error) {
            console.error("Error checking if number is registered:", error);
            return false;
        }
    }
    async checkIInGroup(sessionId, groupId) {
        try {
            const isInGroup = await new Promise((resolve, reject) => {
                processManager.checkIInGroup(sessionId, groupId)
                    .then(result => resolve(result))
                    .catch(error => reject(error));
            });
            console.log("isInGroup from checkIInGroup", isInGroup);
            return isInGroup;
        } catch (error) {
            console.error("Error checking if in group:", error);
            return false;
        }
    }
}
export default WAClient;