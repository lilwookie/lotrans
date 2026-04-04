const pool = require('../../config/db');

// Check if driver exists and has role 'driver'
async function getDriverById(driver_id) {
  try {
    const result = await pool.query(
      `SELECT id, role FROM users WHERE id = $1 AND role = 'driver'`,
      [driver_id]
    );
    return result.rows[0] || null;
  } catch (err) {
    if (err.code === '22P02') return 'INVALID_UUID';
    throw err;
  }
}

// Check if vehicle exists
async function getVehicleById(vehicle_id) {
  try {
    const result = await pool.query(
      `SELECT id FROM vehicles WHERE id = $1`,
      [vehicle_id]
    );
    return result.rows[0] || null;
  } catch (err) {
    if (err.code === '22P02') return 'INVALID_UUID';
    throw err;
  }
}

async function assignDriverToVehicle(driver_id, vehicle_id) {
  try {
    const result = await pool.query(
      `INSERT INTO driver_vehicles (driver_id, vehicle_id)
       VALUES ($1, $2)
       RETURNING *`,
      [driver_id, vehicle_id]
    );
    return result.rows[0];
  } catch (err) {
    if (err.code === '23P01') return 'ALREADY_ASSIGNED'; // exclusion constraint violation
    if (err.code === '22P02') return 'INVALID_UUID';
    throw err;
  }
}

async function unassignDriverFromVehicle(vehicle_id) {
  try {
    const result = await pool.query(
      `UPDATE driver_vehicles
       SET is_active = FALSE, unassigned_at = NOW()
       WHERE vehicle_id = $1 AND is_active = TRUE
       RETURNING *`,
      [vehicle_id]
    );
    return result.rows[0] || null;
  } catch (err) {
    if (err.code === '22P02') return 'INVALID_UUID';
    throw err;
  }
}

// Get current active assignment for a vehicle
async function getActiveAssignment(vehicle_id) {
  try {
    const result = await pool.query(
      `SELECT dv.*, u.full_name AS driver, u.email, u.phone_number
       FROM driver_vehicles dv
       JOIN users u ON u.id = dv.driver_id
       WHERE dv.vehicle_id = $1 AND dv.is_active = TRUE`,
      [vehicle_id]
    );
    return result.rows[0] || null;
  } catch (err) {
    if (err.code === '22P02') return 'INVALID_UUID';
    throw err;
  }
}

module.exports = {
  getDriverById,
  getVehicleById,
  assignDriverToVehicle,
  unassignDriverFromVehicle,
  getActiveAssignment,
};