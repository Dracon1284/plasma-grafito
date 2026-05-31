import { useEffect, useRef } from "react";
import Plotly from "plotly.js-dist-min";
import type { ChartDefinition, ChartProps } from "../types";

export const bubbleScatterDefinition: Omit<ChartDefinition, "renderComponent"> = {
  id: "bubblescatter",
  label: "Bubble Scatter",
  description: "Scatter plot with varying bubble sizes and color hues. Encodes 3–5 variables per point.",
  icon: "◍",
  engine: "plotly",
  requiredFields: [
    { key: "x",     label: "X axis (numeric)",        dtype: "number" },
    { key: "y",     label: "Y axis (numeric)",        dtype: "number" },
    { key: "size",  label: "Bubble size (numeric)",   dtype: "number" },
    { key: "color", label: "Color variable",          dtype: "string", optional: true },
    { key: "label", label: "Point label",             dtype: "string", optional: true },
  ],
  defaultExample: {
    data: {
      columns: ["country", "gdp_per_capita", "life_expectancy", "population_m", "region"],
      rows: [
        ["USA",        65297, 78.9,  331,  "Americas"],
        ["China",      10500, 76.9, 1411,  "Asia"],
        ["Germany",    46259, 81.3,   83,  "Europe"],
        ["Brazil",      8717, 75.9,  212,  "Americas"],
        ["India",       2257, 70.8, 1393,  "Asia"],
        ["France",     40494, 82.7,   67,  "Europe"],
        ["Nigeria",     2097, 54.7,  211,  "Africa"],
        ["Japan",      40113, 84.3,  125,  "Asia"],
        ["UK",         41855, 81.4,   67,  "Europe"],
        ["Mexico",      9926, 75.1,  128,  "Americas"],
        ["S. Korea",   31846, 83.5,   52,  "Asia"],
        ["Australia",  55060, 83.4,   26,  "Oceania"],
        ["Canada",     43242, 82.6,   38,  "Americas"],
        ["Egypt",       3507, 71.8,  102,  "Africa"],
        ["Argentina",  10636, 76.7,   45,  "Americas"],
        ["Turkey",      9126, 77.7,   84,  "Europe"],
        ["S. Africa",   6001, 64.1,   60,  "Africa"],
        ["Indonesia",   4136, 71.7,  273,  "Asia"],
      ],
    },
    mapping: {
      x: "gdp_per_capita",
      y: "life_expectancy",
      size: "population_m",
      color: "region",
      label: "country",
    },
  },
  optionsSchema: [
    { key: "title",      label: "Title",                  type: "text",    default: "",   group: "Referencias" },
    { key: "xLabel",     label: "X axis label",           type: "text",    default: "",   group: "Referencias" },
    { key: "yLabel",     label: "Y axis label",           type: "text",    default: "",   group: "Referencias" },
    { key: "showLabels", label: "Show point labels",      type: "boolean", default: true, group: "Referencias" },
    { key: "maxSize",    label: "Max bubble size (px)",   type: "number",  default: 60,   group: "Estilo" },
    {
      key: "palette",
      label: "Palette (categorical color)",
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
      label: "Colors by category",
      type: "custom-palette",
      default: {},
      dataKey: "color",
      group: "Estilo",
      dependsOn: { key: "palette", equals: "personalizado" },
    },
    {
      key: "bgColor",
      label: "Background",
      type: "select",
      default: "black",
      options: [
        { value: "black", label: "Black" },
        { value: "gray",  label: "Gray"  },
        { value: "white", label: "White" },
      ],
      group: "Estilo",
    },
  ],
};

// ── Palettes & themes ─────────────────────────────────────────────────────────

const palettes: Record<string, string[]> = {
  plasma:        ["#00F0FF", "#B14AED", "#FF00AA", "#7AD7F0", "#FF6EC7", "#4DD9FF", "#22A045", "#F5C518"],
  primarios:     ["#E8000D", "#1A56DB", "#F5C518"],
  primarios_sec: ["#E8000D", "#F4511E", "#F5C518", "#22A045", "#1A56DB", "#9B30FF"],
};

