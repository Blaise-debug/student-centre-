import { Server } from 'socket.io';
import { socketAuthMiddleware, AuthenticatedSocket } from './socketAuth.middleware';
import { registerPresenceHandlers } from './presence.socket';
import { registerMessageHandlers } from './message.socket';
import { registerNotificationHandlers } from './notification.socket';

export function initSockets(io: Server) {
  io.use(socketAuthMiddleware);

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`[Socket] Client connected: ${socket.id} (user: ${socket.userId})`);

    registerPresenceHandlers(io, socket);
    registerMessageHandlers(io, socket);
    registerNotificationHandlers(io, socket);

    // Immediately mark the user online on connect, rather than waiting for a client event
    socket.emit('connected', { socketId: socket.id });
  });
}