import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { api } from "../api/client";
import { AuthUser, Company } from "../types";

interface AuthContextValue {
  user: AuthUser | null;
  company: Company | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSession() {
      const saved = localStorage.getItem("token");
      if (!saved) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get("/auth/me");
        setUser(data.user);
        setCompany(data.company);
        setToken(saved);
      } catch {
        localStorage.removeItem("token");
      } finally {
        setLoading(false);
      }
    }
    loadSession();
  }, []);

  async function login(email: string, password: string) {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", data.token);
    setToken(data.token);
    setUser(data.user);
    setCompany(data.company);
  }

  function logout() {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setCompany(null);
  }

  return (
    <AuthContext.Provider value={{ user, company, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
