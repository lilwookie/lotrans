const io = require('socket.io-client');
const axios = require('axios');

const DRIVER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjI3OWYyMDZmLTg1MzgtNDZjZS04NmU3LWM2NDM1YWI0YjQ2MCIsImVtYWlsIjoiZHJpdmVyQGxvdHJhbnMuY29tIiwicm9sZSI6ImRyaXZlciIsImlhdCI6MTc3NzM3Mzg0OCwiZXhwIjoxNzc3Mzc3NDQ4fQ.c5lGC-aJmU1p_Hon6H-tdVMIjc7NnHVcvgaW4aOoPgA';
const ROUTE_ID = '7e8fdc75-637a-49d1-ad16-6112bd71a3c9';
const BASE_URL = 'http://localhost:3000';

const socket = io(BASE_URL, {
  auth: { token: DRIVER_TOKEN }
});

async function fetchStops() {
  try {
    const res = await axios.get(`${BASE_URL}/v1/routes/getRoute/${ROUTE_ID}`, {
      headers: { Authorization: `Bearer ${DRIVER_TOKEN}` }
    });
    const stops = res.data.route.stops;
    console.log(`📦 Loaded ${stops.length} stops from API:`);
    stops.forEach(s => console.log(`   ${s.stop_order}. ${s.name} | ${s.lat}, ${s.lng}`));
    return stops;
  } catch (err) {
    console.error('❌ Failed to fetch stops:', err.message);
    process.exit(1);
  }
}

socket.on('connect', async () => {
  console.log('✅ Connected:', socket.id);

  // Fetch stops from API
  const dbStops = await fetchStops();

  // Build simulation — outbound then inbound
  const outbound = [...dbStops].sort((a, b) => a.stop_order - b.stop_order);
  const inbound = [...outbound].reverse();
  const allStops = [...outbound, ...inbound];

  console.log(`\n🗺️  Simulation route (${allStops.length} pings):`);
  allStops.forEach((s, idx) => console.log(`   ${idx + 1}. ${s.name}`));
  console.log('');

  socket.emit('driver:online');
  console.log('📡 Emitted: driver:online');
});

socket.on('driver:ready', (data) => {
  console.log(`🚌 Driver ready: ${data.plate_number} | ${data.route_name}`);
  console.log(`   Stops loaded: ${data.stops.length}`);
  console.log('   Starting simulation in 3 seconds...\n');

  // Get stops from driver:ready since they're already loaded
  const outbound = [...data.stops].sort((a, b) => a.stop_order - b.stop_order);
  const inbound = [...outbound].reverse();
  const allStops = [...outbound, ...inbound];

  let i = 0;
  setTimeout(() => {
    const interval = setInterval(() => {
      if (i >= allStops.length) {
        console.log('🏁 Simulation complete');
        clearInterval(interval);
        process.exit(0);
      }
      const stop = allStops[i];
      socket.emit('gps:update', {
        lat: parseFloat(stop.lat),
        lng: parseFloat(stop.lng)
      });
      console.log(`\n📍 GPS ping [${i + 1}/${allStops.length}] → ${stop.name} (${stop.lat}, ${stop.lng})`);
      i++;
    }, 25000);
  }, 3000);
});

// ── VEHICLE EVENTS ──────────────────────────────

socket.on('vehicle:position', (data) => {
  console.log(`🗺️  vehicle:position → ${data.plate_number} | stop: ${data.nearest_stop?.name} | dir: ${data.direction} | seats left: ${data.capacity - data.seats_taken}/${data.capacity}`);
});

socket.on('vehicle:online', (data) => {
  console.log('🟢 vehicle:online:', JSON.stringify(data, null, 2));
});

socket.on('vehicle:offline', (data) => {
  console.log('🔴 vehicle:offline:', JSON.stringify(data, null, 2));
});

socket.on('vehicle:fully_booked', (data) => {
  console.log('🚫 vehicle:fully_booked:', JSON.stringify(data, null, 2));
});

socket.on('vehicle:registered', (data) => {
  console.log('🚗 vehicle:registered:', JSON.stringify(data, null, 2));
});

socket.on('vehicle:route:assigned', (data) => {
  console.log('🗺️  vehicle:route:assigned:', JSON.stringify(data, null, 2));
});

// ── STOP EVENTS ──────────────────────────────────

