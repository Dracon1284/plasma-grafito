import Plotly from "plotly.js-dist-min";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import type { ChartConfig, DataTable } from "../charts/types";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function captureDataURL(domId: string, bgColor = "#0A0A0A"): Promise<string> {
  const el = document.getElementById(domId);
  if (!el) throw new Error("No se encontró el canvas del gráfico");

  // el puede ser el propio div de Plotly (js-plotly-plot) o contenerlo como hijo
  const plotlyEl: HTMLElement | null =
    el.classList.contains("js-plotly-plot")
      ? el
      : el.querySelector<HTMLElement>(".js-plotly-plot");

  if (plotlyEl && (plotlyEl as any)._fullLayout) {
    return Plotly.toImage(plotlyEl as any, {
      format: "png",
      width: 1600,
      height: 1000,
      scale: 2,
    });
  }
  return toPng(el, { pixelRatio: 2, backgroundColor: bgColor });
}

export async function exportPNG(
  domId: string,
  bgColor = "#0A0A0A",
  filename = "plasma-grafito.png"
) {
  const dataUrl = await captureDataURL(domId, bgColor);
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  download(blob, filename);
}

export async function exportPDF(
  domId: string,
  bgColor = "#0A0A0A",
  filename = "plasma-grafito.pdf"
) {
  const dataUrl = await captureDataURL(domId, bgColor);
  const img = new Image();
  img.src = dataUrl;
  await new Promise((r) => (img.onload = r));

  // Parse hex → r,g,b para jsPDF
  const hex = bgColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const pdf = new jsPDF({
    orientation: img.width >= img.height ? "landscape" : "portrait",
    unit: "pt",
    format: "a4",
  });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const ratio = Math.min(pageW / img.width, pageH / img.height) * 0.95;
  const w = img.width * ratio;
  const h = img.height * ratio;
  pdf.setFillColor(r, g, b);
  pdf.rect(0, 0, pageW, pageH, "F");
  pdf.addImage(dataUrl, "PNG", (pageW - w) / 2, (pageH - h) / 2, w, h);
  pdf.save(filename);
}

export function exportProjectJSON(
  config: ChartConfig,
  filename = "plasma-grafito.json"
) {
  const blob = new Blob([JSON.stringify(config, null, 2)], {
    type: "application/json",
  });
  download(blob, filename);
}

// ── Tabla ────────────────────────────────────────────────────────────────────

export function exportTableCSV(data: DataTable, filename = "datos.csv") {
  const header = data.columns.join(",");
  const body = data.rows
    .map((r) =>
      r
        .map((v) => {
          if (v === null) return "";
          const s = String(v);
          // quote si contiene coma, comilla o salto de línea
          return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\n");
  // BOM UTF-8 (﻿) para que Excel / LibreOffice abran el archivo
  // con encoding correcto y no muestren caracteres como "EnergÃ­a"
  const blob = new Blob(["﻿" + header + "\n" + body], {
    type: "text/csv;charset=utf-8",
  });
  download(blob, filename);
}

export function exportTableXLSX(data: DataTable, filename = "datos.xlsx") {
  const rows = [data.columns, ...data.rows.map((r) => r.map((v) => v ?? ""))];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, filename);
}

// ── Proyecto JSON ─────────────────────────────────────────────────────────────

export async function importProjectJSON(file: File): Promise<ChartConfig> {
  const text = await file.text();
  const parsed = JSON.parse(text) as ChartConfig;
  if (!parsed || parsed.version !== 1 || !parsed.chartType || !parsed.data) {
    throw new Error("Archivo de proyecto inválido");
  }
  return parsed;
}
