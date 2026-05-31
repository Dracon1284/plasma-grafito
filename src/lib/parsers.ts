import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { DataTable } from "../charts/types";

/** Formatea un Date a YYYY-MM-DD (incluye hora si no es medianoche) */
function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const ymd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hasTime = d.getHours() || d.getMinutes() || d.getSeconds();
  return hasTime ? `${ymd} ${pad(d.getHours())}:${pad(d.getMinutes())}` : ymd;
}

function coerce(value: unknown): string | number | null {
  if (value === null || value === undefined || value === "") return null;
  // Celdas de fecha de Excel (cellDates: true) llegan como Date → YYYY-MM-DD
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : formatDate(value);
  }
  if (typeof value === "number") return value;
  const s = String(value).trim();
  if (s === "") return null;
  // Reconocer fechas ISO (YYYY-MM-DD / YYYY-MM-DDTHH:MM) → mantener como string
  if (/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2})?/.test(s)) return s;
  const n = Number(s);
  return Number.isFinite(n) && /^-?\d/.test(s) ? n : s;
}

function normalize(rows: Record<string, unknown>[]): DataTable {
  if (rows.length === 0) return { columns: [], rows: [] };
  const columns = Object.keys(rows[0]);
  const out = rows.map((r) => columns.map((c) => coerce(r[c])));
  return { columns, rows: out };
}

export async function parseCSV(file: File): Promise<DataTable> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => resolve(normalize(res.data)),
      error: (err) => reject(err),
    });
  });
}

export async function parseXLSX(file: File): Promise<DataTable> {
  const buf = await file.arrayBuffer();
  // cellDates: true → las celdas con formato de fecha llegan como objetos Date
  // (en vez del número serial de Excel), que coerce() convierte a YYYY-MM-DD.
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
  });
  return normalize(json);
}

export async function parseFile(file: File): Promise<DataTable> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".tsv")) return parseCSV(file);
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) return parseXLSX(file);
  throw new Error("Formato no soportado. Usá .csv o .xlsx");
}
