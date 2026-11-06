import { Server } from 'socket.io';
import { AuthenticatedSocket } from './socketAuth.middleware';

export function registerNotificationHandlers(io: Server, socket: AuthenticatedSocket) {
  const userId = socket.userId!;
  // Personal room — lets us push notifications directly to this user from anywhere in the app
  socket.join(`user:${userId}`);
}