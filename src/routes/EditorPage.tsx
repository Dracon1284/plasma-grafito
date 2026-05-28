import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Navbar } from "../components/ui/Navbar";
import { Button } from "../components/ui/Button";
import { useProject } from "../store/projectStore";
import { ChartCanvas } from "../components/ChartCanvas";
import { EditorPanel } from "../components/EditorPanel";
import { ExportMenu } from "../components/ExportMenu";

const CHART_DOM_ID = "plasma-chart-canvas";

export default function EditorPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const chartType = useProject((s) => s.chartType);
  const data = useProject((s) => s.data);

  useEffect(() => {
    if (!chartType || !data) navigate("/");
  }, [chartType, data, navigate]);

  if (!chartType || !data) return null;

  return (
    <div className="min-h-full flex flex-col">
      <Navbar
        right={
          <>
            <Button variant="ghost" onClick={() => navigate("/design")}>
              {t("common.back")}
            </Button>
            <ExportMenu domId={CHART_DOM_ID} />
          </>
        }
      />
      <main className="flex-1 grid lg:grid-cols-[1fr_360px] gap-0">
        <section className="p-6 bg-graphite/40">
          <ChartCanvas domId={CHART_DOM_ID} />
        </section>
        <aside className="border-l border-white/10 bg-carbon/40 p-5 overflow-y-auto max-h-[calc(100vh-57px)]">
          <EditorPanel />
        </aside>
      </main>
    </div>
  );
}
