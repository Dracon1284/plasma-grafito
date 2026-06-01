import { useEffect, useRef, useState, useCallback } from "react";
import Plotly from "plotly.js-dist-min";
import type { Data } from "plotly.js-dist-min";
import type { ChartDefinition, ChartProps } from "../types";

export const sankeyDefinition: Omit<ChartDefinition, "renderComponent"> = {
  id: "sankey",
  label: "Diagrama Sankey",
  description: "Flujos entre nodos con grosor proporcional al valor.",
  icon: "⇶",
  engine: "plotly",
  requiredFields: [
    { key: "source", label: "Origen", dtype: "string" },
    { key: "target", label: "Destino", dtype: "string" },
    { key: "value", label: "Valor", dtype: "number" },
  ],
  defaultExample: {
    data: {
      columns: ["source", "target", "value"],
      rows: [
        ["Solar",   "Grid",     30],
        ["Wind",    "Grid",     25],
        ["Gas",     "Grid",     45],
        ["Grid",    "Homes",    50],
        ["Grid",    "Industry", 35],
        ["Grid",    "Commerce", 15],
      ],
    },
    mapping: { source: "source", target: "target", value: "value" },
  },
  optionsSchema: [
    { key: "title", label: "Título", type: "text", default: "", group: "Referencias" },
    { key: "showLegend", label: "Mostrar etiquetas en nodos", type: "boolean", default: true, group: "Referencias" },
    { key: "nodePad", label: "Separación entre nodos (px)", type: "number", default: 40, group: "Estilo" },
    { key: "nodeThickness", label: "Grosor de nodos (px)", type: "number", default: 20, group: "Estilo" },
    {
      key: "palette",
      label: "Paleta de colores",
      type: "select",
      default: "plasma",
      options: [
        { value: "plasma",       label: "Plasma (cyan → magenta)" },
        { value: "blue",         label: "Azul neón" },
        { value: "magenta",      label: "Magenta" },
        { value: "primarios",    label: "Primarios (rojo · azul · amarillo)" },
        { value: "primarios_sec",label: "Primarios + Secundarios (6 colores)" },
        { value: "personalizado",label: "Personalizado" },
      ],
      group: "Estilo",
    },
    {
      key: "customColors",
      label: "Colores por nodo",
      type: "custom-palette",
      default: {},
      dataKey: ["source", "target"],
      group: "Estilo",
      dependsOn: { key: "palette", equals: "personalizado" },
    },
    {
      key: "bgColor",
      label: "Fondo del gráfico",
      type: "select",
      default: "black",
      options: [
        { value: "black", label: "Negro (oscuro)" },
        { value: "gray",  label: "Gris" },
        { value: "white", label: "Blanco" },
      ],
      group: "Estilo",
    },
  ],
};

const palettes: Record<string, string[]> = {
  plasma:       ["#00F0FF", "#7AD7F0", "#B14AED", "#FF00AA", "#FF6EC7"],
  blue:         ["#00F0FF", "#33C6E0", "#1F8FB0", "#0E5970", "#4DD9FF"],
  magenta:      ["#FF00AA", "#FF52C8", "#C2348B", "#7A1F58", "#FF80D5"],
  primarios:    ["#E8000D", "#1A56DB", "#F5C518"],
  primarios_sec:["#E8000D", "#F4511E", "#F5C518", "#22A045", "#1A56DB", "#9B30FF"],
};

const bgColorMap: Record<string, { bg: string; text: string; nodeBorder: string }> = {
  black: { bg: "#0A0A0A", text: "#E0E0E0", nodeBorder: "#0A0A0A" },
  gray:  { bg: "#6B7280", text: "#1C1C1E", nodeBorder: "#4B5563" },
  white: { bg: "#FFFFFF",  text: "#1C1C1E", nodeBorder: "#FFFFFF"  },
};

