import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { ChartDefinition, ChartProps } from "../types";

export const chordDefinition: Omit<ChartDefinition, "renderComponent"> = {
  id: "chord",
  label: "Diagrama de Cuerdas",
  description: "Relaciones circulares entre grupos con flujos proporcionales.",
  icon: "◎",
  engine: "d3",
  requiredFields: [
    { key: "source", label: "Origen",  dtype: "string" },
    { key: "target", label: "Destino", dtype: "string" },
    { key: "value",  label: "Valor",   dtype: "number" },
  ],
  defaultExample: {
    data: {
      columns: ["source", "target", "value"],
      rows: [
        ["Europe",  "America", 120],
        ["Europe",  "Asia",     80],
        ["Europe",  "Africa",   40],
        ["America", "Europe",   90],
        ["America", "Asia",     60],
        ["America", "Oceania",  20],
        ["Asia",    "Europe",   70],
        ["Asia",    "America",  50],
        ["Asia",    "Africa",   30],
        ["Africa",  "Europe",   35],
        ["Oceania", "Asia",     15],
      ],
    },
    mapping: { source: "source", target: "target", value: "value" },
  },
  optionsSchema: [
    { key: "title",            label: "Título",                    type: "text",    default: "",    group: "Referencias" },
    { key: "showLabels",       label: "Mostrar etiquetas",          type: "boolean", default: true,  group: "Referencias" },
    { key: "horizontalLabels", label: "Etiquetas siempre horizontales", type: "boolean", default: false, group: "Referencias" },
    { key: "rotation",         label: "Rotación (0 - 360°)",        type: "number",  default: 0,     group: "Estilo" },
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
      label: "Colores por grupo",
      type: "custom-palette",
      default: {},
      dataKey: ["source", "target"],
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

const palettes: Record<string, string[]> = {
  plasma:        ["#00F0FF", "#B14AED", "#FF00AA", "#7AD7F0", "#FF6EC7", "#4DD9FF"],
  primarios:     ["#E8000D", "#1A56DB", "#F5C518"],
  primarios_sec: ["#E8000D", "#F4511E", "#F5C518", "#22A045", "#1A56DB", "#9B30FF"],
};

const bgMap: Record<string, { bg: string; text: string }> = {
  black: { bg: "#0A0A0A", text: "#E0E0E0" },
  gray:  { bg: "#6B7280", text: "#1C1C1E" },
  white: { bg: "#FFFFFF",  text: "#1C1C1E" },
};

export default function ChordChart({ data, mapping, options, domId }: ChartProps) {
  const ref = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !wrapRef.current) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const srcIdx = data.columns.indexOf(mapping.source as string);
    const tgtIdx = data.columns.indexOf(mapping.target as string);
    const valIdx = data.columns.indexOf(mapping.value  as string);
    if (srcIdx < 0 || tgtIdx < 0 || valIdx < 0) return;

    const bgKey = (options.bgColor as string) || "black";
    const bg    = bgMap[bgKey] ?? bgMap.black;
    const paletteKey       = (options.palette as string) || "plasma";
    const palette          = palettes[paletteKey] || palettes.plasma;
    const customColors     = (options.customColors as Record<string, string>) || {};
    const useCustom        = paletteKey === "personalizado";
    const showLabels       = options.showLabels !== false;
    const horizontalLabels = options.horizontalLabels === true;
    const title            = (options.title as string) || "";
    const rotation         = Number(options.rotation) || 0;

    const W = wrapRef.current.clientWidth  || 600;
    const H = wrapRef.current.clientHeight || 540;
    svg.attr("width", W).attr("height", H).style("background", bg.bg);

    if (title) {
      svg.append("text")
        .attr("x", W / 2).attr("y", 26)
        .attr("text-anchor", "middle")
        .style("font-family", "Orbitron, sans-serif")
        .style("font-size", "15px")
        .style("fill", bg.text)
        .text(title);
    }

    // Build matrix
    const groups: string[] = [];
    const getIdx = (name: string) => {
      let i = groups.indexOf(name);
      if (i === -1) { groups.push(name); i = groups.length - 1; }
      return i;
    };
    const rawFlows: { s: number; t: number; v: number }[] = [];
    for (const r of data.rows) {
      const s = r[srcIdx], t = r[tgtIdx], v = r[valIdx];
      if (s === null || t === null || v === null) continue;
      rawFlows.push({ s: getIdx(String(s)), t: getIdx(String(t)), v: Number(v) });
    }

    const n = groups.length;
    const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    for (const { s, t, v } of rawFlows) matrix[s][t] += v;

    const topPad = title ? 50 : 20;
    const cx = W / 2;
    const cy = (H - topPad) / 2 + topPad;
    const outerR = Math.min(W, H - topPad) / 2 - (showLabels ? 70 : 20);
    const innerR = outerR - 22;

    const color = (i: number) => {
      const fallback = palette[i % palette.length];
      if (useCustom && groups[i] && customColors[groups[i]]) return customColors[groups[i]];
      return fallback;
    };

    const chord = d3.chord().padAngle(0.04).sortSubgroups(d3.descending);
    const chords = chord(matrix);

    const arc   = d3.arc<d3.ChordGroup>().innerRadius(innerR).outerRadius(outerR);
    const ribbon = d3.ribbon<d3.Chord, d3.ChordSubgroup>().radius(innerR);

    const g = svg.append("g").attr("transform", `translate(${cx},${cy}) rotate(${rotation})`);

    // ribbons
    g.append("g").selectAll("path")
      .data(chords)
      .join("path")
      .attr("d", (d) => ribbon(d) ?? "")
      .attr("fill", (d) => color(d.source.index))
      .attr("opacity", 0.55)
      .attr("stroke", (d) => color(d.source.index))
      .attr("stroke-width", 0.5);

    // arcs
    const grpG = g.append("g").selectAll("g")
      .data(chords.groups)
      .join("g");

    grpG.append("path")
      .attr("d", (d) => arc(d) ?? "")
      .attr("fill", (d) => color(d.index))
      .attr("stroke", bg.bg)
      .attr("stroke-width", 1);

    if (showLabels) {
      const rotRad = (rotation * Math.PI) / 180;
      grpG.append("text")
        .attr("dy", "0.35em")
        .attr("transform", function (d) {
          const angle = (d.startAngle + d.endAngle) / 2;
          const r = outerR + 14;
          if (horizontalLabels) {
            // Posición local + contra-rotación para anular el rotate() del padre
            const x = Math.sin(angle) * r;
            const y = -Math.cos(angle) * r;
            return `translate(${x},${y}) rotate(${-rotation})`;
          }
          return `rotate(${(angle * 180) / Math.PI - 90}) translate(${r},0)${angle > Math.PI ? "rotate(180)" : ""}`;
        })
        .attr("text-anchor", function (d) {
          const angle = (d.startAngle + d.endAngle) / 2;
          if (horizontalLabels) {
            // El ángulo en pantalla es (angle + rotation) — decide el anchor según eso
            const screenAngle = angle + rotRad;
            const sinA = Math.sin(screenAngle);
            return sinA > 0.1 ? "start" : sinA < -0.1 ? "end" : "middle";
          }
          return angle > Math.PI ? "end" : "start";
        })
        .attr("dominant-baseline", function (d) {
          if (!horizontalLabels) return "auto";
          const angle = (d.startAngle + d.endAngle) / 2;
          const cosA  = Math.cos(angle + rotRad);
          return cosA > 0.15 ? "auto" : cosA < -0.15 ? "hanging" : "middle";
        })
        .style("font-family", "Inter, sans-serif")
        .style("font-size", "11px")
        .style("fill", bg.text)
        .text((d) => groups[d.index]);
    }
  }, [data, mapping, options]);

  return (
    <div id={domId} ref={wrapRef} className="w-full h-full min-h-[500px] overflow-hidden">
      <svg ref={ref} className="w-full h-full" />
    </div>
  );
}
