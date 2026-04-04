 const dotenv = require('dotenv');
dotenv.config(); // Load env vars first before anything else

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { setIO } = require('./websocket/socket');

const { initializeWebSocket } = require('./websocket/handler'); 

// Config
const pool = require('./config/db');
const redisClient = require('./config/redis');

// TODO: Import routes here as modules are completed
const superAdminRoutes = require('./modules/super-admin/routes');
const saccoAdminRoutes = require('./modules/sacco-admin/routes');
const driverRoutes = require('./modules/drivers/routes');
const passengerRoutes = require('./modules/passengers/routes');
const authRoutes = require('./auth/login/routes');
const vehicleRoutes = require('./modules/vehicles/routes');
const VehicleRouteRoutes = require('./modules/routes/routes');
   

const app = express();
const server = http.createServer(app);

// Initialize socket.io
const io = new Server(server, {
    cors: { origin: '*' }
});

// Store IO instance globally
setIO(io);
initializeWebSocket(io, redisClient);

app.use(cors());
app.use(bodyParser.json());

// Health check
app.get('/health', (req, res) => {
    res.json({ message: 'LoTrans server is running!'});
});

// TODO: Mount routes here as modules are completed
app.use('/v1/super-admins', superAdminRoutes);
app.use('/v1/sacco-admins', saccoAdminRoutes);
app.use('/v1/drivers', driverRoutes);
app.use('/v1/passengers', passengerRoutes);
app.use('/v1/auth', authRoutes);
app.use('/v1/vehicles', vehicleRoutes);
app.use('/v1/routes', VehicleRouteRoutes);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`LoTrans server is running on port ${PORT}`);
});
