import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Filter, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import type { Contact, ContactStage } from "@/types/domain";

const STAGES: { value: ContactStage; label: string }[] = [
  { value: "lead", label: "Lead" },
  { value: "qualified", label: "Qualificado" },
  { value: "proposal", label: "Proposta" },
  { value: "negotiation", label: "Negociação" },
  { value: "won", label: "Ganho" },
  { value: "lost", label: "Perdido" },
  { value: "churned", label: "Churn" },
];

const SOURCES = ["manual", "whatsapp", "web", "referral", "campaign", "import"];

type FormData = {
  name: string;
  email: string;
  phone: string;
  whatsapp_number: string;
  company_name: string;
  stage: ContactStage;
  source: string;
  notes: string;
};

const emptyForm = (): FormData => ({
  name: "",
  email: "",
  phone: "",
  whatsapp_number: "",
  company_name: "",
  stage: "lead",
  source: "manual",
  notes: "",
});

export default function Contacts() {
  const { tenant } = useTenant();
  const qc = useQueryClient();
  const tid = tenant?.id;

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm());

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["contacts", tid, stageFilter],
    enabled: !!tid,
    queryFn: async () => {
      let q = supabase
        .from("contacts")
        .select("*")
        .eq("tenant_id", tid!)
        .order("created_at", { ascending: false });
      if (stageFilter !== "all") q = q.eq("stage", stageFilter);
      const { data } = await q;
      return (data ?? []) as Contact[];
    },
  });

  const filtered = (contacts ?? []).filter((c) =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.whatsapp_number?.includes(search) ||
    c.company_name?.toLowerCase().includes(search.toLowerCase())
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tid) throw new Error("No tenant");
      const payload = {
        tenant_id: tid,
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        whatsapp_number: form.whatsapp_number || null,
        company_name: form.company_name || null,
        stage: form.stage,
        source: form.source,
        notes: form.notes || null,
      };
      if (editId) {
        const { error } = await supabase.from("contacts").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contacts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts", tid] });
      setOpen(false);
      resetForm();
      toast.success(editId ? "Contato atualizado!" : "Contato criado!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts", tid] });
      toast.success("Contato removido.");
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: ContactStage }) => {
      const { error } = await supabase.from("contacts").update({ stage }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts", tid] }),
  });

  const resetForm = () => { setForm(emptyForm()); setEditId(null); };

  const openEdit = (c: Contact) => {
    setForm({
      name: c.name,
      email: c.email ?? "",
      phone: c.phone ?? "",
      whatsapp_number: c.whatsapp_number ?? "",
      company_name: c.company_name ?? "",
      stage: c.stage,
      source: c.source,
      notes: c.notes ?? "",
    });
    setEditId(c.id);
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contatos / CRM"
        description="Gerencie seus leads e clientes"
        actions={
          <Button
            className="gap-2"
            onClick={() => { resetForm(); setOpen(true); }}
          >
            <Plus className="h-4 w-4" /> Novo contato
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email, telefone..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-44">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Estágio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {STAGES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-xs">
          {filtered.length} contato{filtered.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum contato encontrado"
              description="Adicione seu primeiro contato ou ajuste os filtros."
              action={
                <Button onClick={() => { resetForm(); setOpen(true); }}>
                  <Plus className="mr-2 h-4 w-4" /> Novo contato
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Estágio</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{c.name}</p>
                        {c.email && (
                          <p className="text-xs text-muted-foreground">{c.email}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{c.company_name ?? "—"}</TableCell>
                    <TableCell className="text-sm font-mono">
                      {c.whatsapp_number ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={c.stage}
                        onValueChange={(val) =>
                          updateStageMutation.mutate({ id: c.id, stage: val as ContactStage })
                        }
                      >
                        <SelectTrigger className="h-7 w-36 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STAGES.map((s) => (
                            <SelectItem key={s.value} value={s.value} className="text-xs">
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {c.lead_score}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => deleteMutation.mutate(c.id)}
                        >
                          Excluir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit dialog */}
      <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); setOpen(o); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar contato" : "Novo contato"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Nome *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="João Silva"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Empresa</Label>
                <Input
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                  placeholder="ACME Ltda"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="joao@email.com"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>WhatsApp</Label>
                <Input
                  value={form.whatsapp_number}
                  onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })}
                  placeholder="5511999999999"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Estágio</Label>
                <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v as ContactStage })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Origem</Label>
                <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Observações</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Anotações internas..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.name || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
