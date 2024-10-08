import BaseModel from './BaseModel.js';
import connection from "../db/connection.js";

class SessionNotValidNumbers extends BaseModel {
    constructor() {
        super('session_not_valid_numbers');
    }
}

export default SessionNotValidNumbers;