import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { ChartDefinition, ChartProps } from "../types";

export const ridgeplotDefinition: Omit<ChartDefinition, "renderComponent"> = {
  id: "ridgeplot",
  label: "Ridgeplot",
  description: "Distribuciones apiladas superpuestas (joy plot) por categoría.",
  icon: "≋",
  engine: "d3",
  requiredFields: [
    { key: "category", label: "Categoría (serie)", dtype: "string",
      help: "Cada valor único crea una distribución separada." },
    { key: "value",    label: "Valor numérico",    dtype: "number" },
  ],
  defaultExample: {
    data: {
      columns: ["month", "temperature"],
      rows: [
        ...["January","February","March","April","May","June",
            "July","August","September","October","November","December"]
          .flatMap((month, mi) =>
            Array.from({ length: 30 }, () => {
              const base = 5 + mi * 2.5;
              return [month, +(base + (Math.random() - 0.5) * 14 + Math.sin(mi) * 3).toFixed(1)];
            })
          ),
      ],
    },
    mapping: { category: "month", value: "temperature" },
  },
  optionsSchema: [
    { key: "title",   label: "Título",                   type: "text",    default: "",   group: "Referencias" },
    { key: "overlap", label: "Superposición (0.5 - 3)",   type: "number",  default: 1.6,  group: "Estilo" },
    { key: "labelWidth", label: "Ancho de etiquetas (eje Y)", type: "number", default: 110, group: "Estilo" },
    { key: "xMin",    label: "Mínimo eje X (vacío = auto)", type: "text",  default: "",   group: "Referencias" },
    { key: "xMax",    label: "Máximo eje X (vacío = auto)", type: "text",  default: "",   group: "Referencias" },
    {
      key: "hiddenCategories",
      label: "Categorías visibles",
      type: "multicheck-data",
      default: [],
      dataKey: "category",   // lee las categorías del campo "category" del mapping
      group: "Referencias",
    },
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
      label: "Colores por categoría",
      type: "custom-palette",
      default: {},
      dataKey: "category",
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
  plasma:        ["#00F0FF","#33C6E0","#7AD7F0","#B14AED","#FF00AA","#FF6EC7"],
  primarios:     ["#E8000D","#1A56DB","#F5C518"],
  primarios_sec: ["#E8000D","#F4511E","#F5C518","#22A045","#1A56DB","#9B30FF"],
};

const bgMap: Record<string, { bg: string; text: string }> = {
  black: { bg: "#0A0A0A", text: "#E0E0E0" },
  gray:  { bg: "#6B7280", text: "#1C1C1E" },
  white: { bg: "#FFFFFF",  text: "#1C1C1E" },
};

function kde(kernel: (v: number) => number, thresholds: number[], values: number[]) {
  return thresholds.map((x) => [x, d3.mean(values, (v) => kernel(x - v))!] as [number, number]);
}
function epanechnikov(bw: number) {
  return (v: number) => Math.abs(v /= bw) <= 1 ? (0.75 * (1 - v * v)) / bw : 0;
}

export default function Ridgeplot({ data, mapping, options, domId }: ChartProps) {
  const ref     = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !wrapRef.current) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const catIdx = data.columns.indexOf((mapping.category as string) || "");
    const valIdx = data.columns.indexOf((mapping.value    as string) || "");
    if (catIdx < 0 || valIdx < 0) return;

    const bgKey  = (options.bgColor as string) || "black";
    const bg     = bgMap[bgKey] ?? bgMap.black;
    const paletteKey   = (options.palette as string) || "plasma";
    const palette      = paletteMap[paletteKey] || paletteMap.plasma;
    const customColors = (options.customColors as Record<string, string>) || {};
    const useCustom    = paletteKey === "personalizado";
    const title  = (options.title as string) || "";
    const overlap = Math.max(0.5, Math.min(3, Number(options.overlap) || 1.6));
    const hidden  = (options.hiddenCategories as string[]) || [];

    // Rango X manual
    const xMinRaw = (options.xMin as string) || "";
    const xMaxRaw = (options.xMax as string) || "";

    // Agrupar datos
    const grouped = new Map<string, number[]>();
    const catOrder: string[] = [];
    for (const r of data.rows) {
      const c = r[catIdx], v = r[valIdx];
      if (c === null || v === null) continue;
      const key = String(c);
      if (!grouped.has(key)) { grouped.set(key, []); catOrder.push(key); }
      grouped.get(key)!.push(Number(v));
    }

    // Filtrar categorías ocultas
    const categories = Array.from(new Set(catOrder)).filter((c) => !hidden.includes(c));
    if (categories.length === 0) return;

    const allValues = [...grouped.values()].flat();
    const autoMin = d3.min(allValues)!;
    const autoMax = d3.max(allValues)!;
    const vMin = xMinRaw !== "" && !isNaN(+xMinRaw) ? +xMinRaw : autoMin;
    const vMax = xMaxRaw !== "" && !isNaN(+xMaxRaw) ? +xMaxRaw : autoMax;

    const W       = wrapRef.current.clientWidth || 680;
    const padLeft = Math.max(40, Math.min(400, Number(options.labelWidth) || 110));
    const padRight = 30;
    const padTop  = title ? 52 : 30;
    const padBot  = 36;
    const rowH    = Math.max(40, Math.min(80, (600 - padTop - padBot) / categories.length));
    const H       = padTop + categories.length * rowH + padBot;

    svg.attr("width", W).attr("height", H).style("background", bg.bg);

    if (title) {
      svg.append("text")
        .attr("x", W / 2).attr("y", 28).attr("text-anchor", "middle")
        .style("font-family", "Orbitron, sans-serif").style("font-size", "15px")
        .style("fill", bg.text).text(title);
    }

    const xScale = d3.scaleLinear().domain([vMin, vMax]).range([padLeft, W - padRight]).nice();
    const bw = Math.max((vMax - vMin) / 8, 0.01);
    const thresholds = xScale.ticks(60);

    const densities = categories.map((cat) =>
      kde(epanechnikov(bw), thresholds, grouped.get(cat) || [])
    );
    const maxDensity = d3.max(densities.flat(), (d) => d[1]) || 1;

    // Eje X
    svg.append("g")
      .attr("transform", `translate(0,${H - padBot})`)
      .call(d3.axisBottom(xScale).ticks(7))
      .call((g) => {
        g.select(".domain").attr("stroke", bg.text).attr("opacity", 0.3);
        g.selectAll("text").style("fill", bg.text).style("font-size", "10px");
        g.selectAll(".tick line").attr("stroke", bg.text).attr("opacity", 0.3);
      });

    categories.forEach((cat, i) => {
      const yBase = padTop + (i + 1) * rowH;
      const fallback = palette[i % palette.length];
      const color    = useCustom && customColors[cat] ? customColors[cat] : fallback;

      const yScale = d3.scaleLinear()
        .domain([0, maxDensity])
        .range([0, -rowH * overlap]);

      const area = d3.area<[number, number]>()
        .x((d) => xScale(d[0]))
        .y0(0).y1((d) => yScale(d[1]))
        .curve(d3.curveBasis);

      const line = d3.line<[number, number]>()
        .x((d) => xScale(d[0]))
        .y((d) => yScale(d[1]))
        .curve(d3.curveBasis);

      const g = svg.append("g").attr("transform", `translate(0,${yBase})`);

      g.append("path").datum(densities[i])
        .attr("fill", color).attr("opacity", 0.35).attr("d", area);

      g.append("path").datum(densities[i])
        .attr("fill", "none").attr("stroke", color)
        .attr("stroke-width", 1.8).attr("opacity", 0.9).attr("d", line);

      const maxChars = Math.max(4, Math.floor((padLeft - 12) / 6.5));
      svg.append("text")
        .attr("x", padLeft - 8).attr("y", yBase - rowH * 0.1)
        .attr("text-anchor", "end").attr("dominant-baseline", "middle")
        .style("font-family", "Calibri, 'Segoe UI', sans-serif").style("font-size", "11px")
        .style("fill", bg.text)
        .text(cat.length > maxChars ? cat.slice(0, maxChars - 1) + "…" : cat);
    });
    // ── Crosshair vertical ──────────────────────────────────────────────────
    // Grupo siempre encima de todo el contenido
    const crossG = svg.append("g")
      .attr("class", "crosshair")
      .style("pointer-events", "none")
      .attr("opacity", 0);

    crossG.append("line")
      .attr("class", "ch-line")
      .attr("y1", padTop)
      .attr("y2", H - padBot)
      .attr("stroke", "#00F0FF")
      .attr("stroke-width", 1.2)
      .attr("stroke-dasharray", "4,3");

    // Fondo + texto del valor (para que se lea sobre cualquier color)
    crossG.append("rect")
      .attr("class", "ch-bg")
      .attr("y", H - padBot + 8)
      .attr("height", 16)
      .attr("rx", 3)
      .attr("fill", "#00F0FF")
      .attr("opacity", 0.9);

    crossG.append("text")
      .attr("class", "ch-text")
      .attr("y", H - padBot + 20)
      .attr("text-anchor", "middle")
      .style("font-family", "Inter, sans-serif")
      .style("font-size", "10px")
      .style("font-weight", "600")
      .style("fill", "#0A0A0A");

    // Adjuntamos los eventos directamente al SVG (más fiable que un overlay rect)
    svg.on("mousemove", function (event) {
      const [mx, my] = d3.pointer(event, this);
      if (mx < padLeft || mx > W - padRight || my < padTop || my > H - padBot) {
        crossG.attr("opacity", 0);
        return;
      }
      const xVal = xScale.invert(mx);
      const txt  = xVal.toFixed(Math.abs(vMax - vMin) < 10 ? 2 : 1);
      crossG.attr("opacity", 1);
      crossG.select<SVGLineElement>(".ch-line").attr("x1", mx).attr("x2", mx);
      const t = crossG.select<SVGTextElement>(".ch-text").text(txt);
      // Ajustar el ancho del fondo al texto
      const bbox = (t.node() as SVGTextElement).getBBox();
      crossG.select<SVGRectElement>(".ch-bg")
        .attr("x", mx - bbox.width / 2 - 6)
        .attr("width", bbox.width + 12);
      t.attr("x", mx);
    }).on("mouseleave", function () {
      crossG.attr("opacity", 0);
    });
  }, [data, mapping, options]);

  return (
    <div id={domId} ref={wrapRef} className="w-full h-full min-h-[440px] overflow-auto">
      <svg ref={ref} className="w-full" />
    </div>
  );
}
