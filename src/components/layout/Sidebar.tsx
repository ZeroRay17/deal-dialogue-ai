import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Package,
  TrendingUp,
  ShoppingCart,
  BarChart2,
  Settings,
  Zap,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const navItems = [
  {
    group: "Visão Geral",
    items: [
      { to: "/", icon: LayoutDashboard, label: "Dashboard" },
      { to: "/analytics", icon: BarChart2, label: "Analytics" },
    ],
  },
  {
    group: "Clientes",
    items: [
      { to: "/contacts", icon: Users, label: "Contatos / CRM" },
      { to: "/pipeline", icon: TrendingUp, label: "Pipeline" },
    ],
  },
  {
    group: "Atendimento",
    items: [
      { to: "/conversations", icon: MessageSquare, label: "Conversas" },
    ],
  },
  {
    group: "Comercial",
    items: [
      { to: "/catalog", icon: Package, label: "Catálogo" },
      { to: "/orders", icon: ShoppingCart, label: "Pedidos" },
    ],
  },
  {
    group: "Configuração",
    items: [
      { to: "/settings", icon: Settings, label: "Configurações" },
    ],
  },
];

export default function Sidebar() {
  const location = useLocation();
  const { tenant } = useTenant();
  const { signOut } = useAuth();

  return (
    <aside className="flex h-full w-60 flex-col border-r bg-card">
      {/* Brand */}
      <div className="flex items-center gap-3 border-b px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <Zap className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground">
            {tenant?.name ?? "CommercePilot"}
          </p>
          <p className="text-[11px] text-muted-foreground capitalize">
            {tenant?.plan ?? "—"}
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {navItems.map((group) => (
          <div key={group.group}>
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.group}
            </p>
            <ul className="space-y-0.5">
              {group.items.map(({ to, icon: Icon, label }) => {
                const active =
                  to === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(to);
                return (
                  <li key={to}>
                    <NavLink
                      to={to}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                        active
                          ? "bg-primary/10 font-medium text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{label}</span>
                      {active && (
                        <ChevronRight className="h-3 w-3 opacity-50" />
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t px-3 py-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </aside>
  );
}
