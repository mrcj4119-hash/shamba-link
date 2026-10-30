import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api } from "./api";
import type { User } from "./types";

interface AuthValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: {
    name: string;
    email: string;
    password: string;
    role: "farmer" | "agrovet" | "expert";
    phone: string;
    locationRegion: string;
    preferredLanguage: "en" | "sw";
  }) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem("shamba-access"));
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    let active = true;
    api<{ data: User }>("/api/auth/me", {}, token)
      .then((result) => {
        if (active) setUser(result.data);
      })
      .catch(() => {
        sessionStorage.removeItem("shamba-access");
        if (active) {
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function acceptCredentials(endpoint: string, body: unknown) {
    const result = await api<{ data: { user: User; accessToken: string } }>(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    });
    sessionStorage.setItem("shamba-access", result.data.accessToken);
    setToken(result.data.accessToken);
    setUser(result.data.user);
  }

  const value = useMemo<AuthValue>(() => ({
    user,
    token,
    loading,
    signIn: (email, password) => acceptCredentials("/api/auth/login", { email, password }),
    signUp: (input) => acceptCredentials("/api/auth/register", input),
    signOut: () => {
      sessionStorage.removeItem("shamba-access");
      setToken(null);
      setUser(null);
    },
  }), [user, token, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
