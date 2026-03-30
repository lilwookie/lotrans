const pool = require('../../config/db');

const createAdmin = async ({ full_name, email, phone_number, password_hash, profile_picture_url, created_by }) => {
    const result = await pool.query(
        `INSERT INTO users (full_name, email, phone_number, password_hash, profile_picture_url, role, created_by)
         VALUES ($1, $2, $3, $4, $5, 'admin', $6)
         RETURNING id, full_name, email, phone_number, profile_picture_url, role, is_active, created_at`,
        [full_name, email, phone_number, password_hash, profile_picture_url, created_by]
    );
    return result.rows[0];
};

const getAllAdmins = async () => {
    const result = await pool.query(
        `SELECT id, full_name, email, phone_number, profile_picture_url, is_active, last_login_at, created_at
         FROM users WHERE role = 'admin' ORDER BY created_at DESC`
    );
    return result.rows;
};

const getAdminById = async (id) => {
    try {
        const result = await pool.query(
            `SELECT id, full_name, email, phone_number, profile_picture_url, is_active, last_login_at, created_at
             FROM users WHERE id = $1 AND role = 'admin'`,
            [id]
        );
        return result.rows[0] || null;
    } catch (err) {
        if (err.code === '22P02') return 'INVALID_UUID';
        throw err;
    }
};

const getAdminByEmail = async (email) => {
    const result = await pool.query(
        `SELECT * FROM users WHERE email = $1 AND role = 'admin'`,
        [email]
    );
    return result.rows[0];
};

const getAdminByPhone = async (phone_number) => {
    const result = await pool.query(
        `SELECT id FROM users WHERE phone_number = $1 AND role = 'admin'`,
        [phone_number]
    );
    return result.rows[0] || null;
};

const updateAdmin = async (id, { full_name, phone_number, profile_picture_url, is_active }) => {
    try {
        const result = await pool.query(
            `UPDATE users
             SET full_name = COALESCE($1, full_name),
                 phone_number = COALESCE($2, phone_number),
                 profile_picture_url = COALESCE($3, profile_picture_url),
                 is_active = COALESCE($4, is_active),
                 updated_at = NOW()
             WHERE id = $5 AND role = 'admin'
             RETURNING id, full_name, email, phone_number, profile_picture_url, is_active, updated_at`,
            [full_name, phone_number, profile_picture_url, is_active, id]
        );
        return result.rows[0] || null;
    } catch (err) {
        if (err.code === '22P02') return 'INVALID_UUID';
        throw err;
    }
};

const deleteAdmin = async (id) => {
    try {
        const result = await pool.query(
            `DELETE FROM users WHERE id = $1 AND role = 'admin'
             RETURNING id, full_name, email`,
            [id]
        );
        return result.rows[0] || null;
    } catch (err) {
        if (err.code === '22P02') return 'INVALID_UUID';
        throw err;
    }
};

module.exports = {
    createAdmin,
    getAllAdmins,
    getAdminById,
    getAdminByEmail,
    getAdminByPhone,
    updateAdmin,
    deleteAdmin,
};