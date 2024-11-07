import dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';
const BACKEND_URL = process.env.BACKEND_URL;
const token = process.env.TOKEN_SECRET;
const axiosInstance = axios.create({
    baseURL: BACKEND_URL,
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `${token}`
    }
});

export const getAllSessions = async () => {
    try {
        const response = await axiosInstance.get(`${BACKEND_URL}all-sessions`);
        return response.data.sessions;
    } catch (error) {
        console.error('Error fetching all sessions:', error);
        return null;
    }
};

export const checkToken = async (token) => {
    try {
        const response = await axiosInstance.get(`${BACKEND_URL}get-user-by-token`, { token: token });
        return response.data.success;
    } catch (error) {
        console.error('Error checking token:', error);
        return false;
    }
};

export const updateSession = async (sessionId, key, value) => {
    try {
        const data = { session_id: sessionId };
        data[key] = value;
        const response = await axiosInstance.post(`${BACKEND_URL}update-session`, data);
        if (response.status == 200) {
            return response.data.success;
        } else {
            return false;
        }
    } catch (error) {
        console.error('Error updating session:', error);
        return false;
    }
};

export const checkSessionSubscription = async (sessionId) => {
    try {
        const response = await axiosInstance.get(`${BACKEND_URL}check-session-sub`, { params: { session_id: sessionId } });
        return response.data.success;
    } catch (error) {
        console.error('Error checking session subscription:', error);
        return false;
    }
};

export const getBySessionId = async (sessionId) => {
    try {
        const response = await axiosInstance.get(`${BACKEND_URL}get-session-by-session-id`, { params: { session_id: sessionId.replace(/\\/g, '').replace(/'/g, '') } });
        return response.data.session;
    } catch (error) {
        console.error('Error getting session by ID:', error);
        return null;
    }
};

export const getUserBySessionId = async (sessionId) => {
    try {
        const response = await axiosInstance.get(`${BACKEND_URL}get-user-by-session-id`, { params: { session_id: sessionId } });
        return response.data.user;
    } catch (error) {
        console.error('Error getting user by session ID:', error);
        return null;
    }
};

export const sendMessage = async (wa_session_id, message_id, phone_number, message) => {
    try {
        const response = await axiosInstance.post(`${BACKEND_URL}create-sended-message`, { wa_session_id: wa_session_id, message_id: message_id, message: message, phone_number: phone_number });
        return response.data;
    } catch (error) {
        console.error('Error sending message:', error);
        return null;
    }
};

export const addSessionNotValidNumber = async (wa_session_id, phone_number) => {
    try {
        const response = await axiosInstance.post(`${BACKEND_URL}add-session-not-valid-number`, { wa_session_id, phone_number });
        return response.data;
    } catch (error) {
        console.error('Error adding session not valid number:', error);
        return null;
    }
};