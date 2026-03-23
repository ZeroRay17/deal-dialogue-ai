import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Copy, Settings2, Zap, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import type { Channel, ChannelType } from "@/types/domain";

const CHANNEL_TYPES: { value: ChannelType; label: string }[] = [
  { value: "whatsapp_meta", label: "WhatsApp (Meta Cloud API)" },
  { value: "whatsapp_twilio", label: "WhatsApp (Twilio)" },
  { value: "email", label: "Email" },
  { value: "web", label: "Web Chat" },
];

type ChannelForm = {
  name: string;
  type: ChannelType;
  phone_number_id: string;
  access_token: string;
  verify_token: string;
  is_active: boolean;
};

const emptyChannelForm = (): ChannelForm => ({
  name: "",
  type: "whatsapp_meta",
  phone_number_id: "",
  access_token: "",
  verify_token: "saas_verify",
  is_active: true,
});

export default function Settings() {
  const { tenant, refetch: refetchTenant } = useTenant();
  const qc = useQueryClient();
  const tid = tenant?.id;

  const [tenantName, setTenantName] = useState(tenant?.name ?? "");
  const [aiPrompt, setAiPrompt] = useState(tenant?.ai_system_prompt ?? "");
  const [savingTenant, setSavingTenant] = useState(false);

  const [channelOpen, setChannelOpen] = useState(false);
  const [editChannelId, setEditChannelId] = useState<string | null>(null);
  const [channelForm, setChannelForm] = useState<ChannelForm>(emptyChannelForm());
  const [showToken, setShowToken] = useState(false);

  const { data: channels } = useQuery({
    queryKey: ["channels", tid],
    enabled: !!tid,
    queryFn: async () => {
      const { data } = await supabase
        .from("channels")
        .select("*")
        .eq("tenant_id", tid!)
        .order("created_at");
      return (data ?? []) as Channel[];
    },
  });

  const saveTenantMutation = async () => {
    if (!tid) return;
    setSavingTenant(true);
    const { error } = await supabase
      .from("tenants")
      .update({ name: tenantName, ai_system_prompt: aiPrompt || null })
      .eq("id", tid);
    setSavingTenant(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      await refetchTenant();
      toast.success("Configurações salvas!");
    }
  };

  const saveChannelMutation = useMutation({
    mutationFn: async () => {
      if (!tid) throw new Error("No tenant");
      const config: Record<string, string> = {};
      if (channelForm.phone_number_id) config.phone_number_id = channelForm.phone_number_id;
      if (channelForm.access_token) config.access_token = channelForm.access_token;
      if (channelForm.verify_token) config.verify_token = channelForm.verify_token;

      const payload = {
        tenant_id: tid,
        name: channelForm.name,
        type: channelForm.type,
        config,
        is_active: channelForm.is_active,
      };

      if (editChannelId) {
        const { error } = await supabase.from("channels").update(payload).eq("id", editChannelId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("channels").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["channels", tid] });
      setChannelOpen(false);
      resetChannelForm();
      toast.success(editChannelId ? "Canal atualizado!" : "Canal criado!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const toggleChannelMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("channels").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["channels", tid] }),
  });

  const deleteChannelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("channels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["channels", tid] });
      toast.success("Canal removido.");
    },
  });

  const resetChannelForm = () => { setChannelForm(emptyChannelForm()); setEditChannelId(null); };

  const openEditChannel = (c: Channel) => {
    setChannelForm({
      name: c.name,
      type: c.type,
      phone_number_id: (c.config as any).phone_number_id ?? "",
      access_token: (c.config as any).access_token ?? "",
      verify_token: (c.config as any).verify_token ?? "saas_verify",
      is_active: c.is_active,
    });
    setEditChannelId(c.id);
    setChannelOpen(true);
  };

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        description="Gerencie seu workspace e integrações"
      />

      <Tabs defaultValue="workspace">
        <TabsList>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="channels">Canais</TabsTrigger>
          <TabsTrigger value="ai">IA</TabsTrigger>
        </TabsList>

        {/* Workspace */}
        <TabsContent value="workspace" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informações do workspace</CardTitle>
              <CardDescription>Configure o nome e plano do seu workspace.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-1.5">
                <Label>Nome do workspace</Label>
                <Input
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  placeholder="Minha Empresa"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>Plano atual</Label>
                  <div className="flex items-center gap-2 h-10">
                    <Badge variant="outline" className="capitalize text-sm">
                      {tenant?.plan ?? "starter"}
                    </Badge>
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label>Workspace ID</Label>
                  <div className="flex items-center gap-2">
                    <Input value={tenant?.id ?? ""} readOnly className="font-mono text-xs" />
                    <Button variant="outline" size="icon" onClick={() => copy(tenant?.id ?? "")}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <Button onClick={saveTenantMutation} disabled={savingTenant || !tenantName.trim()}>
                {savingTenant ? "Salvando..." : "Salvar"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Channels */}
        <TabsContent value="channels" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Canais de atendimento</p>
              <p className="text-sm text-muted-foreground">
                Configure as integrações WhatsApp e outros canais.
              </p>
            </div>
            <Button
              className="gap-2"
              onClick={() => { resetChannelForm(); setChannelOpen(true); }}
            >
              <Plus className="h-4 w-4" /> Novo canal
            </Button>
          </div>

          {/* Webhook info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Webhook URL</CardTitle>
              <CardDescription>Use este URL no painel do Meta Cloud API ou Twilio.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input value={webhookUrl} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => copy(webhookUrl)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Channel list */}
          {(channels ?? []).length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Nenhum canal configurado. Adicione seu primeiro canal.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {(channels ?? []).map((ch) => (
                <Card key={ch.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                        <Zap className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{ch.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {CHANNEL_TYPES.find((t) => t.value === ch.type)?.label ?? ch.type}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={ch.is_active}
                        onCheckedChange={(v) =>
                          toggleChannelMutation.mutate({ id: ch.id, is_active: v })
                        }
                      />
                      <Button variant="ghost" size="sm" onClick={() => openEditChannel(ch)}>
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => deleteChannelMutation.mutate(ch.id)}
                      >
                        Excluir
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* AI */}
        <TabsContent value="ai" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Prompt do assistente de IA</CardTitle>
              <CardDescription>
                Personalize como o assistente responde no WhatsApp. Se vazio, usa o prompt padrão.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder={`Você é um assistente de vendas da empresa ${tenant?.name ?? "nossa empresa"}. Seu papel é...`}
                rows={8}
                className="font-mono text-sm"
              />
              <Button onClick={saveTenantMutation} disabled={savingTenant}>
                {savingTenant ? "Salvando..." : "Salvar prompt"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Secrets necessários</CardTitle>
              <CardDescription>
                Configure estes secrets em Supabase → Settings → Edge Functions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {[
                  { key: "OPENAI_API_KEY", desc: "Chave da OpenAI para o chatbot IA" },
                  { key: "META_ACCESS_TOKEN", desc: "Token permanente do System User (Meta)" },
                  { key: "META_PHONE_NUMBER_ID", desc: "ID do número de telefone no Meta" },
                  { key: "META_VERIFY_TOKEN", desc: "Token de verificação do webhook" },
                ].map(({ key, desc }) => (
                  <div key={key} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <code className="text-xs font-bold">{key}</code>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copy(key)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Channel dialog */}
      <Dialog open={channelOpen} onOpenChange={(o) => { if (!o) resetChannelForm(); setChannelOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editChannelId ? "Editar canal" : "Novo canal"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Nome do canal</Label>
              <Input
                value={channelForm.name}
                onChange={(e) => setChannelForm({ ...channelForm, name: e.target.value })}
                placeholder="Ex: WhatsApp Principal"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Tipo</Label>
              <Select
                value={channelForm.type}
                onValueChange={(v) => setChannelForm({ ...channelForm, type: v as ChannelType })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANNEL_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {channelForm.type === "whatsapp_meta" && (
              <>
                <div className="grid gap-1.5">
                  <Label>Phone Number ID</Label>
                  <Input
                    value={channelForm.phone_number_id}
                    onChange={(e) => setChannelForm({ ...channelForm, phone_number_id: e.target.value })}
                    placeholder="123456789"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Access Token</Label>
                  <div className="flex gap-2">
                    <Input
                      type={showToken ? "text" : "password"}
                      value={channelForm.access_token}
                      onChange={(e) => setChannelForm({ ...channelForm, access_token: e.target.value })}
                      placeholder="EAAxxxxx..."
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowToken(!showToken)}
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label>Verify Token</Label>
                  <Input
                    value={channelForm.verify_token}
                    onChange={(e) => setChannelForm({ ...channelForm, verify_token: e.target.value })}
                  />
                </div>
              </>
            )}
            <div className="flex items-center gap-2">
              <Switch
                checked={channelForm.is_active}
                onCheckedChange={(v) => setChannelForm({ ...channelForm, is_active: v })}
              />
              <Label>Canal ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setChannelOpen(false); resetChannelForm(); }}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveChannelMutation.mutate()}
              disabled={!channelForm.name || saveChannelMutation.isPending}
            >
              {saveChannelMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
