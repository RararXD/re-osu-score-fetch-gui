import { useEffect, useState } from "react";
import type { MessageKey } from "../../i18n";

interface ResultFreshnessProps {
  cache: string;
  refreshAt: number | null;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
}

export default function ResultFreshness({ cache, refreshAt, t }: ResultFreshnessProps) {
  const [, update] = useState(0);
  useEffect(() => {
    if (refreshAt === null || refreshAt <= Date.now()) return;
    const timer = window.setInterval(() => update((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [refreshAt]);

  const seconds = refreshAt === null ? 0 : Math.max(0, Math.ceil((refreshAt - Date.now()) / 1000));
  return (
    <div className="result-freshness">
      <span>{cache === "HIT" ? t("cacheHit") : t("cacheMiss")}</span>
      <span aria-hidden="true">·</span>
      <span>{seconds > 0 ? t("refreshed", { seconds }) : t("refreshReady")}</span>
    </div>
  );
}
