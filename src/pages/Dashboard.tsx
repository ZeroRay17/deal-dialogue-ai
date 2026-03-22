import { useQuery } from "@tanstack/react-query";
import {
  MessageSquare,
  Users,
  TrendingUp,
  ShoppingCart,
  DollarSign,
  Activity,
  Clock,
  BarChart2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import KpiCard from "@/components/shared/KpiCard";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import StatusBadge from "@/components/shared/StatusBadge";

const last7Days = () =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split("T")[0];
  });

const todayStr = () => new Date().toISOString().split("T")[0];

const FUNNEL_COLORS = ["#6366f1", "#8b5cf6", "#f59e0b", "#f97316", "#10b981", "#ef4444"];

export default function Dashboard() {
  const { tenant } = useTenant();
  const tid = tenant?.id;

  const { data: convCount } = useQuery({
    queryKey: ["dash-conv-count", tid],
    enabled: !!tid,
    queryFn: async () => {
      const { count } = await supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tid!);
      return count ?? 0;
    },
  });

  const { data: convToday } = useQuery({
    queryKey: ["dash-conv-today", tid],
    enabled: !!tid,
    queryFn: async () => {
      const { count } = await supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tid!)
        .gte("created_at", `${todayStr()}T00:00:00`);
      return count ?? 0;
    },
  });

  const { data: contactCount } = useQuery({
    queryKey: ["dash-contacts", tid],
    enabled: !!tid,
    queryFn: async () => {
      const { count } = await supabase
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tid!);
      return count ?? 0;
    },
  });

  const { data: orderRevenue } = useQuery({
    queryKey: ["dash-revenue", tid],
    enabled: !!tid,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("total")
        .eq("tenant_id", tid!)
        .in("status", ["confirmed", "processing", "shipped", "delivered"]);
      return (data ?? []).reduce((s, o) => s + Number(o.total), 0);
    },
  });

  const { data: openOpps } = useQuery({
    queryKey: ["dash-open-opps", tid],
    enabled: !!tid,
    queryFn: async () => {
      const { data } = await supabase
        .from("opportunities")
        .select("value, stage")
        .eq("tenant_id", tid!)
        .not("stage", "in", '("closed_won","closed_lost")');
      return {
        count: data?.length ?? 0,
        pipeline: (data ?? []).reduce((s, o) => s + Number(o.value), 0),
      };
    },
  });

  const { data: weeklyConvs } = useQuery({
    queryKey: ["dash-weekly", tid],
    enabled: !!tid,
    queryFn: async () => {
      const days = last7Days();
      const { data } = await supabase
        .from("conversations")
        .select("created_at")
        .eq("tenant_id", tid!)
        .gte("created_at", `${days[0]}T00:00:00`);

      const counts: Record<string, number> = {};
      days.forEach((d) => (counts[d] = 0));
      (data ?? []).forEach((c) => {
        const day = c.created_at.split("T")[0];
        if (counts[day] !== undefined) counts[day]++;
      });

      return days.map((d) => ({
        day: new Date(d + "T12:00:00").toLocaleDateString("pt-BR", {
          weekday: "short",
          day: "numeric",
        }),
        conversas: counts[d],
      }));
    },
  });

  const { data: contactFunnel } = useQuery({
    queryKey: ["dash-funnel", tid],
    enabled: !!tid,
    queryFn: async () => {
      const stages = ["lead", "qualified", "proposal", "negotiation", "won", "lost"];
      const { data } = await supabase
        .from("contacts")
        .select("stage")
        .eq("tenant_id", tid!);

      const counts: Record<string, number> = {};
      stages.forEach((s) => (counts[s] = 0));
      (data ?? []).forEach((c) => {
        if (counts[c.stage] !== undefined) counts[c.stage]++;
      });

      const labels: Record<string, string> = {
        lead: "Lead", qualified: "Qualificado", proposal: "Proposta",
        negotiation: "Negociação", won: "Ganho", lost: "Perdido",
      };
      return stages.map((s, i) => ({
        name: labels[s],
        value: counts[s],
        color: FUNNEL_COLORS[i],
      }));
    },
  });

  const { data: recentConvs } = useQuery({
    queryKey: ["dash-recent-convs", tid],
    enabled: !!tid,
    queryFn: async () => {
      const { data } = await supabase
        .from("conversations")
        .select("id, whatsapp_number, customer_name, status, updated_at")
        .eq("tenant_id", tid!)
        .order("updated_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const kpis = [
    {
      label: "Conversas hoje",
      value: convToday ?? 0,
      icon: MessageSquare,
      iconColor: "text-indigo-500",
      trend: "up" as const,
      deltaLabel: "vs ontem",
    },
    {
      label: "Total de contatos",
      value: contactCount ?? 0,
      icon: Users,
      iconColor: "text-violet-500",
    },
    {
      label: "Pipeline aberto",
      value: openOpps?.pipeline ?? 0,
      icon: TrendingUp,
      iconColor: "text-amber-500",
      format: "currency" as const,
    },
    {
      label: "Receita confirmada",
      value: orderRevenue ?? 0,
      icon: DollarSign,
      iconColor: "text-emerald-500",
      format: "currency" as const,
    },
    {
      label: "Conversas totais",
      value: convCount ?? 0,
      icon: Activity,
      iconColor: "text-blue-500",
    },
    {
      label: "Oportunidades abertas",
      value: openOpps?.count ?? 0,
      icon: ShoppingCart,
      iconColor: "text-orange-500",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Visão executiva do seu negócio"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Conversas — últimos 7 dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyConvs ?? []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="conversas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Funil de contatos</CardTitle>
          </CardHeader>
          <CardContent>
            {(contactFunnel ?? []).filter((s) => s.value > 0).length === 0 ? (
              <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                Sem dados
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={(contactFunnel ?? []).filter((s) => s.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {(contactFunnel ?? []).map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent conversations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Conversas recentes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(recentConvs ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma conversa ainda.
            </p>
          ) : (
            <ul className="divide-y">
              {(recentConvs ?? []).map((c) => (
                <li key={c.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm font-medium">
                      {c.customer_name ?? c.whatsapp_number}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(c.updated_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <StatusBadge type="conversation" value={c.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