const bgColorMap: Record<string, { bg: string; text: string; grid: string }> = {
  black: { bg: "#0A0A0A", text: "#E0E0E0", grid: "rgba(255,255,255,0.08)" },
  gray:  { bg: "#6B7280", text: "#1C1C1E", grid: "rgba(0,0,0,0.12)" },
  white: { bg: "#FFFFFF",  text: "#1C1C1E", grid: "rgba(0,0,0,0.08)" },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function BubbleScatter({ data, mapping, options, domId }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const xCol    = data.columns.indexOf((mapping.x     as string) || "");
    const yCol    = data.columns.indexOf((mapping.y     as string) || "");
    const sizeCol = data.columns.indexOf((mapping.size  as string) || "");
    const colorCol = mapping.color ? data.columns.indexOf(mapping.color as string) : -1;
    const labelCol = mapping.label ? data.columns.indexOf(mapping.label as string) : -1;

    if (xCol < 0 || yCol < 0 || sizeCol < 0) return;

    // ── Options ───────────────────────────────────────────────────────────────
    const bgKey      = (options.bgColor      as string) || "black";
    const bg         = bgColorMap[bgKey] ?? bgColorMap.black;
    const paletteKey = (options.palette      as string) || "plasma";
    const palette    = palettes[paletteKey] || palettes.plasma;
    const custom     = (options.customColors as Record<string, string>) || {};
    const useCustom  = paletteKey === "personalizado";
    const title      = (options.title        as string) || "";
    const xLabel     = (options.xLabel       as string) || (mapping.x    as string) || "";
    const yLabel     = (options.yLabel       as string) || (mapping.y    as string) || "";
    const showLabels = options.showLabels !== false;
    const maxSizePx  = Math.max(20, Math.min(120, Number(options.maxSize) || 60));

    // ── Filter valid rows ────────────────────────────────────────────────────
    const rows = data.rows.filter(
      (r) => r[xCol] !== null && r[yCol] !== null && r[sizeCol] !== null
    );
    if (rows.length === 0) return;

    const xVals    = rows.map((r) => Number(r[xCol]));
    const yVals    = rows.map((r) => Number(r[yCol]));
    const sizeVals = rows.map((r) => Math.max(0, Number(r[sizeCol])));
    const labelVals = labelCol >= 0
      ? rows.map((r) => (r[labelCol] !== null ? String(r[labelCol]) : ""))
      : [];
    const colorRaw = colorCol >= 0 ? rows.map((r) => r[colorCol]) : [];

    // ── Marker size scaling (area mode: sizeref = 2*max / maxPx²) ───────────
    const maxSizeVal = Math.max(...sizeVals, 1);
    const sizeref    = (2 * maxSizeVal) / (maxSizePx ** 2);

    // ── Color mapping ────────────────────────────────────────────────────────
    // Detect numeric vs categorical color column
    const isNumericColor =
      colorRaw.length > 0 &&
      colorRaw.every((v) => v !== null && !isNaN(Number(v)));

    let markerColors: string[] | number[];
    let showScale = false;
    const colorscale: [number, string][] = [
      [0,   "#0A0A0A"],
      [0.2, "#00F0FF"],
      [0.5, "#B14AED"],
      [0.8, "#FF00AA"],
      [1,   "#FF6EC7"],
    ];

    if (colorRaw.length === 0) {
      // No color column → assign palette by index
      markerColors = rows.map((_, i) => palette[i % palette.length]);
    } else if (isNumericColor) {
      // Continuous → colorscale
      markerColors = colorRaw.map((v) => Number(v));
      showScale = true;
    } else {
      // Categorical → palette lookup
      const cats = Array.from(new Set(colorRaw.map((v) => String(v))));
      markerColors = colorRaw.map((v) => {
        const cat = String(v);
        if (useCustom && custom[cat]) return custom[cat];
        return palette[cats.indexOf(cat) % palette.length];
      });
    }

    // ── Hover text ───────────────────────────────────────────────────────────
    const hoverTexts = rows.map((r, i) => {
      const parts: string[] = [];
      if (labelCol >= 0 && r[labelCol] !== null)
        parts.push(`<b>${r[labelCol]}</b>`);
      parts.push(`${xLabel || mapping.x}: <b>${xVals[i].toLocaleString()}</b>`);
      parts.push(`${yLabel || mapping.y}: <b>${yVals[i].toLocaleString()}</b>`);
      parts.push(`${mapping.size}: <b>${sizeVals[i].toLocaleString()}</b>`);
      if (colorCol >= 0 && r[colorCol] !== null)
        parts.push(`${mapping.color}: <b>${r[colorCol]}</b>`);
      return parts.join("<br>") + "<extra></extra>";
    });

    // ── Plotly trace ─────────────────────────────────────────────────────────
    const trace: Record<string, unknown> = {
      type: "scatter",
      mode: showLabels && labelVals.length > 0 ? "markers+text" : "markers",
      x: xVals,
      y: yVals,
      text: labelVals.length > 0 ? labelVals : undefined,
      textposition: "top center",
      textfont: {
        color: bg.text,
        family: "Calibri, 'Segoe UI', sans-serif",
        size: 10,
      },
      hovertemplate: hoverTexts,
      marker: {
        size:     sizeVals,
        sizeref,
        sizemode: "area",
        sizemin:  4,
        color:    markerColors,
        ...(isNumericColor ? { colorscale, showscale: showScale } : {}),
        opacity: 0.82,
        line: { color: bg.bg, width: 1.2 },
      },
    };

    // ── Plotly layout ────────────────────────────────────────────────────────
    const layout: Record<string, unknown> = {
      paper_bgcolor: bg.bg,
      plot_bgcolor:  bg.bg,
      font: { color: bg.text, family: "Calibri, 'Segoe UI', sans-serif" },
      margin: { l: 60, r: 30, t: title ? 60 : 20, b: 60 },
      xaxis: {
        title: { text: xLabel, font: { color: bg.text } },
        color: bg.text,
        gridcolor: bg.grid,
        zerolinecolor: bg.grid,
      },
      yaxis: {
        title: { text: yLabel, font: { color: bg.text } },
        color: bg.text,
        gridcolor: bg.grid,
        zerolinecolor: bg.grid,
      },
    };

    if (title) {
      layout.title = {
        text: title,
        font: { color: bg.text, family: "Orbitron, sans-serif", size: 16 },
      };
    }

    Plotly.react(ref.current, [trace as any], layout as any, {
      responsive: true,
      displaylogo: false,
    });

    const el = ref.current;
    return () => { if (el) Plotly.purge(el); };
  }, [data, mapping, options]);

  return <div id={domId} ref={ref} className="w-full h-full min-h-[500px]" />;
}
