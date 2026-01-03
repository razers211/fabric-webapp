const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
require('dotenv').config();

const logger = require('./utils/logger');
const switchManager = require('./services/switchManager');
const deploymentRoutes = require('./routes/deployment');
const tenantRoutes = require('./routes/tenants');
const portRoutes = require('./routes/ports');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client/build')));

app.use('/api/deployment', deploymentRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/ports', portRoutes);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

global.io = io;

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
