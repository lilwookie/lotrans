const pool = require('../../config/db');

const createSuperAdmin = async ({ full_name, email, phone_number, password_hash, profile_picture_url }) => {
    const result = await pool.query(
        `INSERT INTO super_admins (full_name, email, phone_number, password_hash, profile_picture_url)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, full_name, email, phone_number, profile_picture_url, is_active, created_at`,
        [full_name, email, phone_number, password_hash, profile_picture_url]
    );
    return result.rows[0];
};

const getAllSuperAdmins = async () => {
    const result = await pool.query(
        `SELECT id, full_name, email, phone_number, profile_picture_url, is_active, last_login_at, created_at
         FROM super_admins ORDER BY created_at DESC`
    );
    return result.rows;
};

const getSuperAdminById = async (id) => {
    try {
        const result = await pool.query(
            `SELECT id, full_name, email, phone_number, profile_picture_url, is_active, last_login_at, created_at
             FROM super_admins WHERE id = $1`,
            [id]
        );
        return result.rows[0] || null;
    } catch (err) {
        if (err.code === '22P02') {
            // invalid UUID format from postgres
            return 'INVALID_UUID';
        }
        throw err;
    }
};

const getSuperAdminByEmail = async (email) => {
    const result = await pool.query(
        `SELECT * FROM super_admins WHERE email = $1`,
        [email]
    );
    return result.rows[0];
};

const getSuperAdminByPhone = async (phone_number) => {
    const result = await pool.query(
        `SELECT id FROM super_admins WHERE phone_number = $1`,
        [phone_number]
    );
    return result.rows[0] || null;
};

const updateSuperAdmin = async (id, { full_name, phone_number, profile_picture_url, is_active }) => {
    const result = await pool.query(
        `UPDATE super_admins
         SET full_name = COALESCE($1, full_name),
             phone_number = COALESCE($2, phone_number),
             profile_picture_url = COALESCE($3, profile_picture_url),
             is_active = COALESCE($4, is_active),
             updated_at = NOW()
         WHERE id = $5
         RETURNING id, full_name, email, phone_number, profile_picture_url, is_active, updated_at`,
        [full_name, phone_number, profile_picture_url, is_active, id]
    );
    return result.rows[0];
};

const deleteSuperAdmin = async (id) => {
    const result = await pool.query(
        `DELETE FROM super_admins WHERE id = $1 RETURNING id, full_name, email`,
        [id]
    );
    return result.rows[0];
};

module.exports = {
    createSuperAdmin,
    getAllSuperAdmins,
    getSuperAdminById,
    getSuperAdminByEmail,
    getSuperAdminByPhone,
    updateSuperAdmin,
    deleteSuperAdmin,
};