const { fork } = require('child_process');
const path = require('path');

class ProcessManager {
    constructor() {
        this.processes = {}; // Store child processes by sessionId
    }

    // Start a new client session process
    async startClientSession(sessionId) {
        if (this.processes[sessionId]) {
            console.log(`Client session ${sessionId} already exists.`);
            return this.processes[sessionId];
        }
        console.log(`Starting client session ${sessionId}`);
        const child = fork(path.join(__dirname, 'client.js'), [sessionId]);
        this.processes[sessionId] = child;
        console.log(`Started client session ${sessionId}`);
        // Listen for messages from the child process
        child.on('message', (message) => {
            console.log(`Message from client ${sessionId}:`, message);
            if (message.type === 'auth_failure') {
                console.log(`Authentication failure for session ${sessionId}:`, message.message);
                this.stopClientSession(sessionId);
            }
        });

        // Handle child process exit
        child.on('exit', (code) => {
            console.log(`Client session ${sessionId} exited with code ${code}`);
            delete this.processes[sessionId]; // Remove the process when it exits
            console.log(`Restarting client session ${sessionId}...`);
            this.startClientSession(sessionId);
        });
        return child;
    }

    // Send a message to a specific client session
    async sendMessageToClient(sessionId, messageType, payload) {
        // console.log(`Sending message to client ${sessionId}:`, messageType, payload);
        const child = this.processes[sessionId];
        if (!child) {
            console.error(`No client session found with sessionId: ${sessionId}`);
            return;
        }
        // console.log(`Sending message to client ${sessionId}:`, messageType, payload);
        return await child.send({ type: messageType, payload });
    }
    async sendMessageToGroup(sessionId,message,groupId,phoneNumber2){
        const child = this.processes[sessionId];
        if (!child) {
            console.error(`No client session found with sessionId: ${sessionId}`);
            return false;
        }
        try{
            return await child.send({ type: 'send_message_to_group', payload:{groupId,message,phoneNumber2} });
        }catch(error){
            console.error("Error sending message to group:", error);
            return false;
        }
    }
    async checkNumberIsRegistered(sessionId,phoneNumber){
        const child = this.processes[sessionId];
        if (!child) {
            console.error(`No client session found with sessionId: ${sessionId}`);
            return;
        }
        return await child.send({ type: 'check_number_is_registered', payload:phoneNumber });
    }
    async checkIInGroup(sessionId,groupId){
        const child = this.processes[sessionId];
        if (!child) {
            console.error(`No client session found with sessionId: ${sessionId}`);
            return;
        }
        return await child.send({ type: 'check_I_in_group', payload:groupId });
    }

    // Stop a client session
    stopClientSession(sessionId) {
        const child = this.processes[sessionId];
        if (child) {
            child.kill(); // Kill the child process
            console.log(`Client session ${sessionId} stopped.`);
            delete this.processes[sessionId];
        } else {
            console.error(`No client session found with sessionId: ${sessionId}`);
        }
        return false;
    }
}

// Export a single instance of the process manager (Singleton pattern)
module.exports = new ProcessManager();