export default function SankeyChart({ data, mapping, options, domId }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // ── Pan/zoom mode toggle ────────────────────────────────────────────────────
  // panMode=false → Plotly handles mouse (drag nodes/ribbons)
  // panMode=true  → CSS transform pan/zoom active
  const [panMode, setPanMode] = useState(false);
  const panModeRef = useRef(false);
  panModeRef.current = panMode;

  // ── Pan + zoom (transform CSS sobre el contenedor del gráfico) ──────────────
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const dragRef = useRef<{ active: boolean; px: number; py: number }>({
    active: false, px: 0, py: 0,
  });

  const resetView = useCallback(() => setView({ x: 0, y: 0, k: 1 }), []);

  const zoomCenter = useCallback((factor: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const cx = el.clientWidth / 2;
    const cy = el.clientHeight / 2;
    setView((v) => {
      const nk = Math.max(0.4, Math.min(8, v.k * factor));
      return { k: nk, x: cx - (cx - v.x) * (nk / v.k), y: cy - (cy - v.y) * (nk / v.k) };
    });
  }, []);

  // Listener de rueda nativo (non-passive) para poder usar preventDefault
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!panModeRef.current) return; // let Plotly handle events in edit mode
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const { x, y, k } = viewRef.current;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const nk = Math.max(0.4, Math.min(8, k * factor));
      setView({
        k: nk,
        x: cx - (cx - x) * (nk / k),
        y: cy - (cy - y) * (nk / k),
      });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!panModeRef.current) return;
    dragRef.current = { active: true, px: e.clientX, py: e.clientY };
  }, []);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.px;
    const dy = e.clientY - dragRef.current.py;
    dragRef.current.px = e.clientX;
    dragRef.current.py = e.clientY;
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  }, []);
  const endDrag = useCallback(() => { dragRef.current.active = false; }, []);

  useEffect(() => {
    if (!ref.current) return;
    const srcCol = data.columns.indexOf(mapping.source as string);
    const tgtCol = data.columns.indexOf(mapping.target as string);
    const valCol = data.columns.indexOf(mapping.value as string);
    if (srcCol < 0 || tgtCol < 0 || valCol < 0) return;

    const labels: string[] = [];
    const idx = (name: string) => {
      let i = labels.indexOf(name);
      if (i === -1) {
        labels.push(name);
        i = labels.length - 1;
      }
      return i;
    };

    const sources: number[] = [];
    const targets: number[] = [];
    const values: number[] = [];
    for (const r of data.rows) {
      const s = r[srcCol];
      const t = r[tgtCol];
      const v = r[valCol];
      if (s === null || t === null || v === null) continue;
      sources.push(idx(String(s)));
      targets.push(idx(String(t)));
      values.push(Number(v));
    }

    const paletteKey   = (options.palette as string) || "plasma";
    const palette      = palettes[paletteKey] || palettes.plasma;
    const customColors = (options.customColors as Record<string, string>) || {};
    const useCustom    = paletteKey === "personalizado";
    const nodeColors   = labels.map((lbl, i) => {
      const fallback = palette[i % palette.length];
      return useCustom && customColors[lbl] ? customColors[lbl] : fallback;
    });
    const linkColors   = sources.map((s) => nodeColors[s] + "55");
    const title = (options.title as string) || "";
    const showLabels = options.showLegend !== false;

    const bgKey       = (options.bgColor       as string) || "black";
    const bg          = bgColorMap[bgKey] ?? bgColorMap.black;
    const nodePad     = Math.max(5,  Math.min(120, Number(options.nodePad)       || 40));
    const nodeThick   = Math.max(5,  Math.min(60,  Number(options.nodeThickness) || 20));

    Plotly.react(
      ref.current,
      [
        {
          type: "sankey",
          orientation: "h",
          node: {
            label: showLabels ? labels : labels.map(() => ""),
            color: nodeColors,
            pad: nodePad,
            thickness: nodeThick,
            line: { color: bg.nodeBorder, width: 1 },
          },
          link: {
            source: sources,
            target: targets,
            value: values,
            color: linkColors,
          },
        } as Data,
      ],
      {
        title: title
          ? {
              text: title,
              font: { color: bg.text, family: "Orbitron", size: 18 },
            }
          : undefined,
        paper_bgcolor: bg.bg,
        plot_bgcolor: bg.bg,
        font: { color: bg.text, family: "Calibri, 'Segoe UI', sans-serif" },
        margin: { l: 20, r: 20, t: title ? 50 : 20, b: 20 },
      },
      { responsive: true, displaylogo: false }
    );

    const el = ref.current;
    return () => {
      if (el) Plotly.purge(el);
    };
  }, [data, mapping, options]);

  return (
    <div
      ref={wrapRef}
      className={`relative w-full h-full min-h-[620px] overflow-hidden select-none ${panMode ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      onDoubleClick={panMode ? resetView : undefined}
    >
      {/* Toolbar */}
      <div className="absolute top-2 right-2 z-10 flex gap-1">
        {panMode && (
          <>
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => zoomCenter(1.25)}
              title="Zoom in"
              className="text-[11px] px-2 py-1 rounded border border-plasma-blue/40 bg-graphite/80 text-text-neon hover:border-plasma-blue hover:shadow-glow-blue transition-all"
            >＋</button>
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => zoomCenter(1 / 1.25)}
              title="Zoom out"
              className="text-[11px] px-2 py-1 rounded border border-plasma-blue/40 bg-graphite/80 text-text-neon hover:border-plasma-blue hover:shadow-glow-blue transition-all"
            >－</button>
          </>
        )}
        {(view.k !== 1 || view.x !== 0 || view.y !== 0) && (
          <button
            type="button"
            onClick={resetView}
            onMouseDown={(e) => e.stopPropagation()}
            className="text-[11px] px-2 py-1 rounded border border-plasma-blue/40 bg-graphite/80 text-text-neon hover:border-plasma-blue hover:shadow-glow-blue transition-all"
          >
            ⛶ Reset
          </button>
        )}
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setPanMode((m) => !m)}
          title={panMode ? "Volver al modo edición (arrastrar nodos)" : "Activar modo pan/zoom"}
          className={`text-[11px] px-2 py-1 rounded border transition-all ${
            panMode
              ? "border-plasma-magenta/60 bg-graphite/80 text-plasma-magenta hover:border-plasma-magenta"
              : "border-white/20 bg-graphite/80 text-text-muted hover:border-white/40"
          }`}
        >
          {panMode ? "↖ Editar" : "✥ Pan"}
        </button>
      </div>
      <div
        id={domId}
        ref={ref}
        className="w-full h-full min-h-[620px]"
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
          transformOrigin: "0 0",
        }}
      />
    </div>
  );
}
