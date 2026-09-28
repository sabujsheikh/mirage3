import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User, Capability, UserRoleTier } from '../types';

interface LoginResult {
  success: boolean;
  error?: string;
  locked?: boolean;
  remainingMinutes?: number;
}

interface AuthContextType {
  currentUser: User | null;
  users: User[];
  allUsers: User[];
  tier: UserRoleTier;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionToken: string | null;
  login: (identifier: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  switchUser: (userId: string) => void;
  can: (capability: Capability) => boolean;
  setRoleTier: (userId: string, tier: UserRoleTier) => Promise<void>;
  toggleCapability: (userId: string, capability: Capability) => Promise<void>;
  updateUserToggles: (userId: string, toggles: Record<string, boolean>) => Promise<void>;
  updateProfile: (data: { name: string; email?: string; phone: string; profile_photo_url?: string; password?: string }) => Promise<{ success: boolean; error?: string }>;
  createUser: (data: { name: string; email: string; phone: string; tier: UserRoleTier; role: string }) => Promise<void>;
  refreshUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'mirage_session_token';
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes idle timeout

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [sessionToken, setSessionToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  });
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const lastActiveRef = useRef<number>(Date.now());

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users', {
        headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  }, [sessionToken]);

  const verifySession = useCallback(async (token: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          setCurrentUser(data.user);
          return true;
        }
      }
    } catch (err) {
      console.error('Session validation error:', err);
    }
    return false;
  }, []);

  // Validate session on mount
  useEffect(() => {
    let isMounted = true;
    const initAuth = async () => {
      setIsLoading(true);
      if (sessionToken) {
        const isValid = await verifySession(sessionToken);
        if (!isValid && isMounted) {
          localStorage.removeItem(TOKEN_KEY);
          setSessionToken(null);
          setCurrentUser(null);
        }
      }
      if (isMounted) {
        await fetchUsers();
        setIsLoading(false);
      }
    };

    initAuth();
    return () => {
      isMounted = false;
    };
  }, [sessionToken, verifySession, fetchUsers]);

  // Idle timeout detector (30 minutes of inactivity)
  useEffect(() => {
    if (!currentUser || !sessionToken) return;

    const resetIdleTimer = () => {
      lastActiveRef.current = Date.now();
    };

    const intervalId = setInterval(() => {
      const inactiveDuration = Date.now() - lastActiveRef.current;
      if (inactiveDuration >= IDLE_TIMEOUT_MS) {
        console.warn('Session expired due to 30 minutes of inactivity');
        logout();
      }
    }, 60 * 1000); // Check every minute

    window.addEventListener('mousemove', resetIdleTimer, { passive: true });
    window.addEventListener('keydown', resetIdleTimer, { passive: true });
    window.addEventListener('click', resetIdleTimer, { passive: true });
    window.addEventListener('touchstart', resetIdleTimer, { passive: true });

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('mousemove', resetIdleTimer);
      window.removeEventListener('keydown', resetIdleTimer);
      window.removeEventListener('click', resetIdleTimer);
      window.removeEventListener('touchstart', resetIdleTimer);
    };
  }, [currentUser, sessionToken]);

  const login = async (identifier: string, password: string): Promise<LoginResult> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: data.error || 'Invalid credentials',
          locked: data.locked,
          remainingMinutes: data.remainingMinutes,
        };
      }

      setSessionToken(data.token);
      setCurrentUser(data.user);
      try {
        localStorage.setItem(TOKEN_KEY, data.token);
      } catch (e) {
        console.warn('Could not persist session token to localStorage', e);
      }
      lastActiveRef.current = Date.now();
      await fetchUsers();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error during login' };
    }
  };

  const logout = async () => {
    if (sessionToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token: sessionToken }),
        });
      } catch (err) {
        console.error('Logout error:', err);
      }
    }
    setSessionToken(null);
    setCurrentUser(null);
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {}
  };

  const tier: UserRoleTier = currentUser?.tier || 1;

  const can = (capability: Capability): boolean => {
    if (!currentUser) return false;
    if (currentUser.tier === 1) return true; // Tier 1: Owner (Section 20) has all capabilities

    if (currentUser.capabilities && currentUser.capabilities.includes(capability)) {
      return true;
    }

    if (currentUser.toggles && currentUser.toggles[capability] !== undefined) {
      return currentUser.toggles[capability];
    }

    return false;
  };

  const switchUser = (userId: string) => {
    const target = users.find(u => u.id === userId);
    if (target) {
      setCurrentUser(target);
    }
  };

  const setRoleTier = async (userId: string, newTier: UserRoleTier) => {
    const roleNames: Record<UserRoleTier, string> = {
      1: 'Owner',
      2: 'Accountant',
      3: 'Showroom & Sales',
      4: 'Packing Team',
    };

    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;

    const updatedUsers = users.map(u => {
      if (u.id === userId) {
        return {
          ...u,
          tier: newTier,
          role: roleNames[newTier] || u.role,
        };
      }
      return u;
    });
    setUsers(updatedUsers);
    if (currentUser?.id === userId) {
      setCurrentUser({
        ...currentUser,
        tier: newTier,
        role: roleNames[newTier] || currentUser.role,
      });
    }
  };

  const toggleCapability = async (userId: string, capability: Capability) => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser || targetUser.tier === 1) return;

    const currentCaps = targetUser.capabilities || [];
    const has = currentCaps.includes(capability);
    const newCaps = has
      ? currentCaps.filter(c => c !== capability)
      : [...currentCaps, capability];

    const updatedUsers = users.map(u => {
      if (u.id === userId) {
        return {
          ...u,
          capabilities: newCaps,
          toggles: {
            ...u.toggles,
            [capability]: !has,
          },
        };
      }
      return u;
    });
    setUsers(updatedUsers);
    if (currentUser?.id === userId) {
      setCurrentUser({
        ...currentUser,
        capabilities: newCaps,
        toggles: {
          ...currentUser.toggles,
          [capability]: !has,
        },
      });
    }
  };

  const updateUserToggles = async (userId: string, toggles: Record<string, boolean>) => {
    try {
      const res = await fetch(`/api/users/${userId}/toggles`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify({
          toggles,
          actor_id: currentUser?.id,
          actor_name: currentUser?.name,
        }),
      });
      if (res.ok) {
        await fetchUsers();
      }
    } catch (err) {
      console.error('Failed to update toggles:', err);
    }
  };

  const updateProfile = async (data: { name: string; email?: string; phone: string; profile_photo_url?: string; password?: string }) => {
    if (!currentUser) return { success: false, error: 'No active user found' };
    try {
      const res = await fetch(`/api/users/${currentUser.id}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const updatedUser = await res.json();
        setUsers(prev => prev.map(u => (u.id === currentUser.id ? updatedUser : u)));
        setCurrentUser(updatedUser);
        await fetchUsers();
        return { success: true };
      } else {
        const errData = await res.json().catch(() => ({ error: 'Failed to update profile' }));
        return { success: false, error: errData.error || 'Failed to update profile' };
      }
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      return { success: false, error: err.message || 'Network error updating profile' };
    }
  };

  const createUser = async (data: { name: string; email: string; phone: string; tier: UserRoleTier; role: string }) => {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify({
          ...data,
          actor_id: currentUser?.id,
          actor_name: currentUser?.name,
        }),
      });
      if (res.ok) {
        await fetchUsers();
      }
    } catch (err) {
      console.error('Failed to create user:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        users,
        allUsers: users,
        tier,
        isAuthenticated: !!currentUser,
        isLoading,
        sessionToken,
        login,
        logout,
        switchUser,
        can,
        setRoleTier,
        toggleCapability,
        updateUserToggles,
        updateProfile,
        createUser,
        refreshUsers: fetchUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

