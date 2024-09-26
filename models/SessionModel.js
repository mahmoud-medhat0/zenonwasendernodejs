const BaseModel = require('./BaseModel');
const connection = require("../db/connection");

class SessionModel extends BaseModel {
    constructor() {
        super('wa_sessions');
    }
    async updateSession(sessionId, column, status) {
        const session = await this.getBySessionId(sessionId);
        if (!session) {
            return null;
        }
        session[column] = status;
        await this.update(sessionId, session);
        return session;
    }
    async getBySessionId(sessionId) {
        // console.log(`Fetching session data for sessionId: ${sessionId}`);
        try {
            // Your existing code to fetch session data
            const sessionData = await this.fetchSessionData(sessionId);
            // console.log(`Fetched session data: ${JSON.stringify(sessionData)}`);
            return sessionData;

        } catch (error) {
            console.error(`Error fetching session data for sessionId: ${sessionId}`, error);
            return null; // or handle the error as needed
        }
    }

    async fetchSessionData(sessionId) {
        return new Promise((resolve, reject) => {
            connection.query(
                `SELECT * FROM wa_sessions WHERE session_id = ?`,
                [sessionId],
                (err, results) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(results[0]);
                    }
                }
            );
        });
    }
    async getUserBySessionId(sessionId) {
        try {
            const session = await this.getBySessionId(sessionId);
            if (!session) {
                throw new Error(`Session with ID ${sessionId} not found`);
            }
            const userId = session.user_id;
            const userData = await this.fetchUserData(userId);
            return userData;
        } catch (error) {
            console.error(`Error getting user by session ID ${sessionId}:`, error);
            throw error;
        }
    }

    async fetchUserData(userId) {
        return new Promise((resolve, reject) => {
            connection.query(
                `SELECT * FROM users WHERE id = ?`,
                [userId],
                (err, results) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(results[0]);
                    }
                }
            );
        });
    }
    async checkActiveSubcription(sessionId) {
        const session = await this.getBySessionId(sessionId);
        if (!session) {
            return null;
        }
        const subscriptionId = session.subscription_id ;
        const subcriptionData = await this.fetchSubcriptionDataById(subscriptionId);
        if (subcriptionData.status === 'active') {
            return true;
        } else {
            return false;
        }
    }
    async fetchSubcriptionDataById(subscriptionId) {
        return new Promise((resolve, reject) => {
            connection.query(
                `SELECT * FROM subscriptions WHERE id = ?`,
                [subscriptionId],
                (err, results) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(results[0]);
                    }
                }
            );
        });
    }
}

module.exports = SessionModel;