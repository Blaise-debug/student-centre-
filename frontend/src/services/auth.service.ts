import { api } from './api';
import { User } from '../types/models';

import { normalizeUser } from '../utils/normalize';

interface AuthResponse {
  token: string;
  user: User;
}

interface RegistrationResponse {
  user: User;
}

export async function registerUser(
  username: string,
  email: string,
  password: string,
  displayName: string
): Promise<RegistrationResponse> {
  const { data } = await api.post<{ user: any }>('/auth/register', {
    username,
    email,
    password,
    displayName,
  });
  return { user: normalizeUser(data.user) };
}

export async function verifyEmail(email: string, code: string): Promise<AuthResponse> {
  const { data } = await api.post<{ token: string; user: any }>('/auth/verify-email', {
    email,
    code,
  });
  return { token: data.token, user: normalizeUser(data.user) };
}

export async function resendVerification(email: string): Promise<void> {
  await api.post('/auth/resend-verification', { email });
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

export async function requestPasswordReset(email: string): Promise<void> {
  await api.post('/auth/password-reset/request', { email });
}

export async function completePasswordReset(
  token: string,
  newPassword: string
): Promise<void> {
  await api.post('/auth/password-reset/complete', { token, newPassword });
}
