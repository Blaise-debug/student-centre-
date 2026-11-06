import { User } from '../types/models';

export function normalizeUser(raw: any): User {
  return {
    id: raw._id || raw.id,
    username: raw.username,
    email: raw.email,
    displayName: raw.displayName,
    avatarUrl: raw.avatarUrl,
    bio: raw.bio,
    status: raw.status,
    lastSeen: raw.lastSeen,
  };
}
