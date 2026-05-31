import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { ChartDefinition, ChartProps } from "../types";

export const bubbleNetworkDefinition: Omit<ChartDefinition, "renderComponent"> = {
  id: "bubblenetwork",
  label: "Bubble Network",
  description: "Network diagram with variable node size proportional to a numeric value.",
  icon: "◉",
  engine: "d3",
  requiredFields: [
    {
      key: "source",
      label: "Nodo origen",
      dtype: "string",
    },
    {
      key: "target",
      label: "Nodo destino",
      dtype: "string",
    },
    {
      key: "nodeValue",
      label: "Valor del nodo origen",
      dtype: "number",
      help: "Define el tamaño del nodo. Cada fila asigna este valor al nodo origen; si un nodo aparece varias veces se usa el primero no nulo.",
    },
    {
      key: "weight",
      label: "Peso del enlace",
      dtype: "number",
      optional: true,
      help: "Controla el grosor de la línea que une los nodos.",
    },
    {
      key: "group",
      label: "Grupo (color de nodo)",
      dtype: "string",
      optional: true,
      help: "Agrupa nodos por color. Si se deja vacío el color se asigna por nodo.",
    },
  ],
  defaultExample: {
    data: {
      columns: ["source", "target", "stars_k", "weight"],
      rows: [
        // JS ecosystem — GitHub stars (thousands)
        ["D3.js",       "Vega",       280, 4],
        ["D3.js",       "Plotly",     280, 3],
        ["React",       "Next.js",    410, 6],
        ["React",       "Vue",        410, 2],
        ["Vue",         "Nuxt",       190, 5],
        ["Svelte",      "SvelteKit",   85, 4],
        ["Next.js",     "Vercel",     200, 5],
        ["Plotly",      "Dash",       120, 4],
        ["TypeScript",  "React",      370, 6],
        ["TypeScript",  "Vue",        370, 4],
        ["Vega",        "Vega-Lite",   60, 5],
        ["Python",      "Plotly",     500, 3],
        ["Python",      "D3.js",      500, 2],
        ["Nuxt",        "Vue",         75, 3],
        ["SvelteKit",   "Svelte",      55, 3],
        ["Vercel",      "Next.js",    150, 4],
        ["Dash",        "Python",      90, 3],
        ["Vega-Lite",   "Vega",        45, 4],
      ],
    },
    mapping: { source: "source", target: "target", nodeValue: "stars_k", weight: "weight" },
  },
  optionsSchema: [
    { key: "title",     label: "Título",            type: "text",    default: "",    group: "Referencias" },
    { key: "showLabels",label: "Mostrar etiquetas", type: "boolean", default: true,  group: "Referencias" },
    { key: "showValues",label: "Mostrar valor en el nodo", type: "boolean", default: true, group: "Referencias" },
    { key: "minRadius", label: "Radio mínimo",      type: "number",  default: 8,     group: "Estilo" },
    { key: "maxRadius", label: "Radio máximo",      type: "number",  default: 44,    group: "Estilo" },
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
      label: "Colores por nodo / grupo",
      type: "custom-palette",
      default: {},
      dataKey: ["source", "target", "group"],
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

// ── Paletas ──────────────────────────────────────────────────────────────────
const palettes: Record<string, string[]> = {
  plasma:        ["#00F0FF", "#B14AED", "#FF00AA", "#7AD7F0", "#FF6EC7"],
  primarios:     ["#E8000D", "#1A56DB", "#F5C518"],
  primarios_sec: ["#E8000D", "#F4511E", "#F5C518", "#22A045", "#1A56DB", "#9B30FF"],
};

const bgMap: Record<string, { bg: string; text: string; link: string }> = {
  black: { bg: "#0A0A0A", text: "#E0E0E0", link: "rgba(255,255,255,0.18)" },
  gray:  { bg: "#6B7280", text: "#1C1C1E", link: "rgba(0,0,0,0.28)" },
  white: { bg: "#FFFFFF",  text: "#1C1C1E", link: "rgba(0,0,0,0.18)" },
};

// ── Tipos internos ────────────────────────────────────────────────────────────
type NodeDatum = d3.SimulationNodeDatum & {
  id: string;
  group: string;
  value: number;   // valor numérico para el radio
  r: number;       // radio calculado
};
type LinkDatum = d3.SimulationLinkDatum<NodeDatum> & { weight: number };

// ── Componente ────────────────────────────────────────────────────────────────
export default function BubbleNetwork({ data, mapping, options, domId }: ChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef  = useRef<SVGSVGElement>(null);
  const simRef  = useRef<d3.Simulation<NodeDatum, LinkDatum> | null>(null);

  useEffect(() => {
    if (!svgRef.current || !wrapRef.current) return;

    simRef.current?.stop();
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // ── Índices de columnas ──────────────────────────────────────────────
    const srcCol  = data.columns.indexOf(mapping.source    as string);
    const tgtCol  = data.columns.indexOf(mapping.target    as string);
    const valCol  = data.columns.indexOf(mapping.nodeValue as string);
    if (srcCol < 0 || tgtCol < 0 || valCol < 0) return;

    const wCol    = mapping.weight ? data.columns.indexOf(mapping.weight as string) : -1;
    const grpCol  = mapping.group  ? data.columns.indexOf(mapping.group  as string) : -1;

    // ── Opciones ──────────────────────────────────────────────────────────
    const bgKey      = (options.bgColor  as string) || "black";
    const bg         = bgMap[bgKey] ?? bgMap.black;
    const paletteKey = (options.palette  as string) || "plasma";
    const palette    = palettes[paletteKey] || palettes.plasma;
    const customColors = (options.customColors as Record<string, string>) || {};
    const useCustom  = paletteKey === "personalizado";
    const showLabels = options.showLabels !== false;
    const showValues = options.showValues !== false;
    const minR       = Math.max(4,  Math.min(60, Number(options.minRadius) || 8));
    const maxR       = Math.max(minR + 4, Math.min(100, Number(options.maxRadius) || 44));
    const title      = (options.title as string) || "";

    const W      = wrapRef.current.clientWidth  || 720;
    const H      = wrapRef.current.clientHeight || 540;
    const topPad = title ? 44 : 16;

    svg.attr("width", W).attr("height", H).style("background", bg.bg);

    if (title) {
      svg.append("text")
        .attr("x", W / 2).attr("y", 28).attr("text-anchor", "middle")
        .style("font-family", "Orbitron, sans-serif").style("font-size", "16px")
        .style("fill", bg.text).text(title);
    }

    // ── Construcción de nodos y links ────────────────────────────────────
    // nodeValueMap: primer valor no-nulo encontrado por nodo-id
    const nodeValueMap: Record<string, number> = {};
    const groupMap:     Record<string, string> = {};
    const nodeSet    = new Set<string>();
    const rawLinks: { src: string; tgt: string; w: number }[] = [];

    for (const r of data.rows) {
      const s = r[srcCol], t = r[tgtCol], v = r[valCol];
      if (s === null || t === null) continue;
      const sId = String(s), tId = String(t);
      nodeSet.add(sId);
      nodeSet.add(tId);
      // Asignar valor solo una vez (primer no-nulo)
      if (nodeValueMap[sId] === undefined && v !== null && !isNaN(Number(v))) {
        nodeValueMap[sId] = Number(v);
      }
      if (grpCol >= 0 && r[grpCol] !== null) groupMap[sId] = String(r[grpCol]);
      rawLinks.push({
        src: sId,
        tgt: tId,
        w: wCol >= 0 && r[wCol] !== null ? Number(r[wCol]) || 1 : 1,
      });
    }

    const nodeList = Array.from(nodeSet);
    const groups   = Array.from(new Set(Object.values(groupMap)));
    const maxW     = Math.max(...rawLinks.map((l) => l.w), 1);

    // Escala de radio: raíz cuadrada → proporcional al área del círculo
    const allValues = nodeList.map((id) => nodeValueMap[id] ?? 0);
    const maxVal    = d3.max(allValues) || 1;
    const radiusScale = d3.scaleSqrt<number>()
      .domain([0, maxVal])
      .range([minR, maxR]);

    // Función de color por nodo
    const nodeColor = (d: NodeDatum) => {
      const fallback = groupMap[d.id]
        ? palette[groups.indexOf(d.group) % palette.length]
        : palette[nodeList.indexOf(d.id) % palette.length];
      if (!useCustom) return fallback;
      if (customColors[d.id])    return customColors[d.id];
      if (d.group && customColors[d.group]) return customColors[d.group];
      return fallback;
    };

    const nodes: NodeDatum[] = nodeList.map((id) => {
      const val = nodeValueMap[id] ?? 0;
      return { id, group: groupMap[id] || "", value: val, r: radiusScale(val) };
    });
    const links: LinkDatum[] = rawLinks.map(({ src, tgt, w }) => ({
      source: src, target: tgt, weight: w,
    }));

    // ── Grupo principal (para zoom/pan) ───────────────────────────────────
    const gMain = svg.append("g");

    // Links
    const linkSel = gMain.append("g").selectAll<SVGLineElement, LinkDatum>("line")
      .data(links).join("line")
      .attr("stroke", bg.link)
      .attr("stroke-width", (d) => 1 + (d.weight / maxW) * 5)
      .attr("stroke-linecap", "round");

    // Nodos
    const nodeG = gMain.append("g").selectAll<SVGGElement, NodeDatum>("g")
      .data(nodes).join("g")
      .attr("cursor", "grab");

    // Círculo exterior (glow sutil)
    nodeG.append("circle")
      .attr("r", (d) => d.r + 3)
      .attr("fill", "none")
      .attr("stroke", nodeColor)
      .attr("stroke-width", 1)
      .attr("opacity", 0.25);

    // Círculo principal
    nodeG.append("circle")
      .attr("r", (d) => d.r)
      .attr("fill", nodeColor)
      .attr("opacity", 0.88)
      .attr("stroke", bg.bg)
      .attr("stroke-width", 1.5);

    // Valor dentro del nodo (solo si el radio es suficientemente grande)
    if (showValues) {
      nodeG.each(function (d) {
        const fontSize = Math.min(d.r * 0.5, 14);
        if (d.r < 12) return; // nodo demasiado pequeño
        const label = d.value >= 1000
          ? `${(d.value / 1000).toFixed(1)}k`
          : String(d.value);
        d3.select(this).append("text")
          .attr("dy", showLabels ? "-0.25em" : "0.35em")
          .attr("text-anchor", "middle")
          .style("font-family", "Calibri, 'Segoe UI', sans-serif")
          .style("font-size", `${fontSize}px`)
          .style("font-weight", "700")
          .style("fill", "#0A0A0A")
          .style("pointer-events", "none")
          .text(label);
      });
    }

    // Etiquetas de nombre fuera del nodo
    if (showLabels) {
      nodeG.append("text")
        .attr("dy", (d) => d.r + 13)
        .attr("text-anchor", "middle")
        .style("font-family", "Calibri, 'Segoe UI', sans-serif")
        .style("font-size", "11px")
        .style("fill", bg.text)
        .style("pointer-events", "none")
        .text((d) => d.id.length > 18 ? d.id.slice(0, 16) + "…" : d.id);
    }

    // ── Simulación de fuerzas ─────────────────────────────────────────────
    const sim = d3.forceSimulation<NodeDatum>(nodes)
      .force("link",
        d3.forceLink<NodeDatum, LinkDatum>(links)
          .id((d) => d.id)
          .distance((d) => {
            const s = d.source as NodeDatum;
            const t = d.target as NodeDatum;
            return s.r + t.r + 40;
          })
      )
      .force("charge",  d3.forceManyBody().strength(-280))
      .force("center",  d3.forceCenter(W / 2, (H + topPad) / 2))
      .force("collide", d3.forceCollide<NodeDatum>().radius((d) => d.r + 10));

    simRef.current = sim;

    sim.on("tick", () => {
      linkSel
        .attr("x1", (d) => (d.source as NodeDatum).x ?? 0)
        .attr("y1", (d) => (d.source as NodeDatum).y ?? 0)
        .attr("x2", (d) => (d.target as NodeDatum).x ?? 0)
        .attr("y2", (d) => (d.target as NodeDatum).y ?? 0);
      nodeG.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    // ── Drag de nodos ──────────────────────────────────────────────────────
    function dragStarted(event: d3.D3DragEvent<SVGGElement, NodeDatum, NodeDatum>, d: NodeDatum) {
      if (!event.active) sim.alphaTarget(0.3).restart();
      d.fx = d.x; d.fy = d.y;
      d3.select(event.sourceEvent.currentTarget as SVGGElement).attr("cursor", "grabbing");
    }
    function dragged(event: d3.D3DragEvent<SVGGElement, NodeDatum, NodeDatum>, d: NodeDatum) {
      d.fx = event.x; d.fy = event.y;
    }
    function dragEnded(event: d3.D3DragEvent<SVGGElement, NodeDatum, NodeDatum>, d: NodeDatum) {
      if (!event.active) sim.alphaTarget(0);
      d3.select(event.sourceEvent.currentTarget as SVGGElement).attr("cursor", "grab");
    }

    nodeG.call(
      d3.drag<SVGGElement, NodeDatum>()
        .on("start", dragStarted)
        .on("drag",  dragged)
        .on("end",   dragEnded)
    );

    // ── Tooltip al hacer hover sobre nodo ────────────────────────────────
    const tooltip = d3.select(wrapRef.current)
      .selectAll<HTMLDivElement, unknown>(".bn-tooltip")
      .data([null])
      .join("div")
      .attr("class", "bn-tooltip")
      .style("position", "absolute")
      .style("pointer-events", "none")
      .style("background", "rgba(10,10,10,0.9)")
      .style("border", "1px solid #00F0FF44")
      .style("border-radius", "6px")
      .style("padding", "6px 10px")
      .style("font-family", "Calibri, 'Segoe UI', sans-serif")
      .style("font-size", "11px")
      .style("color", "#E0E0E0")
      .style("opacity", "0")
      .style("transition", "opacity 0.15s");

    nodeG
      .on("mouseenter", function (event, d) {
        d3.select(this).select("circle:nth-child(2)").attr("opacity", 1);
        const label = d.value >= 1000
          ? `${(d.value / 1000).toFixed(2)}k`
          : String(d.value);
        tooltip
          .html(`<strong style="color:#00F0FF">${d.id}</strong><br/>Valor: ${label}${d.group ? `<br/>Grupo: ${d.group}` : ""}`)
          .style("opacity", "1");
      })
      .on("mousemove", function (event) {
        const [mx, my] = d3.pointer(event, wrapRef.current!);
        tooltip.style("left", `${mx + 14}px`).style("top", `${my - 10}px`);
      })
      .on("mouseleave", function () {
        d3.select(this).select("circle:nth-child(2)").attr("opacity", 0.88);
        tooltip.style("opacity", "0");
      });

    // ── Zoom y pan ────────────────────────────────────────────────────────
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.15, 8])
        .on("zoom", (e) => gMain.attr("transform", e.transform))
        .filter((event) =>
          event.type === "wheel" ||
          (event.touches && event.touches.length >= 2) ||
          event.type === "dblclick"
        )
    );

    return () => { sim.stop(); };
  }, [data, mapping, options]);

  return (
    <div
      id={domId}
      ref={wrapRef}
      className="w-full h-full min-h-[500px] overflow-hidden select-none relative"
    >
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}
