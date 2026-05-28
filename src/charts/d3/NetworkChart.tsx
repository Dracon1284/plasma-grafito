import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { ChartDefinition, ChartProps } from "../types";

export const networkDefinition: Omit<ChartDefinition, "renderComponent"> = {
  id: "network",
  label: "Diagrama de Redes",
  description: "Nodos y conexiones con layout de fuerza. Arrastrá los nodos para reposicionarlos.",
  icon: "⬡",
  engine: "d3",
  requiredFields: [
    { key: "source", label: "Nodo origen",  dtype: "string" },
    { key: "target", label: "Nodo destino", dtype: "string" },
    { key: "weight", label: "Peso del enlace",         dtype: "number", optional: true },
    { key: "group",  label: "Grupo (color de nodo)",   dtype: "string", optional: true },
  ],
  defaultExample: {
    data: {
      columns: ["source", "target", "weight"],
      rows: [
        ["Alice","Bob",3],["Alice","Carol",2],["Bob","Dave",4],["Carol","Eve",1],
        ["Dave","Frank",2],["Eve","Frank",3],["Frank","Grace",5],["Grace","Alice",2],
        ["Bob","Eve",1],["Carol","Dave",2],["Alice","Frank",1],["Grace","Dave",3],
      ],
    },
    mapping: { source: "source", target: "target", weight: "weight" },
  },
  optionsSchema: [
    { key: "title",      label: "Título",           type: "text",    default: "",     group: "Referencias" },
    { key: "showLabels", label: "Mostrar etiquetas", type: "boolean", default: true,   group: "Referencias" },
    { key: "nodeRadius", label: "Radio de nodos",    type: "number",  default: 10,     group: "Estilo" },
    {
      key: "palette",
      label: "Paleta de nodos",
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

const palettes: Record<string, string[]> = {
  plasma:        ["#00F0FF","#B14AED","#FF00AA","#7AD7F0","#FF6EC7"],
  primarios:     ["#E8000D","#1A56DB","#F5C518"],
  primarios_sec: ["#E8000D","#F4511E","#F5C518","#22A045","#1A56DB","#9B30FF"],
};

const bgMap: Record<string, { bg: string; text: string; link: string }> = {
  black: { bg: "#0A0A0A", text: "#E0E0E0", link: "rgba(255,255,255,0.15)" },
  gray:  { bg: "#6B7280", text: "#1C1C1E", link: "rgba(0,0,0,0.25)" },
  white: { bg: "#FFFFFF",  text: "#1C1C1E", link: "rgba(0,0,0,0.15)" },
};

type NodeDatum = d3.SimulationNodeDatum & { id: string; group: string };
type LinkDatum = d3.SimulationLinkDatum<NodeDatum> & { weight: number };

export default function NetworkChart({ data, mapping, options, domId }: ChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef  = useRef<SVGSVGElement>(null);
  const simRef  = useRef<d3.Simulation<NodeDatum, LinkDatum> | null>(null);

  useEffect(() => {
    if (!svgRef.current || !wrapRef.current) return;

    // Detener simulación previa si existe
    simRef.current?.stop();

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const srcCol = data.columns.indexOf(mapping.source as string);
    const tgtCol = data.columns.indexOf(mapping.target as string);
    if (srcCol < 0 || tgtCol < 0) return;

    const wCol   = mapping.weight ? data.columns.indexOf(mapping.weight as string) : -1;
    const grpCol = mapping.group  ? data.columns.indexOf(mapping.group  as string) : -1;

    const bgKey    = (options.bgColor  as string) || "black";
    const bg       = bgMap[bgKey] ?? bgMap.black;
    const paletteKey   = (options.palette as string) || "plasma";
    const palette      = palettes[paletteKey] || palettes.plasma;
    const customColors = (options.customColors as Record<string, string>) || {};
    const useCustom    = paletteKey === "personalizado";
    const showLabels = options.showLabels !== false;
    const nodeR    = Math.max(4, Math.min(30, Number(options.nodeRadius) || 10));
    const title    = (options.title as string) || "";

    const W = wrapRef.current.clientWidth  || 700;
    const H = wrapRef.current.clientHeight || 520;
    const topPad = title ? 42 : 16;

    svg.attr("width", W).attr("height", H).style("background", bg.bg);

    if (title) {
      svg.append("text")
        .attr("x", W / 2).attr("y", 28).attr("text-anchor", "middle")
        .style("font-family", "Orbitron, sans-serif").style("font-size", "16px")
        .style("fill", bg.text).text(title);
    }

    // Construir nodos y links
    const nodeSet = new Set<string>();
    const rawLinks: { src: string; tgt: string; w: number }[] = [];
    for (const r of data.rows) {
      const s = r[srcCol], t = r[tgtCol];
      if (s === null || t === null) continue;
      nodeSet.add(String(s)); nodeSet.add(String(t));
      rawLinks.push({ src: String(s), tgt: String(t), w: wCol >= 0 ? Number(r[wCol]) || 1 : 1 });
    }

    const groupMap: Record<string, string> = {};
    if (grpCol >= 0) {
      for (const r of data.rows) {
        const s = r[srcCol], g = r[grpCol];
        if (s !== null && g !== null) groupMap[String(s)] = String(g);
      }
    }
    const groups = Array.from(new Set(Object.values(groupMap)));
    const nodeList = Array.from(nodeSet);
    const nodeColor = (d: NodeDatum) => {
      const fallback = groupMap[d.id]
        ? palette[groups.indexOf(d.group) % palette.length]
        : palette[nodeList.indexOf(d.id) % palette.length];
      if (!useCustom) return fallback;
      // Prioridad: color del nodo por id → color del grupo → fallback
      if (customColors[d.id]) return customColors[d.id];
      if (d.group && customColors[d.group]) return customColors[d.group];
      return fallback;
    };

    const nodes: NodeDatum[] = Array.from(nodeSet).map((id) => ({ id, group: groupMap[id] || "" }));
    const links: LinkDatum[] = rawLinks.map(({ src, tgt, w }) => ({
      source: src, target: tgt, weight: w,
    }));
    const maxW = Math.max(...links.map((l) => l.weight), 1);

    // Grupo principal (zoom)
    const gMain = svg.append("g");

    // Links
    const linkSel = gMain.append("g").selectAll<SVGLineElement, LinkDatum>("line")
      .data(links).join("line")
      .attr("stroke", bg.link)
      .attr("stroke-width", (d) => 1 + (d.weight / maxW) * 5);

    // Nodos
    const nodeG = gMain.append("g").selectAll<SVGGElement, NodeDatum>("g")
      .data(nodes).join("g")
      .attr("cursor", "grab");

    nodeG.append("circle")
      .attr("r", nodeR)
      .attr("fill", nodeColor)
      .attr("opacity", 0.9)
      .attr("stroke", bg.bg).attr("stroke-width", 1.5);

    if (showLabels) {
      nodeG.append("text")
        .attr("dy", "0.35em").attr("x", nodeR + 4)
        .style("font-family", "Inter, sans-serif").style("font-size", "11px")
        .style("fill", bg.text).style("pointer-events", "none")
        .text((d) => d.id);
    }

    // ── Simulación en vivo ──────────────────────────────────────────────────
    const sim = d3.forceSimulation<NodeDatum>(nodes)
      .force("link",    d3.forceLink<NodeDatum, LinkDatum>(links).id((d) => d.id).distance(90))
      .force("charge",  d3.forceManyBody().strength(-220))
      .force("center",  d3.forceCenter(W / 2, (H + topPad) / 2))
      .force("collide", d3.forceCollide(nodeR + 8));

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
      // Mantener el nodo fijo donde se soltó (fx/fy quedan seteados)
      d3.select(event.sourceEvent.currentTarget as SVGGElement).attr("cursor", "grab");
    }

    nodeG.call(
      d3.drag<SVGGElement, NodeDatum>()
        .on("start", dragStarted)
        .on("drag",  dragged)
        .on("end",   dragEnded)
    );

    // ── Zoom y pan ──────────────────────────────────────────────────────────
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 6])
        .on("zoom", (e) => gMain.attr("transform", e.transform))
        // filtrar que el zoom no reaccione al click simple (solo scroll/pinch/doble)
        .filter((event) => event.type === "wheel" || event.touches?.length >= 2 || event.type === "dblclick")
    );

    return () => { sim.stop(); };
  }, [data, mapping, options]);

  return (
    <div id={domId} ref={wrapRef} className="w-full h-full min-h-[500px] overflow-hidden select-none">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}
