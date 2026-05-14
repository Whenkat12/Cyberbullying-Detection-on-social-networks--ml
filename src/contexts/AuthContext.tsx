import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiService } from '../services/api';

export interface User {
  id: string;
  username: string;
  email: string;
  profile: {
    firstName?: string;
    lastName?: string;
    avatar?: string;
    bio?: string;
    dateOfBirth?: string;
    country?: string;
    language?: string;
  };
  settings: {
    notifications: {
      email: boolean;
      push: boolean;
      sms: boolean;
    };
    privacy: {
      profileVisibility: 'public' | 'private' | 'friends';
      showDetectionHistory: boolean;
    };
    detection: {
      sensitivity: 'low' | 'medium' | 'high';
      autoBlock: boolean;
      blockThreshold: number;
    };
  };
  subscription: {
    plan: 'free' | 'basic' | 'premium';
    status: 'active' | 'inactive' | 'cancelled';
    expiresAt?: string;
    features: string[];
  };
  role: 'user' | 'moderator' | 'admin';
  isActive: boolean;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
  stats: {
    totalDetections: number;
    bullyingDetections: number;
    blockedUsers: number;
    reportsSubmitted: number;
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
  clearError: () => void;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for existing token on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedToken = localStorage.getItem('token');
        const storedRefreshToken = localStorage.getItem('refreshToken');
        
        if (storedToken && storedRefreshToken) {
          apiService.setToken(storedToken);
          apiService.setRefreshToken(storedRefreshToken);
          
          // Verify token by fetching user data
          const response = await apiService.getCurrentUser();
          setUser(response.user);
          setToken(storedToken);
        }
      } catch (error) {
        console.error('Auth initialization failed:', error);
        // Clear invalid tokens
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        apiService.clearAuth();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (emailOrUsername: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiService.login({ emailOrUsername, password });
      
      setUser(response.user);
      setToken(response.token);
      
      apiService.setToken(response.token);
      apiService.setRefreshToken(response.refreshToken);
      
    } catch (error: any) {
      setError(error.message || 'Login failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: RegisterData) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiService.register(userData);
      
      setUser(response.user);
      setToken(response.token);
      
      apiService.setToken(response.token);
      apiService.setRefreshToken(response.refreshToken);
      
    } catch (error: any) {
      setError(error.message || 'Registration failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setToken(null);
      apiService.clearAuth();
    }
  };

  const updateUser = async (userData: Partial<User>) => {
    try {
      // Update user profile
      if (userData.profile) {
        await apiService.updateProfile({ profile: userData.profile });
      }
      
      // Update user settings
      if (userData.settings) {
        await apiService.updateSettings({ settings: userData.settings });
      }
      
      // Fetch updated user data
      const response = await apiService.getCurrentUser();
      setUser(response.user);
      
    } catch (error: any) {
      setError(error.message || 'Failed to update user');
      throw error;
    }
  };

  const clearError = () => {
    setError(null);
  };

  const value = {
    user,
    token,
    isLoading,
    error,
    login,
    register,
    logout,
    updateUser,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};