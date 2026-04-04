const io = require('socket.io-client');

const DRIVER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImVlMTIzMDQ5LWFiMDAtNGU5Ni04OGY3LWVkOWZiMzM5MzIyMyIsImVtYWlsIjoiamFtZXNtM0Bsb3RyYW5zLmNvbSIsInJvbGUiOiJkcml2ZXIiLCJpYXQiOjE3NzUzMDY0MjksImV4cCI6MTc3NTMxMDAyOX0.SJzGINnIU1mFQN7juxgi2yxeVUspnQIuHcYjF9eh89I';

const socket = io('http://localhost:3000', {
  auth: { token: DRIVER_TOKEN }
});

const stops = [
  { lat: -1.333206, lng: 36.774420, name: 'Galleria' },
  { lat: -1.300119, lng: 36.775739, name: 'Prestige' },
  { lat: -1.257834, lng: 36.804580, name: 'Westgate' },
  { lat: -1.232718, lng: 36.832910, name: 'Winton' },
  { lat: -1.395023, lng: 36.769485, name: 'Rongai' },
  { lat: -1.232718, lng: 36.832910, name: 'Winton' },
  { lat: -1.257834, lng: 36.804580, name: 'Westgate' },
  { lat: -1.300119, lng: 36.775739, name: 'Prestige' },
  { lat: -1.333206, lng: 36.774420, name: 'Galleria' },
];

let i = 0;

socket.on('connect', () => {
  console.log('✅ Connected:', socket.id);
  socket.emit('driver:online');
  console.log('📡 Emitted: driver:online');
});

socket.on('driver:ready', (data) => {
  console.log('🚌 Driver ready:', JSON.stringify(data, null, 2));

  setInterval(() => {
    if (i >= stops.length) {
      console.log('🏁 Simulation complete');
      process.exit(0);
    }
    const stop = stops[i];
    socket.emit('gps:update', { lat: stop.lat, lng: stop.lng });
    console.log(`\n📍 GPS ping → ${stop.name} (${stop.lat}, ${stop.lng})`);
    i++;
  }, 5000);
});

// ── ALL INCOMING EVENTS ──────────────────────────

socket.on('vehicle:position', (data) => {
  console.log('🗺️  vehicle:position:', JSON.stringify(data, null, 2));
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

socket.on('stop:crossed', (data) => {
  console.log('🛑 stop:crossed:', JSON.stringify(data, null, 2));
});

socket.on('vehicle:approaching', (data) => {
  console.log('🔔 vehicle:approaching:', JSON.stringify(data, null, 2));
});

socket.on('passenger:boarded', (data) => {
  console.log('🟢 passenger:boarded:', JSON.stringify(data, null, 2));
});

socket.on('passenger:alighted', (data) => {
  console.log('🟡 passenger:alighted:', JSON.stringify(data, null, 2));
});

socket.on('ride:completed', (data) => {
  console.log('✅ ride:completed:', JSON.stringify(data, null, 2));
});

socket.on('vehicle:registered', (data) => {
  console.log('🚗 vehicle:registered:', JSON.stringify(data, null, 2));
});

socket.on('driver:assigned', (data) => {
  console.log('👤 driver:assigned:', JSON.stringify(data, null, 2));
});

socket.on('vehicle:route:assigned', (data) => {
  console.log('🗺️  vehicle:route:assigned:', JSON.stringify(data, null, 2));
});

socket.on('driver:created', (data) => {
  console.log('👤 driver:created:', JSON.stringify(data, null, 2));
});

socket.on('passenger:created', (data) => {
  console.log('👤 passenger:created:', JSON.stringify(data, null, 2));
});

socket.on('error', (err) => {
  console.log('❌ Error:', JSON.stringify(err, null, 2));
});

socket.on('disconnect', () => {
  console.log('🔴 Disconnected');
});