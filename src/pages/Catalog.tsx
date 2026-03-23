import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import type { Product, ProductCategory } from "@/types/domain";

type FormData = {
  name: string;
  brand: string;
  sku: string;
  category_id: string;
  price: string;
  price_promo: string;
  cost: string;
  stock: string;
  description: string;
  specs: string;
  active: boolean;
};

const emptyForm = (): FormData => ({
  name: "",
  brand: "",
  sku: "",
  category_id: "",
  price: "",
  price_promo: "",
  cost: "",
  stock: "0",
  description: "",
  specs: "{}",
  active: true,
});

export default function Catalog() {
  const { tenant } = useTenant();
  const qc = useQueryClient();
  const tid = tenant?.id;

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm());

  const { data: categories } = useQuery({
    queryKey: ["categories", tid],
    enabled: !!tid,
    queryFn: async () => {
      const { data } = await supabase
        .from("product_categories")
        .select("*")
        .or(`tenant_id.eq.${tid},tenant_id.is.null`)
        .order("display_order");
      return (data ?? []) as ProductCategory[];
    },
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ["products", tid, categoryFilter],
    enabled: !!tid,
    queryFn: async () => {
      let q = supabase
        .from("products")
        .select("*, product_categories(name)")
        .or(`tenant_id.eq.${tid},tenant_id.is.null`)
        .order("created_at", { ascending: false });
      if (categoryFilter !== "all") q = q.eq("category_id", categoryFilter);
      const { data } = await q;
      return (data ?? []) as (Product & { product_categories: { name: string } | null })[];
    },
  });

  const filtered = (products ?? []).filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.brand?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tid) throw new Error("No tenant");
      let specs: Record<string, unknown> = {};
      try {
        specs = JSON.parse(form.specs || "{}");
      } catch {
        throw new Error("Specs inválido: JSON malformado");
      }
      const payload = {
        tenant_id: tid,
        name: form.name,
        brand: form.brand || null,
        sku: form.sku || null,
        category_id: form.category_id || null,
        price: parseFloat(form.price) || 0,
        price_promo: form.price_promo ? parseFloat(form.price_promo) : null,
        cost: form.cost ? parseFloat(form.cost) : null,
        stock: parseInt(form.stock) || 0,
        description: form.description || null,
        specs,
        active: form.active,
      };
      if (editId) {
        const { error } = await supabase.from("products").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products", tid] });
      setOpen(false);
      resetForm();
      toast.success(editId ? "Produto atualizado!" : "Produto criado!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("products").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products", tid] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products", tid] });
      toast.success("Produto removido.");
    },
  });

  const resetForm = () => { setForm(emptyForm()); setEditId(null); };

  const openEdit = (p: Product & { product_categories: any }) => {
    setForm({
      name: p.name,
      brand: p.brand ?? "",
      sku: p.sku ?? "",
      category_id: p.category_id ?? "",
      price: String(p.price),
      price_promo: p.price_promo ? String(p.price_promo) : "",
      cost: p.cost ? String(p.cost) : "",
      stock: String(p.stock),
      description: p.description ?? "",
      specs: JSON.stringify(p.specs ?? {}, null, 2),
      active: p.active,
    });
    setEditId(p.id);
    setOpen(true);
  };

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catálogo"
        description="Gerencie produtos e categorias"
        actions={
          <Button className="gap-2" onClick={() => { resetForm(); setOpen(true); }}>
            <Plus className="h-4 w-4" /> Novo produto
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar produto..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {(categories ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-xs">
          {filtered.length} produto{filtered.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Nenhum produto encontrado"
              description="Adicione produtos ao seu catálogo."
              action={
                <Button onClick={() => { resetForm(); setOpen(true); }}>
                  <Plus className="mr-2 h-4 w-4" /> Novo produto
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id} className={!p.active ? "opacity-50" : undefined}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.brand}{p.sku ? ` · ${p.sku}` : ""}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {(p as any).product_categories?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div>
                        <p className="text-sm font-semibold">{fmt(p.price)}</p>
                        {p.price_promo && (
                          <p className="text-xs text-emerald-600">{fmt(p.price_promo)}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="outline"
                        className={
                          p.stock === 0
                            ? "border-rose-200 bg-rose-50 text-rose-600"
                            : p.stock < 5
                            ? "border-amber-200 bg-amber-50 text-amber-600"
                            : ""
                        }
                      >
                        {p.stock}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={p.active}
                        onCheckedChange={(active) =>
                          toggleActiveMutation.mutate({ id: p.id, active })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => deleteMutation.mutate(p.id)}
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

      {/* Dialog */}
      <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); setOpen(o); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar produto" : "Novo produto"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nome do produto"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Marca</Label>
                <Input
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  placeholder="Ex: Apple"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>SKU</Label>
                <Input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="Ex: PROD-001"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Categoria</Label>
              <Select
                value={form.category_id}
                onValueChange={(v) => setForm({ ...form, category_id: v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(categories ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label>Preço (R$) *</Label>
                <Input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Promo (R$)</Label>
                <Input
                  type="number"
                  value={form.price_promo}
                  onChange={(e) => setForm({ ...form, price_promo: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Estoque</Label>
                <Input
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Specs (JSON)</Label>
              <Input
                value={form.specs}
                onChange={(e) => setForm({ ...form, specs: e.target.value })}
                placeholder='{"cores": 6}'
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
              <Label>Produto ativo</Label>
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
