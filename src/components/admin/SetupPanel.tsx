import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

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
        <p className="text-muted-foreground">Configure a integração com WhatsApp via Twilio</p>
      </div>

      {/* Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status da Integração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Lovable Cloud</span>
            <Badge variant="default" className="gap-1">
              <CheckCircle className="h-3 w-3" /> Conectado
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Twilio</span>
            <Badge variant="default" className="gap-1">
              <CheckCircle className="h-3 w-3" /> Conectado
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">IA (Lovable AI)</span>
            <Badge variant="default" className="gap-1">
              <CheckCircle className="h-3 w-3" /> Ativo
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Webhook URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook URL</CardTitle>
          <CardDescription>
            Cole esta URL no painel do Twilio como webhook para mensagens WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input value={webhookUrl} readOnly className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={() => copy(webhookUrl)}>
              <Copy className="h-4 w-4" />
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
            <p className="font-medium text-foreground">2. Conectar seu WhatsApp ao Sandbox</p>
            <p>Envie a mensagem de ativação (ex: "join [código]") para o número do sandbox Twilio</p>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-foreground">3. Testar</p>
            <p>Envie uma mensagem como "quero montar um PC gamer até R$4000" e a IA irá responder com sugestões do catálogo!</p>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-foreground">4. Produção</p>
            <p>Para usar em produção, registre um número WhatsApp Business no Twilio e atualize o número "From" na edge function.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Need Button imported
import { Button } from "@/components/ui/button";

export default SetupPanel;
