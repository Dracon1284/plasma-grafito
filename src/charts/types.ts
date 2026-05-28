import type { ComponentType } from "react";

export type DType = "string" | "number" | "date" | "category";

export interface RequiredField {
  key: string;
  label: string;
  dtype: DType;
  multiple?: boolean;
  optional?: boolean;
  help?: string;
}

export type OptionType =
  | "text"
  | "color"
  | "boolean"
  | "select"
  | "number"
  | "multicheck-data"
  | "custom-palette";

export interface OptionSchema {
  key: string;
  label: string;
  type: OptionType;
  default: unknown;
  options?: { value: string; label: string }[];
  group?: "Referencias" | "Estilo" | "Avanzado";
  /** Para "multicheck-data" / "custom-palette": clave(s) del mapping cuyas categorías se listan.
   *  Puede ser un único string o un array de claves (las categorías se unen). */
  dataKey?: string | string[];
  /** Mostrar esta opción solo si otra opción tiene determinado valor */
  dependsOn?: { key: string; equals: unknown };
}

export interface DataTable {
  columns: string[];
  rows: (string | number | null)[][];
}

export type ColumnMapping = Record<string, string | string[]>;

export interface ChartProps {
  data: DataTable;
  mapping: ColumnMapping;
  options: Record<string, unknown>;
  /** id del elemento DOM (para exportadores) */
  domId?: string;
}

export interface ChartDefinition {
  id: string;
  label: string;
  description: string;
  icon: string;
  /** "plotly" o "d3" — informativo para el exportador */
  engine: "plotly" | "d3";
  requiredFields: RequiredField[];
  defaultExample: {
    data: DataTable;
    mapping: ColumnMapping;
  };
  optionsSchema: OptionSchema[];
  renderComponent: ComponentType<ChartProps>;
}

export interface ChartConfig {
  version: 1;
  chartType: string;
  data: DataTable;
  mapping: ColumnMapping;
  options: Record<string, unknown>;
  title?: string;
}
