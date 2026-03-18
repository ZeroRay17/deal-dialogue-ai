import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, MessageSquare, Settings, Cpu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import ProductsPanel from "@/components/admin/ProductsPanel";
import ConversationsPanel from "@/components/admin/ConversationsPanel";
import DashboardPanel from "@/components/admin/DashboardPanel";
import SetupPanel from "@/components/admin/SetupPanel";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Cpu className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">PC Builder Bot</h1>
            <p className="text-xs text-muted-foreground">Chatbot IA para WhatsApp</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground"
            onClick={() => supabase.auth.signOut()}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-7xl p-6">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard" className="gap-2">
              <Cpu className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="products" className="gap-2">
              <Package className="h-4 w-4" />
              Produtos
            </TabsTrigger>
            <TabsTrigger value="conversations" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Conversas
            </TabsTrigger>
            <TabsTrigger value="setup" className="gap-2">
              <Settings className="h-4 w-4" />
              Configuração
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <DashboardPanel />
          </TabsContent>
          <TabsContent value="products">
            <ProductsPanel />
          </TabsContent>
          <TabsContent value="conversations">
            <ConversationsPanel />
          </TabsContent>
          <TabsContent value="setup">
            <SetupPanel />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
