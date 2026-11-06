import { Server } from 'socket.io';
import { User } from '../models/User';
import { AuthenticatedSocket } from './socketAuth.middleware';

const onlineUsers = new Map<string, Set<string>>();

export async function registerPresenceHandlers(io: Server, socket: AuthenticatedSocket) {
  const userId = socket.userId!;

  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  onlineUsers.get(userId)!.add(socket.id);

  if (onlineUsers.get(userId)!.size === 1) {
    await User.findByIdAndUpdate(userId, { status: 'online' });
    io.emit('presence:update', { userId, status: 'online' });
  }

  socket.on('disconnect', async () => {
    const userSockets = onlineUsers.get(userId);
    if (!userSockets) return;

    userSockets.delete(socket.id);

    if (userSockets.size === 0) {
      onlineUsers.delete(userId);
      const lastSeen = new Date();
      await User.findByIdAndUpdate(userId, { status: 'offline', lastSeen });
      io.emit('presence:update', { userId, status: 'offline', lastSeen });
    }
  });
}

export function isUserOnline(userId: string): boolean {
  return onlineUsers.has(userId);
}

export function getOnlineSocketIds(userId: string): string[] {
  return Array.from(onlineUsers.get(userId) || []);
}