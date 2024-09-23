const BaseModel = require('./BaseModel');
const connection = require("../db/connection");

class SessionNotValidNumbers extends BaseModel {
    constructor() {
        super('session_not_valid_numbers');
    }
}

module.exports = SessionNotValidNumbers;