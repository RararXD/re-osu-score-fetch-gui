import { ArrowUpRight, UserRound } from "lucide-react";
import { useState } from "react";
import type { Player, Ruleset } from "../../../shared/contracts";
import type { MessageKey } from "../../i18n";

interface PlayerSummaryProps {
  player: Player;
  mode: Ruleset;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
}

const modeLabels: Record<Ruleset, string> = {
  osu: "osu!",
  taiko: "osu!taiko",
  fruits: "osu!catch",
  mania: "osu!mania",
};

function number(value: number | null, digits = 0): string {
  return value === null
    ? "—"
    : value.toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
}

function duration(seconds: number | null): string {
  if (seconds === null) return "—";
  const hours = Math.floor(seconds / 3600);
  return `${hours.toLocaleString()}h`;
}

function PlayerAvatar({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <span className="player-avatar">
      {failed ? (
        <UserRound size={28} aria-hidden="true" />
      ) : (
        <img src={src} alt="" onError={() => setFailed(true)} />
      )}
    </span>
  );
}

export default function PlayerSummary({ player, mode, t }: PlayerSummaryProps) {
  const stats = [
    [t("pp"), `${number(player.pp, 2)} pp`],
    [t("rank"), player.globalRank === null ? "—" : `#${number(player.globalRank)}`],
    [t("accuracy"), `${number(player.hitAccuracy, 2)}%`],
    [t("playTime"), duration(player.playTime)],
  ];

  return (
    <section className="player-summary" aria-labelledby="player-name">
      <div className="player-identity">
        <PlayerAvatar key={player.avatarUrl} src={player.avatarUrl} />
        <div>
          <a
            id="player-name"
            className="player-name"
            href={`https://osu.ppy.sh/users/${player.userId}`}
            target="_blank"
            rel="noreferrer"
          >
            {player.username}
            <ArrowUpRight size={17} aria-hidden="true" />
          </a>
          <p>
            {player.country} <span aria-hidden="true">·</span> {modeLabels[mode]}
          </p>
        </div>
      </div>
      <dl className="player-stats">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
