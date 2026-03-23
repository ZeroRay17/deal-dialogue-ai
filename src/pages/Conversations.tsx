import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, User, Bot, Send, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { Conversation, Message } from "@/types/domain";

export default function Conversations() {
  const { tenant } = useTenant();
  const qc = useQueryClient();
  const tid = tenant?.id;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: conversations } = useQuery({
    queryKey: ["conversations", tid],
    enabled: !!tid,
    queryFn: async () => {
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .or(`tenant_id.eq.${tid},tenant_id.is.null`)
        .order("updated_at", { ascending: false });
      return (data ?? []) as Conversation[];
    },
    refetchInterval: 10_000,
  });

  const { data: messages } = useQuery({
    queryKey: ["messages", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", selectedId!)
        .order("created_at");
      return (data ?? []) as Message[];
    },
    refetchInterval: 5_000,
  });

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
      qc.invalidateQueries({ queryKey: ["messages", selectedId] });
    } catch {
      toast.error("Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  const closeConversation = async (id: string) => {
    const { error } = await supabase
      .from("conversations")
      .update({ status: "closed" })
      .eq("id", id);
    if (!error) {
      qc.invalidateQueries({ queryKey: ["conversations", tid] });
      toast.success("Conversa fechada.");
    }
  };

  const filtered = (conversations ?? []).filter(
    (c) =>
      !search ||
      c.whatsapp_number.includes(search) ||
      (c.customer_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const selected = (conversations ?? []).find((c) => c.id === selectedId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conversas"
        description="Acompanhe e responda conversas do WhatsApp"
      />

      <div className="grid gap-4 lg:grid-cols-3" style={{ height: "calc(100vh - 200px)", minHeight: 500 }}>
        {/* List */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2 shrink-0">
            <CardTitle className="text-sm">Conversas recentes</CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8 text-xs"
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full">
              {filtered.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title="Sem conversas"
                  description="Nenhuma conversa encontrada."
                  className="py-10"
                />
              ) : (
                filtered.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedId(conv.id)}
                    className={`w-full border-b p-3 text-left transition-colors hover:bg-muted ${
                      selectedId === conv.id ? "bg-accent" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {conv.customer_name ?? conv.whatsapp_number}
                      </span>
                      <StatusBadge type="conversation" value={conv.status} />
                    </div>
                    <div className="mt-0.5 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-mono">
                        {conv.whatsapp_number}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(conv.updated_at).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat */}
        <Card className="flex flex-col lg:col-span-2">
          <CardHeader className="pb-2 shrink-0 border-b">
            {selected ? (
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">
                    {selected.customer_name ?? selected.whatsapp_number}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground font-mono">
                    {selected.whatsapp_number}
                  </p>
                </div>
                {selected.status !== "closed" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => closeConversation(selected.id)}
                  >
                    Fechar conversa
                  </Button>
                )}
              </div>
            ) : (
              <CardTitle className="text-sm text-muted-foreground">
                Selecione uma conversa
              </CardTitle>
            )}
          </CardHeader>

          <CardContent className="flex flex-1 flex-col p-0 overflow-hidden">
            <ScrollArea className="flex-1 p-4">
              {!selectedId ? (
                <EmptyState
                  icon={MessageSquare}
                  title="Nenhuma conversa selecionada"
                  description="Clique em uma conversa para ver as mensagens."
                  className="h-full py-20"
                />
              ) : (messages ?? []).length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-10">
                  Sem mensagens nesta conversa.
                </p>
              ) : (
                <div className="space-y-3">
                  {(messages ?? []).map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-2 ${msg.role === "assistant" || msg.role === "agent" ? "" : "flex-row-reverse"}`}
                    >
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                          msg.role === "assistant" || msg.role === "agent"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        {msg.role === "assistant" || msg.role === "agent" ? (
                          <Bot className="h-4 w-4" />
                        ) : (
                          <User className="h-4 w-4" />
                        )}
                      </div>
                      <div
                        className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                          msg.role === "assistant" || msg.role === "agent"
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

            {selectedId && selected?.status !== "closed" && (
              <div className="shrink-0 border-t p-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Digite uma mensagem..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    disabled={sending}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={sending || !input.trim()}
                    size="icon"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Enter para enviar · via WhatsApp
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
