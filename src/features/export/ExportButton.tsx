import { Button } from "@heroui/react";
import { Download, LoaderCircle } from "lucide-react";
import { useState } from "react";
import type { ScoresResponse } from "../../../shared/contracts";
import type { Language, MessageKey } from "../../i18n";
import { downloadBestScores, type ExportProgress } from "./render-best";

interface ExportButtonProps {
  data: ScoresResponse;
  language: Language;
  limit: 20 | 50;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
}

export default function ExportButton({ data, language, limit, t }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [error, setError] = useState(false);

  async function download() {
    if (exporting) return;
    setExporting(true);
    setError(false);
    setProgress(null);
    try {
      await downloadBestScores(data, limit, language, setProgress);
    } catch {
      setError(true);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="export-action">
      <Button className="export-button" isPending={exporting} variant="outline" onPress={download}>
        {exporting ? (
          <LoaderCircle className="spin" size={17} aria-hidden="true" />
        ) : (
          <Download size={17} aria-hidden="true" />
        )}
        {exporting
          ? `${t("exporting")}${progress ? ` ${progress.loaded}/${progress.total}` : ""}`
          : t("exportImage", { limit })}
      </Button>
      {error && <p role="alert">{t("exportFailed")}</p>}
    </div>
  );
}
