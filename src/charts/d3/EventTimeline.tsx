import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { ChartDefinition, ChartProps } from "../types";

export const eventTimelineDefinition: Omit<ChartDefinition, "renderComponent"> = {
  id: "eventtimeline",
  label: "Event Timeline",
  description: "Single-axis timeline with alternating event cards. Drag to pan along the axis.",
  icon: "⊸",
  engine: "d3",
  requiredFields: [
    { key: "date",        label: "Date / Period",  dtype: "string" },
    { key: "title",       label: "Event title",    dtype: "string" },
    { key: "description", label: "Description",    dtype: "string", optional: true },
  ],
  defaultExample: {
    data: {
      columns: ["date", "title", "description"],
      rows: [
        ["2020 Q1", "Project Start",   "Initial planning and kick-off meeting for all departments."],
        ["2020 Q2", "Research Phase",  "User research, surveys and competitive analysis completed."],
        ["2020 Q3", "Design Sprint",   "Final design system approved by stakeholders and developers."],
        ["2020 Q4", "Development",     "Core features implemented, unit tests written and reviewed."],
        ["2021 Q1", "Beta Launch",     "Limited beta release to 500 early-access users worldwide."],
        ["2021 Q2", "Public Launch",   "Full public launch with marketing campaign and press release."],
      ],
    },
    mapping: { date: "date", title: "title", description: "description" },
  },
  optionsSchema: [
    { key: "title", label: "Chart title", type: "text", default: "", group: "Referencias" },
    {
      key: "orientation",
      label: "Orientation",
      type: "select",
      default: "horizontal",
      options: [
        { value: "horizontal", label: "Horizontal" },
        { value: "vertical",   label: "Vertical"   },
      ],
      group: "Estilo",
    },
    {
      key: "palette",
      label: "Palette",
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
      label: "Colors by event",
      type: "custom-palette",
      default: {},
      dataKey: "title",
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

// ── Palettes & themes ────────────────────────────────────────────────────────

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

// ── Text wrap helper (SVG has no native wrapping) ────────────────────────────

function wrapText(text: string, charsPerLine = 20): string[] {
  if (!text) return [];
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const candidate = cur ? cur + " " + w : w;
    if (candidate.length <= charsPerLine) {
      cur = candidate;
    } else {
      if (cur) lines.push(cur);
      cur = w.length > charsPerLine ? w.slice(0, charsPerLine - 1) + "…" : w;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 4);
}

// ── Component ────────────────────────────────────────────────────────────────

export default function EventTimeline({ data, mapping, options, domId }: ChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef  = useRef<SVGSVGElement>(null);
  const panRef  = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (!svgRef.current || !wrapRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const dateIdx  = data.columns.indexOf((mapping.date        as string) || "");
    const titleIdx = data.columns.indexOf((mapping.title       as string) || "");
    const descIdx  = mapping.description
      ? data.columns.indexOf(mapping.description as string)
      : -1;

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

    // ── Options ──────────────────────────────────────────────────────────────
    const bgKey      = (options.bgColor      as string) || "black";
    const bg         = bgMap[bgKey] ?? bgMap.black;
    const paletteKey = (options.palette      as string) || "plasma";
    const palette    = paletteMap[paletteKey] || paletteMap.plasma;
    const custom     = (options.customColors as Record<string, string>) || {};
    const useCustom  = paletteKey === "personalizado";
    const chartTitle = (options.title        as string) || "";
    const isH        = ((options.orientation as string) || "horizontal") !== "vertical";

    const colorFor = (title: string, i: number) =>
      useCustom && custom[title] ? custom[title] : palette[i % palette.length];

    // ── Layout constants ─────────────────────────────────────────────────────
    const W       = wrapRef.current.clientWidth || 800;
    const titleH  = chartTitle ? 38 : 10;
    const connLen = 80;   // connector length from dot to text box edge
    const boxW    = 122;  // text box width
    const lineH   = 13;   // line height for description
    const boxH    = 16 + 4 * lineH + 10; // title(16) + 4 desc lines + padding ≈ 78

    const spacing = isH
      ? Math.max(130, (W - 80) / Math.max(events.length - 1, 1))
      : 138;

    const H = isH
      ? titleH + 2 * (boxH + connLen) + 28
      : Math.max(460, titleH + events.length * spacing + 80);

    svg.attr("width", W).attr("height", H).style("background", bg.bg);

    // ── Chart title ──────────────────────────────────────────────────────────
    if (chartTitle) {
      svg.append("text")
        .attr("x", W / 2).attr("y", 26).attr("text-anchor", "middle")
        .style("font-family", "Orbitron, sans-serif").style("font-size", "15px")
        .style("fill", bg.text).text(chartTitle);
    }

    // ── Arrow markers ────────────────────────────────────────────────────────
    const lineColor = palette[0];
    const defs = svg.append("defs");

    [
      { id: "et-right", pts: "0 0, 8 3, 0 6", mw: 8, mh: 6, rx: 7, ry: 3, orient: "auto" },
      { id: "et-left",  pts: "0 0, 8 3, 0 6", mw: 8, mh: 6, rx: 1, ry: 3, orient: "auto-start-reverse" },
      { id: "et-down",  pts: "0 0, 3 8, 6 0", mw: 6, mh: 8, rx: 3, ry: 7, orient: "auto" },
      { id: "et-up",    pts: "0 0, 3 8, 6 0", mw: 6, mh: 8, rx: 3, ry: 1, orient: "auto-start-reverse" },
    ].forEach(({ id, pts, mw, mh, rx, ry, orient }) => {
      defs.append("marker")
        .attr("id", id)
        .attr("markerWidth", mw).attr("markerHeight", mh)
        .attr("refX", rx).attr("refY", ry)
        .attr("orient", orient)
        .append("polygon").attr("points", pts)
        .attr("fill", lineColor).attr("opacity", 0.65);
    });

    // ── Pan group ─────────────────────────────────────────────────────────────
    const g = svg.append("g")
      .attr("transform", `translate(${panRef.current.x},${panRef.current.y})`);

    // ── Draw ─────────────────────────────────────────────────────────────────

    if (isH) {
      // Horizontal: line runs left-right at vertical midpoint
      const midY  = titleH + boxH + connLen + 4;
      const ext   = 1200;
      const totalW = 60 + (events.length - 1) * spacing;

      g.append("line")
        .attr("x1", -ext).attr("x2", totalW + ext)
        .attr("y1", midY).attr("y2", midY)
        .attr("stroke", lineColor).attr("stroke-width", 2.2).attr("opacity", 0.5)
        .attr("marker-end", "url(#et-right)")
        .attr("marker-start", "url(#et-left)");

      events.forEach((ev, i) => {
        const x     = 60 + i * spacing;
        const above = i % 2 === 0;          // even → above, odd → below
        const color = colorFor(ev.title, ev.i);
        const lines = wrapText(ev.desc);

        // Outer ring + filled dot
        g.append("circle").attr("cx", x).attr("cy", midY).attr("r", 10)
          .attr("fill", "none").attr("stroke", color)
          .attr("stroke-width", 1.2).attr("opacity", 0.4);
        g.append("circle").attr("cx", x).attr("cy", midY).attr("r", 6)
          .attr("fill", color).attr("stroke", bg.bg).attr("stroke-width", 2);

        // Date label — on the line-side of each event
        g.append("text")
          .attr("x", x).attr("y", above ? midY + 18 : midY - 8)
          .attr("text-anchor", "middle")
          .style("font-family", "Calibri, 'Segoe UI', sans-serif")
          .style("font-size", "11px").style("font-weight", "700")
          .style("fill", color)
          .text(ev.date);

        // Dashed connector
        const cStart = above ? midY - 10 : midY + 10;
        const cEnd   = above ? midY - connLen : midY + connLen;
        g.append("line")
          .attr("x1", x).attr("x2", x).attr("y1", cStart).attr("y2", cEnd)
          .attr("stroke", color).attr("stroke-width", 1.5)
          .attr("stroke-dasharray", "4,3");

        // Text card background
        const cardTop = above ? cEnd - boxH - 4 : cEnd + 4;
        g.append("rect")
          .attr("x", x - boxW / 2 - 5).attr("y", cardTop - 3)
          .attr("width", boxW + 10).attr("height", boxH + 6)
          .attr("fill", bg.bg).attr("opacity", 0.3)
          .attr("stroke", color).attr("stroke-width", 0.5).attr("stroke-opacity", 0.4)
          .attr("rx", 3);

        // Event title
        const textBase = above ? cEnd - 6 : cEnd + 15;
        g.append("text")
          .attr("x", x).attr("y", textBase)
          .attr("text-anchor", "middle")
          .style("font-family", "Calibri, 'Segoe UI', sans-serif")
          .style("font-size", "12px").style("font-weight", "700")
          .style("fill", bg.text)
          .text(ev.title.length > 22 ? ev.title.slice(0, 20) + "…" : ev.title);

        // Description lines
        lines.forEach((line, li) => {
          g.append("text")
            .attr("x", x).attr("y", textBase + 14 + li * lineH)
            .attr("text-anchor", "middle")
            .style("font-family", "Calibri, 'Segoe UI', sans-serif")
            .style("font-size", "10px")
            .style("fill", bg.text).style("opacity", "0.65")
            .text(line);
        });
      });

    } else {
      // Vertical: line runs top-bottom at horizontal lineX
      const lineX = Math.round(W * 0.40);
      const padY  = titleH + boxH / 2 + 20;
      const ext   = 1000;

      g.append("line")
        .attr("x1", lineX).attr("x2", lineX)
        .attr("y1", -ext).attr("y2", padY + (events.length - 1) * spacing + ext)
        .attr("stroke", lineColor).attr("stroke-width", 2.2).attr("opacity", 0.5)
        .attr("marker-end", "url(#et-down)")
        .attr("marker-start", "url(#et-up)");

      events.forEach((ev, i) => {
        const y      = padY + i * spacing;
        const toRight = i % 2 === 0;
        const color  = colorFor(ev.title, ev.i);
        const lines  = wrapText(ev.desc);

        // Dot
        g.append("circle").attr("cx", lineX).attr("cy", y).attr("r", 10)
          .attr("fill", "none").attr("stroke", color)
          .attr("stroke-width", 1.2).attr("opacity", 0.4);
        g.append("circle").attr("cx", lineX).attr("cy", y).attr("r", 6)
          .attr("fill", color).attr("stroke", bg.bg).attr("stroke-width", 2);

        // Date label (opposite side of text card)
        g.append("text")
          .attr("x", toRight ? lineX - 14 : lineX + 14)
          .attr("y", y + 4)
          .attr("text-anchor", toRight ? "end" : "start")
          .style("font-family", "Calibri, 'Segoe UI', sans-serif")
          .style("font-size", "11px").style("font-weight", "700")
          .style("fill", color)
          .text(ev.date);

        // Horizontal dashed connector
        const cxStart = toRight ? lineX + 10 : lineX - 10;
        const cxEnd   = toRight ? lineX + connLen : lineX - connLen;
        g.append("line")
          .attr("x1", cxStart).attr("x2", cxEnd).attr("y1", y).attr("y2", y)
          .attr("stroke", color).attr("stroke-width", 1.5)
          .attr("stroke-dasharray", "4,3");

        // Text card
        const cardX  = toRight ? cxEnd + 4 : cxEnd - boxW - 4;
        const cardY  = y - boxH / 2 - 3;
        g.append("rect")
          .attr("x", cardX - 4).attr("y", cardY)
          .attr("width", boxW + 8).attr("height", boxH + 6)
          .attr("fill", bg.bg).attr("opacity", 0.3)
          .attr("stroke", color).attr("stroke-width", 0.5).attr("stroke-opacity", 0.4)
          .attr("rx", 3);

        const textX    = toRight ? cxEnd + 8 : cxEnd - 8;
        const anchor   = toRight ? "start" : "end";
        const textBase = y - boxH / 2 + 14;

        g.append("text")
          .attr("x", textX).attr("y", textBase)
          .attr("text-anchor", anchor)
          .style("font-family", "Calibri, 'Segoe UI', sans-serif")
          .style("font-size", "12px").style("font-weight", "700")
          .style("fill", bg.text)
          .text(ev.title.length > 20 ? ev.title.slice(0, 18) + "…" : ev.title);

        lines.forEach((line, li) => {
          g.append("text")
            .attr("x", textX).attr("y", textBase + 14 + li * lineH)
            .attr("text-anchor", anchor)
            .style("font-family", "Calibri, 'Segoe UI', sans-serif")
            .style("font-size", "10px")
            .style("fill", bg.text).style("opacity", "0.65")
            .text(line);
        });
      });
    }

    // ── Drag to pan (axis-constrained) ───────────────────────────────────────
    const overlay = svg.append("rect")
      .attr("width", W).attr("height", H)
      .attr("fill", "transparent")
      .style("cursor", "grab");

    overlay.call(
      d3.drag<SVGRectElement, unknown>()
        .on("start", () => overlay.style("cursor", "grabbing"))
        .on("drag", (event) => {
          if (isH) panRef.current.x += event.dx;
          else     panRef.current.y += event.dy;
          g.attr("transform", `translate(${panRef.current.x},${panRef.current.y})`);
        })
        .on("end", () => overlay.style("cursor", "grab"))
    );

  }, [data, mapping, options]);

  return (
    <div
      id={domId}
      ref={wrapRef}
      className="w-full h-full min-h-[420px] overflow-hidden select-none"
    >
      <svg ref={svgRef} className="w-full" />
    </div>
  );
}
