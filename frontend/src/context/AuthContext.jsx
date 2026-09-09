import { createContext, useContext, useState, useEffect } from "react";
import api from "../lib/api";
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("yneet_user")); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("yneet_token");
    if (token) {
      api.get("/auth/me")
        .then(r => { setUser(r.data.user); localStorage.setItem("yneet_user", JSON.stringify(r.data.user)); })
        .catch(() => { localStorage.removeItem("yneet_token"); localStorage.removeItem("yneet_user"); setUser(null); })
        .finally(() => setLoading(false));
    } else setLoading(false);
  }, []);

  // The only way a session starts on YNeet: exchange a Raise Academy token
  // (handed to us via the /bridge?token=... redirect) for a provisioned local user.
  const bridgeLogin = async (raiseAcademyToken) => {
    const { data } = await api.post("/auth/bridge", { token: raiseAcademyToken });
    localStorage.setItem("yneet_token", data.token);
    localStorage.setItem("yneet_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("yneet_token");
    localStorage.removeItem("yneet_user");
    setUser(null);
    const raiseUrl = import.meta.env.VITE_RAISE_ACADEMY_URL || "/";
    window.location.href = raiseUrl;
  };

  const updateUser = (updates) => {
    const merged = { ...user, ...updates };
    setUser(merged);
    localStorage.setItem("yneet_user", JSON.stringify(merged));
  };

  const refreshUser = async () => {
    const { data } = await api.get("/auth/me");
    setUser(data.user);
    localStorage.setItem("yneet_user", JSON.stringify(data.user));
    return data.user;
  };

  return (
    <AuthContext.Provider value={{ user, loading, bridgeLogin, logout, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
