import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useProject } from "../store/projectStore";
import { getChart } from "../charts/registry";
import { Input, Label, Select } from "./ui/Input";
import { Button } from "./ui/Button";
import { exportTableCSV, exportTableXLSX } from "../lib/exporters";
import type { ColumnMapping, DataTable, OptionSchema } from "../charts/types";

/** Extrae los valores únicos (como strings) de una o más columnas del mapping */
function getCategoriesFromData(
  data: DataTable | null,
  mapping: ColumnMapping,
  dataKey?: string | string[],
): string[] {
  if (!data || !dataKey) return [];
  const keys = Array.isArray(dataKey) ? dataKey : [dataKey];
  const colNames = keys
    .map((k) => mapping[k])
    .flatMap((v) => (Array.isArray(v) ? v : v ? [v] : []))
    .filter(Boolean) as string[];
  const colIdxs = colNames
    .map((c) => data.columns.indexOf(c))
    .filter((i) => i >= 0);
  if (colIdxs.length === 0) return [];
  return Array.from(
    new Set(
      colIdxs
        .flatMap((idx) => data.rows.map((r) => r[idx]))
        .filter((v) => v !== null && v !== undefined && v !== "")
        .map((v) => String(v)),
    ),
  );
}

export function EditorPanel() {
  const { t } = useTranslation();
  const chartType  = useProject((s) => s.chartType);
  const options    = useProject((s) => s.options);
  const setOption  = useProject((s) => s.setOption);
  const data       = useProject((s) => s.data);
  const mapping    = useProject((s) => s.mapping);

  if (!chartType) return null;
  const def = getChart(chartType);
  if (!def) return null;

  const groups: Record<string, OptionSchema[]> = {};
  def.optionsSchema.forEach((o) => {
    const g = o.group ?? "Referencias";
    (groups[g] ||= []).push(o);
  });

  /** Traduce el label de una opción: intenta chart-specific → genérico → fallback original */
  const optLabel = (o: OptionSchema) =>
    t(`charts.${chartType}.options.${o.key}`, {
      defaultValue: t(`options.${o.key}`, { defaultValue: String(o.label) }),
    });

  /** Traduce el label de un valor de select (ej. "plasma", "black") */
  const optValLabel = (val: string, fallback: string) =>
    t(`optionValues.${val}`, { defaultValue: fallback });

  return (
    <div className="space-y-6">
      <div>
        <div className="text-plasma-blue font-display tracking-wider text-xs">
          {t("panel.editorLabel")}
        </div>
        <div className="font-display text-xl">
          {t(`charts.${chartType}.label`, def.label)}
        </div>
      </div>

      {/* ── Datos ── */}
      <section className="space-y-3">
        <h3 className="text-xs uppercase tracking-[0.2em] text-text-muted border-b border-white/10 pb-1">
          {t("panel.sectionData")}
        </h3>
        <div className="space-y-2">
          {data && (
            <div className="text-xs text-text-muted">
              {t("panel.rows", { rows: data.rows.length, cols: data.columns.length })}
            </div>
          )}
          <Button variant="ghost" className="w-full text-xs" disabled={!data}
            onClick={() => data && exportTableCSV(data, `datos-${chartType}.csv`)}>
            {t("panel.downloadCsv")}
          </Button>
          <Button variant="ghost" className="w-full text-xs"
            onClick={() => exportTableXLSX(def.defaultExample.data, `ejemplo-${chartType}.xlsx`)}>
            {t("panel.downloadXlsx")}
          </Button>
        </div>
      </section>

      {/* ── Opciones por grupo ── */}
      {Object.entries(groups).map(([g, opts]) => {
        const visible = opts.filter((o) => {
          if (!o.dependsOn) return true;
          const dep = options[o.dependsOn.key]
            ?? def.optionsSchema.find((s) => s.key === o.dependsOn!.key)?.default;
          return dep === o.dependsOn.equals;
        });
        if (visible.length === 0) return null;
        return (
          <section key={g} className="space-y-3">
            <h3 className="text-xs uppercase tracking-[0.2em] text-text-muted border-b border-white/10 pb-1">
              {t(`groups.${g}`, g)}
            </h3>
            {visible.map((o) => (
              <OptionField
                key={o.key}
                schema={o}
                label={optLabel(o)}
                optValLabel={optValLabel}
                value={options[o.key] ?? o.default}
                onChange={(v) => setOption(o.key, v)}
                data={data}
                mapping={mapping}
                chartType={chartType}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}

function OptionField({
  schema, label, optValLabel, value, onChange, data, mapping, chartType,
}: {
  schema: OptionSchema;
  label: string;
  optValLabel: (val: string, fallback: string) => string;
  value: unknown;
  onChange: (v: unknown) => void;
  data: DataTable | null;
  mapping: ColumnMapping;
  chartType: string;
}) {
  const { t } = useTranslation();

  switch (schema.type) {
    case "text":
      return (
        <div>
          <Label>{label}</Label>
          <Input value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
    case "number":
      return (
        <div>
          <Label>{label}</Label>
          <Input type="number" value={(value as number) ?? 0}
            onChange={(e) => onChange(Number(e.target.value))} />
        </div>
      );
    case "color":
      return (
        <div>
          <Label>{label}</Label>
          <input type="color" value={(value as string) ?? "#00F0FF"}
            onChange={(e) => onChange(e.target.value)}
            className="w-full h-9 bg-graphite border border-white/10 rounded" />
        </div>
      );
    case "boolean":
      return (
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)} className="accent-plasma-blue" />
          <span>{label}</span>
        </label>
      );
    case "select":
      return (
        <div>
          <Label>{label}</Label>
          <Select value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}>
            {schema.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {optValLabel(o.value, o.label)}
              </option>
            ))}
          </Select>
        </div>
      );
    case "multicheck-data": {
      const cats   = getCategoriesFromData(data, mapping, schema.dataKey);
      const hidden = (value as string[]) || [];
      const toggle  = (cat: string) => {
        const next = hidden.includes(cat)
          ? hidden.filter((c) => c !== cat)
          : [...hidden, cat];
        onChange(next);
      };
      return (
        <div>
          <Label>{label}</Label>
          {cats.length === 0 ? (
            <p className="text-xs text-text-muted">
              {typeof schema.dataKey === "string"
                ? t("panel.assignFirst", { key: schema.dataKey })
                : t("panel.assignFirstMulti")}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-1 p-2 bg-graphite border border-white/10 rounded max-h-44 overflow-y-auto">
              {cats.map((cat) => (
                <label key={cat}
                  className={`flex items-center gap-2 text-xs px-2 py-1 rounded cursor-pointer hover:bg-white/5 transition-colors
                    ${hidden.includes(cat) ? "text-text-muted line-through" : "text-text-neon"}`}>
                  <input type="checkbox" checked={!hidden.includes(cat)}
                    onChange={() => toggle(cat)} className="accent-plasma-blue" />
                  {cat}
                </label>
              ))}
            </div>
          )}
          {hidden.length > 0 && (
            <p className="text-xs text-text-muted mt-1">
              {t("panel.hiddenCount", { count: hidden.length })}
            </p>
          )}
        </div>
      );
    }
    case "custom-palette":
      return (
        <CustomPaletteField
          schema={schema}
          label={label}
          value={value}
          onChange={onChange}
          data={data}
          mapping={mapping}
          chartType={chartType}
        />
      );
  }
}

/** Componente aparte para poder usar useState (selección de leyenda activa) */
function CustomPaletteField({
  schema, label, value, onChange, data, mapping,
}: {
  schema: OptionSchema;
  label: string;
  value: unknown;
  onChange: (v: unknown) => void;
  data: DataTable | null;
  mapping: ColumnMapping;
  chartType: string;
}) {
  const { t } = useTranslation();
  const cats   = getCategoriesFromData(data, mapping, schema.dataKey);
  const custom = (value as Record<string, string>) || {};

  const [activeCat, setActiveCat] = useState<string>("");
  const currentCat = cats.includes(activeCat) ? activeCat : "";

  if (cats.length === 0) {
    return (
      <div>
        <Label>{label}</Label>
        <p className="text-xs text-text-muted">
          {t("panel.assignFirstMulti")}
        </p>
      </div>
    );
  }

  const removeColor = (cat: string) => {
    const next = { ...custom };
    delete next[cat];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <Label>{label}</Label>

      {/* Paso 1: elegir leyenda */}
      <div>
        <Label>{t("panel.legend")}</Label>
        <Select
          value={currentCat}
          onChange={(e) => setActiveCat(e.target.value)}
        >
          <option value="">{t("panel.selectCategory")}</option>
          {cats.map((c) => (
            <option key={c} value={c}>
              {custom[c] ? "● " : "○ "}{c}
            </option>
          ))}
        </Select>
      </div>

      {/* Paso 2: elegir color */}
      {currentCat && (
        <div>
          <Label>{t("panel.color")}</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={custom[currentCat] || "#00F0FF"}
              onChange={(e) => onChange({ ...custom, [currentCat]: e.target.value })}
              className="h-9 w-16 bg-graphite border border-plasma-blue/40 rounded cursor-pointer"
              title={t("panel.color")}
            />
            <span className="text-xs text-text-muted truncate">
              {custom[currentCat] ? (
                <>{t("panel.colorValue")} <code className="text-text-neon">{custom[currentCat]}</code></>
              ) : (
                t("panel.noColor")
              )}
            </span>
          </div>
        </div>
      )}

      {/* Listado de asignaciones actuales */}
      {Object.keys(custom).length > 0 && (
        <div className="text-xs space-y-1 pt-2 border-t border-white/5">
          <div className="text-text-muted font-display tracking-wider mb-1">
            {t("panel.assignments")}
          </div>
          {Object.entries(custom).map(([cat, col]) => (
            <div key={cat} className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-sm border border-white/20 shrink-0"
                style={{ backgroundColor: col }}
              />
              <span className="truncate flex-1 text-text-neon">{cat}</span>
              <code className="text-text-muted">{col}</code>
              <button
                type="button"
                onClick={() => removeColor(cat)}
                className="text-text-muted hover:text-plasma-magenta px-1"
                title={t("panel.removeColor")}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange({})}
            className="text-text-muted hover:text-plasma-blue mt-1"
          >
            {t("panel.resetAll")}
          </button>
        </div>
      )}
    </div>
  );
}
