import { checkToken } from '../utils/requestsfunctions.js';
const sessionTokenMiddleware = async (req, res, next) => {
    const token = req.headers['authorization'];
    console.log("Token", token);
    if (!token) {
        return res.status(401).json({ error: 'Token not provided' });
    }

    const success = await checkToken(token);
    if (!success) return res.status(401).json({ error: 'Invalid token' });
    next();
};

export default sessionTokenMiddleware;