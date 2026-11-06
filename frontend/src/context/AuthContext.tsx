import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types/models';
import { loginUser, registerUser, fetchCurrentUser } from '../services/auth.service';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  register: (
    username: string,
    email: string,
    password: string,
    displayName: string
  ) => Promise<void>;
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
      console.warn('[Auth] Session restore failed, clearing token');
      await AsyncStorage.removeItem('authToken');
      setToken(null);
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
    await AsyncStorage.setItem('authToken', newToken);
    setToken(newToken);
    setUser(loggedInUser);
  }

  async function register(
    username: string,
    email: string,
    password: string,
    displayName: string
  ) {
    const { token: newToken, user: newUser } = await registerUser(
      username,
      email,
      password,
      displayName
    );
    await AsyncStorage.setItem('authToken', newToken);
    setToken(newToken);
    setUser(newUser);
  }

  async function logout() {
    await AsyncStorage.removeItem('authToken');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, login, register, logout }}
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