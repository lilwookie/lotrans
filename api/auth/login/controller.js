const { comparePassword } = require('../../utils/bcrypt.util');
const {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken,
} = require('../../utils/jwt.utils');
const {
    findByEmailInUsers,
    findByEmailInSuperAdmins,
    updateLastLogin,
} = require('./model');

const handleLogin = async (req, res) => {
    try {
        const { email, password, role } = req.body;

        if (!email || !password || !role) {
            return res.status(400).json({ message: 'email, password and role are required' });
        }

        let user = null;
        let table = null;

        // determine which table to check based on role
        if (role === 'super_admin') {
            user = await findByEmailInSuperAdmins(email);
            table = 'super_admins';
        } else if (['admin', 'driver', 'passenger'].includes(role)) {
            user = await findByEmailInUsers(email);
            table = 'users';

            // make sure the role matches
            if (user && user.role !== role) {
                return res.status(403).json({ message: 'Role mismatch' });
            }
        } else {
            return res.status(400).json({ message: 'Invalid role' });
        }

        if (!user) {
            return res.status(404).json({ message: 'Account not found' });
        }

        if (!user.is_active) {
            return res.status(403).json({ message: 'Account is deactivated' });
        }

        const passwordMatch = await comparePassword(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // build token payload
        const payload = {
            id: user.id,
            email: user.email,
            role: role,
        };

        const accessToken = generateAccessToken(payload);
        const refreshToken = generateRefreshToken(payload);

        // update last login
        await updateLastLogin(user.id, table);

        res.status(200).json({
            message: 'Login successful',
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                role,
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const handleRefreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ message: 'Refresh token is required' });
        }

        const decoded = verifyRefreshToken(refreshToken);

        // generate new access token from refresh token payload
        const payload = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role,
        };

        const newAccessToken = generateAccessToken(payload);

        res.status(200).json({
            message: 'Access token refreshed',
            accessToken: newAccessToken,
        });
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Refresh token expired, please login again' });
        }
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Invalid refresh token' });
        }
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = { handleLogin, handleRefreshToken };