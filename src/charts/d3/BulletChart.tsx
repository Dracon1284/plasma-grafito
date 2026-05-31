import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { ChartDefinition, ChartProps } from "../types";

export const bulletDefinition: Omit<ChartDefinition, "renderComponent"> = {
  id: "bullet",
  label: "Gráfico de Bala",
  description: "Compará el valor actual contra una meta y rangos de rendimiento.",
  icon: "▬",
  engine: "d3",
  requiredFields: [
    { key: "label",    label: "Etiqueta (KPI)",      dtype: "string" },
    { key: "actual",   label: "Valor actual",         dtype: "number" },
    { key: "target",   label: "Meta / objetivo",      dtype: "number" },
    { key: "rangeMin", label: "Rango mínimo (malo)",  dtype: "number", optional: true },
    { key: "rangeMid", label: "Rango medio (regular)",dtype: "number", optional: true },
    { key: "rangeMax", label: "Rango máximo (bueno)",  dtype: "number", optional: true },
  ],
  defaultExample: {
    data: {
      columns: ["kpi",           "actual", "target", "range_min", "range_mid", "range_max"],
      rows: [
        ["Sales (M$)",      72,  80,  40,  60,  100],
        ["Satisfaction %",  83,  90,  50,  70,  100],
        ["Retention %",     91,  88,  60,  80,  100],
        ["Leads",          118, 130,  60, 100,  160],
      ],
    },
    mapping: {
      label: "kpi", actual: "actual", target: "target",
      rangeMin: "range_min", rangeMid: "range_mid", rangeMax: "range_max",
    },
  },
  optionsSchema: [
    { key: "title",      label: "Título",                            type: "text",    default: "",   group: "Referencias" },
    { key: "showValues", label: "Mostrar valor numérico (actual)",   type: "boolean", default: true, group: "Referencias" },
    { key: "showTarget", label: "Mostrar valor objetivo (meta)",     type: "boolean", default: true, group: "Referencias" },
    { key: "tickCount",  label: "Divisiones en eje numérico",        type: "number",  default: 5,    group: "Referencias" },
    { key: "labelWidth", label: "Ancho de etiquetas (eje Y)",         type: "number",  default: 150,  group: "Estilo" },
    {
      key: "palette",
      label: "Paleta",
      type: "select",
      default: "plasma",
      options: [
        { value: "plasma",        label: "Plasma" },
        { value: "primarios",     label: "Primarios" },
        { value: "primarios_sec", label: "Primarios + Secundarios" },
        { value: "personalizado", label: "Personalizado" },
      ],
      group: "Estilo",
    },
    {
      key: "customColors",
      label: "Colores por KPI",
      type: "custom-palette",
      default: {},
      dataKey: "label",
      group: "Estilo",
      dependsOn: { key: "palette", equals: "personalizado" },
    },
    {
      key: "bgColor",
      label: "Fondo",
      type: "select",
      default: "black",
      options: [
        { value: "black", label: "Negro" },
        { value: "gray",  label: "Gris"  },
        { value: "white", label: "Blanco" },
      ],
      group: "Estilo",
    },
  ],
};

const paletteMap: Record<string, string[]> = {
  plasma:        ["#00F0FF", "#B14AED", "#FF00AA", "#7AD7F0"],
  primarios:     ["#E8000D", "#1A56DB", "#F5C518"],
  primarios_sec: ["#E8000D", "#F4511E", "#F5C518", "#22A045", "#1A56DB", "#9B30FF"],
};

const bgMap: Record<string, { bg: string; text: string; range: [string, string, string] }> = {
  black: { bg: "#0A0A0A", text: "#E0E0E0", range: ["#1C1C1E","#2A2A2E","#363638"] },
  gray:  { bg: "#6B7280", text: "#1C1C1E", range: ["#4B5563","#6B7280","#9CA3AF"] },
  white: { bg: "#FFFFFF",  text: "#1C1C1E", range: ["#E5E7EB","#D1D5DB","#9CA3AF"] },
};

