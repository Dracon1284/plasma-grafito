import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type {
  ChartDefinition,
  ColumnMapping,
  DataTable,
  DType,
} from "../charts/types";
import { Label, Select } from "./ui/Input";

function inferDType(values: (string | number | null)[]): DType {
  const sample = values.filter((v) => v !== null) as (string | number)[];
  if (sample.length === 0) return "string";
  if (sample.every((v) => typeof v === "number")) return "number";
  return "string";
}

function compatible(want: DType, have: DType): boolean {
  if (want === "category" || want === "string") return true;
  // "date" columns are stored as strings after parsing (YYYY-MM-DD), so accept string columns
  if (want === "date") return have === "string" || have === "date";
  return want === have;
}

export interface MapperValidation {
  valid: boolean;
  errors: string[];
}

export function validateMapping(
  def: ChartDefinition,
  data: DataTable,
  mapping: ColumnMapping,
  tFn?: (key: string, opts?: Record<string, unknown>) => string
): MapperValidation {
  const errors: string[] = [];
  for (const f of def.requiredFields) {
    if (f.optional) continue;
    const v = mapping[f.key];
    if (!v || (Array.isArray(v) && v.length === 0) || v === "") {
      const label = tFn
        ? tFn(`charts.${def.id}.fields.${f.key}`, { defaultValue: tFn(`fields.${f.key}`, { defaultValue: f.label }) })
        : f.label;
      const msg = tFn
        ? tFn("mapper.missingField", { label })
        : `Falta asignar columna para "${label}"`;
      errors.push(msg);
    }
  }
  return { valid: errors.length === 0, errors };
}

interface Props {
  chartDef: ChartDefinition;
  data: DataTable;
  mapping: ColumnMapping;
  onChange: (mapping: ColumnMapping) => void;
}

export function ColumnMapper({ chartDef, data, mapping, onChange }: Props) {
  const { t } = useTranslation();

  const dtypes = useMemo(() => {
    const out: Record<string, DType> = {};
    data.columns.forEach((col, idx) => {
      out[col] = inferDType(data.rows.map((r) => r[idx]));
    });
    return out;
  }, [data]);

  const set = (key: string, value: string) =>
    onChange({ ...mapping, [key]: value });

  const toggleMulti = (key: string, col: string) => {
    const current = (mapping[key] as string[]) || [];
    const next = current.includes(col)
      ? current.filter((c) => c !== col)
      : [...current, col];
    onChange({ ...mapping, [key]: next });
  };

  /** Traduce la etiqueta de un campo: intenta chart-specific, luego genérico, luego fallback original */
  const fieldLabel = (f: { key: string; label: string }) =>
    t(`charts.${chartDef.id}.fields.${f.key}`, { defaultValue: t(`fields.${f.key}`, { defaultValue: f.label }) });

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {chartDef.requiredFields.map((f) => {
        if (f.multiple) {
          const selected = (mapping[f.key] as string[]) || [];
          return (
            <div key={f.key} className="sm:col-span-2">
              <Label>
                {fieldLabel(f)}
                <span className="ml-2 text-plasma-blue/70 normal-case tracking-normal text-[10px]">
                  {t("mapper.selectMultiple")}
                </span>
              </Label>
              {f.help && (
                <p className="text-xs text-text-muted mb-1">{f.help}</p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 p-3 bg-graphite border border-white/10 rounded max-h-40 overflow-y-auto">
                {data.columns.map((c) => {
                  const ok = compatible(f.dtype, dtypes[c]);
                  const checked = selected.includes(c);
                  return (
                    <label
                      key={c}
                      className={`flex items-center gap-2 text-xs px-2 py-1 rounded cursor-pointer transition-colors
                        ${ok ? "hover:bg-white/5" : "opacity-40 cursor-not-allowed"}
                        ${checked ? "text-plasma-blue" : "text-text-muted"}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!ok}
                        onChange={() => ok && toggleMulti(f.key, c)}
                        className="accent-plasma-blue"
                      />
                      {c}
                    </label>
                  );
                })}
              </div>
              {selected.length > 0 && (
                <p className="text-xs text-plasma-blue/70 mt-1">
                  {t("mapper.columnsSelected", { count: selected.length })}
                </p>
              )}
            </div>
          );
        }

        const current = (mapping[f.key] as string) || "";
        return (
          <div key={f.key}>
            <Label htmlFor={`map-${f.key}`}>
              {fieldLabel(f)}
              {f.optional && (
                <span className="ml-2 text-text-muted/60 normal-case tracking-normal text-[10px]">
                  {t("mapper.optional")}
                </span>
              )}
            </Label>
            {f.help && (
              <p className="text-xs text-text-muted mb-1">{f.help}</p>
            )}
            <Select
              id={`map-${f.key}`}
              value={current}
              onChange={(e) => set(f.key, e.target.value)}
            >
              <option value="">
                {f.optional ? t("mapper.selectNone") : t("mapper.select")}
              </option>
              {data.columns.map((c) => {
                const ok = compatible(f.dtype, dtypes[c]);
                return (
                  <option key={c} value={c} disabled={!ok}>
                    {c}{!ok ? ` · ${t("mapper.typeLabel", { type: dtypes[c] })}` : ""}
                  </option>
                );
              })}
            </Select>
          </div>
        );
      })}
    </div>
  );
}
