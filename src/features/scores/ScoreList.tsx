import { ArrowUpRight, ImageOff, Star } from "lucide-react";
import type { Score } from "../../../shared/contracts";

interface ScoreListProps {
  scores: Score[];
}

function number(value: number | null, digits = 0): string {
  return value === null
    ? "—"
    : value.toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
}

export default function ScoreList({ scores }: ScoreListProps) {
  return (
    <ol className="score-list">
      {scores.map((score, index) => (
        <li className="score-row" key={score.scoreId ?? `${score.beatmapId}-${index}`}>
          <span className="score-position">{String(index + 1).padStart(2, "0")}</span>
          <div className="score-cover">
            {score.coverUrl ? (
              <img src={score.coverUrl} alt="" loading="lazy" />
            ) : (
              <ImageOff size={19} aria-hidden="true" />
            )}
          </div>
          <div className="score-map">
            {score.beatmapId ? (
              <a
                className="score-map-link"
                href={`https://osu.ppy.sh/beatmaps/${score.beatmapId}`}
                target="_blank"
                rel="noreferrer"
              >
                {score.beatmapTitle}
                <ArrowUpRight size={13} aria-hidden="true" />
              </a>
            ) : (
              <strong className="score-map-title">{score.beatmapTitle}</strong>
            )}
            <p>
              {score.artist} <span aria-hidden="true">·</span> {score.version}
            </p>
            <div className="score-tags">
              <span className="star-rating">
                <Star size={11} fill="currentColor" aria-hidden="true" />
                {number(score.starRating, 2)}
              </span>
              {score.mods.length > 0 ? (
                score.mods.map((mod) => (
                  <span className="mod" key={mod}>
                    {mod}
                  </span>
                ))
              ) : (
                <span className="mod mod-muted">NM</span>
              )}
            </div>
          </div>
          <span className={`grade grade-${score.rank.toLowerCase()}`}>{score.rank}</span>
          <div className="score-accuracy">
            <strong>{number(score.accuracy * 100, 2)}%</strong>
            <span>{number(score.maxCombo)}×</span>
          </div>
          <div className="score-pp">
            <strong>{number(score.pp, 2)}</strong>
            <span>pp</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
