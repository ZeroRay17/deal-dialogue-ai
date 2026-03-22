import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const VERIFY_TOKEN = "pcbuilder_verify";

const SetupPanel = () => {
  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Configuração</h2>
        <p className="text-muted-foreground">Configure a integração com WhatsApp via Meta Cloud API</p>
      </div>

      {/* Webhook URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook URL</CardTitle>
          <CardDescription>Cole esta URL no painel do Meta para receber mensagens</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input value={webhookUrl} readOnly className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={() => copy(webhookUrl)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Verify Token (use este valor no Meta)</p>
            <div className="flex gap-2">
              <Input value={VERIFY_TOKEN} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => copy(VERIFY_TOKEN)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Secrets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Secrets no Supabase</CardTitle>
          <CardDescription>
            Configure estes secrets em{" "}
            <a
              href="https://supabase.com/dashboard/project/njvgtjovguunpotragaf/settings/functions"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary underline"
            >
              Supabase → Settings → Edge Functions <ExternalLink className="h-3 w-3" />
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {[
              { key: "META_ACCESS_TOKEN", desc: "Token permanente do System User (Meta Business Suite)" },
              { key: "META_PHONE_NUMBER_ID", desc: "ID do número de telefone (Meta for Developers → WhatsApp → API Setup)" },
              { key: "META_VERIFY_TOKEN", desc: `Valor fixo: ${VERIFY_TOKEN}` },
              { key: "OPENAI_API_KEY", desc: "Chave da OpenAI para o chatbot" },
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

      {/* Step by step */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Passo a passo — Meta Cloud API</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 text-sm text-muted-foreground">
          <div className="space-y-2">
            <p className="font-medium text-foreground">1. Criar conta no Meta for Developers</p>
            <p>
              Acesse{" "}
              <a
                href="https://developers.facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary underline"
              >
                developers.facebook.com <ExternalLink className="h-3 w-3" />
              </a>{" "}
              e crie um App do tipo <strong>Business</strong>.
            </p>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-foreground">2. Adicionar o produto WhatsApp</p>
            <p>No painel do App, clique em <strong>"Add Product"</strong> e selecione <strong>WhatsApp</strong>. Você vai precisar de uma conta Meta Business verificada.</p>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-foreground">3. Pegar o Phone Number ID e Token</p>
            <p>
              Em <strong>WhatsApp → API Setup</strong>, copie o <strong>Phone number ID</strong> e gere um token de acesso permanente via System User no Meta Business Suite.
            </p>
            <a
              href="https://developers.facebook.com/docs/whatsapp/business-management-api/get-started"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary underline text-xs"
            >
              Documentação oficial <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-foreground">4. Configurar o webhook no Meta</p>
            <p>
              Em <strong>WhatsApp → Configuration → Webhook</strong>, cole a <strong>Webhook URL</strong> e o <strong>Verify Token</strong> acima. Assine o campo <strong>messages</strong>.
            </p>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-foreground">5. Adicionar os secrets no Supabase</p>
            <p>Cole os valores de <strong>META_ACCESS_TOKEN</strong>, <strong>META_PHONE_NUMBER_ID</strong> e <strong>META_VERIFY_TOKEN</strong> nas configurações de Edge Functions do Supabase acima.</p>
          </div>

          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">
            <p className="font-medium">Custo: praticamente zero</p>
            <p className="mt-1 text-xs">
              Conversas iniciadas pelo cliente (Service) são <strong>gratuitas</strong> até 1.000/mês. Sem taxa por mensagem do intermediário — você paga só o OpenAI (~$0,001/conversa).
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SetupPanel;
