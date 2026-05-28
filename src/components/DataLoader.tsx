import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { parseFile } from "../lib/parsers";
import type {
  ChartDefinition,
  ColumnMapping,
  DataTable,
} from "../charts/types";
import { Button } from "./ui/Button";
import { ColumnMapper, validateMapping } from "./ColumnMapper";

interface Props {
  chartDef: ChartDefinition;
  onReady: (data: DataTable, mapping: ColumnMapping) => void;
}

export function DataLoader({ chartDef, onReady }: Props) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<DataTable | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [error, setError] = useState<string | null>(null);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    try {
      const dt = await parseFile(f);
      if (dt.columns.length === 0) throw new Error(t("data.emptyError"));
      setData(dt);
      setMapping({});
    } catch (err) {
      setError((err as Error).message);
    } finally {
      e.target.value = "";
    }
  };

  const v = data ? validateMapping(chartDef, data, mapping) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.tsv,.xlsx,.xls"
          className="hidden"
          onChange={onPick}
        />
        <Button variant="primary" onClick={() => inputRef.current?.click()}>
          {t("data.upload")}
        </Button>
        <span className="text-xs text-text-muted">
          {t("data.requiredFields")}{" "}
          {chartDef.requiredFields
            .filter((f) => !f.optional)
            .map((f) => t(`charts.${chartDef.id}.fields.${f.key}`, t(`fields.${f.key}`, f.label)))
            .join(", ")}
        </span>
      </div>

      {error && (
        <div className="text-plasma-magenta text-sm border border-plasma-magenta/30 rounded p-3 bg-plasma-magenta/5">
          {error}
        </div>
      )}

      {data && (
        <>
          <PreviewTable data={data} />
          <ColumnMapper
            chartDef={chartDef}
            data={data}
            mapping={mapping}
            onChange={setMapping}
          />
          {v && !v.valid && (
            <ul className="text-xs text-plasma-magenta list-disc pl-5">
              {v.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <Button
            variant="secondary"
            disabled={!v?.valid}
            onClick={() => v?.valid && onReady(data, mapping)}
          >
            {t("data.continue")}
          </Button>
        </>
      )}
    </div>
  );
}

function PreviewTable({ data }: { data: DataTable }) {
  const { t } = useTranslation();
  const rows = data.rows.slice(0, 5);
  return (
    <div className="border border-white/10 rounded overflow-auto max-h-56">
      <table className="w-full text-xs">
        <thead className="bg-graphite text-plasma-blue uppercase tracking-wider">
          <tr>
            {data.columns.map((c) => (
              <th key={c} className="text-left px-3 py-2 font-display">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-white/5">
              {r.map((v, j) => (
                <td key={j} className="px-3 py-1.5 text-text-muted">
                  {v === null ? "—" : String(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-3 py-1.5 text-[10px] text-text-muted bg-graphite/50">
        {t("data.preview", { showing: rows.length, total: data.rows.length })}
      </div>
    </div>
  );
}
