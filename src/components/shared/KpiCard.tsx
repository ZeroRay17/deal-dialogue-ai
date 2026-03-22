import { ElementType } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { KpiMetric } from "@/types/domain";

interface KpiCardProps extends KpiMetric {
  icon?: ElementType;
  iconColor?: string;
  loading?: boolean;
}

function formatValue(value: number | string, format?: KpiMetric["format"]): string {
  if (typeof value === "string") return value;
  if (format === "currency") {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  }
  if (format === "percent") return `${value.toFixed(1)}%`;
  return new Intl.NumberFormat("pt-BR").format(value);
}

export default function KpiCard({
  label,
  value,
  delta,
  deltaLabel,
  trend = "neutral",
  format,
  icon: Icon,
  iconColor = "text-primary",
  loading = false,
}: KpiCardProps) {
  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up"
      ? "text-emerald-600"
      : trend === "down"
      ? "text-rose-500"
      : "text-muted-foreground";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        {Icon && <Icon className={cn("h-5 w-5", iconColor)} />}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-8 w-24 animate-pulse rounded bg-muted" />
        ) : (
          <div className="text-2xl font-bold">{formatValue(value, format)}</div>
        )}
        {(delta !== undefined || deltaLabel) && !loading && (
          <div className={cn("mt-1 flex items-center gap-1 text-xs", trendColor)}>
            <TrendIcon className="h-3 w-3" />
            {delta !== undefined && (
              <span>
                {trend === "up" ? "+" : ""}
                {format === "percent"
                  ? `${delta.toFixed(1)}pp`
                  : delta.toFixed(0)}
              </span>
            )}
            {deltaLabel && <span className="text-muted-foreground">{deltaLabel}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
