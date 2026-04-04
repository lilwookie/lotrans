const jwt = require('jsonwebtoken');
 
const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers['authorization'];
 
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }
 
    const token = authHeader.split(' ')[1];
 
    jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: 'Invalid or expired token.' });
        }
 
        req.user = decoded; // { id, role, name, email }
        next();
    });
};
 
module.exports = authenticateJWT;