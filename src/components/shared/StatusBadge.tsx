import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const contactStageConfig: Record<string, { label: string; className: string }> = {
  lead:          { label: "Lead",          className: "bg-blue-100 text-blue-700 border-blue-200" },
  qualified:     { label: "Qualificado",   className: "bg-violet-100 text-violet-700 border-violet-200" },
  proposal:      { label: "Proposta",      className: "bg-amber-100 text-amber-700 border-amber-200" },
  negotiation:   { label: "Negociação",    className: "bg-orange-100 text-orange-700 border-orange-200" },
  won:           { label: "Ganho",         className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  lost:          { label: "Perdido",       className: "bg-rose-100 text-rose-700 border-rose-200" },
  churned:       { label: "Churn",         className: "bg-gray-100 text-gray-600 border-gray-200" },
};

const opportunityStageConfig: Record<string, { label: string; className: string }> = {
  prospecting:   { label: "Prospecção",    className: "bg-blue-100 text-blue-700 border-blue-200" },
  qualification: { label: "Qualificação",  className: "bg-violet-100 text-violet-700 border-violet-200" },
  proposal:      { label: "Proposta",      className: "bg-amber-100 text-amber-700 border-amber-200" },
  negotiation:   { label: "Negociação",    className: "bg-orange-100 text-orange-700 border-orange-200" },
  closed_won:    { label: "Ganho",         className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  closed_lost:   { label: "Perdido",       className: "bg-rose-100 text-rose-700 border-rose-200" },
};

const orderStatusConfig: Record<string, { label: string; className: string }> = {
  pending:    { label: "Pendente",    className: "bg-amber-100 text-amber-700 border-amber-200" },
  confirmed:  { label: "Confirmado", className: "bg-blue-100 text-blue-700 border-blue-200" },
  processing: { label: "Processando",className: "bg-violet-100 text-violet-700 border-violet-200" },
  shipped:    { label: "Enviado",    className: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  delivered:  { label: "Entregue",   className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  cancelled:  { label: "Cancelado",  className: "bg-rose-100 text-rose-700 border-rose-200" },
};

const conversationStatusConfig: Record<string, { label: string; className: string }> = {
  open:     { label: "Aberta",    className: "bg-blue-100 text-blue-700 border-blue-200" },
  bot:      { label: "Bot",       className: "bg-violet-100 text-violet-700 border-violet-200" },
  human:    { label: "Humano",    className: "bg-amber-100 text-amber-700 border-amber-200" },
  closed:   { label: "Fechada",   className: "bg-gray-100 text-gray-600 border-gray-200" },
  active:   { label: "Ativa",     className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  archived: { label: "Arquivada", className: "bg-gray-100 text-gray-500 border-gray-200" },
};

type BadgeType = "contact" | "opportunity" | "order" | "conversation";

const configs: Record<BadgeType, Record<string, { label: string; className: string }>> = {
  contact:      contactStageConfig,
  opportunity:  opportunityStageConfig,
  order:        orderStatusConfig,
  conversation: conversationStatusConfig,
};

interface StatusBadgeProps {
  type: BadgeType;
  value: string;
}

export default function StatusBadge({ type, value }: StatusBadgeProps) {
  const config = configs[type]?.[value];
  if (!config) {
    return (
      <Badge variant="outline" className="capitalize">
        {value}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn("font-normal", config.className)}>
      {config.label}
    </Badge>
  );
}
