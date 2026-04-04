const jwt = require('jsonwebtoken');
const { findNearestStop } = require('../utils/haversine');
const {
  getVehicleRouteWithStops,
  getDriverVehicle,
  getBookingsAtStop,
  getActiveBookingsForVehicle,
} = require('./model');

const vehicleCache = {};
const driverSockets = {};
const passengerSockets = {};

function authenticateSocket(socket) {
  const token =
    socket.handshake.auth?.token ||
    socket.handshake.headers?.authorization?.split(' ')[1];
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET_KEY);
  } catch {
    return null;
  }
}

function detectDirection(prevOrder, currentOrder) {
  if (currentOrder > prevOrder) return 'outbound';
  if (currentOrder < prevOrder) return 'inbound';
  return null;
}

function initializeWebSocket(io, redisClient) {

  function handleDriverOffline(socket) {
    const driverInfo = driverSockets[socket.id];
    if (!driverInfo) return;
    const { vehicle_id } = driverInfo;
    const state = vehicleCache[vehicle_id];
    io.emit('vehicle:offline', {
      vehicle_id,
      plate_number: state?.plate_number,
      message: 'Vehicle has gone offline',
    });
    console.log(`[EMIT] vehicle:offline → ${state?.plate_number || vehicle_id}`);
    delete vehicleCache[vehicle_id];
    delete driverSockets[socket.id];
  }

  io.on('connection', (socket) => {
    const user = authenticateSocket(socket);
    if (!user) {
      socket.emit('error', { message: 'Unauthorized' });
      socket.disconnect();
      return;
    }
    console.log(`[WS] Connected: ${user.role} | ${user.id} | socket: ${socket.id}`);

    // ─────────────────────────────────────────────
    // DRIVER
    // ─────────────────────────────────────────────
    if (user.role === 'driver') {

      socket.on('driver:online', async () => {
        try {
          const vehicle = await getDriverVehicle(user.id);
          if (!vehicle) { socket.emit('error', { message: 'No vehicle assigned to you' }); return; }

          const route = await getVehicleRouteWithStops(vehicle.vehicle_id);
          if (!route) { socket.emit('error', { message: 'No active route assigned to your vehicle' }); return; }

          driverSockets[socket.id] = { driver_id: user.id, vehicle_id: vehicle.vehicle_id };

          vehicleCache[vehicle.vehicle_id] = {
            lat: null, lng: null,
            lastNearestStop: null,
            direction: route.direction,
            routeStops: route.stops,
            route_name: route.route_name,
            plate_number: vehicle.plate_number,
            nickname: vehicle.nickname,
            vehicle_id: vehicle.vehicle_id,
            capacity: vehicle.capacity,
            seats_taken: 0,
          };

          socket.join(`vehicle:${vehicle.vehicle_id}`);

          socket.emit('driver:ready', {
            vehicle_id: vehicle.vehicle_id,
            plate_number: vehicle.plate_number,
            route_name: route.route_name,
            direction: route.direction,
            stops: route.stops,
          });

          // 🌍 Open broadcast
          io.emit('vehicle:online', {
            vehicle_id: vehicle.vehicle_id,
            plate_number: vehicle.plate_number,
            nickname: vehicle.nickname,
            route_name: route.route_name,
            direction: route.direction,
            capacity: vehicle.capacity,
            seats_taken: 0,
          });
          console.log(`[EMIT] vehicle:online → ${vehicle.plate_number} on ${route.route_name}`);

        } catch (err) {
          console.error('[WS] driver:online error:', err);
          socket.emit('error', { message: 'Failed to initialize driver session' });
        }
      });

      socket.on('gps:update', async ({ lat, lng }) => {
        try {
          const driverInfo = driverSockets[socket.id];
          if (!driverInfo) return;
          const { vehicle_id } = driverInfo;
          const state = vehicleCache[vehicle_id];
          if (!state) return;

          state.lat = lat;
          state.lng = lng;

          const nearestStop = findNearestStop(lat, lng, state.routeStops);
          if (!nearestStop) return;

          if (state.lastNearestStop) {
            const detectedDirection = detectDirection(state.lastNearestStop.stop_order, nearestStop.stop_order);
            if (detectedDirection) state.direction = detectedDirection;
          }

          const crossedStop = state.lastNearestStop && nearestStop.id !== state.lastNearestStop.id;
          state.lastNearestStop = nearestStop;

          await redisClient.set(
            `vehicle:${vehicle_id}:position`,
            JSON.stringify({
              vehicle_id, plate_number: state.plate_number, nickname: state.nickname,
              lat, lng, direction: state.direction, route_name: state.route_name,
              nearest_stop: { name: nearestStop.name, stop_order: nearestStop.stop_order },
              seats_taken: state.seats_taken, capacity: state.capacity,
            }),
            { EX: 30 }
          );

          // 🌍 Open broadcast
          io.emit('vehicle:position', {
            vehicle_id, plate_number: state.plate_number, nickname: state.nickname,
            lat, lng, direction: state.direction, route_name: state.route_name,
            nearest_stop: { name: nearestStop.name, stop_order: nearestStop.stop_order },
            seats_taken: state.seats_taken, capacity: state.capacity,
          });
          console.log(`[EMIT] vehicle:position → ${state.plate_number} | lat:${lat} lng:${lng} | stop:${nearestStop.name} | dir:${state.direction}`);

          if (crossedStop) {
            console.log(`[WS] ${state.plate_number} crossed → ${nearestStop.name}`);

            const { pickups, dropoffs } = await getBookingsAtStop(vehicle_id, nearestStop.id);

            // Driver only — has personal details
            socket.emit('stop:crossed', {
              stop: { name: nearestStop.name, stop_order: nearestStop.stop_order },
              direction: state.direction,
              pickups: pickups.length,
              dropoffs: dropoffs.length,
              pickup_passengers: pickups.map(p => ({ name: p.full_name, phone: p.phone_number })),
              dropoff_passengers: dropoffs.map(p => ({ name: p.full_name, phone: p.phone_number })),
            });
            console.log(`[EMIT] stop:crossed → driver | ${pickups.length} pickups | ${dropoffs.length} dropoffs at ${nearestStop.name}`);

            // Targeted passenger notifications
            const allBookings = await getActiveBookingsForVehicle(vehicle_id);
            for (const booking of allBookings) {
              const isMyStop = booking.drop_off_stop_id === nearestStop.id;
              const shouldNotify = booking.notification_preference === 'all_stops' || isMyStop;
              if (shouldNotify) {
                io.to(`passenger:${booking.passenger_id}`).emit('vehicle:approaching', {
                  vehicle_id, plate_number: state.plate_number,
                  stop_name: nearestStop.name, is_my_stop: isMyStop,
                  message: isMyStop ? `🚨 Your stop is next! ${nearestStop.name}` : `Vehicle approaching ${nearestStop.name}`,
                });
                console.log(`[EMIT] vehicle:approaching → passenger:${booking.passenger_id} | ${nearestStop.name} | my_stop:${isMyStop}`);
              }
            }
          }
        } catch (err) {
          console.error('[WS] gps:update error:', err);
        }
      });

      socket.on('passenger:boarded', async ({ booking_id, passenger_id }) => {
        try {
          const driverInfo = driverSockets[socket.id];
          if (!driverInfo) return;
          const { vehicle_id } = driverInfo;
          const state = vehicleCache[vehicle_id];
          if (!state) return;

          state.seats_taken += 1;
          const seats_left = state.capacity - state.seats_taken;

          // 🌍 Open broadcast
          io.emit('passenger:boarded', {
            vehicle_id, plate_number: state.plate_number, booking_id, seats_left, capacity: state.capacity,
          });
          console.log(`[EMIT] passenger:boarded → ${state.plate_number} | seats left: ${seats_left}`);

          if (seats_left === 0) {
            io.emit('vehicle:fully_booked', { vehicle_id, plate_number: state.plate_number });
            console.log(`[EMIT] vehicle:fully_booked → ${state.plate_number}`);
          }
        } catch (err) {
          console.error('[WS] passenger:boarded error:', err);
        }
      });

      socket.on('passenger:alighted', async ({ booking_id, passenger_id }) => {
        try {
          const driverInfo = driverSockets[socket.id];
          if (!driverInfo) return;
          const { vehicle_id } = driverInfo;
          const state = vehicleCache[vehicle_id];
          if (!state) return;

          state.seats_taken = Math.max(0, state.seats_taken - 1);
          const seats_left = state.capacity - state.seats_taken;

          // 🌍 Open broadcast
          io.emit('passenger:alighted', {
            vehicle_id, plate_number: state.plate_number, booking_id, seats_left, capacity: state.capacity,
          });
          console.log(`[EMIT] passenger:alighted → ${state.plate_number} | seats left: ${seats_left}`);

          // Targeted — ride complete notification
          io.to(`passenger:${passenger_id}`).emit('ride:completed', {
            vehicle_id, plate_number: state.plate_number,
            message: 'You have successfully alighted. Safe travels!',
          });
          console.log(`[EMIT] ride:completed → passenger:${passenger_id}`);

        } catch (err) {
          console.error('[WS] passenger:alighted error:', err);
        }
      });

      socket.on('driver:offline', () => handleDriverOffline(socket));
    }

    // ─────────────────────────────────────────────
    // PASSENGER
    // ─────────────────────────────────────────────
    if (user.role === 'passenger') {
      socket.on('passenger:track', async ({ vehicle_id }) => {
        try {
          socket.join(`vehicle:${vehicle_id}`);
          socket.join(`passenger:${user.id}`);
          passengerSockets[socket.id] = { passenger_id: user.id, vehicle_id };

          const cached = await redisClient.get(`vehicle:${vehicle_id}:position`);
          if (cached) {
            socket.emit('vehicle:position', JSON.parse(cached));
            console.log(`[EMIT] vehicle:position (cached) → passenger:${user.id}`);
          } else {
            socket.emit('vehicle:offline', { vehicle_id, message: 'Vehicle is not online yet' });
          }

          console.log(`[WS] Passenger ${user.id} tracking vehicle ${vehicle_id}`);
        } catch (err) {
          console.error('[WS] passenger:track error:', err);
        }
      });
    }

    // ─────────────────────────────────────────────
    // ADMIN
    // ─────────────────────────────────────────────
    if (user.role === 'admin') {
      socket.on('admin:dashboard', async () => {
        socket.join('admin:dashboard');
        const activeVehicles = [];
        for (const vehicle_id of Object.keys(vehicleCache)) {
          const cached = await redisClient.get(`vehicle:${vehicle_id}:position`);
          if (cached) activeVehicles.push(JSON.parse(cached));
        }
        socket.emit('dashboard:init', { vehicles: activeVehicles });
        console.log(`[WS] Admin ${user.id} joined dashboard | ${activeVehicles.length} active vehicles`);
      });
    }

    // ─────────────────────────────────────────────
    // DISCONNECT
    // ─────────────────────────────────────────────
    socket.on('disconnect', () => {
      if (driverSockets[socket.id]) handleDriverOffline(socket);
      if (passengerSockets[socket.id]) delete passengerSockets[socket.id];
      console.log(`[WS] Disconnected: ${socket.id}`);
    });
  });
}

module.exports = { initializeWebSocket, vehicleCache };