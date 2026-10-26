import { Button } from "@heroui/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Languages, RefreshCw, Trophy } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { QueryMode } from "../../shared/contracts";
import RhythmField from "../components/RhythmField";
import ExportButton from "../features/export/ExportButton";
import PlayerSummary from "../features/scores/PlayerSummary";
import ResultFreshness from "../features/scores/ResultFreshness";
import ScoreList from "../features/scores/ScoreList";
import SearchPanel, { type RecentPlayer } from "../features/search/SearchPanel";
import { detectLanguage, type Language, type MessageKey, translate } from "../i18n";
import { ApiError, fetchScores } from "../lib/api";

const RECENT_KEY = "raru-recent-players-v2";

function readRecent(): RecentPlayer[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (item): item is RecentPlayer =>
          typeof item === "object" &&
          item !== null &&
          Number.isSafeInteger((item as RecentPlayer).id) &&
          typeof (item as RecentPlayer).username === "string" &&
          ["auto", "osu", "taiko", "fruits", "mania"].includes((item as RecentPlayer).mode),
      )
      .slice(0, 5);
  } catch {
    return [];
  }
}

export default function App() {
  const [language, setLanguage] = useState<Language>(detectLanguage);
  const [input, setInput] = useState("");
  const [submittedPlayer, setSubmittedPlayer] = useState("");
  const [mode, setMode] = useState<QueryMode>("auto");
  const [limit, setLimit] = useState<20 | 50>(20);
  const [recent, setRecent] = useState<RecentPlayer[]>(readRecent);
  const searchInput = useRef<HTMLInputElement>(null);
  const t = useMemo(
    () => (key: MessageKey, values?: Record<string, string | number>) =>
      translate(language, key, values),
    [language],
  );

  const query = useQuery({
    queryKey: ["scores", submittedPlayer, mode, limit],
    queryFn: ({ signal }) => fetchScores(submittedPlayer, mode, limit, signal),
    enabled: Boolean(submittedPlayer),
    placeholderData: keepPreviousData,
    retry: (failureCount, error) =>
      error instanceof ApiError && error.code === "UPSTREAM_BUSY" && failureCount < 3,
    retryDelay: (_attempt, error) =>
      error instanceof ApiError ? Math.min(30_000, error.retryAfter * 1000) : 1000,
  });

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      localStorage.setItem("raru-language", language);
    } catch {
      // Language remains in memory when storage is unavailable.
    }
  }, [language]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInput.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const player = query.data?.data.player;
    if (!player) return;
    setRecent((current) => {
      const next = [
        { id: player.userId, username: player.username, mode },
        ...current.filter((item) => item.id !== player.userId),
      ].slice(0, 5);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        // Recent searches are optional browser convenience data.
      }
      return next;
    });
  }, [query.data?.data.player, mode]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const player = input.trim();
    if (!player) {
      searchInput.current?.focus();
      return;
    }
    setSubmittedPlayer(player);
  }

  function chooseRecent(player: RecentPlayer) {
    setInput(player.username);
    setMode(player.mode);
    setSubmittedPlayer(player.username);
  }

  function clearRecent() {
    setRecent([]);
    try {
      localStorage.removeItem(RECENT_KEY);
    } catch {
      // The in-memory list has still been cleared.
    }
  }

  const errorCode = query.error instanceof ApiError ? query.error.code : "unknownError";
  const errorMessage =
    errorCode in errorKeys ? t(errorKeys[errorCode as keyof typeof errorKeys]) : t("unknownError");
  const result = query.data?.data;

  return (
    <div className="app-shell">
      <RhythmField />
      <header className="site-header">
        <a className="brand" href="/" aria-label={t("brand")}>
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>{t("brand")}</span>
        </a>
        <nav>
          <Button
            aria-label={t("switchLanguage")}
            className="language-button"
            isIconOnly
            size="sm"
            variant="ghost"
            onPress={() => setLanguage(language === "zh-CN" ? "en-US" : "zh-CN")}
          >
            <Languages size={18} aria-hidden="true" />
          </Button>
          <a href="https://osu.ppy.sh" target="_blank" rel="noreferrer">
            {t("visitOsu")} <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </nav>
      </header>

      <main>
        <section className="hero-copy">
          <h1>
            {t("heroBefore")} <span className="osu-beat">osu!</span> {t("heroAfter")}
          </h1>
          <p>{t("heroDetail")}</p>
        </section>

        <SearchPanel
          ref={searchInput}
          input={input}
          language={language}
          limit={limit}
          loading={query.isFetching}
          mode={mode}
          recent={recent}
          t={t}
          onClearRecent={clearRecent}
          onInput={setInput}
          onLimit={setLimit}
          onMode={setMode}
          onRecent={chooseRecent}
          onSubmit={submit}
        />

        <section className="result-stage" aria-live="polite">
          {query.isPending && submittedPlayer ? (
            <LoadingState label={t("loading")} />
          ) : query.isError ? (
            <div className="error-state" role="alert">
              <span className="error-shape" aria-hidden="true" />
              <p>{errorMessage}</p>
              <Button variant="outline" onPress={() => query.refetch()}>
                <RefreshCw size={16} aria-hidden="true" />
                {t("retry")}
              </Button>
            </div>
          ) : result ? (
            <div className={query.isPlaceholderData ? "results results-updating" : "results"}>
              <PlayerSummary mode={result.mode} player={result.player} t={t} />
              <div className="results-heading">
                <div>
                  <Trophy size={19} aria-hidden="true" />
                  <h2>{t("results")}</h2>
                  <span>{t("scoresCount", { count: result.scores.length })}</span>
                </div>
                <ExportButton data={result} language={language} limit={limit} t={t} />
              </div>
              <ResultFreshness
                cache={query.data?.cache ?? "UNKNOWN"}
                refreshAt={query.data?.refreshAt ?? null}
                t={t}
              />
              {result.scores.length > 0 ? (
                <ScoreList scores={result.scores} />
              ) : (
                <p className="no-scores">{t("noScores")}</p>
              )}
              <div className="result-footnote">
                <span>{t("sourceNote")}</span>
                <span>
                  {t("updatedAt", {
                    time: new Date(result.fetchedAt).toLocaleString(language),
                  })}
                </span>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-rhythm" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <h2>{t("emptyTitle")}</h2>
              <p>{t("emptyDetail")}</p>
            </div>
          )}
        </section>
      </main>

      <footer>
        <span>Raru Score · v0.1.0</span>
        <span className="footer-note">{t("unofficial")}</span>
        <a
          className="footer-link"
          href="https://github.com/Rarverse"
          target="_blank"
          rel="noreferrer"
        >
          {t("github")} <ArrowUpRight size={13} aria-hidden="true" />
        </a>
      </footer>
    </div>
  );
}

const errorKeys = {
  PLAYER_NOT_FOUND: "PLAYER_NOT_FOUND",
  RATE_LIMITED: "RATE_LIMITED",
  NOT_CONFIGURED: "NOT_CONFIGURED",
  UPSTREAM_BUSY: "UPSTREAM_BUSY",
  UPSTREAM_ERROR: "UPSTREAM_ERROR",
  INVALID_REQUEST: "INVALID_REQUEST",
} satisfies Record<string, MessageKey>;

function LoadingState({ label }: { label: string }) {
  const rows = ["first", "second", "third", "fourth"];

  return (
    <div className="loading-state" role="status" aria-label={label}>
      <div className="loading-player shimmer" />
      {rows.map((row) => (
        <div className="loading-row shimmer" key={row} />
      ))}
    </div>
  );
}
