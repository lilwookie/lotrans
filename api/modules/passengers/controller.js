const { hashPassword } = require('../../utils/bcrypt.util');
const {
    createPassenger,
    getAllPassengers,
    getPassengerById,
    getPassengerByEmail,
    getPassengerByPhone,
    updatePassenger,
    deletePassenger,
} = require('./model');

const handleCreate = async (req, res) => {
    try {
        const { full_name, email, phone_number, password, profile_picture_url, created_by } = req.body;

        if (!full_name || !email || !password) {
            return res.status(400).json({ message: 'full_name, email and password are required' });
        }

        const existing = await getPassengerByEmail(email);
        if (existing) {
            return res.status(409).json({ message: 'Email already in use' });
        }

        // check phone number
        if (phone_number) {
            const existingPhone = await getPassengerByPhone(phone_number);
            if (existingPhone) {
                return res.status(409).json({ message: 'Phone number already in use' });
            }
        }

        const password_hash = await hashPassword(password);
        const passenger = await createPassenger({
            full_name, email, phone_number,
            password_hash,
            profile_picture_url,
            role: 'passenger',
            created_by,
        });

        res.status(201).json({ message: 'Passenger created', data: passenger });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const handleGetAll = async (req, res) => {
    try {
        const passengers = await getAllPassengers();
        res.status(200).json({ data: passengers });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const handleGetById = async (req, res) => {
    try {
        const { id } = req.params;
        const passenger = await getPassengerById(id);

        if (passenger === 'INVALID_UUID') {
            return res.status(400).json({ message: 'Invalid ID format' });
        }
        if (!passenger) {
            return res.status(404).json({ message: 'No passenger with such ID found' });
        }

        res.status(200).json({ data: passenger });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const handleUpdate = async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await updatePassenger(id, req.body);

        if (updated === 'INVALID_UUID') {
            return res.status(400).json({ message: 'Invalid ID format' });
        }
        if (!updated) {
            return res.status(404).json({ message: 'No passenger with such ID found' });
        }

        res.status(200).json({ message: 'Passenger updated', data: updated });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const handleDelete = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await deletePassenger(id);

        if (deleted === 'INVALID_UUID') {
            return res.status(400).json({ message: 'Invalid ID format' });
        }
        if (!deleted) {
            return res.status(404).json({ message: 'No passenger with such ID found' });
        }

        res.status(200).json({ message: 'Passenger deleted', data: deleted });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = { handleCreate, handleGetAll, handleGetById, handleUpdate, handleDelete };