const BaseModel = require('./BaseModel');
const connection = require("../db/connection");

class WaSendedMessages extends BaseModel {
    constructor() {
        super('wa_session_sended_messages');
    }
}
module.exports = WaSendedMessages;
