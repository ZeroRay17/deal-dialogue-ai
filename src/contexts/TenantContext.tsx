import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tenant, TenantUser, UserRole } from "@/types/domain";
import { useAuth } from "./AuthContext";

interface TenantContextValue {
  tenant: Tenant | null;
  membership: TenantUser | null;
  role: UserRole | null;
  loading: boolean;
  hasRole: (roles: UserRole[]) => boolean;
  refetch: () => Promise<void>;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [membership, setMembership] = useState<TenantUser | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) {
      setTenant(null);
      setMembership(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Get the user's first tenant membership
      const { data: mem } = await supabase
        .from("tenant_users")
        .select("*, tenants(*)")
        .eq("user_id", user.id)
        .order("created_at")
        .limit(1)
        .maybeSingle();

      if (mem) {
        setMembership(mem as TenantUser);
        setTenant((mem as any).tenants as Tenant);
      } else {
        setMembership(null);
        setTenant(null);
      }
    } catch {
      setTenant(null);
      setMembership(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const hasRole = (roles: UserRole[]) =>
    membership ? roles.includes(membership.role as UserRole) : false;

  return (
    <TenantContext.Provider
      value={{ tenant, membership, role: (membership?.role as UserRole) ?? null, loading, hasRole, refetch: load }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
}
