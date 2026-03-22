import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageSquare, User, Bot, Send } from "lucide-react";
import { toast } from "sonner";

const ConversationsPanel = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: conversations } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .order("updated_at", { ascending: false });
      return data || [];
    },
    refetchInterval: 10000,
  });

  const { data: messages } = useQuery({
    queryKey: ["messages", selectedId],
    queryFn: async () => {
      if (!selectedId) return [];
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", selectedId)
        .order("created_at");
      return data || [];
    },
    enabled: !!selectedId,
    refetchInterval: 5000,
  });

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !selectedId || sending) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-whatsapp", {
        body: { conversation_id: selectedId, message: input.trim() },
      });
      if (error) throw error;
      setInput("");
      queryClient.invalidateQueries({ queryKey: ["messages", selectedId] });
    } catch (e) {
      toast.error("Erro ao enviar mensagem");
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Conversas</h2>
        <p className="text-muted-foreground">Acompanhe as conversas do WhatsApp</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Lista de conversas */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Conversas Recentes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[560px]">
              {conversations?.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  Nenhuma conversa ainda. As conversas aparecerão aqui quando clientes enviarem mensagens no WhatsApp.
                </p>
              ) : (
                conversations?.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedId(conv.id)}
                    className={`w-full border-b p-4 text-left transition-colors hover:bg-muted ${
                      selectedId === conv.id ? "bg-accent" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{conv.whatsapp_number}</span>
                      <Badge variant={conv.status === "active" ? "default" : "secondary"}>
                        {conv.status === "active" ? "Ativa" : "Fechada"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(conv.updated_at).toLocaleString("pt-BR")}
                    </p>
                  </button>
                ))
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat view */}
        <Card className="flex flex-col lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              {selectedId
                ? conversations?.find((c) => c.id === selectedId)?.whatsapp_number ?? "Mensagens"
                : "Selecione uma conversa"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col p-0">
            <ScrollArea className="h-[460px] p-4">
              {!selectedId ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <MessageSquare className="mx-auto mb-2 h-10 w-10 opacity-30" />
                    <p className="text-sm">Selecione uma conversa para ver as mensagens</p>
                  </div>
                </div>
              ) : messages?.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">Sem mensagens</p>
              ) : (
                <div className="space-y-3">
                  {messages?.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-2 ${msg.role === "assistant" ? "" : "flex-row-reverse"}`}
                    >
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                          msg.role === "assistant" ? "bg-primary text-primary-foreground" : "bg-muted"
                        }`}
                      >
                        {msg.role === "assistant" ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                      </div>
                      <div
                        className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                          msg.role === "assistant"
                            ? "bg-muted text-foreground"
                            : "bg-primary text-primary-foreground"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        <p className="mt-1 text-[10px] opacity-60">
                          {new Date(msg.created_at).toLocaleTimeString("pt-BR")}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input area */}
            {selectedId && (
              <div className="border-t p-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Digite uma mensagem..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={sending}
                    className="flex-1"
                  />
                  <Button onClick={handleSend} disabled={sending || !input.trim()} size="icon">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">Enter para enviar • a mensagem será enviada via WhatsApp</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ConversationsPanel;
