const { hashPassword } = require('../../utils/bcrypt.util');
const {
    createSuperAdmin,
    getAllSuperAdmins,
    getSuperAdminById,
    getSuperAdminByEmail,
    getSuperAdminByPhone,
    updateSuperAdmin,
    deleteSuperAdmin,
} = require('./model');

const handleCreate = async (req, res) => {
    try {
        const { full_name, email, phone_number, password, profile_picture_url, created_by } = req.body;

        if (!full_name || !email || !password) {
            return res.status(400).json({ message: 'full_name, email and password are required' });
        }

        const existing = await getSuperAdminByEmail(email);
        if (existing) {
            return res.status(409).json({ message: 'Email already in use' });
        }

        // check phone number
        if (phone_number) {
            const existingPhone = await getSuperAdminByPhone(phone_number);
            if (existingPhone) {
                return res.status(409).json({ message: 'Phone number already in use' });
            }
        }

        const password_hash = await hashPassword(password);
        const admin = await createSuperAdmin({
            full_name, email, phone_number,
            password_hash,
            profile_picture_url, 
            created_by
            });

        res.status(201).json({ message: 'Admin created', data: admin });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const handleGetAll = async (req, res) => {
    try {
        const superAdmins = await getAllSuperAdmins();
        res.status(200).json({ data: superAdmins });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const handleGetById = async (req, res) => {
    try {
        const { id } = req.params;

        const superAdmin = await getSuperAdminById(id);

        if (superAdmin === 'INVALID_UUID') {
            return res.status(400).json({ message: 'Invalid ID format' });
        }

        if (!superAdmin) {
            return res.status(404).json({ message: 'No admin with such ID found' });
        }

        res.status(200).json({ data: superAdmin });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const handleUpdate = async (req, res) => {
    try {
        const updated = await updateSuperAdmin(req.params.id, req.body);
        if (!updated) return res.status(404).json({ message: 'Super admin not found' });
        res.status(200).json({ message: 'Super admin updated', data: updated });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const handleDelete = async (req, res) => {
    try {
        const deleted = await deleteSuperAdmin(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'Super admin not found' });
        res.status(200).json({ message: 'Super admin deleted', data: deleted });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = { handleCreate,
     handleGetAll, 
     handleGetById,
      handleUpdate, 
      handleDelete };