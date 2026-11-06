import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import path from 'path';

import app from './app';
import { env } from './config/env';
import { connectDB } from './config/db';
import { initSockets } from './sockets';

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

async function startServer() {
  await connectDB();

  const httpServer = http.createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  initSockets(io);

  httpServer.listen(env.PORT, () => {
    console.log(`[Server] Running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});