export default function BulletChart({ data, mapping, options, domId }: ChartProps) {
  const ref = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !wrapRef.current) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const get = (key: string) => data.columns.indexOf((mapping[key] as string) || "");

    const labelIdx  = get("label");
    const actualIdx = get("actual");
    const targetIdx = get("target");
    const minIdx    = get("rangeMin");
    const midIdx    = get("rangeMid");
    const maxIdx    = get("rangeMax");

    if (labelIdx < 0 || actualIdx < 0 || targetIdx < 0) return;

    const bgKey  = (options.bgColor as string) || "black";
    const bg     = bgMap[bgKey] ?? bgMap.black;
    const paletteKey   = (options.palette as string) || "plasma";
    const palette      = paletteMap[paletteKey] || paletteMap.plasma;
    const customColors = (options.customColors as Record<string, string>) || {};
    const useCustom    = paletteKey === "personalizado";
    const colorFor     = (label: string, i: number) =>
      useCustom && customColors[label] ? customColors[label] : palette[i % palette.length];
    const title      = (options.title as string) || "";
    const showValues = options.showValues !== false;  // valor real al final de la barra
    const showTarget = options.showTarget !== false;  // valor meta al lado del marcador
    const tickCount  = Math.max(2, Math.min(15, Number(options.tickCount) || 5));
    const labelW     = Math.max(40, Math.min(400, Number(options.labelWidth) || 150));  // ancho de etiqueta KPI

    type Row = { label: string; actual: number; target: number; min?: number; mid?: number; max?: number };
    const rows: Row[] = data.rows
      .filter((r) => r[labelIdx] !== null && r[actualIdx] !== null && r[targetIdx] !== null)
      .map((r) => ({
        label:  String(r[labelIdx]),
        actual: Number(r[actualIdx]),
        target: Number(r[targetIdx]),
        min:    minIdx >= 0 && r[minIdx] !== null ? Number(r[minIdx]) : undefined,
        mid:    midIdx >= 0 && r[midIdx] !== null ? Number(r[midIdx]) : undefined,
        max:    maxIdx >= 0 && r[maxIdx] !== null ? Number(r[maxIdx]) : undefined,
      }));

    if (rows.length === 0) return;

    const W = wrapRef.current.clientWidth || 620;
    const rowH = 64;
    // labelW ya definido arriba con showLabels
    const padTop = title ? 48 : 20;
    const H = padTop + rows.length * rowH + 20;

    svg.attr("width", W).attr("height", H).style("background", bg.bg);

    if (title) {
      svg.append("text")
        .attr("x", W / 2).attr("y", 28)
        .attr("text-anchor", "middle")
        .style("font-family", "Orbitron, sans-serif")
        .style("font-size", "15px")
        .style("fill", bg.text)
        .text(title);
    }

    const chartW = W - labelW - 40;

    rows.forEach((row, i) => {
      const domainMax = Math.max(row.actual, row.target, row.max ?? 0) * 1.1;
      const x = d3.scaleLinear().domain([0, domainMax]).range([0, chartW]);
      const g = svg.append("g").attr("transform", `translate(${labelW}, ${padTop + i * rowH + 8})`);

      // background ranges
      if (row.max !== undefined) {
        g.append("rect").attr("x", 0).attr("width", x(row.max)).attr("height", 32)
          .attr("fill", bg.range[2]).attr("rx", 2);
      }
      if (row.mid !== undefined) {
        g.append("rect").attr("x", 0).attr("width", x(row.mid)).attr("height", 32)
          .attr("fill", bg.range[1]).attr("rx", 2);
      }
      if (row.min !== undefined) {
        g.append("rect").attr("x", 0).attr("width", x(row.min)).attr("height", 32)
          .attr("fill", bg.range[0]).attr("rx", 2);
      }

      // actual bar
      const barColor = colorFor(row.label, i);
      g.append("rect")
        .attr("x", 0).attr("y", 9).attr("width", x(row.actual)).attr("height", 14)
        .attr("fill", barColor).attr("rx", 2).attr("opacity", 0.95);

      // target line
      g.append("rect")
        .attr("x", x(row.target) - 2).attr("y", 4).attr("width", 4).attr("height", 24)
        .attr("fill", bg.text).attr("opacity", 0.9);

      // target value (encima del marcador de meta)
      if (showTarget) {
        g.append("text")
          .attr("x", x(row.target)).attr("y", -2)
          .attr("text-anchor", "middle")
          .style("font-size", "10px")
          .style("font-weight", "600")
          .style("fill", bg.text)
          .style("opacity", "0.85")
          .text(`▼ ${row.target}`);
      }

      // axis ticks
      const ticks = x.ticks(tickCount);
      ticks.forEach((t) => {
        g.append("text")
          .attr("x", x(t)).attr("y", 46)
          .attr("text-anchor", "middle")
          .style("font-size", "9px")
          .style("fill", bg.text)
          .style("opacity", "0.5")
          .text(t);
      });

      // Etiqueta del KPI (siempre visible)
      svg.append("text")
        .attr("x", labelW - 8)
        .attr("y", padTop + i * rowH + 8 + 20)
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .style("font-family", "Calibri, 'Segoe UI', sans-serif")
        .style("font-size", "12px")
        .style("fill", bg.text)
        .text(row.label);

      // Valor numérico al final de la barra (controlado por showValues)
      if (showValues) {
        g.append("text")
          .attr("x", x(row.actual) + 5).attr("y", 20)
          .attr("dominant-baseline", "middle")
          .style("font-size", "11px")
          .style("fill", barColor)
          .text(row.actual);
      }
    });
  }, [data, mapping, options]);

  return (
    <div id={domId} ref={wrapRef} className="w-full h-full min-h-[320px] overflow-auto">
      <svg ref={ref} className="w-full" />
    </div>
  );
}
