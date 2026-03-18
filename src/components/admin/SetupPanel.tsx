import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Copy, Trash2, Plus, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type TwilioAccount = {
  id: string;
  name: string;
  phone_number: string;
  api_key: string;
  is_active: boolean;
};

const SetupPanel = () => {
  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

  const [accounts, setAccounts] = useState<TwilioAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", phone_number: "", api_key: "" });
  const [saving, setSaving] = useState(false);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const fetchAccounts = async () => {
    const { data, error } = await supabase
      .from("twilio_accounts")
      .select("*")
      .order("created_at");
    if (error) toast.error("Erro ao carregar contas");
    else setAccounts(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAccounts(); }, []);

  const addAccount = async () => {
    if (!form.name || !form.phone_number || !form.api_key) {
      toast.error("Preencha todos os campos");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("twilio_accounts").insert({
      name: form.name,
      phone_number: form.phone_number,
      api_key: form.api_key,
    });
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar conta");
    } else {
      toast.success("Conta adicionada!");
      setForm({ name: "", phone_number: "", api_key: "" });
      fetchAccounts();
    }
  };

  const toggleAccount = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from("twilio_accounts")
      .update({ is_active: !current })
      .eq("id", id);
    if (error) toast.error("Erro ao atualizar");
    else fetchAccounts();
  };

  const deleteAccount = async (id: string) => {
    const { error } = await supabase.from("twilio_accounts").delete().eq("id", id);
    if (error) toast.error("Erro ao remover");
    else { toast.success("Conta removida"); fetchAccounts(); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Configuração</h2>
        <p className="text-muted-foreground">Configure a integração com WhatsApp via Twilio</p>
      </div>

      {/* Webhook URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook URL</CardTitle>
          <CardDescription>
            Cole esta URL no painel do Twilio como webhook para mensagens WhatsApp
          </CardDescription>
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

      {/* Twilio Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contas Twilio</CardTitle>
          <CardDescription>
            Gerencie múltiplas contas Twilio. O webhook roteia automaticamente pelo número de destino.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma conta configurada.</p>
          ) : (
            <div className="space-y-3">
              {accounts.map((acc) => (
                <div key={acc.id} className="flex items-center justify-between rounded-lg border p-3 gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{acc.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{acc.phone_number}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant={acc.is_active ? "default" : "secondary"}
                      className="cursor-pointer gap-1"
                      onClick={() => toggleAccount(acc.id, acc.is_active)}
                    >
                      {acc.is_active && <CheckCircle className="h-3 w-3" />}
                      {acc.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => deleteAccount(acc.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add account form */}
          <div className="space-y-3 border-t pt-4">
            <p className="text-sm font-medium">Adicionar conta</p>
            <div className="grid gap-2">
              <div>
                <Label className="text-xs">Nome</Label>
                <Input
                  placeholder="Ex: Conta Principal"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Número do Twilio</Label>
                <Input
                  placeholder="+14155238886"
                  value={form.phone_number}
                  onChange={(e) => setForm((f) => ({ ...f, phone_number: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">API Key (X-Connection-Api-Key)</Label>
                <Input
                  type="password"
                  placeholder="Sua Twilio API Key"
                  value={form.api_key}
                  onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
                />
              </div>
            </div>
            <Button onClick={addAccount} disabled={saving} className="w-full gap-2">
              <Plus className="h-4 w-4" />
              {saving ? "Salvando..." : "Adicionar Conta"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Passo a passo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <p className="font-medium text-foreground">1. Configurar Twilio Sandbox (teste)</p>
            <p>
              Acesse{" "}
              <a
                href="https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Twilio Console → WhatsApp Sandbox
              </a>
            </p>
            <p>Cole a URL do webhook acima no campo "WHEN A MESSAGE COMES IN"</p>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">2. Adicionar as contas acima</p>
            <p>Para cada conta Twilio, insira o número e a API Key correspondente. O webhook detecta automaticamente qual conta responde.</p>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">3. Testar</p>
            <p>Envie uma mensagem como "quero montar um PC gamer até R$4000" e a IA responderá com sugestões do catálogo!</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SetupPanel;
