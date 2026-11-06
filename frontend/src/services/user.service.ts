import { api } from './api';
import { User } from '../types/models';

// Backend sends _id; normalize to id for consistent frontend usage
import { normalizeUser } from '../utils/normalize';

export async function searchUsers(query: string): Promise<User[]> {
  const { data } = await api.get<{ users: any[] }>('/users/search', {
    params: { q: query },
  });
  return data.users.map(normalizeUser);
}

export async function fetchUserProfile(userId: string): Promise<User> {
  const { data } = await api.get<{ user: any }>(`/users/${userId}`);
  return normalizeUser(data.user);
}

export async function updateOwnProfile(updates: {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
}): Promise<User> {
  const { data } = await api.patch<{ user: any }>('/users/me', updates);
  return normalizeUser(data.user);
}