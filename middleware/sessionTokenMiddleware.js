const connection = require('../db/connection');

const sessionTokenMiddleware = (req, res, next) => {
    const token = req.headers['authorization'];
    console.log("Token", token);
    if (!token) {
        return res.status(401).json({ error: 'Token not provided' });
    }

    connection.query('SELECT user_id FROM session_tokens WHERE token = ?', [token], (err, results) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        if (results.length === 0) return res.status(401).json({ error: 'Invalid token' });

        req.user_id = results[0].user_id;
        next();
    });
};

module.exports = sessionTokenMiddleware;