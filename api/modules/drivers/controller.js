const { hashPassword } = require('../../utils/bcrypt.util');
const { getIO } = require('../../websocket/socket');
const {
    createDriver,
    getAllDrivers,
    getDriverById,
    getDriverByEmail,
    getDriverByPhone,
    updateDriver,
    deleteDriver,
} = require('./model');

const handleCreate = async (req, res) => {
    try {
        const { full_name, email, phone_number, password, profile_picture_url, created_by } = req.body;

        if (!full_name || !email || !password) {
            return res.status(400).json({ message: 'full_name, email and password are required' });
        }

        const existing = await getDriverByEmail(email);
        if (existing) {
            return res.status(409).json({ message: 'Email already in use' });
        }

        if (phone_number) {
            const existingPhone = await getDriverByPhone(phone_number);
            if (existingPhone) {
                return res.status(409).json({ message: 'Phone number already in use' });
            }
        }

        const password_hash = await hashPassword(password);
        const driver = await createDriver({
            full_name, email, phone_number,
            password_hash,
            profile_picture_url,
            role: 'driver',
            created_by,
        });

        getIO().to('admin:dashboard').emit('driver:created', { driver });
        console.log(`[EMIT] driver:created → ${driver.full_name}`);

        res.status(201).json({ message: 'Driver created', data: driver });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const handleGetAll = async (req, res) => {
    try {
        const drivers = await getAllDrivers();
        res.status(200).json({ data: drivers });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const handleGetById = async (req, res) => {
    try {
        const { id } = req.params;
        const driver = await getDriverById(id);

        if (driver === 'INVALID_UUID') {
            return res.status(400).json({ message: 'Invalid ID format' });
        }
        if (!driver) {
            return res.status(404).json({ message: 'No driver with such ID found' });
        }

        res.status(200).json({ data: driver });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const handleUpdate = async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await updateDriver(id, req.body);

        if (updated === 'INVALID_UUID') {
            return res.status(400).json({ message: 'Invalid ID format' });
        }
        if (!updated) {
            return res.status(404).json({ message: 'No driver with such ID found' });
        }

        getIO().to('admin:dashboard').emit('driver:updated', { driver: updated });
        console.log(`[EMIT] driver:updated → ${updated.full_name}`);

        res.status(200).json({ message: 'Driver updated', data: updated });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const handleDelete = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await deleteDriver(id);

        if (deleted === 'INVALID_UUID') {
            return res.status(400).json({ message: 'Invalid ID format' });
        }
        if (!deleted) {
            return res.status(404).json({ message: 'No driver with such ID found' });
        }

        getIO().to('admin:dashboard').emit('driver:deleted', { driver_id: id });
        console.log(`[EMIT] driver:deleted → ${id}`);

        res.status(200).json({ message: 'Driver deleted', data: deleted });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = { handleCreate, handleGetAll, handleGetById, handleUpdate, handleDelete };