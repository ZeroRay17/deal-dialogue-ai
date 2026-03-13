import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface ParsedProduct {
  name: string;
  brand: string;
  price: number;
  stock: number;
  category_slug: string;
  specs: Record<string, any>;
}

const CsvUploadDialog = ({ categories }: { categories: any[] }) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [parsed, setParsed] = useState<ParsedProduct[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseCsv = (text: string) => {
    const lines = text.replace(/^\uFEFF/, "").split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      setErrors(["O arquivo precisa ter um cabeçalho e pelo menos uma linha de dados."]);
      return;
    }

    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const colMap: Record<string, string> = {
      nome: "name", name: "name",
      preco: "price", price: "price",
      categoria: "category", category: "category",
      marca: "brand", brand: "brand",
      estoque: "stock", stock: "stock",
      link: "link",
      specs: "specs",
    };

    const mapped = header.map((h) => colMap[h] || h);
    if (!mapped.includes("name") || !mapped.includes("price") || !mapped.includes("category")) {
      setErrors([`Colunas obrigatórias faltando. Esperado: nome/name, preco/price, categoria/category`]);
      return;
    }

    const products: ParsedProduct[] = [];
    const errs: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      const row: Record<string, string> = {};
      mapped.forEach((h, idx) => (row[h] = values[idx] || ""));

      if (!row.name) { errs.push(`Linha ${i + 1}: nome vazio`); continue; }
      const price = parseFloat(row.price);
      if (isNaN(price)) { errs.push(`Linha ${i + 1}: preço inválido "${row.price}"`); continue; }

      let specs: Record<string, any> = {};
      if (row.specs) {
        try { specs = JSON.parse(row.specs); } catch { /* ignore */ }
      }

      products.push({
        name: row.name,
        brand: row.brand || "",
        price,
        stock: parseInt(row.stock) || 0,
        category_slug: row.category,
        specs,
      });
    }

    setParsed(products);
    setErrors(errs);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => parseCsv(ev.target?.result as string);
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!parsed.length) return;
    setUploading(true);

    const catMap = new Map(categories.map((c: any) => [c.slug, c.id]));
    const errs: string[] = [];
    const payload = parsed
      .map((p, i) => {
        const catId = catMap.get(p.category_slug);
        if (!catId) { errs.push(`"${p.name}": categoria "${p.category_slug}" não encontrada`); return null; }
        return { name: p.name, brand: p.brand || null, price: p.price, stock: p.stock, category_id: catId, specs: p.specs };
      })
      .filter(Boolean);

    if (errs.length) { setErrors((prev) => [...prev, ...errs]); }

    if (payload.length) {
      const { error } = await supabase.from("products").insert(payload as any);
      if (error) {
        toast.error("Erro ao importar: " + error.message);
      } else {
        toast.success(`${payload.length} produto(s) importado(s) com sucesso!`);
        queryClient.invalidateQueries({ queryKey: ["products"] });
        queryClient.invalidateQueries({ queryKey: ["product-count"] });
        setOpen(false);
        setParsed([]);
        setErrors([]);
      }
    }
    setUploading(false);
  };

  const reset = () => { setParsed([]); setErrors([]); if (fileRef.current) fileRef.current.value = ""; };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileSpreadsheet className="h-4 w-4" /> Importar CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Produtos via CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border border-dashed border-muted-foreground/30 p-6 text-center">
            <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-2">Selecione um arquivo .csv</p>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="mx-auto block text-sm" />
          </div>

          <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold">Formato esperado (colunas):</p>
            <code>name, brand, price, stock, category, specs</code>
            <p><strong>name, price, category</strong> são obrigatórios. <strong>category</strong> usa o slug (ex: processador, placa-mae, memoria-ram).</p>
            <p><strong>specs</strong> é opcional, em formato JSON (ex: {`{"cores":6}`}).</p>
          </div>

          {errors.length > 0 && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 space-y-1">
              <p className="text-sm font-medium text-destructive flex items-center gap-1"><AlertCircle className="h-4 w-4" /> Avisos:</p>
              {errors.map((e, i) => <p key={i} className="text-xs text-destructive">{e}</p>)}
            </div>
          )}

          {parsed.length > 0 && (
            <>
              <p className="text-sm text-foreground font-medium">{parsed.length} produto(s) encontrado(s):</p>
              <div className="max-h-48 overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead className="text-right">Preço</TableHead>
                      <TableHead className="text-right">Estoque</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>{p.category_slug}</TableCell>
                        <TableCell>{p.brand}</TableCell>
                        <TableCell className="text-right">R$ {p.price.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{p.stock}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>Cancelar</Button>
          <Button onClick={handleUpload} disabled={!parsed.length || uploading}>
            {uploading ? "Importando..." : `Importar ${parsed.length} produto(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CsvUploadDialog;
