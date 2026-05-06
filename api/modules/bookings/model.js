const pool = require('../../config/db');

// Get stop by ID
async function getStopById(stop_id) {
  try {
    const result = await pool.query(
      `SELECT * FROM stops WHERE id = $1`,
      [stop_id]
    );
    return result.rows[0] || null;
  } catch (err) {
    if (err.code === '22P02') return 'INVALID_UUID';
    throw err;
  }
}

// Get all stops for a vehicle's active route
async function getVehicleStops(vehicle_id) {
  try {
    const result = await pool.query(
      `SELECT s.*, vr.direction, r.name AS route_name, r.id AS route_id
       FROM vehicle_routes vr
       JOIN routes r ON r.id = vr.route_id
       JOIN stops s ON s.route_id = r.id
       WHERE vr.vehicle_id = $1 AND vr.is_active = TRUE
       ORDER BY s.stop_order ASC`,
      [vehicle_id]
    );
    return result.rows;
  } catch (err) {
    if (err.code === '22P02') return 'INVALID_UUID';
    throw err;
  }
}

// Check available seats for a vehicle
async function getVehicleBookedSeats(vehicle_id) {
  const result = await pool.query(
    `SELECT COALESCE(SUM(seats), 0)::int AS booked_seats
     FROM bookings
     WHERE vehicle_id = $1 AND status IN ('pending', 'confirmed')`,
    [vehicle_id]
  );
  return result.rows[0].booked_seats;
}

// Check if peak hours apply right now for a route
async function isPeakHour(route_id) {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 8); // HH:MM:SS

  const result = await pool.query(
    `SELECT id FROM route_peak_hours
     WHERE route_id = $1
       AND peak_start <= $2::time
       AND peak_end >= $2::time`,
    [route_id, currentTime]
  );
  return result.rows.length > 0;
}

// Calculate fare based on pickup, dropoff, direction and peak hours
function calculateFare(pickupStop, dropoffStop, direction, isPeak) {
  if (direction === 'outbound') {
    const dropoffFare = isPeak
      ? parseFloat(dropoffStop.outbound_fare_peak)
      : parseFloat(dropoffStop.outbound_fare_offpeak);
    const pickupFare = isPeak
      ? parseFloat(pickupStop.outbound_fare_peak || 0)
      : parseFloat(pickupStop.outbound_fare_offpeak || 0);
    return dropoffFare - pickupFare;
  } else {
    const boardingFare = isPeak
      ? parseFloat(pickupStop.inbound_fare_peak)
      : parseFloat(pickupStop.inbound_fare_offpeak);
    const alightingFare = isPeak
      ? parseFloat(dropoffStop.inbound_fare_peak || 0)
      : parseFloat(dropoffStop.inbound_fare_offpeak || 0);
    return boardingFare - alightingFare;
  }
}

// Create booking
async function createBooking({
  passenger_id, vehicle_id, route_id, pickup_stop_id,
  drop_off_stop_id, seats, direction, fare, total_fare,
  notification_preference, payment_phone
}) {
  try {
    const result = await pool.query(
      `INSERT INTO bookings (
        passenger_id, vehicle_id, route_id, pickup_stop_id,
        drop_off_stop_id, seats, direction, fare, total_fare,
        notification_preference, payment_phone
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        passenger_id, vehicle_id, route_id, pickup_stop_id,
        drop_off_stop_id, seats, direction, fare, total_fare,
        notification_preference || 'my_stop_only', payment_phone
      ]
    );
    return result.rows[0];
  } catch (err) {
    if (err.code === '22P02') return 'INVALID_UUID';
    throw err;
  }
}

// Get passenger's bookings
async function getPassengerBookings(passenger_id) {
  try {
    const result = await pool.query(
      `SELECT b.*,
              r.name AS route_name,
              ps.name AS pickup_stop_name,
              ds.name AS dropoff_stop_name,
              v.plate_number, v.nickname
       FROM bookings b
       JOIN routes r ON r.id = b.route_id
       JOIN stops ps ON ps.id = b.pickup_stop_id
       JOIN stops ds ON ds.id = b.drop_off_stop_id
       JOIN vehicles v ON v.id = b.vehicle_id
       WHERE b.passenger_id = $1
       ORDER BY b.booked_at DESC`,
      [passenger_id]
    );
    return result.rows;
  } catch (err) {
    if (err.code === '22P02') return 'INVALID_UUID';
    throw err;
  }
}

// Cancel booking
async function cancelBooking(booking_id, passenger_id) {
  try {
    const result = await pool.query(
      `UPDATE bookings SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 AND passenger_id = $2 AND status IN ('pending', 'confirmed')
       RETURNING *`,
      [booking_id, passenger_id]
    );
    return result.rows[0] || null;
  } catch (err) {
    if (err.code === '22P02') return 'INVALID_UUID';
    throw err;
  }
}

//passenger notification preference: 'my_stop_only' or 'route_wide'
async function getPassengerNotificationPref(passenger_id) {
  const result = await pool.query(
    `SELECT notification_preference FROM passenger_profiles WHERE user_id = $1`,
    [passenger_id]
  );
  return result.rows[0]?.notification_preference || 'my_stop_only';
}

module.exports = {
  getStopById,
  getVehicleStops,
  getVehicleBookedSeats,
  isPeakHour,
  calculateFare,
  createBooking,
  getPassengerBookings,
  cancelBooking,
  getPassengerNotificationPref,
};