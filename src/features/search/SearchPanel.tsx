import { Button, Input } from "@heroui/react";
import {
  ChartNoAxesColumnIncreasing,
  Cherry,
  CircleDot,
  Disc3,
  LoaderCircle,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { type FormEvent, forwardRef } from "react";
import type { QueryMode } from "../../../shared/contracts";
import type { MessageKey } from "../../i18n";

export interface RecentPlayer {
  id: number;
  username: string;
  mode: QueryMode;
}

interface SearchPanelProps {
  input: string;
  mode: QueryMode;
  limit: 20 | 50;
  loading: boolean;
  cooldownSeconds: number;
  recent: RecentPlayer[];
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
  onInput: (value: string) => void;
  onMode: (mode: QueryMode) => void;
  onLimit: (limit: 20 | 50) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRecent: (player: RecentPlayer) => void;
  onClearRecent: () => void;
}

const modes: Array<{
  value: QueryMode;
  label: string;
  icon: typeof UserRound;
}> = [
  { value: "auto", label: "playerDefault", icon: UserRound },
  { value: "osu", label: "osu!", icon: CircleDot },
  { value: "taiko", label: "osu!taiko", icon: Disc3 },
  { value: "fruits", label: "osu!catch", icon: Cherry },
  { value: "mania", label: "osu!mania", icon: ChartNoAxesColumnIncreasing },
];

const SearchPanel = forwardRef<HTMLInputElement, SearchPanelProps>(function SearchPanel(
  {
    input,
    mode,
    limit,
    loading,
    cooldownSeconds,
    recent,
    t,
    onInput,
    onMode,
    onLimit,
    onSubmit,
    onRecent,
    onClearRecent,
  },
  ref,
) {
  return (
    <section className="search-zone" aria-label={t("search")}>
      <form className="search-instrument" onSubmit={onSubmit}>
        <label className="search-label" htmlFor="player-search">
          {t("playerLabel")}
        </label>
        <div className="search-line">
          <Search size={21} aria-hidden="true" />
          <Input
            ref={ref}
            id="player-search"
            aria-label={t("playerPlaceholder")}
            autoComplete="off"
            fullWidth
            maxLength={32}
            placeholder={t("playerPlaceholder")}
            value={input}
            variant="secondary"
            onChange={(event) => onInput(event.target.value)}
          />
          <kbd className="search-shortcut">⌘ K</kbd>
          <Button
            className="search-submit"
            isDisabled={!input.trim() || cooldownSeconds > 0}
            isPending={loading}
            type="submit"
            variant="primary"
          >
            {loading ? (
              <LoaderCircle className="spin" size={18} aria-hidden="true" />
            ) : (
              <Search size={18} aria-hidden="true" />
            )}
            {cooldownSeconds > 0
              ? t("retryIn", { seconds: cooldownSeconds })
              : loading
                ? t("searching")
                : t("search")}
          </Button>
        </div>

        <div className="search-options">
          <fieldset
            className="mode-picker"
            aria-label={t("ruleset")}
            disabled={loading || cooldownSeconds > 0}
          >
            <legend>{t("ruleset")}</legend>
            <div className="mode-buttons">
              {modes.map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  aria-pressed={mode === value}
                  className="mode-button"
                  size="sm"
                  type="button"
                  isDisabled={loading || cooldownSeconds > 0}
                  variant={mode === value ? "secondary" : "ghost"}
                  onPress={() => onMode(value)}
                >
                  <Icon size={14} aria-hidden="true" />
                  {label === "playerDefault" ? t("playerDefault") : label}
                </Button>
              ))}
            </div>
          </fieldset>

          <fieldset className="limit-picker" aria-label={t("bestCount")}>
            <legend>{t("bestCount")}</legend>
            <div className="limit-buttons" data-limit={limit}>
              {[20, 50].map((value) => (
                <Button
                  key={value}
                  aria-pressed={limit === value}
                  className="limit-button"
                  size="sm"
                  type="button"
                  variant={limit === value ? "secondary" : "ghost"}
                  onPress={() => onLimit(value as 20 | 50)}
                >
                  B{value}
                </Button>
              ))}
            </div>
          </fieldset>
        </div>
      </form>

      <div className="search-meta">
        <span className="public-note">
          <ShieldCheck size={14} aria-hidden="true" />
          {t("publicScores")}
        </span>
        {recent.length > 0 && (
          <div className="recent-row">
            <span>{t("recent")}</span>
            {recent.map((player) => (
              <button
                key={player.id}
                className="recent-player"
                type="button"
                disabled={loading || cooldownSeconds > 0}
                onClick={() => onRecent(player)}
              >
                {player.username}
              </button>
            ))}
            <button className="recent-clear" type="button" onClick={onClearRecent}>
              {t("clearRecent")}
            </button>
          </div>
        )}
      </div>
    </section>
  );
});

export default SearchPanel;
