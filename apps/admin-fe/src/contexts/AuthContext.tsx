import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { httpRequest } from '../lib/httpRequest';
import { Admin } from '../types';

interface AuthContextType {
  admin: Admin | null;
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, twoFactorCode?: string) => Promise<{ error: AuthError | null }>;
  logout: () => Promise<{ error: AuthError | null }>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const syncAdminToDatabase = async (session: Session | null) => {
    if (!session?.user) {
      setSession(null);
      setUser(null);
      setAdmin(null);
      setIsLoading(false);
      return;
    }

    try {
      // Sync user to database first
      try {
        await httpRequest.post("/user/sync", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        });
      } catch (syncError) {
        console.warn('User sync failed, continuing with admin setup:', syncError);
      }

      // Try to get admin profile from API, but don't fail if it doesn't exist
      let adminData: Admin | null = null;
      
      try {
        const adminResponse = await httpRequest.get("/admin/profile", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (adminResponse.success && adminResponse.data) {
          adminData = {
            id: session.user.id,
            email: session.user.email || '',
            fullName: adminResponse.data.fullName || session.user.user_metadata?.full_name || 'Admin User',
            role: adminResponse.data.role || 'admin',
            permissions: adminResponse.data.permissions || ['*'],
            lastLogin: new Date().toISOString(),
            avatar: adminResponse.data.avatar || session.user.user_metadata?.avatar_url || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=2'
          };
        }
      } catch (adminError) {
        console.warn('Admin profile API not available, using fallback:', adminError);
      }

      // Use admin data from API or fallback to basic data
      if (!adminData) {
        adminData = {
          id: session.user.id,
          email: session.user.email || '',
          fullName: session.user.user_metadata?.full_name || 'Admin User',
          role: 'admin',
          permissions: ['*'],
          lastLogin: new Date().toISOString(),
          avatar: session.user.user_metadata?.avatar_url || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=2'
        };
      }

      setAdmin(adminData);
    } catch (error) {
      console.error('Error syncing admin data:', error);
      // Fallback to basic admin data
      const fallbackAdmin: Admin = {
        id: session.user.id,
        email: session.user.email || '',
        fullName: session.user.user_metadata?.full_name || 'Admin User',
        role: 'admin',
        permissions: ['*'],
        lastLogin: new Date().toISOString(),
        avatar: session.user.user_metadata?.avatar_url || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=2'
      };
      setAdmin(fallbackAdmin);
    }

    setSession(session);
    setUser(session.user);
    setIsLoading(false);
  };

  useEffect(() => {
    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      syncAdminToDatabase(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string, twoFactorCode?: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        setIsLoading(false);
        return { error };
      }

      // The auth state change will handle setting admin data
      return { error: null };
    } catch (error) {
      setIsLoading(false);
      return { error: error as AuthError };
    }
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    setAdmin(null);
    setUser(null);
    setSession(null);
    return { error };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  const value = {
    admin,
    user,
    session,
    isAuthenticated: !!admin,
    login,
    logout,
    resetPassword,
    isLoading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};