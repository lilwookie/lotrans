const pool = require('../../config/db');

const createDriver = async ({ full_name, email, phone_number, password_hash, profile_picture_url, created_by }) => {
    const result = await pool.query(
        `INSERT INTO users (full_name, email, phone_number, password_hash, profile_picture_url, role, created_by)
         VALUES ($1, $2, $3, $4, $5, 'driver', $6)
         RETURNING id, full_name, email, phone_number, profile_picture_url, role, is_active, created_at`,
        [full_name, email, phone_number, password_hash, profile_picture_url, created_by]
    );
    return result.rows[0];
};

const getAllDrivers = async () => {
    const result = await pool.query(
        `SELECT id, full_name, email, phone_number, profile_picture_url, is_active, last_login_at, created_at
         FROM users WHERE role = 'driver' ORDER BY created_at DESC`
    );
    return result.rows;
};

const getDriverById = async (id) => {
    try {
        const result = await pool.query(
            `SELECT id, full_name, email, phone_number, profile_picture_url, is_active, last_login_at, created_at
             FROM users WHERE id = $1 AND role = 'driver'`,
            [id]
        );
        return result.rows[0] || null;
    } catch (err) {
        if (err.code === '22P02') return 'INVALID_UUID';
        throw err;
    }
};

const getDriverByEmail = async (email) => {
    const result = await pool.query(
        `SELECT * FROM users WHERE email = $1 AND role = 'driver'`,
        [email]
    );
    return result.rows[0];
};


const getDriverByPhone = async (phone_number) => {
    const result = await pool.query(
        `SELECT id FROM users WHERE phone_number = $1 AND role = 'driver'`,
        [phone_number]
    );
    return result.rows[0] || null;
};


const updateDriver = async (id, { full_name, phone_number, profile_picture_url, is_active }) => {
    try {
        const result = await pool.query(
            `UPDATE users
             SET full_name = COALESCE($1, full_name),
                 phone_number = COALESCE($2, phone_number),
                 profile_picture_url = COALESCE($3, profile_picture_url),
                 is_active = COALESCE($4, is_active),
                 updated_at = NOW()
             WHERE id = $5 AND role = 'driver'
             RETURNING id, full_name, email, phone_number, profile_picture_url, is_active, updated_at`,
            [full_name, phone_number, profile_picture_url, is_active, id]
        );
        return result.rows[0] || null;
    } catch (err) {
        if (err.code === '22P02') return 'INVALID_UUID';
        throw err;
    }
};

const deleteDriver = async (id) => {
    try {
        const result = await pool.query(
            `DELETE FROM users WHERE id = $1 AND role = 'driver'
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
    createDriver,
    getAllDrivers,
    getDriverById,
    getDriverByEmail,
    getDriverByPhone,
    updateDriver,
    deleteDriver,
};