import { useNavigate } from "react-router-dom";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Navbar } from "../components/ui/Navbar";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { useProject } from "../store/projectStore";
import { importProjectJSON } from "../lib/exporters";

export default function HomePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const loadConfig = useProject((s) => s.loadConfig);
  const reset = useProject((s) => s.reset);

  const onNew = () => {
    reset();
    navigate("/design");
  };

  const onOpenClick = () => fileRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const config = await importProjectJSON(f);
      loadConfig(config);
      navigate("/editor");
    } catch (err) {
      alert(t("home.open.error", { message: (err as Error).message }));
    } finally {
      e.target.value = "";
    }
  };

  return (
    <div className="min-h-full flex flex-col">
      <Navbar />
      <main className="flex-1 circuit-bg">
        <div className="max-w-5xl mx-auto px-6 py-20">

          {/* Eyebrow */}
          <p className="font-display text-xs tracking-[0.35em] text-text-muted uppercase mb-4">
            {t("home.eyebrow")}
          </p>

          {/* Título principal */}
          <h1 className="font-display text-5xl md:text-6xl tracking-widest text-text-neon mb-5">
            <span className="neon-text text-plasma-blue">PLASMA</span>{" "}
            <span className="neon-text-magenta text-plasma-magenta">GRAFITO</span>
          </h1>

          {/* Separador con degradado neón */}
          <div className="flex items-center gap-4 mb-5">
            <div className="h-px w-20 bg-gradient-to-r from-plasma-blue to-transparent" />
            <span className="font-display text-[10px] tracking-[0.3em] text-text-muted uppercase">
              {t("home.chartsSeparator")}
            </span>
            <div className="h-px w-20 bg-gradient-to-l from-plasma-magenta to-transparent" />
          </div>

          {/* Descripción */}
          <p className="text-text-muted text-sm max-w-md mb-6">
            {t("home.subtitle")}
          </p>

          {/* Badges de tipos de gráfico */}
          <div className="flex flex-wrap gap-2 mb-12">
            {[
              { key: "Sankey",       label: "Sankey",                          color: "blue"    },
              { key: "Chord",        label: "Chord",                           color: "magenta" },
              { key: "redes",        label: t("home.badges.redes"),            color: "blue"    },
              { key: "Paralelas",    label: "Parallel",                        color: "magenta" },
              { key: "Ridgeplot",    label: "Ridgeplot",                       color: "blue"    },
              { key: "bala",         label: t("home.badges.bala"),             color: "magenta" },
              { key: "Timeline",     label: "Timeline",                        color: "blue"    },
              { key: "Bubble",       label: "Bubble Network",                  color: "magenta" },
            ].map(({ key, label, color }) => (
              <span
                key={key}
                className={`font-display text-[10px] tracking-widest px-3 py-1 rounded border
                  ${color === "blue"
                    ? "border-plasma-blue/40 text-plasma-blue bg-plasma-blue/5"
                    : "border-plasma-magenta/40 text-plasma-magenta bg-plasma-magenta/5"
                  }`}
              >
                {label}
              </span>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card glow="blue" interactive onClick={onNew}>
              <div className="text-plasma-blue font-display tracking-wider text-sm mb-2">
                {t("home.new.tag")}
              </div>
              <h2 className="font-display text-2xl mb-2">{t("home.new.title")}</h2>
              <p className="text-text-muted text-sm mb-6">
                {t("home.new.subtitle")}
              </p>
              <Button variant="primary" onClick={onNew}>
                {t("home.new.button")}
              </Button>
            </Card>

            <Card glow="magenta" interactive onClick={onOpenClick}>
              <div className="text-plasma-magenta font-display tracking-wider text-sm mb-2">
                {t("home.open.tag")}
              </div>
              <h2 className="font-display text-2xl mb-2">{t("home.open.title")}</h2>
              <p className="text-text-muted text-sm mb-6">
                {t("home.open.subtitle", { ext: ".json" })}{" "}
                <code className="text-plasma-blue">.json</code>.
              </p>
              <Button variant="secondary" onClick={onOpenClick}>
                {t("home.open.button")}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={onFile}
              />
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
