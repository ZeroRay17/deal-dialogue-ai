import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, MessageSquare, Users, TrendingUp } from "lucide-react";

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

  const { data: messageCount } = useQuery({
    queryKey: ["message-count"],
    queryFn: async () => {
      const { count } = await supabase.from("messages").select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  const stats = [
    { label: "Produtos", value: productCount ?? 0, icon: Package, color: "text-primary" },
    { label: "Conversas", value: conversationCount ?? 0, icon: Users, color: "text-accent-foreground" },
    { label: "Ativas", value: activeConversations ?? 0, icon: TrendingUp, color: "text-success" },
    { label: "Mensagens", value: messageCount ?? 0, icon: MessageSquare, color: "text-muted-foreground" },
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
          <CardTitle>Como funciona</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>1. 📦 Cadastre seus produtos na aba <strong>Produtos</strong></p>
          <p>2. ⚙️ Configure o webhook do Twilio na aba <strong>Configuração</strong></p>
          <p>3. 💬 Os clientes enviam mensagens no WhatsApp</p>
          <p>4. 🤖 A IA analisa o pedido e sugere uma configuração do catálogo</p>
          <p>5. 🛒 O cliente recebe a sugestão com preços e link do carrinho</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardPanel;
