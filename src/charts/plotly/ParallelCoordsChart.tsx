import { useEffect, useRef } from "react";
import Plotly from "plotly.js-dist-min";
import type { ChartDefinition, ChartProps } from "../types";

export const parallelCoordsDefinition: Omit<ChartDefinition, "renderComponent"> = {
  id: "parallelcoords",
  label: "Coordenadas Paralelas",
  description: "Compará múltiples variables numéricas en ejes paralelos.",
  icon: "⫴",
  engine: "plotly",
  requiredFields: [
    {
      key: "dimensions",
      label: "Columnas numéricas",
      dtype: "number",
      multiple: true,
      help: "Seleccioná 2 o más columnas numéricas para los ejes.",
    },
    {
      key: "color",
      label: "Color por categoría",
      dtype: "string",
      optional: true,
      help: "Columna que define el color de cada línea (opcional).",
    },
  ],
  defaultExample: {
    data: {
      columns: ["model", "cylinders", "horsepower", "weight_kg", "consumption_L100", "acceleration"],
      rows: [
        ["A", 4, 85,  1100, 7.8, 18.5],
        ["B", 6, 120, 1400, 10.2, 14.2],
        ["C", 8, 200, 1900, 15.0, 11.3],
        ["D", 4, 75,  1050, 6.5, 20.1],
        ["E", 6, 110, 1350, 9.8, 15.0],
        ["F", 4, 90,  1200, 8.1, 17.3],
        ["G", 8, 180, 1800, 14.2, 12.0],
        ["H", 4, 70,  1000, 6.2, 21.5],
        ["I", 6, 130, 1500, 11.5, 13.0],
        ["J", 8, 220, 2000, 16.5, 10.5],
      ],
    },
    mapping: {
      dimensions: ["cylinders", "horsepower", "weight_kg", "consumption_L100", "acceleration"],
      color: "cylinders",
    },
  },
  optionsSchema: [
    { key: "title",       label: "Título",                          type: "text",   default: "",  group: "Referencias" },
    { key: "tickCount",   label: "Cantidad de divisiones en ejes",  type: "number", default: 5,   group: "Referencias" },
    {
      key: "colorscale",
      label: "Escala de color",
      type: "select",
      default: "plasma",
      options: [
        { value: "plasma",        label: "Plasma (cyan→magenta)" },
        { value: "Viridis",       label: "Viridis" },
        { value: "Jet",           label: "Espectro (Jet)" },
        { value: "RdYlGn",        label: "Rojo→Verde" },
        { value: "personalizado", label: "Personalizado" },
      ],
      group: "Estilo",
    },
    {
      key: "customColors",
      label: "Colores por categoría",
      type: "custom-palette",
      default: {},
      dataKey: "color",
      group: "Estilo",
      dependsOn: { key: "colorscale", equals: "personalizado" },
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

const bgMap: Record<string, { bg: string; text: string }> = {
  black: { bg: "#0A0A0A", text: "#E0E0E0" },
  gray:  { bg: "#6B7280", text: "#1C1C1E" },
  white: { bg: "#FFFFFF",  text: "#1C1C1E" },
};

const customColorscale: [number, string][] = [
  [0, "#00F0FF"],
  [0.5, "#B14AED"],
  [1, "#FF00AA"],
];

export default function ParallelCoordsChart({ data, mapping, options, domId }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const dims = (mapping.dimensions as string[]) || [];
    if (dims.length < 2) return;

    const bgKey    = (options.bgColor    as string) || "black";
    const bg       = bgMap[bgKey] ?? bgMap.black;
    const title    = (options.title      as string) || "";
    const csKey       = (options.colorscale as string) || "plasma";
    const customColors = (options.customColors as Record<string, string>) || {};
    const tickCount    = Math.max(2, Math.min(20, Number(options.tickCount) || 5));

    const colorCol  = mapping.color as string | undefined;
    const colorIdx  = colorCol ? data.columns.indexOf(colorCol) : -1;
    const colorValues = colorIdx >= 0
      ? data.rows.map((r) => Number(r[colorIdx]))
      : data.rows.map((_, i) => i);

    // Construir el colorscale según el modo
    let colorscale: typeof customColorscale | string;
    if (csKey === "personalizado" && colorIdx >= 0) {
      // Colorscale escalonado a partir de los valores únicos del campo color
      const uniqRaw = Array.from(new Set(data.rows.map((r) => r[colorIdx])))
        .filter((v) => v !== null && v !== undefined)
        .sort((a, b) => Number(a) - Number(b));
      const n = uniqRaw.length;
      const steps: [number, string][] = [];
      uniqRaw.forEach((v, i) => {
        const col = customColors[String(v)] || customColorscale[i % customColorscale.length][1];
        const a = i / n;
        const b = (i + 1) / n;
        steps.push([Math.max(0, a), col]);
        steps.push([Math.min(1, b), col]);
      });
      // Asegurar extremos exactos
      if (steps.length > 0) {
        steps[0][0] = 0;
        steps[steps.length - 1][0] = 1;
      }
      colorscale = steps.length > 0 ? steps : customColorscale;
    } else {
      colorscale = csKey === "plasma" ? customColorscale : csKey;
    }

    const dimensions = dims.map((colName) => {
      const idx    = data.columns.indexOf(colName);
      const values = data.rows.map((r) => (r[idx] !== null ? Number(r[idx]) : 0));
      // Plotly parcoords dimensions no soportan nticks → calculamos tickvals manualmente
      const minVal = Math.min(...values);
      const maxVal = Math.max(...values);
      const tickvals: number[] = [];
      if (tickCount >= 2 && maxVal > minVal) {
        for (let k = 0; k < tickCount; k++) {
          tickvals.push(+(minVal + (maxVal - minVal) * k / (tickCount - 1)).toPrecision(5));
        }
      }
      return { label: colName, values, ...(tickvals.length > 0 ? { tickvals } : {}) };
    });

    // Siempre purgar primero para garantizar re-render completo de todos los atributos
    Plotly.purge(ref.current);

    Plotly.newPlot(
      ref.current,
      [
        {
          type: "parcoords",
          line: {
            color: colorValues,
            colorscale,
            showscale: colorIdx >= 0,
            colorbar: {
              tickfont: { color: bg.text },
              title: { font: { color: bg.text } },
            },
          },
          dimensions,
          // labelfont, tickfont, rangefont solo son válidos a nivel de traza (no por dimensión)
          labelfont: { color: bg.text, family: "Inter, sans-serif", size: 12 },
          tickfont:  { color: bg.text, family: "Inter, sans-serif", size: 10 },
          rangefont: { color: bg.text, family: "Inter, sans-serif", size: 10 },
        } as any,
      ],
      {
        title: title
          ? { text: title, font: { color: bg.text, family: "Orbitron", size: 16 } }
          : undefined,
        paper_bgcolor: bg.bg,
        plot_bgcolor:  bg.bg,
        font: { color: bg.text, family: "Inter" },
        margin: { l: 60, r: 60, t: title ? 80 : 60, b: 30 },
      },
      { responsive: true, displaylogo: false }
    );

    const el = ref.current;
    return () => { if (el) Plotly.purge(el); };
  }, [data, mapping, options]);

  return <div id={domId} ref={ref} className="w-full h-full min-h-[500px]" />;
}
