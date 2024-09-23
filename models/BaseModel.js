const connection = require("../db/connection");

class BaseModel {
  constructor(tableName) {
    this.tableName = tableName;
  }

  getAll(callback) {
    connection.query(`SELECT * FROM ${this.tableName}`, (err, results) => {
      if (typeof callback !== "function") return;
      if (err) {
        return callback(err, null);
      }
      callback(null, results);
    });
  }
  getBySessionId(sessionId, callback) {
    console.log("step get sessionId", sessionId);
    try {
      connection.query(
        `SELECT * FROM ${this.tableName} WHERE session_id = ?`,
        [sessionId],
        (err, results) => {
          if (typeof callback !== "function") return;
          if (err) {
            callback(err, null);
            return;
          }
        //   console.log("success get sessionId", results); // Moved inside the callback
          callback(null, results);
        }
      );
    } catch (error) {
      console.log("error", error);
      if (typeof callback === "function") {
        callback(error, null);
      }
    }
  }
  updateBySessionId(sessionId, column, value, callback) {
    const query = `UPDATE ${this.tableName} SET ${column} = ? WHERE session_id = ?`;
    connection.query(query, [value, sessionId], (err, results) => {
      if (typeof callback !== "function") return;

      if (err) {
        return callback(err, null);
      }
      callback(null, results);
    });
  }
  getById(id, callback) {
    connection.query(
      `SELECT * FROM ${this.tableName} WHERE id = ?`,
      [id],
      (err, results) => {
        if (typeof callback !== "function") return;
        if (err) {
          return callback(err, null);
        }
        callback(null, results[0]);
      }
    );
  }

  create(data, callback) {
    connection.query(
      `INSERT INTO ${this.tableName} SET ?`,
      data,
      (err, results) => {
        if (typeof callback !== "function") return;
        if (err) {
          return callback(err, null);
        }
        callback(null, results.insertId);
      }
    );
  }
  update(id, data, callback) {
    connection.query(
      `UPDATE ${this.tableName} SET ? WHERE id = ?`,
      [data, id],
      (err, results) => {
        if (typeof callback !== "function") return;
        if (err) {
          return callback(err, null);
        }
        callback(null, results);
      }
    );
  }
}

module.exports = BaseModel;
