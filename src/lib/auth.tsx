import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';

export type Player = { id: string; display_name: string; is_admin: boolean };

type AuthState = {
  player: Player | null;
  loading: boolean;
  join: (passcode: string, name: string, pin: string) => Promise<void>;
  login: (name: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

// Every browser gets an anonymous Supabase session; join/login attach it to a player.
async function ensureSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) return;
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
}

async function fetchMe(): Promise<Player | null> {
  const { data, error } = await supabase.rpc('me');
  if (error) throw error;
  return (data as Player[])[0] ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) setPlayer(await fetchMe());
      } catch {
        setPlayer(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const join = useCallback(async (passcode: string, name: string, pin: string) => {
    await ensureSession();
    const { data, error } = await supabase.rpc('join_group', { p_passcode: passcode, p_name: name, p_pin: pin });
    if (error) throw error;
    if (!data) throw new Error('Wrong passcode');
    setPlayer(await fetchMe());
  }, []);

  const login = useCallback(async (name: string, pin: string) => {
    await ensureSession();
    const { data, error } = await supabase.rpc('login', { p_name: name, p_pin: pin });
    if (error) throw error;
    if (!data) throw new Error('Wrong name or PIN');
    setPlayer(await fetchMe());
  }, []);

  const logout = useCallback(async () => {
    await supabase.rpc('logout');
    await supabase.auth.signOut();
    setPlayer(null);
  }, []);

  return (
    <AuthContext.Provider value={{ player, loading, join, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
