 const dotenv = require('dotenv');
dotenv.config(); // Load env vars first before anything else

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { setIO } = require('./websocket/socket');

// Config
const pool = require('./config/db');
const redisClient = require('./config/redis');

// TODO: Import routes here as modules are completed

const app = express();
const server = http.createServer(app);

// Initialize socket.io
const io = new Server(server, {
    cors: { origin: '*' }
});

// Store IO instance globally
setIO(io);

// Socket.io connection
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

app.use(cors());
app.use(bodyParser.json());

// Health check
app.get('/health', (req, res) => {
    res.json({ message: 'LoTrans server is running!' });
});

// TODO: Mount routes here as modules are completed

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`LoTrans server is running on port ${PORT}`);
});
