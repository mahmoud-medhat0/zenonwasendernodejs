import BaseModel from './BaseModel.js';
import connection from "../db/connection.js";

export default class WaSendedMessages extends BaseModel {
    constructor() {
        super('wa_session_sended_messages');
    }
}
