import { Button } from "@heroui/react";
import { Clock3, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import type { MessageKey } from "../../i18n";

interface ResultFreshnessProps {
  cache: string;
  refreshAt: number | null;
  loading: boolean;
  disabled: boolean;
  onRefresh: () => void;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
}

export default function ResultFreshness({
  cache,
  refreshAt,
  loading,
  disabled,
  onRefresh,
  t,
}: ResultFreshnessProps) {
  const [, update] = useState(0);
  useEffect(() => {
    if (refreshAt === null || refreshAt <= Date.now()) return;
    const timer = window.setInterval(() => {
      update((value) => value + 1);
      if (refreshAt <= Date.now()) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [refreshAt]);

  const seconds = refreshAt === null ? 0 : Math.max(0, Math.ceil((refreshAt - Date.now()) / 1000));
  return (
    <div className="results-toolbar">
      <div className="result-freshness">
        <Clock3 size={13} aria-hidden="true" />
        <span>{cache === "HIT" ? t("cacheHit") : t("cacheMiss")}</span>
        <span aria-hidden="true">·</span>
        <span>{seconds > 0 ? t("refreshed", { seconds }) : t("refreshReady")}</span>
      </div>
      <Button
        className="refresh-button"
        size="sm"
        variant="ghost"
        isDisabled={disabled || seconds > 0}
        onPress={onRefresh}
      >
        <RefreshCw size={14} className={loading ? "spin" : undefined} aria-hidden="true" />
        {loading ? t("searching") : t("refresh")}
      </Button>
    </div>
  );
}
