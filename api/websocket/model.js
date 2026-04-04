const pool = require('../config/db');

// Get active vehicle route + all stops for a vehicle
async function getVehicleRouteWithStops(vehicle_id) {
  const routeResult = await pool.query(
    `SELECT vr.vehicle_id, vr.direction, vr.route_id, r.name AS route_name
     FROM vehicle_routes vr
     JOIN routes r ON r.id = vr.route_id
     WHERE vr.vehicle_id = $1 AND vr.is_active = TRUE`,
    [vehicle_id]
  );

  const route = routeResult.rows[0];
  if (!route) return null;

  const stopsResult = await pool.query(
    `SELECT * FROM stops WHERE route_id = $1 ORDER BY stop_order ASC`,
    [route.route_id]
  );

  route.stops = stopsResult.rows;
  return route;
}

// Get driver's assigned vehicle
async function getDriverVehicle(driver_id) {
  const result = await pool.query(
    `SELECT v.id AS vehicle_id, v.plate_number, v.capacity, v.nickname
     FROM driver_vehicles dv
     JOIN vehicles v ON v.id = dv.vehicle_id
     WHERE dv.driver_id = $1 AND dv.is_active = TRUE`,
    [driver_id]
  );
  return result.rows[0] || null;
}

// Get active bookings at a specific stop for a vehicle
async function getBookingsAtStop(vehicle_id, stop_id) {
  const pickups = await pool.query(
    `SELECT b.id, b.passenger_id, b.drop_off_stop_id, b.notification_preference,
            u.full_name, u.phone_number
     FROM bookings b
     JOIN users u ON u.id = b.passenger_id
     WHERE b.vehicle_id = $1 
       AND b.pickup_stop_id = $2 
       AND b.status = 'confirmed'`,
    [vehicle_id, stop_id]
  );

  const dropoffs = await pool.query(
    `SELECT b.id, b.passenger_id, b.pickup_stop_id, b.notification_preference,
            u.full_name, u.phone_number
     FROM bookings b
     JOIN users u ON u.id = b.passenger_id
     WHERE b.vehicle_id = $1 
       AND b.drop_off_stop_id = $2 
       AND b.status = 'confirmed'`,
    [vehicle_id, stop_id]
  );

  return {
    pickups: pickups.rows,
    dropoffs: dropoffs.rows,
  };
}

// Get all confirmed bookings for a vehicle (for passenger notifications)
async function getActiveBookingsForVehicle(vehicle_id) {
  const result = await pool.query(
    `SELECT b.id, b.passenger_id, b.drop_off_stop_id, b.pickup_stop_id,
            b.notification_preference
     FROM bookings b
     WHERE b.vehicle_id = $1 AND b.status = 'confirmed'`,
    [vehicle_id]
  );
  return result.rows;
}

module.exports = {
  getVehicleRouteWithStops,
  getDriverVehicle,
  getBookingsAtStop,
  getActiveBookingsForVehicle,
};