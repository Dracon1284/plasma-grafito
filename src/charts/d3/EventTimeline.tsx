import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { ChartDefinition, ChartProps } from "../types";

export const eventTimelineDefinition: Omit<ChartDefinition, "renderComponent"> = {
  id: "eventtimeline",
  label: "Event Timeline",
  description: "Single-axis timeline with alternating event cards.",
  icon: "⊸",
  engine: "d3",
  requiredFields: [
    { key: "date",        label: "Date (YYYY-MM-DD)",  dtype: "date" },
    { key: "title",       label: "Event title",        dtype: "string" },
    { key: "description", label: "Description",        dtype: "string", optional: true },
  ],
  defaultExample: {
    data: {
      columns: ["date", "title", "description"],
      rows: [
        ["2020-01-15", "Project Start",   "Initial planning and kick-off meeting for all departments."],
        ["2020-04-20", "Research Phase",  "User research, surveys and competitive analysis completed."],
        ["2020-07-10", "Design Sprint",   "Final design system approved by stakeholders and developers."],
        ["2020-10-05", "Development",     "Core features implemented, unit tests written and reviewed."],
        ["2021-02-01", "Beta Launch",     "Limited beta release to 500 early-access users worldwide."],
        ["2021-06-15", "Public Launch",   "Full public launch with marketing campaign and press release."],
      ],
    },
    mapping: { date: "date", title: "title", description: "description" },
  },
  optionsSchema: [
    { key: "title",       label: "Chart title",          type: "text",    default: "",           group: "Referencias" },
    {
      key: "orientation", label: "Orientation",          type: "select",  default: "horizontal",
      options: [{ value: "horizontal", label: "Horizontal" }, { value: "vertical", label: "Vertical" }],
      group: "Estilo",
    },
    { key: "connLen",     label: "Connector length (px)", type: "number",  default: 80,           group: "Estilo" },
    {
      key: "fontFamily",  label: "Text font",            type: "select",  default: "calibri",
      options: [
        { value: "calibri",  label: "Calibri" },
        { value: "inter",    label: "Inter" },
        { value: "orbitron", label: "Orbitron" },
        { value: "courier",  label: "Courier New" },
      ],
      group: "Estilo",
    },
    { key: "titleBold",   label: "Title bold",           type: "boolean", default: true,          group: "Estilo" },
    { key: "titleItalic", label: "Title italic",         type: "boolean", default: false,         group: "Estilo" },
    { key: "descItalic",  label: "Description italic",   type: "boolean", default: false,         group: "Estilo" },
    {
      key: "dateFormat", label: "Date label format", type: "select", default: "auto", group: "Estilo",
      options: [
        { value: "auto",      label: "Auto" },
        { value: "year",      label: "Year" },
        { value: "monthYear", label: "Month · Year" },
        { value: "date",      label: "Date (YYYY-MM-DD)" },
        { value: "datetime",  label: "Date + Time" },
      ],
    },
    { key: "showScale",   label: "Show time scale",       type: "boolean", default: false,         group: "Estilo" },
    {
      key: "scaleUnit", label: "Scale unit", type: "select", default: "year", group: "Estilo",
      dependsOn: { key: "showScale", equals: true },
      options: [
        { value: "year",  label: "Year"  },
        { value: "month", label: "Month" },
      ],
    },
    { key: "fitText",     label: "Expand cards to fit text", type: "boolean", default: false,        group: "Estilo" },
    { key: "lineColor",   label: "Axis line color",       type: "color",   default: "#00F0FF",     group: "Estilo" },
    {
      key: "palette",     label: "Palette",              type: "select",  default: "plasma",
      options: [
        { value: "plasma",        label: "Plasma" },
        { value: "primarios",     label: "Primarios" },
        { value: "primarios_sec", label: "Primarios + Secundarios" },
        { value: "personalizado", label: "Personalizado" },
      ],
      group: "Estilo",
    },
    {
      key: "customColors", label: "Colors by event",    type: "custom-palette", default: {},
      dataKey: "title",    group: "Estilo",
      dependsOn: { key: "palette", equals: "personalizado" },
    },
    {
      key: "bgColor",     label: "Background",           type: "select",  default: "black",
      options: [
        { value: "black", label: "Black" },
        { value: "gray",  label: "Gray"  },
        { value: "white", label: "White" },
      ],
      group: "Estilo",
    },
  ],
};

