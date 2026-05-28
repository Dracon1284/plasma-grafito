import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/Button";
import { useProject } from "../store/projectStore";
import { exportPDF, exportPNG, exportProjectJSON } from "../lib/exporters";

const bgHexMap: Record<string, string> = {
  black: "#0A0A0A",
  gray:  "#6B7280",
  white: "#FFFFFF",
};

export function ExportMenu({ domId }: { domId: string }) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const toConfig = useProject((s) => s.toConfig);
  const options = useProject((s) => s.options);

  const bgHex = bgHexMap[(options.bgColor as string) || "black"] ?? "#0A0A0A";

  const onPNG = async () => {
    setOpen(false);
    try {
      await exportPNG(domId, bgHex);
    } catch (e) {
      alert(t("export.errorPng", { message: (e as Error).message }));
    }
  };
  const onPDF = async () => {
    setOpen(false);
    try {
      await exportPDF(domId, bgHex);
    } catch (e) {
      alert(t("export.errorPdf", { message: (e as Error).message }));
    }
  };
  const onJSON = () => {
    setOpen(false);
    const cfg = toConfig();
    if (!cfg) return;
    exportProjectJSON(cfg);
  };

  return (
    <div className="relative">
      <Button variant="primary" onClick={() => setOpen((v) => !v)}>
        {t("export.button")}
      </Button>
      {open && (
        <div className="absolute right-0 mt-2 w-44 bg-carbon border border-plasma-blue/40 rounded shadow-glow-soft z-30">
          <button
            onClick={onPNG}
            className="block w-full text-left px-4 py-2 text-sm hover:bg-plasma-blue/10 hover:text-plasma-blue"
          >
            {t("export.png")}
          </button>
          <button
            onClick={onPDF}
            className="block w-full text-left px-4 py-2 text-sm hover:bg-plasma-blue/10 hover:text-plasma-blue"
          >
            {t("export.pdf")}
          </button>
          <div className="border-t border-white/10" />
          <button
            onClick={onJSON}
            className="block w-full text-left px-4 py-2 text-sm hover:bg-plasma-magenta/10 hover:text-plasma-magenta"
          >
            {t("export.json")}
          </button>
        </div>
      )}
    </div>
  );
}
