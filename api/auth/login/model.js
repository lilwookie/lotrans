const pool = require('../../config/db');

const findByEmailInUsers = async (email) => {
    const result = await pool.query(
        `SELECT * FROM users WHERE email = $1`,
        [email]
    );
    return result.rows[0] || null;
};

const findByEmailInSuperAdmins = async (email) => {
    const result = await pool.query(
        `SELECT * FROM super_admins WHERE email = $1`,
        [email]
    );
    return result.rows[0] || null;
};

const updateLastLogin = async (id, table) => {
    await pool.query(
        `UPDATE ${table} SET last_login_at = NOW() WHERE id = $1`,
        [id]
    );
};

module.exports = {
    findByEmailInUsers,
    findByEmailInSuperAdmins,
    updateLastLogin,
};
