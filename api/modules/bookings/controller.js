const { getIO } = require('../../websocket/socket');
const {initiateStkPush} = require('../../mpesa/modules/controller');
const {
  getStopById,
  getVehicleStops,
  getVehicleBookedSeats,
  isPeakHour,
  calculateFare,
  createBooking,
  getPassengerBookings,
  cancelBooking,
  getPassengerNotificationPref,
} = require('./model');

// GET /bookings/vehicles/available
// Returns all active vehicles from Redis cache
async function getAvailableVehicles(req, res) {
  try {
    const redisClient = req.app.get('redisClient');
    const { vehicleCache } = require('../../websocket/ws.handler');

    const vehicles = [];

    for (const vehicle_id of Object.keys(vehicleCache)) {
      const cached = await redisClient.get(`vehicle:${vehicle_id}:position`);
      if (!cached) continue;

      const state = JSON.parse(cached);
      const bookedSeats = await getVehicleBookedSeats(vehicle_id);
      const capacity = vehicleCache[vehicle_id]?.capacity || 0;
      const seats_available = capacity - bookedSeats;

      vehicles.push({
        vehicle_id,
        plate_number: state.plate_number,
        nickname: state.nickname,
        route_name: state.route_name,
        direction: state.direction,
        nearest_stop: state.nearest_stop,
        lat: state.lat,
        lng: state.lng,
        seats_available,
        capacity,
      });
    }

    return res.status(200).json({ vehicles });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /bookings/stops/:vehicle_id
// Returns stops for a vehicle's active route
async function getStopsForVehicle(req, res) {
  const { vehicle_id } = req.params;

  const stops = await getVehicleStops(vehicle_id);
  if (stops === 'INVALID_UUID') return res.status(400).json({ error: 'Invalid vehicle ID' });
  if (!stops.length) return res.status(404).json({ error: 'No active route found for this vehicle' });

  const direction = stops[0].direction;
  const route_name = stops[0].route_name;
  const route_id = stops[0].route_id;

  // For inbound, reverse the stops so passenger sees them in travel order
  const orderedStops = direction === 'inbound' ? [...stops].reverse() : stops;

  return res.status(200).json({ direction, route_name, route_id, stops: orderedStops });
}

// GET /bookings/fare?vehicle_id=&pickup_stop_id=&dropoff_stop_id=
// Calculate fare based on stops, direction and peak hours
async function getFare(req, res) {
  const { vehicle_id, pickup_stop_id, dropoff_stop_id } = req.query;

  if (!vehicle_id || !pickup_stop_id || !dropoff_stop_id) {
    return res.status(400).json({ error: 'vehicle_id, pickup_stop_id and dropoff_stop_id are required' });
  }

  const pickupStop = await getStopById(pickup_stop_id);
  if (!pickupStop) return res.status(404).json({ error: 'Pickup stop not found' });

  const dropoffStop = await getStopById(dropoff_stop_id);
  if (!dropoffStop) return res.status(404).json({ error: 'Drop-off stop not found' });

  // Determine direction from stop order
  const direction = dropoffStop.stop_order > pickupStop.stop_order ? 'outbound' : 'inbound';

  // Check peak hours
  const peak = await isPeakHour(pickupStop.route_id);

  // Calculate fare
  const fare = calculateFare(pickupStop, dropoffStop, direction, peak);

  if (fare <= 0) {
    return res.status(400).json({ error: 'Invalid stop selection for this direction' });
  }

  return res.status(200).json({
    fare,
    direction,
    is_peak: peak,
    pickup_stop: pickupStop.name,
    dropoff_stop: dropoffStop.name,
  });
}

// POST /bookings
// Create a booking
async function bookVehicle(req, res) {
  const passenger_id = req.user.id;
  const {
    vehicle_id,
    pickup_stop_id,
    drop_off_stop_id,
    seats,
    payment_phone,
  } = req.body;

  if (!vehicle_id || !pickup_stop_id || !drop_off_stop_id) {
    return res.status(400).json({ error: 'vehicle_id, pickup_stop_id and drop_off_stop_id are required' });
  }

  // Get stops
  const pickupStop = await getStopById(pickup_stop_id);
  if (!pickupStop) return res.status(404).json({ error: 'Pickup stop not found' });

  const dropoffStop = await getStopById(drop_off_stop_id);
  if (!dropoffStop) return res.status(404).json({ error: 'Drop-off stop not found' });

  // Determine direction
  const direction = dropoffStop.stop_order > pickupStop.stop_order ? 'outbound' : 'inbound';

  // Check peak hours
  const peak = await isPeakHour(pickupStop.route_id);

  // Calculate fare
  const fare = calculateFare(pickupStop, dropoffStop, direction, peak);
  if (fare <= 0) {
    return res.status(400).json({ error: 'Invalid stop selection' });
  }

  const seatsRequested = seats || 1;
  const total_fare = fare * seatsRequested;

  // Check seat availability from cache
  const { vehicleCache } = require('../../websocket/handler');
  const cacheState = vehicleCache[vehicle_id];
  if (cacheState) {
    const seats_available = cacheState.capacity - cacheState.seats_taken;
    if (seatsRequested > seats_available) {
      return res.status(409).json({ error: `Only ${seats_available} seats available` });
    }
  }

  // Get route_id
  const vehicleStops = await getVehicleStops(vehicle_id);
  if (!vehicleStops.length) return res.status(404).json({ error: 'Vehicle has no active route' });
  const route_id = vehicleStops[0].route_id;

  // Get passenger notification preference from profile
  const notification_preference = await getPassengerNotificationPref(passenger_id);

  // Resolve payment phone
  const phone = payment_phone || req.user.phone_number;

  console.log('[BOOKING] IDs →', {
  passenger_id,
  vehicle_id,
  route_id,
  pickup_stop_id,
  drop_off_stop_id,
});
  // Create booking
  const booking = await createBooking({
    passenger_id, vehicle_id, route_id,
    pickup_stop_id, drop_off_stop_id,
    seats: seatsRequested, direction,
    fare, total_fare,
    notification_preference,
    payment_phone: phone,
  });

  if (booking === 'INVALID_UUID') return res.status(400).json({ error: 'Invalid ID' });

  // Update seats in cache
  if (cacheState) {
    cacheState.seats_taken += seatsRequested;
    const seats_left = cacheState.capacity - cacheState.seats_taken;

    // 🌍 Open broadcast
    getIO().emit('passenger:booked', {
      vehicle_id,
      plate_number: cacheState.plate_number,
      seats_left,
      capacity: cacheState.capacity,
    });
    console.log(`[EMIT] passenger:booked → ${cacheState.plate_number} | seats left: ${seats_left}`);

    if (seats_left === 0) {
      getIO().emit('vehicle:fully_booked', {
        vehicle_id,
        plate_number: cacheState.plate_number,
      });
      console.log(`[EMIT] vehicle:fully_booked → ${cacheState.plate_number}`);
    }
  }

  // Admin dashboard
  getIO().to('admin:dashboard').emit('booking:created', { booking });
  console.log(`[EMIT] booking:created → passenger:${passenger_id} | vehicle:${vehicle_id}`);

  // 💰 Initiate STK Push
  try {
    const stk = await initiateStkPush({
      phone,
      amount: total_fare,
      booking_id: booking.id,
      passenger_id,
    });
    console.log(`[MPESA] STK Push initiated → ${stk.CheckoutRequestID}`);

    return res.status(201).json({
      message: 'Booking successful. Check your phone to complete payment.',
      booking,
      fare_breakdown: {
        fare_per_seat: fare,
        seats: seatsRequested,
        total_fare,
        is_peak: peak,
        direction,
      },
      mpesa: {
        checkout_request_id: stk.CheckoutRequestID,
        merchant_request_id: stk.MerchantRequestID,
      }
    });
  } catch (err) {
    console.error('❌ STK Push failed:', err.message);
    // Booking exists but payment failed to initiate — return booking anyway
    return res.status(201).json({
      message: 'Booking created but payment initiation failed. Please retry payment.',
      booking,
      fare_breakdown: {
        fare_per_seat: fare,
        seats: seatsRequested,
        total_fare,
        is_peak: peak,
        direction,
      },
    });
  }
}

// GET /bookings/my
// Passenger's booking history
async function myBookings(req, res) {
  const passenger_id = req.user.id;
  const result = await getPassengerBookings(passenger_id);
  if (result === 'INVALID_UUID') return res.status(400).json({ error: 'Invalid ID' });
  return res.status(200).json({ bookings: result });
}

// DELETE /bookings/:id
// Cancel a booking
async function cancelMyBooking(req, res) {
  const passenger_id = req.user.id;
  const { id } = req.params;

  const result = await cancelBooking(id, passenger_id);
  if (result === 'INVALID_UUID') return res.status(400).json({ error: 'Invalid booking ID' });
  if (!result) return res.status(404).json({ error: 'Booking not found or already cancelled' });

  // Free up seats in cache
  const { vehicleCache } = require('../../websocket/handler');
  const cacheState = vehicleCache[result.vehicle_id];
  if (cacheState) {
    cacheState.seats_taken = Math.max(0, cacheState.seats_taken - result.seats);
    const seats_left = cacheState.capacity - cacheState.seats_taken;

    getIO().emit('booking:cancelled', {
      vehicle_id: result.vehicle_id,
      plate_number: cacheState.plate_number,
      seats_left,
      capacity: cacheState.capacity,
    });
    console.log(`[EMIT] booking:cancelled → ${cacheState.plate_number} | seats left: ${seats_left}`);
  }

  getIO().to('admin:dashboard').emit('booking:cancelled', { booking: result });

  return res.status(200).json({ message: 'Booking cancelled', booking: result });
}

module.exports = {
  getAvailableVehicles,
  getStopsForVehicle,
  getFare,
  bookVehicle,
  myBookings,
  cancelMyBooking,
};