import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import * as d3 from "d3";
import type { ChartDefinition, ChartProps } from "../types";

export const timelineDefinition: Omit<ChartDefinition, "renderComponent"> = {
  id: "timeline",
  label: "Phase Timeline",
  description: "Duration events ordered chronologically by phase/group.",
  icon: "▶",
  engine: "d3",
  requiredFields: [
    { key: "label", label: "Evento / tarea",          dtype: "string" },
    { key: "start", label: "Fecha inicio (YYYY-MM-DD)", dtype: "string",
      help: "Formato YYYY-MM-DD." },
    { key: "end",   label: "Fecha fin (YYYY-MM-DD)",    dtype: "string" },
    { key: "group", label: "Grupo / categoría",         dtype: "string", optional: true },
  ],
  defaultExample: {
    data: {
      columns: ["task","start","end","phase"],
      rows: [
        ["Research",       "2024-01-08","2024-02-02","Planning"],
        ["UX Design",      "2024-01-22","2024-02-16","Design"],
        ["Visual Design",  "2024-02-05","2024-03-01","Design"],
        ["Backend Dev",    "2024-02-19","2024-04-12","Development"],
        ["Frontend Dev",   "2024-03-04","2024-04-26","Development"],
        ["Testing",        "2024-04-15","2024-05-10","QA"],
        ["Launch",         "2024-05-06","2024-05-17","Deploy"],
      ],
    },
    mapping: { label: "task", start: "start", end: "end", group: "phase" },
  },
  optionsSchema: [
    { key: "title",  label: "Título",  type: "text",   default: "",  group: "Referencias" },
    { key: "showGroupLegend", label: "Mostrar leyenda de grupos", type: "boolean", default: true, group: "Referencias" },
    { key: "fitToText", label: "Ajustar barras al texto", type: "boolean", default: false, group: "Estilo" },
    { key: "labelWidth", label: "Ancho de etiquetas (eje Y)", type: "number", default: 160, group: "Estilo" },
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
      label: "Colores por grupo / evento",
      type: "custom-palette",
      default: {},
      dataKey: ["group", "label"],
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
  plasma:        ["#00F0FF","#B14AED","#FF00AA","#7AD7F0","#FF6EC7","#4DD9FF"],
  primarios:     ["#E8000D","#1A56DB","#F5C518"],
  primarios_sec: ["#E8000D","#F4511E","#F5C518","#22A045","#1A56DB","#9B30FF"],
};

const bgMap: Record<string, { bg: string; text: string; grid: string; stripe: string }> = {
  black: { bg: "#0A0A0A", text: "#E0E0E0", grid: "rgba(255,255,255,0.06)", stripe: "rgba(255,255,255,0.03)" },
  gray:  { bg: "#6B7280", text: "#1C1C1E", grid: "rgba(0,0,0,0.12)",       stripe: "rgba(0,0,0,0.06)" },
  white: { bg: "#FFFFFF",  text: "#1C1C1E", grid: "rgba(0,0,0,0.08)",       stripe: "rgba(0,0,0,0.03)" },
};

function parseDate(v: string | number | null): Date | null {
  if (v === null) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

// Mide el ancho de un texto en px (para "ajustar barras al texto")
let _measureCtx: CanvasRenderingContext2D | null = null;
function measureText(txt: string, fontPx: number): number {
  if (!_measureCtx) _measureCtx = document.createElement("canvas").getContext("2d");
  if (!_measureCtx) return txt.length * fontPx * 0.6;
  _measureCtx.font = `${fontPx}px Calibri, 'Segoe UI', sans-serif`;
  return _measureCtx.measureText(txt).width;
}

type Item = { label: string; start: Date; end: Date; group: string };

export default function TimelineChart({ data, mapping, options, domId }: ChartProps) {
  const { t } = useTranslation();
  const wrapRef  = useRef<HTMLDivElement>(null);
  const svgRef   = useRef<SVGSVGElement>(null);
  const zoomRef  = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const [order, setOrder] = useState<number[]>([]);
  const [resetTick, setResetTick] = useState(0);

  // Reinicia el orden cuando cambian los datos
  useEffect(() => {
    const labelIdx = data.columns.indexOf((mapping.label as string) || "");
    const startIdx = data.columns.indexOf((mapping.start as string) || "");
    const endIdx   = data.columns.indexOf((mapping.end   as string) || "");
    if (labelIdx < 0 || startIdx < 0 || endIdx < 0) { setOrder([]); return; }
    const validIdx = data.rows
      .map((r, i) => ({ i, ok: parseDate(r[startIdx]) !== null && parseDate(r[endIdx]) !== null }))
      .filter((x) => x.ok).map((x) => x.i);
    setOrder(validIdx);
  }, [data, mapping]);

  useEffect(() => {
    if (!svgRef.current || !wrapRef.current || order.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const labelIdx = data.columns.indexOf((mapping.label as string) || "");
    const startIdx = data.columns.indexOf((mapping.start as string) || "");
    const endIdx   = data.columns.indexOf((mapping.end   as string) || "");
    const grpIdx   = mapping.group ? data.columns.indexOf(mapping.group as string) : -1;

    const bgKey   = (options.bgColor as string) || "black";
    const bg      = bgMap[bgKey] ?? bgMap.black;
    const paletteKey   = (options.palette as string) || "plasma";
    const palette      = paletteMap[paletteKey] || paletteMap.plasma;
    const customColors = (options.customColors as Record<string, string>) || {};
    const useCustom    = paletteKey === "personalizado";
    const title        = (options.title as string) || "";
    const fitToText      = options.fitToText === true;
    const showGroupLegend = options.showGroupLegend !== false;
    const labelW       = Math.max(40, Math.min(400, Number(options.labelWidth) || 160));

    // Construye los items según el orden actual
    const items: Item[] = order.flatMap((ri) => {
      const r = data.rows[ri];
      const s = parseDate(r[startIdx]), e = parseDate(r[endIdx]);
      if (!s || !e) return [];
      return [{ label: String(r[labelIdx]), start: s, end: e,
                group: grpIdx >= 0 && r[grpIdx] !== null ? String(r[grpIdx]) : "—" }];
    });
    if (items.length === 0) return;

    const groups   = Array.from(new Set(items.map((i) => i.group)));
    const groupColor = (g: string) => {
      const fallback = palette[groups.indexOf(g) % palette.length];
      return useCustom && customColors[g] ? customColors[g] : fallback;
    };

    const W       = wrapRef.current.clientWidth || 720;
    const rowH    = 36;
    const handleW = 18;   // ancho del handle de drag
    const titleH  = title ? 36 : 12;
    const padBot  = 36;

    // ── Layout de la leyenda de grupos (arriba, con wrap) ──────────────
    const showLegend = showGroupLegend && grpIdx >= 0 && groups.length > 0;
    const legendItems: { g: string; x: number; y: number }[] = [];
    let legendH = 0;
    if (showLegend) {
      const swatch = 11, gap = 14, padX = labelW;
      let lx = padX, ly = 0;
      const avail = W - 20;
      groups.forEach((g) => {
        const itemW = swatch + 6 + g.length * 6.5 + gap;
        if (lx + itemW > avail && lx > padX) { lx = padX; ly += 20; }
        legendItems.push({ g, x: lx, y: ly });
        lx += itemW;
      });
      legendH = ly + 24;
    }

    const padTop  = titleH + legendH + 8;
    const H       = padTop + items.length * rowH + padBot;

    svg.attr("width", W).attr("height", H).style("background", bg.bg);

    if (title) {
      svg.append("text")
        .attr("x", W / 2).attr("y", 24).attr("text-anchor", "middle")
        .style("font-family", "Orbitron, sans-serif").style("font-size", "15px")
        .style("fill", bg.text).text(title);
    }

    // ── Leyenda de grupos ──────────────────────────────────────────────
    if (showLegend) {
      const legG = svg.append("g").attr("transform", `translate(0, ${titleH})`);
      legendItems.forEach(({ g, x, y }) => {
        legG.append("rect")
          .attr("x", x).attr("y", y).attr("width", 11).attr("height", 11)
          .attr("rx", 2).attr("fill", groupColor(g));
        legG.append("text")
          .attr("x", x + 16).attr("y", y + 9)
          .style("font-family", "Calibri, 'Segoe UI', sans-serif").style("font-size", "11px")
          .style("fill", bg.text).text(g);
      });
    }

    const allDates = items.flatMap((i) => [i.start, i.end]);
    const baseX = d3.scaleTime()
      .domain([d3.min(allDates)!, d3.max(allDates)!])
      .range([labelW, W - 20]).nice();

    // Aplicar zoom previo
    let currentX = zoomRef.current.rescaleX(baseX);

    // ── Clip path para la zona de barras ─────────────────────────────
    svg.append("defs").append("clipPath").attr("id", "bars-clip")
      .append("rect")
      .attr("x", labelW).attr("y", padTop)
      .attr("width", W - labelW - 20).attr("height", H - padTop - padBot);

    // ── Eje X (siempre visible) ───────────────────────────────────────
    const axisG = svg.append("g")
      .attr("transform", `translate(0,${H - padBot})`);

    const drawAxis = (xScale: d3.ScaleTime<number, number>) => {
      axisG.call(d3.axisBottom(xScale).ticks(7))
        .call((g) => {
          g.select(".domain").attr("stroke", bg.text).attr("opacity", 0.3);
          g.selectAll("text").style("fill", bg.text).style("font-size", "10px");
          g.selectAll(".tick line").attr("stroke", bg.text).attr("opacity", 0.3);
        });
    };
    drawAxis(currentX);

    // ── Grupo de barras (clippeado) ───────────────────────────────────
    const barsG = svg.append("g").attr("clip-path", "url(#bars-clip)");

    // Líneas de grilla verticales
    const gridLines = barsG.append("g").attr("class", "grid");
    const drawGrid = (xScale: d3.ScaleTime<number, number>) => {
      gridLines.selectAll("line").remove();
      xScale.ticks(7).forEach((t) => {
        gridLines.append("line")
          .attr("x1", xScale(t)).attr("x2", xScale(t))
          .attr("y1", padTop).attr("y2", H - padBot)
          .attr("stroke", bg.grid);
      });
    };
    drawGrid(currentX);

    // Filas
    const rowGroups = barsG.selectAll<SVGGElement, Item>("g.row")
      .data(items).join("g").attr("class", "row");

    const drawBars = (xScale: d3.ScaleTime<number, number>) => {
      rowGroups.each(function (item, i) {
        const g = d3.select(this);
        g.selectAll("*").remove();
        const y    = padTop + i * rowH;
        // Prioridad: color del evento (label) → color del grupo → fallback de paleta
        const color = useCustom && customColors[item.label]
          ? customColors[item.label]
          : groupColor(item.group);

        // stripe
        if (i % 2 === 0) {
          g.append("rect")
            .attr("x", labelW).attr("y", y)
            .attr("width", W - labelW - 20).attr("height", rowH)
            .attr("fill", bg.stripe);
        }

        const x1 = xScale(item.start);
        const x2 = xScale(item.end);
        let bw  = Math.max(x2 - x1, 4);

        // Ajustar barras al texto: agrandar la barra hasta que entre la etiqueta
        if (fitToText) {
          const need = measureText(item.label, 9) + 14;
          if (need > bw) bw = need;
        }

        g.append("rect")
          .attr("x", x1).attr("y", y + 7).attr("width", bw).attr("height", rowH - 14)
          .attr("fill", color).attr("rx", 3).attr("opacity", 0.88);

        if (fitToText) {
          g.append("text")
            .attr("x", x1 + bw / 2).attr("y", y + rowH / 2)
            .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
            .style("font-family", "Calibri, 'Segoe UI', sans-serif")
            .style("font-size", "9px").style("fill", "#0A0A0A").style("pointer-events", "none")
            .text(item.label);
        } else if (bw > 38) {
          g.append("text")
            .attr("x", x1 + bw / 2).attr("y", y + rowH / 2)
            .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
            .style("font-family", "Calibri, 'Segoe UI', sans-serif")
            .style("font-size", "9px").style("fill", "#0A0A0A").style("pointer-events", "none")
            .text(item.label.length > 16 ? item.label.slice(0, 14) + "…" : item.label);
        }
      });
    };
    drawBars(currentX);

    // ── Etiquetas del eje Y + handles de drag ─────────────────────────
    const labelsG = svg.append("g");

    items.forEach((item, i) => {
      const y = padTop + i * rowH;

      // handle ≡
      labelsG.append("text")
        .attr("x", handleW / 2).attr("y", y + rowH / 2)
        .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
        .style("font-size", "13px").style("fill", bg.text).style("opacity", "0.4")
        .style("cursor", "ns-resize").attr("class", `handle-${i}`)
        .text("≡");

      // label (truncado al ancho disponible salvo que fitToText esté activo)
      const availLabel = labelW - handleW - 12;
      let labelTxt = item.label;
      if (!fitToText && measureText(labelTxt, 11) > availLabel) {
        while (labelTxt.length > 1 && measureText(labelTxt + "…", 11) > availLabel) {
          labelTxt = labelTxt.slice(0, -1);
        }
        labelTxt += "…";
      }
      labelsG.append("text")
        .attr("x", labelW - 8).attr("y", y + rowH / 2)
        .attr("text-anchor", "end").attr("dominant-baseline", "middle")
        .style("font-family", "Calibri, 'Segoe UI', sans-serif").style("font-size", "11px")
        .style("fill", bg.text)
        .text(labelTxt);
    });

    // ── Drag de filas ─────────────────────────────────────────────────
    let dragSrcIdx = -1;
    let ghostY = 0;

    const ghostRect = svg.append("rect")
      .attr("x", handleW).attr("width", labelW - handleW)
      .attr("height", rowH).attr("fill", "rgba(0,240,255,0.15)")
      .attr("rx", 3).style("pointer-events", "none").attr("opacity", 0);

    // Hacemos draggable el área de labels
    const dragBehavior = d3.drag<SVGTextElement, unknown>()
      .on("start", function (_event) {
        const idx = +this.getAttribute("class")!.replace("handle-", "");
        dragSrcIdx = idx;
        ghostY = padTop + idx * rowH;
        ghostRect
          .attr("y", ghostY)
          .attr("opacity", 1);
      })
      .on("drag", function (event) {
        ghostY += event.dy;
        ghostRect.attr("y", ghostY);
      })
      .on("end", function () {
        ghostRect.attr("opacity", 0);
        if (dragSrcIdx < 0) return;
        const targetIdx = Math.max(0, Math.min(items.length - 1,
          Math.round((ghostY - padTop) / rowH)));
        if (targetIdx !== dragSrcIdx) {
          setOrder((prev) => {
            const next = [...prev];
            const [moved] = next.splice(dragSrcIdx, 1);
            next.splice(targetIdx, 0, moved);
            return next;
          });
        }
        dragSrcIdx = -1;
      });

    svg.selectAll<SVGTextElement, unknown>("text[class^='handle-']").call(dragBehavior);

    // ── Crosshair vertical ────────────────────────────────────────────────
    // Se declara antes del zoom para poder referenciarlo en los handlers
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

    svg.on("mousemove.crosshair", function (event) {
      const [mx, my] = d3.pointer(event, this);
      if (mx < labelW || mx > W - 20 || my < padTop || my > H - padBot) {
        crossG.attr("opacity", 0);
        return;
      }
      // currentX es la escala viva (actualizada por el zoom)
      const dateVal = currentX.invert(mx);
      const [d0, d1] = currentX.domain() as [Date, Date];
      const diffDays = (d1.getTime() - d0.getTime()) / 86_400_000;
      const fmt = diffDays < 120
        ? d3.timeFormat("%d %b %Y")
        : diffDays < 730
        ? d3.timeFormat("%b %Y")
        : d3.timeFormat("%Y");
      const txt = fmt(dateVal);

      crossG.attr("opacity", 1);
      crossG.select<SVGLineElement>(".ch-line").attr("x1", mx).attr("x2", mx);
      const t = crossG.select<SVGTextElement>(".ch-text").text(txt);
      const bbox = (t.node() as SVGTextElement).getBBox();
      crossG.select<SVGRectElement>(".ch-bg")
        .attr("x", mx - bbox.width / 2 - 6)
        .attr("width", bbox.width + 12);
      t.attr("x", mx);
    }).on("mouseleave.crosshair", function () {
      crossG.attr("opacity", 0);
    });

    // ── Zoom en X (scroll) + Pan horizontal (click + drag) ──────────────
    const zoomOverlay = svg.append("rect")
      .attr("x", labelW).attr("y", padTop)
      .attr("width", W - labelW - 20).attr("height", H - padTop - padBot)
      .attr("fill", "transparent")
      .style("cursor", "grab");

    const zoom = d3.zoom<SVGRectElement, unknown>()
      .scaleExtent([0.5, 40])
      .translateExtent([[labelW, 0], [W - 20, H]])
      .on("start", (event) => {
        if (event.sourceEvent?.type === "mousedown") {
          zoomOverlay.style("cursor", "grabbing");
          crossG.attr("opacity", 0);
        }
      })
      .on("zoom", (event) => {
        // Ignorar traslación Y para mantener el pan puramente horizontal
        const t = event.transform;
        const tX = d3.zoomIdentity.translate(t.x, 0).scale(t.k);
        zoomRef.current = tX;
        currentX = tX.rescaleX(baseX);
        drawAxis(currentX);
        drawGrid(currentX);
        drawBars(currentX);
      })
      .on("end", (event) => {
        if (event.sourceEvent?.type === "mouseup") {
          zoomOverlay.style("cursor", "grab");
        }
      });

    zoomOverlay.call(zoom);
    // Restaurar zoom previo sin disparar el evento (evita loop)
    zoomOverlay.call(zoom.transform, zoomRef.current);

  }, [data, mapping, options, order, resetTick]);

  return (
    <div id={domId} ref={wrapRef} className="relative w-full h-full min-h-[400px] overflow-auto select-none">
      <button
        type="button"
        onClick={() => { zoomRef.current = d3.zoomIdentity; setResetTick((n) => n + 1); }}
        className="absolute top-2 right-2 z-10 text-[11px] px-2 py-1 rounded border border-plasma-blue/40 bg-graphite/80 text-text-neon hover:border-plasma-blue hover:shadow-glow-blue transition-all"
      >
        {t("panel.resetView", "⛶ Vista completa")}
      </button>
      <svg ref={svgRef} className="w-full" />
    </div>
  );
}
