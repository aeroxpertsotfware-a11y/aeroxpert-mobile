import React, { createContext, useContext, useMemo } from "react";

// ✅ Exportado (esto corrige el TS2305)
export type Role = "admin" | "piloto" | "jefepilotos" | "gerentesms" | string;

type AuthContextType = {
  token: string | null;
  role: Role | null;
  logout: () => Promise<void> | void;
};

const AuthContext = createContext<AuthContextType>({
  token: null,
  role: null,
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({
  token,
  role,
  logout,
  children,
}: React.PropsWithChildren<{
  token: string | null;
  role: Role | null;
  logout: () => Promise<void> | void;
}>) {
  const value = useMemo(() => ({ token, role, logout }), [token, role, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
