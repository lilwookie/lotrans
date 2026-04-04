const pool = require('../../config/db');
const { get } = require('./routes');

// --- ROUTES ---

async function createRoute(name) {
  try {
    const result = await pool.query(
      `INSERT INTO routes (name) VALUES ($1) RETURNING *`,
      [name]
    );
    return result.rows[0];
  } catch (err) {
    if (err.code === '23505') return 'DUPLICATE_ROUTE';
    throw err;
  }
}

async function updateRoute(id, fields) {
  const allowed = ['name', 'overall_fare'];
  const updates = [];
  const values = [];
  let idx = 1;

  for (const key of allowed) {
    if (fields[key] !== undefined) {
      updates.push(`${key} = $${idx++}`);
      values.push(fields[key]);
    }
  }

  if (updates.length === 0) return 'NO_FIELDS';
  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE routes SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  } catch (err) {
    if (err.code === '23505') return 'DUPLICATE_ROUTE';
    if (err.code === '22P02') return 'INVALID_UUID';
    throw err;
  }
}

async function getAllRoutes() {
  const result = await pool.query(
    `SELECT r.*, 
       COUNT(s.id)::int AS stop_count
     FROM routes r
     LEFT JOIN stops s ON s.route_id = r.id
     GROUP BY r.id
     ORDER BY r.name ASC`
  );
  return result.rows;
}

async function getRouteById(id) {
  try {
    const result = await pool.query(
      `SELECT * FROM routes WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  } catch (err) {
    if (err.code === '22P02') return 'INVALID_UUID';
    throw err;
  }
}

async function getRouteWithStops(id) {
  try {
    const routeResult = await pool.query(
      `SELECT * FROM routes WHERE id = $1`,
      [id]
    );
    const route = routeResult.rows[0];
    if (!route) return null;

    const stopsResult = await pool.query(
      `SELECT * FROM stops WHERE route_id = $1 ORDER BY stop_order ASC`,
      [id]
    );
    route.stops = stopsResult.rows;
    return route;
  } catch (err) {
    if (err.code === '22P02') return 'INVALID_UUID';
    throw err;
  }
}

async function deleteRoute(id) {
  try {
    const result = await pool.query(
      `DELETE FROM routes WHERE id = $1 RETURNING id`,
      [id]
    );
    return result.rows[0] || null;
  } catch (err) {
    if (err.code === '22P02') return 'INVALID_UUID';
    throw err;
  }
}

// --- STOPS ---
async function addStop(route_id, { name, stop_order, lat, lng, inbound_fare_peak, inbound_fare_offpeak, outbound_fare_peak, outbound_fare_offpeak }) {
  try {
    const result = await pool.query(
      `INSERT INTO stops (route_id, name, stop_order, lat, lng, inbound_fare_peak, inbound_fare_offpeak, outbound_fare_peak, outbound_fare_offpeak)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [route_id, name, stop_order, lat || null, lng || null,
       inbound_fare_peak || null, inbound_fare_offpeak || null,
       outbound_fare_peak || null, outbound_fare_offpeak || null]
    );
    return result.rows[0];
  } catch (err) {
    if (err.code === '23505') return 'DUPLICATE_STOP';
    if (err.code === '22P02') return 'INVALID_UUID';
    throw err;
  }
}

async function updateStop(stop_id, fields) {
  const allowed = ['name', 'stop_order', 'lat', 'lng', 'inbound_fare_peak', 'inbound_fare_offpeak', 'outbound_fare_peak', 'outbound_fare_offpeak'];
  const updates = [];
  const values = [];
  let idx = 1;

  for (const key of allowed) {
    if (fields[key] !== undefined) {
      updates.push(`${key} = $${idx++}`);
      values.push(fields[key]);
    }
  }

  if (updates.length === 0) return 'NO_FIELDS';
  values.push(stop_id);

  try {
    const result = await pool.query(
      `UPDATE stops SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  } catch (err) {
    if (err.code === '23505') return 'DUPLICATE_STOP';
    if (err.code === '22P02') return 'INVALID_UUID';
    throw err;
  }
}

async function getStopsByRoute(route_id) {
  try {
    const result = await pool.query(
      `SELECT * FROM stops WHERE route_id = $1 ORDER BY stop_order ASC`,
      [route_id]
    );
    return result.rows;
  } catch (err) {
    if (err.code === '22P02') return 'INVALID_UUID';
    throw err;
  }
}

async function deleteStop(stop_id) {
  try {
    const result = await pool.query(
      `DELETE FROM stops WHERE id = $1 RETURNING id`,
      [stop_id]
    );
    return result.rows[0] || null;
  } catch (err) {
    if (err.code === '22P02') return 'INVALID_UUID';
    throw err;
  }
}

// --- VEHICLE ROUTE ASSIGNMENT ---

async function assignVehicleToRoute(vehicle_id, route_id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE vehicle_routes SET is_active = FALSE, updated_at = NOW()
       WHERE vehicle_id = $1 AND is_active = TRUE`,
      [vehicle_id]
    );

    const result = await client.query(
      `INSERT INTO vehicle_routes (vehicle_id, route_id)
       VALUES ($1, $2)
       RETURNING *`,
      [vehicle_id, route_id]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '22P02') return 'INVALID_UUID';
    throw err;
  } finally {
    client.release();
  }
}

async function getActiveVehicleRoute(vehicle_id) {
  try {
    const result = await pool.query(
      `SELECT vr.*, r.name AS route_name
       FROM vehicle_routes vr
       JOIN routes r ON r.id = vr.route_id
       WHERE vr.vehicle_id = $1 AND vr.is_active = TRUE`,
      [vehicle_id]
    );
    return result.rows[0] || null;
  } catch (err) {
    if (err.code === '22P02') return 'INVALID_UUID';
    throw err;
  }
}

async function unassignVehicleFromRoute(vehicle_id) {
  try {
    const result = await pool.query(
      `UPDATE vehicle_routes SET is_active = FALSE, updated_at = NOW()
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

module.exports = {
  createRoute,
  updateRoute,
  getAllRoutes,
  getRouteById,
  getRouteWithStops,
  deleteRoute,
  addStop,
  updateStop,
  getStopsByRoute,
  deleteStop,
  assignVehicleToRoute,
  getActiveVehicleRoute,
  unassignVehicleFromRoute,
};