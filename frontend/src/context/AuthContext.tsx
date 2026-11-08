import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { User } from '../types/models';
import {
  fetchCurrentUser,
  loginUser,
  registerUser,
  verifyEmail as verifyEmailRequest,
} from '../services/auth.service';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  register: (
    username: string,
    email: string,
    password: string,
    displayName: string
  ) => Promise<void>;
  refreshUser: () => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    restoreSession();
  }, []);

  async function restoreSession() {
    try {
      const storedToken = await AsyncStorage.getItem('authToken');
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      setToken(storedToken);
      const currentUser = await fetchCurrentUser();
      setUser(currentUser);
    } catch (error) {
      const definitiveAuthFailure =
        axios.isAxiosError(error) &&
        (error.response?.status === 401 || error.response?.status === 403);
      console.warn('[Auth] Session restore failed');
      if (definitiveAuthFailure) {
        await AsyncStorage.removeItem('authToken');
        setToken(null);
      }
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(emailOrUsername: string, password: string) {
    const { token: newToken, user: loggedInUser } = await loginUser(
      emailOrUsername,
      password
    );
    await saveSession(newToken, loggedInUser);
  }

  async function verifyEmail(email: string, code: string) {
    const { token: newToken, user: verifiedUser } = await verifyEmailRequest(email, code);
    await saveSession(newToken, verifiedUser);
  }

  async function register(
    username: string,
    email: string,
    password: string,
    displayName: string
  ) {
    await registerUser(
      username,
      email,
      password,
      displayName
    );
  }

  async function saveSession(newToken: string, newUser: User) {
    await AsyncStorage.setItem('authToken', newToken);
    setToken(newToken);
    setUser(newUser);
  }

  async function refreshUser(): Promise<User> {
    const currentUser = await fetchCurrentUser();
    setUser(currentUser);
    return currentUser;
  }

  async function logout() {
    try {
      await AsyncStorage.removeItem('authToken');
    } finally {
      setToken(null);
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, login, verifyEmail, register, refreshUser, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
