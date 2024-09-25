const { Client, LocalAuth } = require('whatsapp-web.js');
const SessionModel = require('../models/SessionModel');
const SessionNotValidNumbers = require('../models/sessionNotValidNumbers');
const WaSendedMessages = require('../models/WaSendedMessages');
const clientInstances = {};
const sessionTimeouts = {};
const processManager = require('../processesfiles/processManager'); // Import the ProcessManager
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
    async sendMessage(sessionId, message, phoneNumber,phoneNumber2) {
        console.log("sendingMessage", sessionId, message, phoneNumber,phoneNumber2);
        // let client = clientInstances[sessionId];
        // if (!client) {
        //     await this.initialize(sessionId);
        //     while (!clientInstances[sessionId]) {
        //         console.log(`Waiting for client to be initialized for session ${sessionId}`);
        //         await new Promise((resolve) => setTimeout(resolve, 1000));
        //     }
        //     client = clientInstances[sessionId];
        // }

        // Wait for the client to be ready and status to be 'readyforsendmessage'
        let sessionModel = new SessionModel();
        let status = await (await sessionModel.getBySessionId(sessionId)).status;
        if (status === 'readyforsendmessage') {
            try {
                const isRegistered = await this.CheckNumberIsRegistered(sessionId,phoneNumber);
                if(isRegistered){
                    let result = await processManager.sendMessageToClient(sessionId, 'send_message', { to: phoneNumber + '@c.us', body: message });
                    console.log("result", result);
                    return { sessionId, message, phoneNumber, status: 'sent' ,messageSent:result};
                }
                else if(!isRegistered){
                    const messageSent = await processManager.sendMessageToClient(sessionId, 'send_message', { to: phoneNumber2 + '@c.us', body: message });
                    console.log(`Message sent: ${messageSent}`);   
                    let waSendedMessages = new WaSendedMessages();
                    await waSendedMessages.create({ wa_session_id: sessionId, message: message,message_id:messageSent.id.id,phone_number:phoneNumber2 });
                    this.resetSessionTimeout(sessionId);
                    return { sessionId, message, phoneNumber2, status: 'sent' ,messageSent:messageSent.id.id};
                }
                else{
                    this.resetSessionTimeout(sessionId);
                    let sessionNotValidNumbers = new SessionNotValidNumbers();
                    await sessionNotValidNumbers.create({ wa_session_id: sessionId, number: phoneNumber });
                    return { sessionId, message, phoneNumber, status: 'notregistered', error: 'notregistered' };
                }
            } catch (error) {
                console.error(`Error sending message:`, error);
                return { sessionId, message, phoneNumber, status: 'failed', error: error.message };

            }
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
        const isRegistered = await processManager.checkNumberIsRegistered(sessionId,phoneNumber);
        console.log("isRegistered from checkNumberIsRegistered", isRegistered);
        return isRegistered;
    }
}




const waClient = new WAClient();

module.exports = waClient;