socket.on('stop:crossed', (data) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🛑 STOP CROSSED → ${data.stop.name} | direction: ${data.direction}`);
  console.log(`   🟢 Pickups:  ${data.pickups} passenger(s)`);
  console.log(`   🔴 Dropoffs: ${data.dropoffs} passenger(s)`);
  if (data.pickup_passengers.length > 0) {
    console.log('   📋 Boarding:');
    data.pickup_passengers.forEach(p => console.log(`      → ${p.name} | ${p.phone}`));
  }
  if (data.dropoff_passengers.length > 0) {
    console.log('   📋 Alighting:');
    data.dropoff_passengers.forEach(p => console.log(`      → ${p.name} | ${p.phone}`));
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

socket.on('vehicle:approaching', (data) => {
  console.log('🔔 vehicle:approaching:', JSON.stringify(data, null, 2));
});

// ── BOOKING EVENTS ────────────────────────────────

socket.on('booking:created', (data) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 BOOKING CREATED!');
  console.log(`   🚌 Vehicle:   ${data.booking.vehicle_id}`);
  console.log(`   👤 Passenger: ${data.booking.passenger_id}`);
  console.log(`   📍 Pickup:    ${data.booking.pickup_stop_id}`);
  console.log(`   📍 Dropoff:   ${data.booking.drop_off_stop_id}`);
  console.log(`   💺 Seats:     ${data.booking.seats}`);
  console.log(`   💰 Fare:      Ksh. ${data.booking.total_fare}`);
  console.log(`   🧭 Direction: ${data.booking.direction}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

socket.on('passenger:booked', (data) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🎫 SEAT BOOKED → ${data.plate_number}`);
  console.log(`   💺 Seats left: ${data.seats_left}/${data.capacity}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

socket.on('booking:cancelled', (data) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`❌ BOOKING CANCELLED → ${data.plate_number}`);
  console.log(`   💺 Seats left: ${data.seats_left}/${data.capacity}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

// ── PASSENGER EVENTS ────────────────────────────
socket.on('trip:status', (data) => {
  console.log(`\n🚦 TRIP STATUS UPDATE`);
  console.log(`   Status: ${data.status.toUpperCase()}`);
  console.log(`   ${data.message}`);
  console.log(`   Booking: ${data.booking_id}`);
});

socket.on('passenger:boarded', (data) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🟢 PASSENGER BOARDED → ${data.plate_number}`);
  console.log(`   💺 Seats left: ${data.seats_left}/${data.capacity}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

socket.on('passenger:alighted', (data) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🟡 PASSENGER ALIGHTED → ${data.plate_number}`);
  console.log(`   💺 Seats left: ${data.seats_left}/${data.capacity}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

socket.on('ride:completed', (data) => {
  console.log('✅ ride:completed:', JSON.stringify(data, null, 2));
});

// ── PAYMENT EVENTS ────────────────────────────────

socket.on('payment:status', (data) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`💰 PAYMENT STATUS → ${data.status}`);
  console.log(`   📱 Phone:   ${data.metadata?.phone}`);
  console.log(`   💵 Amount:  Ksh. ${data.metadata?.amount}`);
  console.log(`   🧾 Receipt: ${data.metadata?.receipt}`);
  console.log(`   📊 Result:  ${data.result_code}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

socket.on('payment:received', (data) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`💰 PAYMENT RECEIVED → ${data.payment_status}`);
  console.log(`   📋 Booking: ${data.booking_id}`);
  console.log(`   💵 Amount:  Ksh. ${data.amount}`);
  console.log(`   🧾 Receipt: ${data.receipt}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

// ── PEOPLE EVENTS ─────────────────────────────────

socket.on('driver:created', (data) => {
  console.log('👤 driver:created:', JSON.stringify(data, null, 2));
});

socket.on('driver:assigned', (data) => {
  console.log('👤 driver:assigned:', JSON.stringify(data, null, 2));
});

socket.on('passenger:created', (data) => {
  console.log('👤 passenger:created:', JSON.stringify(data, null, 2));
});

// ── SYSTEM ────────────────────────────────────────

socket.on('error', (err) => {
  console.log('❌ Error:', JSON.stringify(err, null, 2));
});

socket.on('disconnect', () => {
  console.log('🔴 Disconnected');
});