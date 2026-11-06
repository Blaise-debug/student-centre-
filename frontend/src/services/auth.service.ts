import { api } from './api';
import { User } from '../types/models';

import { normalizeUser } from '../utils/normalize';

interface AuthResponse {
  token: string;
  user: User;
}

export async function registerUser(
  username: string,
  email: string,
  password: string,
  displayName: string
): Promise<AuthResponse> {
  const { data } = await api.post<{ token: string; user: any }>('/auth/register', {
    username,
    email,
    password,
    displayName,
  });
  return { token: data.token, user: normalizeUser(data.user) };
}

export async function loginUser(
  emailOrUsername: string,
  password: string
): Promise<AuthResponse> {
  const { data } = await api.post<{ token: string; user: any }>('/auth/login', {
    emailOrUsername,
    password,
  });
  return { token: data.token, user: normalizeUser(data.user) };
}

export async function fetchCurrentUser(): Promise<User> {
  const { data } = await api.get<{ user: any }>('/auth/me');
  return normalizeUser(data.user);
}