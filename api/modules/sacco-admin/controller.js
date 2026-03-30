const { hashPassword } = require('../../utils/bcrypt.util');
const {
    createAdmin,
    getAllAdmins,
    getAdminById,
    getAdminByEmail,
    getAdminByPhone,
    updateAdmin,
    deleteAdmin,
} = require('./model');

const handleCreate = async (req, res) => {
    try {
        const { full_name, email, phone_number, password, profile_picture_url, created_by } = req.body;

        if (!full_name || !email || !password) {
            return res.status(400).json({ message: 'full_name, email and password are required' });
        }

        const existing = await getAdminByEmail(email);
        if (existing) {
            return res.status(409).json({ message: 'Email already in use' });
        }

        // check phone number
        if (phone_number) {
            const existingPhone = await getAdminByPhone(phone_number);
            if (existingPhone) {
                return res.status(409).json({ message: 'Phone number already in use' });
            }
        }

        const password_hash = await hashPassword(password);
        const admin = await createAdmin({
            full_name, email, phone_number,
            password_hash,
            profile_picture_url,
            role: 'admin',
            created_by,
        });

        res.status(201).json({ message: 'Admin created', data: admin });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const handleGetAll = async (req, res) => {
    try {
        const admins = await getAllAdmins();
        res.status(200).json({ data: admins });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const handleGetById = async (req, res) => {
    try {
        const { id } = req.params;
        const admin = await getAdminById(id);

        if (admin === 'INVALID_UUID') {
            return res.status(400).json({ message: 'Invalid ID format' });
        }
        if (!admin) {
            return res.status(404).json({ message: 'No admin with such ID found' });
        }

        res.status(200).json({ data: admin });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const handleUpdate = async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await updateAdmin(id, req.body);

        if (updated === 'INVALID_UUID') {
            return res.status(400).json({ message: 'Invalid ID format' });
        }
        if (!updated) {
            return res.status(404).json({ message: 'No admin with such ID found' });
        }

        res.status(200).json({ message: 'Admin updated', data: updated });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const handleDelete = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await deleteAdmin(id);

        if (deleted === 'INVALID_UUID') {
            return res.status(400).json({ message: 'Invalid ID format' });
        }
        if (!deleted) {
            return res.status(404).json({ message: 'No admin with such ID found' });
        }

        res.status(200).json({ message: 'Admin deleted', data: deleted });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = { handleCreate, handleGetAll, handleGetById, handleUpdate, handleDelete };