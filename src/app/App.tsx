import { Button } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Clock3,
  Languages,
  LoaderCircle,
  RefreshCw,
  Search,
  Trophy,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { QueryMode } from "../../shared/contracts";
import { normalizePlayer } from "../../shared/player";
import RhythmField from "../components/RhythmField";
import ExportButton from "../features/export/ExportButton";
import PlayerSummary from "../features/scores/PlayerSummary";
import ResultFreshness from "../features/scores/ResultFreshness";
import ScoreList from "../features/scores/ScoreList";
import SearchPanel, { type RecentPlayer } from "../features/search/SearchPanel";
import { detectLanguage, type Language, type MessageKey, translate } from "../i18n";
import { ApiError, fetchScores } from "../lib/api";
import { useContentTransition } from "../lib/use-content-transition";

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
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now);
  const searchInput = useRef<HTMLInputElement>(null);
  const t = useMemo(
    () => (key: MessageKey, values?: Record<string, string | number>) =>
      translate(language, key, values),
    [language],
  );

  const query = useQuery({
    queryKey: ["scores", submittedPlayer, mode],
    queryFn: ({ signal }) => fetchScores(submittedPlayer, mode, 50, signal),
    enabled: Boolean(submittedPlayer),
    retry: false,
    refetchOnReconnect: false,
    staleTime: (current) => {
      const refreshAt = current.state.data?.refreshAt;
      return refreshAt == null ? 0 : Math.max(0, refreshAt - current.state.dataUpdatedAt);
    },
  });

  useEffect(() => {
    const error = query.error;
    if (
      error instanceof ApiError &&
      (error.code === "RATE_LIMITED" || error.code === "UPSTREAM_BUSY")
    ) {
      setCooldownUntil((current) => Math.max(current, error.retryAt));
      setNow(Date.now());
    }
  }, [query.error]);

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const timer = window.setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (time >= cooldownUntil) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  const cooldownSeconds = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const searchBlocked = query.isFetching || cooldownSeconds > 0;

  const result = useMemo(() => {
    const data = query.data?.data;
    return data ? { ...data, scores: data.scores.slice(0, limit) } : undefined;
  }, [query.data, limit]);

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
    const data = query.data?.data;
    if (!data) return;
    const player = data.player;
    setRecent((current) => {
      const next = [
        { id: player.userId, username: player.username, mode: data.mode },
        ...current.filter((item) => item.id !== player.userId),
      ].slice(0, 5);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        // Recent searches are optional browser convenience data.
      }
      return next;
    });
  }, [query.data]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (searchBlocked) return;
    const player = normalizePlayer(input);
    if (!player) {
      searchInput.current?.focus();
      return;
    }
    if (player === submittedPlayer) {
      if (!query.data?.refreshAt || query.data.refreshAt <= Date.now() || query.isError) {
        void query.refetch();
      }
    } else {
      setSubmittedPlayer(player);
    }
  }

  function chooseRecent(player: RecentPlayer) {
    if (searchBlocked) return;
    setInput(player.username);
    setMode(player.mode);
    const normalized = normalizePlayer(player.username);
    if (normalized === submittedPlayer && player.mode === mode) {
      if (!query.data?.refreshAt || query.data.refreshAt <= Date.now() || query.isError) {
        void query.refetch();
      }
    } else {
      setSubmittedPlayer(normalized);
    }
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
  const view =
    query.isPending && submittedPlayer
      ? "loading"
      : query.isError
        ? "error"
        : result
          ? "results"
          : "empty";
  const resultMotion = useContentTransition<HTMLElement>(
    view === "results"
      ? `${view}:${submittedPlayer}:${mode}:${limit}:${query.dataUpdatedAt}`
      : view,
  );
  const languageMotion = useContentTransition<HTMLElement>(language);

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

      <main ref={languageMotion}>
        <section className="hero-copy">
          <h1>
            <span className="hero-line">
              {t("heroBefore")} <span className="osu-beat">osu!</span> {t("heroAfterFirst")}
            </span>
            <span className="hero-line">{t("heroAfterSecond")}</span>
          </h1>
          <p>
            <span className="hero-detail-line">{t("heroDetailFirst")}</span>
            <span className="hero-detail-line">{t("heroDetailSecond")}</span>
          </p>
        </section>

        <SearchPanel
          ref={searchInput}
          input={input}
          limit={limit}
          loading={query.isFetching}
          cooldownSeconds={cooldownSeconds}
          mode={mode}
          recent={recent}
          t={t}
          onClearRecent={clearRecent}
          onInput={setInput}
          onLimit={setLimit}
          onMode={(next) => {
            if (!searchBlocked) setMode(next);
          }}
          onRecent={chooseRecent}
          onSubmit={submit}
        />

        <section
          ref={resultMotion}
          className="result-stage"
          data-view={view}
          aria-live="polite"
          aria-busy={query.isFetching}
        >
          {query.isPending && submittedPlayer ? (
            <LoadingState label={t("loading")} />
          ) : query.isError ? (
            <div className="error-state" role="alert">
              <Clock3 size={24} aria-hidden="true" />
              <div className="error-copy">
                <p>{errorMessage}</p>
                <span>
                  {cooldownSeconds > 0
                    ? t("retryIn", { seconds: cooldownSeconds })
                    : t("retryReady")}
                </span>
              </div>
              <Button
                isDisabled={searchBlocked}
                variant="outline"
                onPress={() => {
                  if (!searchBlocked) void query.refetch();
                }}
              >
                <RefreshCw size={16} aria-hidden="true" />
                {t("retry")}
              </Button>
            </div>
          ) : result ? (
            <div className="results" aria-busy={query.isFetching}>
              <PlayerSummary mode={result.mode} player={result.player} t={t} />
              <div className="results-heading">
                <div>
                  <Trophy size={19} aria-hidden="true" />
                  <h2>
                    {t("results")} <em>B{limit}</em>
                  </h2>
                  <span>{t("scoresCount", { count: result.scores.length })}</span>
                </div>
                <ExportButton data={result} language={language} limit={limit} t={t} />
              </div>
              <ResultFreshness
                cache={query.data?.cache ?? "UNKNOWN"}
                refreshAt={query.data?.refreshAt ?? null}
                loading={query.isFetching}
                disabled={searchBlocked}
                onRefresh={() => {
                  if (!searchBlocked) void query.refetch();
                }}
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
              <div className="empty-state-copy">
                <Search size={22} className="empty-icon" aria-hidden="true" />
                <h2>{t("emptyTitle")}</h2>
                <p>{t("emptyDetail")}</p>
              </div>
              <div className="empty-readout" aria-hidden="true">
                <div className="empty-range">
                  <strong>B20</strong>
                  <span />
                  <strong>B50</strong>
                </div>
                <div className="empty-modes">
                  <span>osu!</span>
                  <span>taiko</span>
                  <span>catch</span>
                  <span>mania</span>
                </div>
              </div>
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
    <div className="loading-state" role="status">
      <div className="loading-caption">
        <LoaderCircle className="spin" size={17} aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className="loading-player shimmer" aria-hidden="true">
        <span className="loading-avatar" />
        <span className="loading-lines">
          <i />
          <i />
        </span>
        <span className="loading-stat" />
        <span className="loading-stat" />
      </div>
      {rows.map((row) => (
        <div className="loading-row shimmer" key={row} aria-hidden="true">
          <span className="loading-cover" />
          <span className="loading-lines">
            <i />
            <i />
          </span>
          <span className="loading-value" />
        </div>
      ))}
    </div>
  );
}
