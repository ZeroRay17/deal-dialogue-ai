import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { Opportunity, OpportunityStage } from "@/types/domain";

const STAGES: { value: OpportunityStage; label: string; color: string }[] = [
  { value: "prospecting",   label: "Prospecção",   color: "bg-blue-50 border-blue-200" },
  { value: "qualification", label: "Qualificação",  color: "bg-violet-50 border-violet-200" },
  { value: "proposal",      label: "Proposta",      color: "bg-amber-50 border-amber-200" },
  { value: "negotiation",   label: "Negociação",    color: "bg-orange-50 border-orange-200" },
  { value: "closed_won",    label: "Ganho",         color: "bg-emerald-50 border-emerald-200" },
  { value: "closed_lost",   label: "Perdido",       color: "bg-rose-50 border-rose-200" },
];

type FormData = {
  title: string;
  value: string;
  stage: OpportunityStage;
  probability: string;
  expected_close_date: string;
  notes: string;
};

const emptyForm = (): FormData => ({
  title: "",
  value: "",
  stage: "prospecting",
  probability: "10",
  expected_close_date: "",
  notes: "",
});

export default function Pipeline() {
  const { tenant } = useTenant();
  const qc = useQueryClient();
  const tid = tenant?.id;

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm());

  const { data: opportunities, isLoading } = useQuery({
    queryKey: ["opportunities", tid],
    enabled: !!tid,
    queryFn: async () => {
      const { data } = await supabase
        .from("opportunities")
        .select("*")
        .eq("tenant_id", tid!)
        .order("created_at", { ascending: false });
      return (data ?? []) as Opportunity[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tid) throw new Error("No tenant");
      const payload = {
        tenant_id: tid,
        title: form.title,
        value: parseFloat(form.value) || 0,
        stage: form.stage,
        probability: parseInt(form.probability) || 0,
        expected_close_date: form.expected_close_date || null,
        notes: form.notes || null,
      };
      if (editId) {
        const { error } = await supabase.from("opportunities").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("opportunities").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunities", tid] });
      setOpen(false);
      resetForm();
      toast.success(editId ? "Oportunidade atualizada!" : "Oportunidade criada!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: OpportunityStage }) => {
      const { error } = await supabase.from("opportunities").update({ stage }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["opportunities", tid] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("opportunities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunities", tid] });
      toast.success("Oportunidade removida.");
    },
  });

  const resetForm = () => { setForm(emptyForm()); setEditId(null); };

  const openEdit = (o: Opportunity) => {
    setForm({
      title: o.title,
      value: String(o.value),
      stage: o.stage,
      probability: String(o.probability),
      expected_close_date: o.expected_close_date ?? "",
      notes: o.notes ?? "",
    });
    setEditId(o.id);
    setOpen(true);
  };

  const byStage = (stage: OpportunityStage) =>
    (opportunities ?? []).filter((o) => o.stage === stage);

  const pipelineTotal = (opportunities ?? [])
    .filter((o) => !["closed_won", "closed_lost"].includes(o.stage))
    .reduce((s, o) => s + o.value, 0);

  const wonTotal = (opportunities ?? [])
    .filter((o) => o.stage === "closed_won")
    .reduce((s, o) => s + o.value, 0);

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline"
        description="Gerencie suas oportunidades de venda"
        actions={
          <Button className="gap-2" onClick={() => { resetForm(); setOpen(true); }}>
            <Plus className="h-4 w-4" /> Nova oportunidade
          </Button>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Pipeline aberto</p>
            <p className="text-xl font-bold">{fmt(pipelineTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Oportunidades abertas</p>
            <p className="text-xl font-bold">
              {(opportunities ?? []).filter((o) => !["closed_won", "closed_lost"].includes(o.stage)).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Receita ganha</p>
            <p className="text-xl font-bold text-emerald-600">{fmt(wonTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total de oportunidades</p>
            <p className="text-xl font-bold">{(opportunities ?? []).length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Kanban board */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
      ) : (opportunities ?? []).length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="Nenhuma oportunidade ainda"
          description="Crie sua primeira oportunidade para começar a monitorar o pipeline."
          action={
            <Button onClick={() => { resetForm(); setOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Nova oportunidade
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${STAGES.length}, minmax(200px, 1fr))`, overflowX: "auto" }}>
          {STAGES.map(({ value: stage, label, color }) => {
            const items = byStage(stage);
            const total = items.reduce((s, o) => s + o.value, 0);
            return (
              <div key={stage} className="flex flex-col gap-2 min-w-[200px]">
                <div className={`rounded-lg border px-3 py-2 ${color}`}>
                  <p className="text-xs font-semibold">{label}</p>
                  <p className="text-xs text-muted-foreground">
                    {items.length} · {fmt(total)}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {items.map((opp) => (
                    <Card
                      key={opp.id}
                      className="cursor-pointer hover:shadow-sm transition-shadow"
                      onClick={() => openEdit(opp)}
                    >
                      <CardContent className="p-3">
                        <p className="text-sm font-medium leading-snug">{opp.title}</p>
                        <p className="mt-1 text-xs font-semibold text-primary">
                          {fmt(opp.value)}
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                          <Badge variant="outline" className="text-[10px]">
                            {opp.probability}%
                          </Badge>
                          {opp.expected_close_date && (
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(opp.expected_close_date + "T12:00:00").toLocaleDateString("pt-BR")}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); setOpen(o); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar oportunidade" : "Nova oportunidade"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Título *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: Proposta de ERP para Empresa X"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  placeholder="0,00"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Probabilidade (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={form.probability}
                  onChange={(e) => setForm({ ...form, probability: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Estágio</Label>
                <Select
                  value={form.stage}
                  onValueChange={(v) => setForm({ ...form, stage: v as OpportunityStage })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Previsão de fechamento</Label>
                <Input
                  type="date"
                  value={form.expected_close_date}
                  onChange={(e) => setForm({ ...form, expected_close_date: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Observações</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Anotações sobre esta oportunidade..."
              />
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            {editId && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  deleteMutation.mutate(editId);
                  setOpen(false);
                  resetForm();
                }}
              >
                Excluir
              </Button>
            )}
            <div className="flex gap-2 sm:ml-auto">
              <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>
                Cancelar
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!form.title || saveMutation.isPending}
              >
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
