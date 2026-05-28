import { create } from "zustand";
import type { ChartConfig, ColumnMapping, DataTable } from "../charts/types";

interface ProjectState {
  chartType: string | null;
  data: DataTable | null;
  mapping: ColumnMapping;
  options: Record<string, unknown>;
  title: string;

  setChartType: (id: string) => void;
  setData: (data: DataTable) => void;
  setMapping: (mapping: ColumnMapping) => void;
  setOption: (key: string, value: unknown) => void;
  setTitle: (title: string) => void;
  loadConfig: (config: ChartConfig) => void;
  toConfig: () => ChartConfig | null;
  reset: () => void;
}

export const useProject = create<ProjectState>((set, get) => ({
  chartType: null,
  data: null,
  mapping: {},
  options: {},
  title: "",

  setChartType: (id) => set({ chartType: id, mapping: {}, options: {} }),
  setData: (data) => set({ data }),
  setMapping: (mapping) => set({ mapping }),
  setOption: (key, value) =>
    set((s) => ({ options: { ...s.options, [key]: value } })),
  setTitle: (title) => set({ title }),

  loadConfig: (config) =>
    set({
      chartType: config.chartType,
      data: config.data,
      mapping: config.mapping,
      options: config.options,
      title: config.title ?? "",
    }),

  toConfig: () => {
    const { chartType, data, mapping, options, title } = get();
    if (!chartType || !data) return null;
    return { version: 1, chartType, data, mapping, options, title };
  },

  reset: () =>
    set({ chartType: null, data: null, mapping: {}, options: {}, title: "" }),
}));