// ── Static maps ───────────────────────────────────────────────────────────────

const paletteMap: Record<string, string[]> = {
  plasma:        ["#00F0FF", "#B14AED", "#FF00AA", "#7AD7F0", "#FF6EC7", "#4DD9FF"],
  primarios:     ["#E8000D", "#1A56DB", "#F5C518"],
  primarios_sec: ["#E8000D", "#F4511E", "#F5C518", "#22A045", "#1A56DB", "#9B30FF"],
};

const bgMap: Record<string, { bg: string; text: string }> = {
  black: { bg: "#0A0A0A", text: "#E0E0E0" },
  gray:  { bg: "#6B7280", text: "#1C1C1E" },
  white: { bg: "#FFFFFF",  text: "#1C1C1E" },
};

const fontFamilyMap: Record<string, string> = {
  calibri:  "Calibri, 'Segoe UI', sans-serif",
  inter:    "Inter, sans-serif",
  orbitron: "Orbitron, sans-serif",
  courier:  "'Courier New', monospace",
};

// ── Date display helpers ──────────────────────────────────────────────────────

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatDisplayDate(dateStr: string, fmt: string): string {
  if (!dateStr) return dateStr;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  switch (fmt) {
    case "year":      return String(d.getFullYear());
    case "monthYear": return `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
    case "date":      return dateStr.slice(0, 10);
    case "datetime":  return dateStr.slice(0, 16).replace("T", " ");
    default:          return dateStr; // "auto" — as stored
  }
}

function scaleTickLabel(d: Date, unit: string): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  switch (unit) {
    case "year":  return String(d.getFullYear());
    case "month": return `${MONTHS_SHORT[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
    case "day":   return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
    case "hour":  return `${pad(d.getHours())}:00`;
    default:      return String(d.getFullYear());
  }
}

// ── Text-wrap helper ──────────────────────────────────────────────────────────

function wrapText(text: string, charsPerLine = 20): string[] {
  if (!text) return [];
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const cand = cur ? cur + " " + w : w;
    if (cand.length <= charsPerLine) { cur = cand; continue; }
    if (cur) lines.push(cur);
    cur = w.length > charsPerLine ? w.slice(0, charsPerLine - 1) + "…" : w;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 4);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EventTimeline({ data, mapping, options, domId }: ChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef  = useRef<SVGSVGElement>(null);
  const panRef  = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dataKeyRef = useRef<string>("");
  const [zoomK, setZoomK] = useState(1);

  useEffect(() => {
    if (!svgRef.current || !wrapRef.current) return;

    // ── Data extraction ───────────────────────────────────────────────────────
    const dateIdx  = data.columns.indexOf((mapping.date        as string) || "");
    const titleIdx = data.columns.indexOf((mapping.title       as string) || "");
    const descIdx  = mapping.description
      ? data.columns.indexOf(mapping.description as string) : -1;

    if (dateIdx < 0 || titleIdx < 0) return;

    const events = data.rows
      .filter((r) => r[dateIdx] !== null && r[titleIdx] !== null)
      .map((r, i) => ({
        date:  String(r[dateIdx]),
        title: String(r[titleIdx]),
        desc:  descIdx >= 0 && r[descIdx] !== null ? String(r[descIdx]) : "",
        i,
      }));

    if (events.length === 0) return;

    // Reset pan when data changes
    const newKey = `${data.columns.join(",")}:${data.rows.length}`;
    if (newKey !== dataKeyRef.current) {
      panRef.current = { x: 0, y: 0 };
      dataKeyRef.current = newKey;
    }

    // ── Options ───────────────────────────────────────────────────────────────
    const bgKey      = (options.bgColor      as string) || "black";
    const bg         = bgMap[bgKey] ?? bgMap.black;
    const paletteKey = (options.palette      as string) || "plasma";
    const palette    = paletteMap[paletteKey] || paletteMap.plasma;
    const custom     = (options.customColors as Record<string, string>) || {};
    const useCustom  = paletteKey === "personalizado";
    const chartTitle = (options.title        as string) || "";
    const isH        = ((options.orientation as string) || "horizontal") !== "vertical";
    const connLen    = Math.max(40, Math.min(240, Number(options.connLen) || 80));
    const fontKey    = (options.fontFamily   as string) || "calibri";
    const fontFamily = fontFamilyMap[fontKey] || fontFamilyMap.calibri;
    const titleBold   = options.titleBold  !== false;
    const titleItalic = options.titleItalic === true;
    const descItalic  = options.descItalic  === true;
    const dateFormat  = (options.dateFormat as string) || "auto";
    const showScale   = options.showScale === true;
    const scaleUnit   = (options.scaleUnit as string) || "year";
    const fitText     = options.fitText === true;

    const colorFor = (title: string, i: number) =>
      useCustom && custom[title] ? custom[title] : palette[i % palette.length];

    // ── Card layout constants ─────────────────────────────────────────────────
    // All measurements are in SVG user units (px).
    const W        = wrapRef.current.clientWidth || 800;
    const titleH   = chartTitle ? 38 : 10;
    const GAP      = 6;   // gap between connector tip and card edge
    const PAD_T    = 7;   // card top inner padding
    const PAD_B    = 8;   // card bottom inner padding
    const TITLE_PX = 12;
    const DESC_PX  = 10;
    const LINE_H   = 13;
    const MAX_LINES = 4;
    const CARD_W   = 124;
    // Card height: top-pad + title + gap + max desc lines + bottom-pad
    const CARD_H   = PAD_T + TITLE_PX + 4 + MAX_LINES * LINE_H + PAD_B; // 7+12+4+52+8 = 83

    // ── fitText layout constants (after CARD_W / MAX_LINES / CARD_H are defined) ──
    const CARD_W_EFF      = fitText ? 160 : CARD_W;
    const MAX_CHARS       = fitText ? 26  : 20;
    const MAX_LINES_EFF   = fitText ? 8   : MAX_LINES;
    const MAX_TITLE_CHARS = fitText ? 30  : 22;

    // Pre-compute per-event card heights (variable when fitText=true)
    const eventLayouts = events.map((ev) => {
      const lines = wrapText(ev.desc, MAX_CHARS).slice(0, MAX_LINES_EFF);
      const h = PAD_T + TITLE_PX + (lines.length > 0 ? 4 + lines.length * LINE_H : 0) + PAD_B;
      return { lines, cardH: Math.max(CARD_H, h) };
    });

    // ── Draw ──────────────────────────────────────────────────────────────────
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Arrow markers
    const lineColor = (options.lineColor as string) || palette[0];
    const defs = svg.append("defs");
    [
      { id: "et-r", pts: "0 0,8 3,0 6", mw: 8, mh: 6, rx: 7, ry: 3, orient: "auto" },
      { id: "et-l", pts: "0 0,8 3,0 6", mw: 8, mh: 6, rx: 1, ry: 3, orient: "auto-start-reverse" },
      { id: "et-d", pts: "0 0,3 8,6 0", mw: 6, mh: 8, rx: 3, ry: 7, orient: "auto" },
      { id: "et-u", pts: "0 0,3 8,6 0", mw: 6, mh: 8, rx: 3, ry: 1, orient: "auto-start-reverse" },
    ].forEach(({ id, pts, mw, mh, rx, ry, orient }) => {
      defs.append("marker").attr("id", id)
        .attr("markerWidth", mw).attr("markerHeight", mh)
        .attr("refX", rx).attr("refY", ry).attr("orient", orient)
        .append("polygon").attr("points", pts)
        .attr("fill", lineColor).attr("opacity", 0.65);
    });

    if (isH) {
      // ── HORIZONTAL ─────────────────────────────────────────────────────────
      // Compute per-event card heights for above/below rows
      const aboveMaxH = Math.max(CARD_H, ...eventLayouts.filter((_, i) => i % 2 === 0).map((l) => l.cardH));
      const belowMaxH = Math.max(CARD_H, ...eventLayouts.filter((_, i) => i % 2 !== 0).map((l) => l.cardH));

      const midY = titleH + aboveMaxH + GAP + connLen + 4;
      const H    = midY + connLen + GAP + belowMaxH + 14;

      // Spacing: try to center; fall back to 130px min; scaled by zoomK
      const idealSpacing = Math.round((W - 120) / Math.max(events.length - 1, 1));
      const spacing = Math.max(130, idealSpacing) * zoomK;
      const totalW  = (events.length - 1) * spacing;
      const padX = Math.round(Math.max(60, (W - totalW) / 2));

      svg.attr("width", W).attr("height", H).style("background", bg.bg);

      if (chartTitle) {
        svg.append("text")
          .attr("x", W / 2).attr("y", 26).attr("text-anchor", "middle")
          .style("font-family", "Orbitron, sans-serif").style("font-size", "15px")
          .style("fill", bg.text).text(chartTitle);
      }

      // Pan group
      const g = svg.append("g")
        .attr("transform", `translate(${panRef.current.x},0)`);

      const ext = 1200;
      g.append("line")
        .attr("x1", -ext).attr("x2", padX + totalW + ext)
        .attr("y1", midY).attr("y2", midY)
        .attr("stroke", lineColor).attr("stroke-width", 2.2).attr("opacity", 0.5)
        .attr("marker-end", "url(#et-r)").attr("marker-start", "url(#et-l)");

      events.forEach((ev, i) => {
        const x     = padX + i * spacing;
        const above = i % 2 === 0;
        const color = colorFor(ev.title, ev.i);
        const { lines, cardH: thisCardH } = eventLayouts[i];

        // Dot: inner filled + outer ring
        g.append("circle").attr("cx", x).attr("cy", midY).attr("r", 10)
          .attr("fill", "none").attr("stroke", color).attr("stroke-width", 1.2).attr("opacity", 0.35);
        g.append("circle").attr("cx", x).attr("cy", midY).attr("r", 6)
          .attr("fill", color).attr("stroke", bg.bg).attr("stroke-width", 2);

        // Date label
        const dateLabelY = above ? midY + 16 : midY - 13;
        g.append("text")
          .attr("x", x).attr("y", dateLabelY)
          .attr("text-anchor", "middle")
          .style("font-family", fontFamily)
          .style("font-size", "11px").style("font-weight", "700")
          .style("fill", color)
          .text(formatDisplayDate(ev.date, dateFormat));

        // Vertical dashed connector
        const cStart = above ? midY - 10 : midY + 10;
        const cEnd   = above ? midY - connLen : midY + connLen;
        g.append("line")
          .attr("x1", x).attr("x2", x).attr("y1", cStart).attr("y2", cEnd)
          .attr("stroke", color).attr("stroke-width", 1.5).attr("stroke-dasharray", "4,3");

        const cardY  = above ? cEnd - GAP - thisCardH : cEnd + GAP;
        const titleY = cardY + PAD_T + TITLE_PX;

        g.append("rect")
          .attr("x", x - CARD_W_EFF / 2 - 5).attr("y", cardY)
          .attr("width", CARD_W_EFF + 10).attr("height", thisCardH)
          .attr("fill", bg.bg).attr("opacity", 0.3)
          .attr("stroke", color).attr("stroke-width", 0.5).attr("stroke-opacity", 0.4)
          .attr("rx", 3);

        g.append("text")
          .attr("x", x).attr("y", titleY)
          .attr("text-anchor", "middle")
          .style("font-family", fontFamily)
          .style("font-size", `${TITLE_PX}px`)
          .style("font-weight", titleBold ? "700" : "400")
          .style("font-style", titleItalic ? "italic" : "normal")
          .style("fill", bg.text)
          .text(ev.title.length > MAX_TITLE_CHARS ? ev.title.slice(0, MAX_TITLE_CHARS - 2) + "…" : ev.title);

        const descBaseY = titleY + 4 + DESC_PX;
        lines.forEach((line, li) => {
          g.append("text")
            .attr("x", x).attr("y", descBaseY + li * LINE_H)
            .attr("text-anchor", "middle")
            .style("font-family", fontFamily)
            .style("font-size", `${DESC_PX}px`)
            .style("font-style", descItalic ? "italic" : "normal")
            .style("fill", bg.text).style("opacity", "0.65")
            .text(line);
        });
      });

      // Time scale ticks
      if (showScale && events.length >= 2) {
        const firstDate = new Date(events[0].date);
        const lastDate  = new Date(events[events.length - 1].date);
        if (!isNaN(firstDate.getTime()) && !isNaN(lastDate.getTime()) && firstDate < lastDate) {
          const x0 = padX;
          const x1 = padX + (events.length - 1) * spacing;
          const intervalMap: Record<string, d3.CountableTimeInterval> = {
            year: d3.timeYear, month: d3.timeMonth,
          };
          const interval = intervalMap[scaleUnit] || d3.timeYear;
          // Extend domain to interval boundaries so first/last ticks always appear
          const d0 = interval.floor(firstDate);
          const d1 = interval.ceil(lastDate);
          const dateScale = d3.scaleTime().domain([d0, d1]).range([x0, x1]);
          const tickInterval = interval.every(1);
          const ticks = (tickInterval ? dateScale.ticks(tickInterval) : dateScale.ticks(10)).slice(0, 40);
          ticks.forEach((tick) => {
            const tx = dateScale(tick);
            g.append("line")
              .attr("x1", tx).attr("x2", tx)
              .attr("y1", midY - 7).attr("y2", midY + 7)
              .attr("stroke", lineColor).attr("stroke-width", 0.8).attr("opacity", 0.45);
            g.append("text")
              .attr("x", tx).attr("y", midY + 28)
              .attr("text-anchor", "middle")
              .style("font-family", fontFamily).style("font-size", "8px")
              .style("fill", lineColor).style("opacity", "0.6")
              .text(scaleTickLabel(tick, scaleUnit));
          });
        }
      }

      // Drag overlay — horizontal pan only
      svg.append("rect")
        .attr("width", W).attr("height", H)
        .attr("fill", "transparent").style("cursor", "grab")
        .call(
          d3.drag<SVGRectElement, unknown>()
            .on("start", function () { d3.select(this).style("cursor", "grabbing"); })
            .on("drag", (event) => {
              panRef.current.x += event.dx;
              g.attr("transform", `translate(${panRef.current.x},0)`);
            })
            .on("end", function () { d3.select(this).style("cursor", "grab"); })
        );

    } else {
      // ── VERTICAL ───────────────────────────────────────────────────────────
      //
      // Layout (x-axis):
      //   CARD_W + GAP + connLen         ← left-card area
      //   lineX                          ← the vertical axis line
      //   connLen + GAP + CARD_W         ← right-card area
      //
      const lineX    = Math.round(W / 2);
      const maxCardH = Math.max(CARD_H, ...eventLayouts.map((l) => l.cardH));
      const spacing  = Math.max(138, maxCardH + 30) * zoomK;
      const padY     = titleH + maxCardH / 2 + 20;
      const totalH   = Math.max(460, titleH + events.length * spacing + 80);
      const H        = totalH;

      svg.attr("width", W).attr("height", H).style("background", bg.bg);

      if (chartTitle) {
        svg.append("text")
          .attr("x", W / 2).attr("y", 26).attr("text-anchor", "middle")
          .style("font-family", "Orbitron, sans-serif").style("font-size", "15px")
          .style("fill", bg.text).text(chartTitle);
      }

      const g = svg.append("g")
        .attr("transform", `translate(0,${panRef.current.y})`);

      const ext = 1000;
      g.append("line")
        .attr("x1", lineX).attr("x2", lineX)
        .attr("y1", -ext).attr("y2", padY + (events.length - 1) * spacing + ext)
        .attr("stroke", lineColor).attr("stroke-width", 2.2).attr("opacity", 0.5)
        .attr("marker-end", "url(#et-d)").attr("marker-start", "url(#et-u)");

      events.forEach((ev, i) => {
        const y       = padY + i * spacing;
        const toRight = i % 2 === 0;
        const color   = colorFor(ev.title, ev.i);
        const { lines, cardH: thisCardH } = eventLayouts[i];

        // Dot
        g.append("circle").attr("cx", lineX).attr("cy", y).attr("r", 10)
          .attr("fill", "none").attr("stroke", color).attr("stroke-width", 1.2).attr("opacity", 0.35);
        g.append("circle").attr("cx", lineX).attr("cy", y).attr("r", 6)
          .attr("fill", color).attr("stroke", bg.bg).attr("stroke-width", 2);

        // Date label (opposite side of card)
        g.append("text")
          .attr("x", toRight ? lineX - 14 : lineX + 14)
          .attr("y", y + 4)
          .attr("text-anchor", toRight ? "end" : "start")
          .style("font-family", fontFamily)
          .style("font-size", "11px").style("font-weight", "700")
          .style("fill", color)
          .text(formatDisplayDate(ev.date, dateFormat));

        // Horizontal dashed connector
        const cxStart = toRight ? lineX + 10 : lineX - 10;
        const cxEnd   = toRight ? lineX + connLen : lineX - connLen;
        g.append("line")
          .attr("x1", cxStart).attr("x2", cxEnd).attr("y1", y).attr("y2", y)
          .attr("stroke", color).attr("stroke-width", 1.5).attr("stroke-dasharray", "4,3");

        // Card — vertically centered on event y
        const cardTop  = y - thisCardH / 2;
        const cardLeft = toRight ? cxEnd + GAP : cxEnd - GAP - CARD_W_EFF - 10;
        const titleY   = cardTop + PAD_T + TITLE_PX;
        const textX    = toRight ? cxEnd + GAP + 7 : cxEnd - GAP - 7;
        const anchor   = toRight ? "start" : "end";

        g.append("rect")
          .attr("x", cardLeft - 2).attr("y", cardTop)
          .attr("width", CARD_W_EFF + 10).attr("height", thisCardH)
          .attr("fill", bg.bg).attr("opacity", 0.3)
          .attr("stroke", color).attr("stroke-width", 0.5).attr("stroke-opacity", 0.4)
          .attr("rx", 3);

        g.append("text")
          .attr("x", textX).attr("y", titleY)
          .attr("text-anchor", anchor)
          .style("font-family", fontFamily)
          .style("font-size", `${TITLE_PX}px`)
          .style("font-weight", titleBold ? "700" : "400")
          .style("font-style", titleItalic ? "italic" : "normal")
          .style("fill", bg.text)
          .text(ev.title.length > MAX_TITLE_CHARS ? ev.title.slice(0, MAX_TITLE_CHARS - 2) + "…" : ev.title);

        const descBaseY = titleY + 4 + DESC_PX;
        lines.forEach((line, li) => {
          g.append("text")
            .attr("x", textX).attr("y", descBaseY + li * LINE_H)
            .attr("text-anchor", anchor)
            .style("font-family", fontFamily)
            .style("font-size", `${DESC_PX}px`)
            .style("font-style", descItalic ? "italic" : "normal")
            .style("fill", bg.text).style("opacity", "0.65")
            .text(line);
        });
      });

      // Time scale ticks
      if (showScale && events.length >= 2) {
        const firstDate = new Date(events[0].date);
        const lastDate  = new Date(events[events.length - 1].date);
        if (!isNaN(firstDate.getTime()) && !isNaN(lastDate.getTime()) && firstDate < lastDate) {
          const y0 = padY;
          const y1 = padY + (events.length - 1) * spacing;
          const intervalMap: Record<string, d3.CountableTimeInterval> = {
            year: d3.timeYear, month: d3.timeMonth,
          };
          const interval = intervalMap[scaleUnit] || d3.timeYear;
          const d0 = interval.floor(firstDate);
          const d1 = interval.ceil(lastDate);
          const dateScale = d3.scaleTime().domain([d0, d1]).range([y0, y1]);
          const tickInterval = interval.every(1);
          const ticks = (tickInterval ? dateScale.ticks(tickInterval) : dateScale.ticks(10)).slice(0, 40);
          ticks.forEach((tick) => {
            const ty = dateScale(tick);
            g.append("line")
              .attr("x1", lineX - 7).attr("x2", lineX + 7)
              .attr("y1", ty).attr("y2", ty)
              .attr("stroke", lineColor).attr("stroke-width", 0.8).attr("opacity", 0.45);
            g.append("text")
              .attr("x", lineX + 10).attr("y", ty + 3)
              .attr("text-anchor", "start")
              .style("font-family", fontFamily).style("font-size", "8px")
              .style("fill", lineColor).style("opacity", "0.6")
              .text(scaleTickLabel(tick, scaleUnit));
          });
        }
      }

      // Drag overlay — vertical pan only
      svg.append("rect")
        .attr("width", W).attr("height", H)
        .attr("fill", "transparent").style("cursor", "grab")
        .call(
          d3.drag<SVGRectElement, unknown>()
            .on("start", function () { d3.select(this).style("cursor", "grabbing"); })
            .on("drag", (event) => {
              panRef.current.y += event.dy;
              g.attr("transform", `translate(0,${panRef.current.y})`);
            })
            .on("end", function () { d3.select(this).style("cursor", "grab"); })
        );
    }
  }, [data, mapping, options, zoomK]);

  const btnClass =
    "text-[11px] px-2 py-1 rounded border border-plasma-blue/40 bg-graphite/80 text-text-neon hover:border-plasma-blue hover:shadow-glow-blue transition-all";

  return (
    <div
      id={domId}
      ref={wrapRef}
      className="relative w-full h-full min-h-[420px] overflow-hidden select-none"
    >
      <svg ref={svgRef} className="w-full" />
      {/* Zoom / reset toolbar */}
      <div className="absolute top-2 right-2 flex gap-1 z-10">
        <button
          type="button"
          className={btnClass}
          title="Zoom in"
          onClick={() => setZoomK((k) => Math.min(4, parseFloat((k + 0.25).toFixed(2))))}
        >
          ＋
        </button>
        <button
          type="button"
          className={btnClass}
          title="Zoom out"
          onClick={() => setZoomK((k) => Math.max(0.25, parseFloat((k - 0.25).toFixed(2))))}
        >
          －
        </button>
        <button
          type="button"
          className={btnClass}
          title="Reset view"
          onClick={() => { panRef.current = { x: 0, y: 0 }; setZoomK(1); }}
        >
          ⛶
        </button>
      </div>
    </div>
  );
}
