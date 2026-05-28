import { useProject } from "../store/projectStore";
import { getChart } from "../charts/registry";

const bgStyles: Record<string, string> = {
  black: "bg-[#0A0A0A]",
  gray:  "bg-[#6B7280]",
  white: "bg-white",
};

export function ChartCanvas({ domId }: { domId: string }) {
  const chartType = useProject((s) => s.chartType);
  const data = useProject((s) => s.data);
  const mapping = useProject((s) => s.mapping);
  const options = useProject((s) => s.options);

  if (!chartType || !data) return null;
  const def = getChart(chartType);
  if (!def) {
    return (
      <div className="text-plasma-magenta">
        Tipo de gráfico desconocido: {chartType}
      </div>
    );
  }

  const bgKey = (options.bgColor as string) || "black";
  const bgClass = bgStyles[bgKey] ?? bgStyles.black;

  const Comp = def.renderComponent;
  return (
    <div className={`${bgClass} border border-white/10 rounded-lg p-4 h-full transition-colors duration-300`}>
      <Comp data={data} mapping={mapping} options={options} domId={domId} />
    </div>
  );
}
