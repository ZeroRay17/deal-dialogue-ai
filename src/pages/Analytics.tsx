import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import PageHeader from "@/components/shared/PageHeader";
import KpiCard from "@/components/shared/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, MessageSquare, DollarSign } from "lucide-react";

const last30Days = () =>
  Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return d.toISOString().split("T")[0];
  });

const last7Days = () =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split("T")[0];
  });

export default function Analytics() {
  const { tenant } = useTenant();
  const tid = tenant?.id;

  const { data: contactsByStage } = useQuery({
    queryKey: ["analytics-contacts-stage", tid],
    enabled: !!tid,
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("stage")
        .eq("tenant_id", tid!);

      const stageLabels: Record<string, string> = {
        lead: "Lead", qualified: "Qualificado", proposal: "Proposta",
        negotiation: "Negociação", won: "Ganho", lost: "Perdido", churned: "Churn",
      };
      const counts: Record<string, number> = {};
      Object.keys(stageLabels).forEach((s) => (counts[s] = 0));
      (data ?? []).forEach((c) => { if (counts[c.stage] !== undefined) counts[c.stage]++; });
      return Object.entries(stageLabels).map(([key, label]) => ({ label, value: counts[key] }));
    },
  });

  const { data: oppsByStage } = useQuery({
    queryKey: ["analytics-opps-stage", tid],
    enabled: !!tid,
    queryFn: async () => {
      const { data } = await supabase
        .from("opportunities")
        .select("stage, value")
        .eq("tenant_id", tid!);

      const stageLabels: Record<string, string> = {
        prospecting: "Prospecção", qualification: "Qualificação",
        proposal: "Proposta", negotiation: "Negociação",
        closed_won: "Ganho", closed_lost: "Perdido",
      };
      const counts: Record<string, number> = {};
      const values: Record<string, number> = {};
      Object.keys(stageLabels).forEach((s) => { counts[s] = 0; values[s] = 0; });
      (data ?? []).forEach((o) => {
        if (counts[o.stage] !== undefined) {
          counts[o.stage]++;
          values[o.stage] += Number(o.value);
        }
      });
      return Object.entries(stageLabels).map(([key, label]) => ({
        label, count: counts[key], value: values[key],
      }));
    },
  });

  const { data: weeklyConvs } = useQuery({
    queryKey: ["analytics-weekly-convs", tid],
    enabled: !!tid,
    queryFn: async () => {
      const days = last7Days();
      const { data } = await supabase
        .from("conversations")
        .select("created_at, status")
        .eq("tenant_id", tid!)
        .gte("created_at", `${days[0]}T00:00:00`);

      const counts: Record<string, { total: number; closed: number }> = {};
      days.forEach((d) => (counts[d] = { total: 0, closed: 0 }));
      (data ?? []).forEach((c) => {
        const day = c.created_at.split("T")[0];
        if (counts[day]) {
          counts[day].total++;
          if (c.status === "closed") counts[day].closed++;
        }
      });

      return days.map((d) => ({
        day: new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "numeric" }),
        total: counts[d].total,
        fechadas: counts[d].closed,
      }));
    },
  });

  const { data: revenueByOrigin } = useQuery({
    queryKey: ["analytics-revenue-origin", tid],
    enabled: !!tid,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("origin, total, status")
        .eq("tenant_id", tid!)
        .in("status", ["confirmed", "processing", "shipped", "delivered"]);

      const origins: Record<string, number> = {};
      (data ?? []).forEach((o) => {
        origins[o.origin] = (origins[o.origin] ?? 0) + Number(o.total);
      });
      return Object.entries(origins).map(([origin, total]) => ({ origin, total }));
    },
  });

  const { data: topProducts } = useQuery({
    queryKey: ["analytics-top-products", tid],
    enabled: !!tid,
    queryFn: async () => {
      const { data } = await supabase
        .from("order_items")
        .select("product_name, quantity, total")
        .order("total", { ascending: false })
        .limit(10);

      const byProduct: Record<string, { qty: number; revenue: number }> = {};
      (data ?? []).forEach((item) => {
        if (!byProduct[item.product_name]) byProduct[item.product_name] = { qty: 0, revenue: 0 };
        byProduct[item.product_name].qty += item.quantity;
        byProduct[item.product_name].revenue += Number(item.total);
      });
      return Object.entries(byProduct)
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, 5)
        .map(([name, stats]) => ({ name, ...stats }));
    },
  });

  const { data: summary } = useQuery({
    queryKey: ["analytics-summary", tid],
    enabled: !!tid,
    queryFn: async () => {
      const [
        { count: totalContacts },
        { count: totalConvs },
        { data: oppData },
        { data: orderData },
      ] = await Promise.all([
        supabase.from("contacts").select("*", { count: "exact", head: true }).eq("tenant_id", tid!),
        supabase.from("conversations").select("*", { count: "exact", head: true }).eq("tenant_id", tid!),
        supabase.from("opportunities").select("value, stage").eq("tenant_id", tid!),
        supabase.from("orders").select("total, status").eq("tenant_id", tid!).in("status", ["confirmed", "processing", "shipped", "delivered"]),
      ]);

      const wonOpps = (oppData ?? []).filter((o) => o.stage === "closed_won");
      const allOpps = (oppData ?? []).filter((o) => ["closed_won", "closed_lost"].includes(o.stage));
      const winRate = allOpps.length > 0 ? (wonOpps.length / allOpps.length) * 100 : 0;
      const revenue = (orderData ?? []).reduce((s, o) => s + Number(o.total), 0);

      return { totalContacts, totalConvs, winRate, revenue };
    },
  });

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Métricas de desempenho comercial e operacional"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Total de contatos"
          value={summary?.totalContacts ?? 0}
          icon={Users}
          iconColor="text-violet-500"
        />
        <KpiCard
          label="Conversas totais"
          value={summary?.totalConvs ?? 0}
          icon={MessageSquare}
          iconColor="text-blue-500"
        />
        <KpiCard
          label="Taxa de fechamento"
          value={summary?.winRate ?? 0}
          format="percent"
          icon={TrendingUp}
          iconColor="text-amber-500"
          trend={
            (summary?.winRate ?? 0) > 30 ? "up" : (summary?.winRate ?? 0) > 10 ? "neutral" : "down"
          }
        />
        <KpiCard
          label="Receita total"
          value={summary?.revenue ?? 0}
          format="currency"
          icon={DollarSign}
          iconColor="text-emerald-500"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Contacts by stage */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Contatos por estágio</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={contactsByStage ?? []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Weekly conversations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Conversas — últimos 7 dias</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={weeklyConvs ?? []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" dot={false} />
                <Line type="monotone" dataKey="fechadas" stroke="#10b981" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pipeline by stage */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Pipeline por estágio (R$)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={oppsByStage ?? []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => fmt(Number(v))} />
                <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Valor" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue by origin */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Receita por canal</CardTitle>
          </CardHeader>
          <CardContent>
            {(revenueByOrigin ?? []).length === 0 ? (
              <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                Sem dados de receita ainda.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={revenueByOrigin ?? []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="origin" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => fmt(Number(v))} />
                  <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} name="Receita" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top products */}
      {(topProducts ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Top produtos por receita</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Qtd vendida</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(topProducts ?? []).map((p, i) => (
                  <TableRow key={p.name}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="w-6 text-center text-xs">
                          {i + 1}
                        </Badge>
                        <span className="text-sm font-medium">{p.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm">{p.qty}</TableCell>
                    <TableCell className="text-right text-sm font-semibold">
                      {fmt(p.revenue)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
