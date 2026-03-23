import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import { toast } from "sonner";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);
}

export default function Onboarding() {
  const { user } = useAuth();
  const { refetch } = useTenant();

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) return;
    setLoading(true);

    try {
      const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;

      // Generate the UUID client-side so we never need to SELECT the row back.
      // Using .select() after .insert() triggers PostgREST's RLS check on the
      // SELECT policy — which fails because the user isn't in tenant_users yet.
      const tenantId = crypto.randomUUID();

      // 1. Create tenant (no .select() — avoids the RLS SELECT check)
      const { error: tenantErr } = await supabase
        .from("tenants")
        .insert({ id: tenantId, name: name.trim(), slug });

      if (tenantErr) throw tenantErr;

      // 2. Add user as tenant_owner
      const { error: memberErr } = await supabase.from("tenant_users").insert({
        tenant_id: tenantId,
        user_id: user.id,
        role: "tenant_owner",
      });

      if (memberErr) throw memberErr;

      await refetch();
      toast.success("Workspace criado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao criar workspace: " + err?.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
            <Zap className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Bem-vindo ao CommercePilot</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie seu workspace para começar.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Criar workspace</CardTitle>
            <CardDescription>
              O workspace reúne sua equipe, clientes, conversas e catálogo em um só lugar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome da empresa ou projeto</Label>
                <Input
                  id="name"
                  placeholder="Ex: Loja do João"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !name.trim()}>
                {loading ? "Criando workspace..." : "Criar workspace"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Logado como <strong>{user?.email}</strong>
        </p>
      </div>
    </div>
  );
}
