import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, MessageSquare, Users, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const todayStr = () => new Date().toISOString().split("T")[0];

const last7Days = () =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split("T")[0];
  });

const DashboardPanel = () => {
  const { data: productCount } = useQuery({
    queryKey: ["product-count"],
    queryFn: async () => {
      const { count } = await supabase.from("products").select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: conversationCount } = useQuery({
    queryKey: ["conversation-count"],
    queryFn: async () => {
      const { count } = await supabase.from("conversations").select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: activeConversations } = useQuery({
    queryKey: ["active-conversations"],
    queryFn: async () => {
      const { count } = await supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");
      return count || 0;
    },
  });

  const { data: todayConversations } = useQuery({
    queryKey: ["today-conversations"],
    queryFn: async () => {
      const { count } = await supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .gte("created_at", `${todayStr()}T00:00:00`);
      return count || 0;
    },
  });

  const { data: todayMessages } = useQuery({
    queryKey: ["today-messages"],
    queryFn: async () => {
      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .gte("created_at", `${todayStr()}T00:00:00`);
      return count || 0;
    },
  });

  const { data: weeklyData } = useQuery({
    queryKey: ["weekly-conversations"],
    queryFn: async () => {
      const days = last7Days();
      const { data } = await supabase
        .from("conversations")
        .select("created_at")
        .gte("created_at", `${days[0]}T00:00:00`);

      const counts: Record<string, number> = {};
      days.forEach((d) => (counts[d] = 0));
      (data || []).forEach((c) => {
        const day = c.created_at.split("T")[0];
        if (counts[day] !== undefined) counts[day]++;
      });

      return days.map((d) => ({
        day: new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "numeric" }),
        conversas: counts[d],
      }));
    },
  });

  const stats = [
    { label: "Conversas hoje", value: todayConversations ?? 0, icon: TrendingUp, color: "text-primary" },
    { label: "Mensagens hoje", value: todayMessages ?? 0, icon: MessageSquare, color: "text-blue-500" },
    { label: "Conversas ativas", value: activeConversations ?? 0, icon: Users, color: "text-green-500" },
    { label: "Produtos", value: productCount ?? 0, icon: Package, color: "text-orange-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
        <p className="text-muted-foreground">Visão geral do seu chatbot</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversas — últimos 7 dias</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeklyData || []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="conversas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Totais gerais</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground">Total de conversas</p>
            <p className="text-2xl font-bold">{conversationCount}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Produtos no catálogo</p>
            <p className="text-2xl font-bold">{productCount}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Conversas ativas</p>
            <p className="text-2xl font-bold">{activeConversations}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardPanel;
