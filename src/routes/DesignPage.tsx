import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Navbar } from "../components/ui/Navbar";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { listCharts, getChart } from "../charts/registry";
import { DataLoader } from "../components/DataLoader";
import { useProject } from "../store/projectStore";
import { exportTableXLSX } from "../lib/exporters";

export default function DesignPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const charts = listCharts();
  const [selected, setSelected] = useState<string | null>(null);
  const setChartType = useProject((s) => s.setChartType);
  const setData = useProject((s) => s.setData);
  const setMapping = useProject((s) => s.setMapping);

  const useExample = () => {
    if (!selected) return;
    const def = getChart(selected)!;
    setChartType(selected);
    setData(def.defaultExample.data);
    setMapping(def.defaultExample.mapping);
    navigate("/editor");
  };

  const selectedDef = selected ? getChart(selected) : null;

  return (
    <div className="min-h-full flex flex-col">
      <Navbar
        right={
          <Button variant="ghost" onClick={() => navigate("/")}>
            {t("common.back")}
          </Button>
        }
      />
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <h1 className="font-display text-3xl tracking-wider mb-1">
            {t("design.title")}
          </h1>
          <p className="text-text-muted mb-8">
            {t("design.subtitle")}
          </p>

          {selectedDef && (
            <Card className="border-plasma-blue/30 mb-8">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <div className="text-plasma-blue font-display tracking-wider text-xs">
                    {t("design.selected")}
                  </div>
                  <div className="font-display text-xl">
                    {t(`charts.${selectedDef.id}.label`, selectedDef.label)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() =>
                      exportTableXLSX(
                        selectedDef.defaultExample.data,
                        `ejemplo-${selectedDef.id}.xlsx`
                      )
                    }
                  >
                    {t("design.downloadXlsx")}
                  </Button>
                  <Button variant="secondary" onClick={useExample}>
                    {t("design.useExample")}
                  </Button>
                </div>
              </div>
              <DataLoader
                chartDef={selectedDef}
                onReady={(data, mapping) => {
                  setChartType(selectedDef.id);
                  setData(data);
                  setMapping(mapping);
                  navigate("/editor");
                }}
              />
            </Card>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {charts.map((c) => (
              <Card
                key={c.id}
                interactive
                glow={selected === c.id ? "blue" : "blue"}
                onClick={() => setSelected(c.id)}
                className={
                  selected === c.id
                    ? "border-plasma-blue shadow-glow-blue"
                    : ""
                }
              >
                <div className="text-2xl mb-2">{c.icon}</div>
                <div className="font-display text-lg mb-1">
                  {t(`charts.${c.id}.label`, c.label)}
                </div>
                <p className="text-text-muted text-sm">
                  {t(`charts.${c.id}.description`, c.description)}
                </p>
              </Card>
            ))}
          </div>

        </div>
      </main>
    </div>
  );
}
