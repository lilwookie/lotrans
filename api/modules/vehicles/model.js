const pool = require('../../config/db');

async function createVehicle({ plate_number, make, model, year, capacity, vehicle_type, nickname }) {
  try {
    const result = await pool.query(
      `INSERT INTO vehicles (plate_number, make, model, year, capacity, vehicle_type, nickname)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [plate_number.toUpperCase(), make, model, year, capacity, vehicle_type, nickname || null]
    );
    return result.rows[0];
  } catch (err) {
    if (err.code === '23505') return 'DUPLICATE_PLATE';
    if (err.code === '22P02') return 'INVALID_UUID';
    throw err;
  }
}

async function getAllVehicles() {
  const result = await pool.query(
    `SELECT * FROM vehicles ORDER BY created_at DESC`
  );
  return result.rows;
}

async function getVehicleById(id) {
  try {
    const result = await pool.query(
      `SELECT * FROM vehicles WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  } catch (err) {
    if (err.code === '22P02') return 'INVALID_UUID';
    throw err;
  }
}

async function updateVehicle(id, fields) {
  const allowed = ['plate_number', 'make', 'model', 'year', 'capacity', 'vehicle_type', 'nickname', 'status'];
  const updates = [];
  const values = [];
  let idx = 1;

  for (const key of allowed) {
    if (fields[key] !== undefined) {
      updates.push(`${key} = $${idx++}`);
      values.push(key === 'plate_number' ? fields[key].toUpperCase() : fields[key]);
    }
  }

  if (updates.length === 0) return 'NO_FIELDS';

  updates.push(`updated_at = NOW()`);
  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE vehicles SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  } catch (err) {
    if (err.code === '23505') return 'DUPLICATE_PLATE';
    if (err.code === '22P02') return 'INVALID_UUID';
    throw err;
  }
}

async function deleteVehicle(id) {
  try {
    const result = await pool.query(
      `DELETE FROM vehicles WHERE id = $1 RETURNING id`,
      [id]
    );
    return result.rows[0] || null;
  } catch (err) {
    if (err.code === '22P02') return 'INVALID_UUID';
    throw err;
  }
}

module.exports = {
  createVehicle,
  getAllVehicles,
  getVehicleById,
  updateVehicle,
  deleteVehicle,
};