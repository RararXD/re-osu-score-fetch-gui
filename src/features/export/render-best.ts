import type { ScoresResponse } from "../../../shared/contracts";
import type { Language } from "../../i18n";
import { exportLayout } from "./layout";

export { exportLayout } from "./layout";

export interface ExportProgress {
  loaded: number;
  total: number;
}

type Drawable = ImageBitmap | null;

const exportCopy: Record<
  Language,
  { source: string; project: string; stats: readonly [string, string, string] }
> = {
  "zh-CN": {
    source: "SR 为基础难度 · 公开数据来自 osu!",
    project: "Raru Score · 非官方 fan-made 项目",
    stats: ["表现分", "排名", "准确率"],
  },
  "en-US": {
    source: "SR is base difficulty · Public data from osu!",
    project: "Raru Score · unofficial fan-made project",
    stats: ["PP", "RANK", "ACC"],
  },
};

export async function renderBestScores(
  data: ScoresResponse,
  limit: 20 | 50,
  language: Language,
  onProgress?: (progress: ExportProgress) => void,
): Promise<Blob> {
  await document.fonts.ready;
  const scores = data.scores.slice(0, limit);
  const layout = exportLayout(scores.length, limit);
  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");

  const urls = [data.player.avatarUrl, ...scores.map((score) => score.coverUrl)].filter(
    (value): value is string => Boolean(value),
  );
  const images = await loadImages(urls, onProgress);

  drawBackground(context, layout.width, layout.height);
  const copy = exportCopy[language];
  drawHeader(context, data, limit, images.get(data.player.avatarUrl) ?? null, layout.width, copy);
  scores.forEach((score, index) => {
    const column = index % layout.columns;
    const row = Math.floor(index / layout.columns);
    drawScoreCard(
      context,
      score,
      index,
      40 + column * (layout.cardWidth + 18),
      320 + row * 142,
      layout.cardWidth,
      images.get(score.coverUrl ?? "") ?? null,
    );
  });
  context.fillStyle = "#9d98ad";
  context.font = '22px "DM Sans Variable", sans-serif';
  context.textBaseline = "middle";
  context.fillText(copy.source, 40, layout.height - 42);
  context.textAlign = "right";
  context.fillText(copy.project, layout.width - 40, layout.height - 42);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("PNG encoding failed"))),
      "image/png",
    );
  });
  for (const image of images.values()) image?.close();
  canvas.width = 0;
  canvas.height = 0;
  return blob;
}

export async function downloadBestScores(
  data: ScoresResponse,
  limit: 20 | 50,
  language: Language,
  onProgress?: (progress: ExportProgress) => void,
): Promise<void> {
  const blob = await renderBestScores(data, limit, language, onProgress);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeFilename(data.player.username)}-${data.mode}-B${limit}.png`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function loadImages(
  urls: string[],
  onProgress?: (progress: ExportProgress) => void,
): Promise<Map<string, Drawable>> {
  const unique = [...new Set(urls)];
  const result = new Map<string, Drawable>();
  let cursor = 0;
  let loaded = 0;
  const worker = async () => {
    while (cursor < unique.length) {
      const index = cursor;
      cursor += 1;
      const url = unique[index];
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Image unavailable");
        result.set(url, await createImageBitmap(await response.blob()));
      } catch {
        result.set(url, null);
      } finally {
        loaded += 1;
        onProgress?.({ loaded, total: unique.length });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, unique.length) }, worker));
  return result;
}

function drawBackground(context: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#11101a");
  gradient.addColorStop(0.55, "#0d0d14");
  gradient.addColorStop(1, "#17101c");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  const marks = [
    [0.08, 0.12, "circle"],
    [0.32, 0.08, "triangle"],
    [0.77, 0.14, "square"],
    [0.92, 0.65, "circle"],
    [0.21, 0.82, "square"],
  ] as const;
  context.lineWidth = 3;
  context.strokeStyle = "rgba(207, 177, 255, .16)";
  for (const [x, y, kind] of marks) {
    context.save();
    context.translate(width * x, height * y);
    if (kind === "circle") context.arc(0, 0, 18, 0, Math.PI * 2);
    else if (kind === "square") context.rect(-14, -14, 28, 28);
    else {
      context.moveTo(0, -18);
      context.lineTo(17, 15);
      context.lineTo(-17, 15);
      context.closePath();
    }
    context.stroke();
    context.restore();
  }
}

function drawHeader(
  context: CanvasRenderingContext2D,
  data: ScoresResponse,
  limit: 20 | 50,
  avatar: Drawable,
  width: number,
  copy: (typeof exportCopy)[Language],
) {
  context.fillStyle = "#f6f1fa";
  context.font = '700 38px "Space Mono", monospace';
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText("Raru Score", 40, 52);
  context.fillStyle = "#ff79a8";
  context.fillText(`BEST ${limit}`, width - 250, 52);

  roundRect(context, 40, 92, width - 80, 190, 18);
  context.fillStyle = "rgba(34, 30, 45, .94)";
  context.fill();
  if (avatar) {
    context.save();
    context.beginPath();
    context.arc(122, 187, 58, 0, Math.PI * 2);
    context.clip();
    coverImage(context, avatar, 64, 129, 116, 116);
    context.restore();
  } else {
    context.fillStyle = "#c4a8ff";
    context.beginPath();
    context.arc(122, 187, 58, 0, Math.PI * 2);
    context.fill();
  }
  context.fillStyle = "#f6f1fa";
  context.font = '700 38px "DM Sans Variable", sans-serif';
  context.fillText(data.player.username, 208, 157);
  context.fillStyle = "#aaa2b8";
  context.font = '22px "DM Sans Variable", sans-serif';
  context.fillText(`${data.player.country} · ${data.mode}`, 208, 205);

  const stats = [
    [copy.stats[0], number(data.player.pp, 2)],
    [copy.stats[1], data.player.globalRank === null ? "—" : `#${number(data.player.globalRank)}`],
    [copy.stats[2], `${number(data.player.hitAccuracy, 2)}%`],
  ];
  const start = Math.max(width * 0.56, 760);
  stats.forEach(([label, value], index) => {
    const x = start + index * ((width - start - 60) / stats.length);
    context.fillStyle = "#8f889e";
    context.font = '18px "DM Sans Variable", sans-serif';
    context.fillText(label, x, 151);
    context.fillStyle = "#d9c2ff";
    context.font = '700 32px "DM Sans Variable", sans-serif';
    context.fillText(value, x, 200);
  });
}

function drawScoreCard(
  context: CanvasRenderingContext2D,
  score: ScoresResponse["scores"][number],
  index: number,
  x: number,
  y: number,
  width: number,
  cover: Drawable,
) {
  roundRect(context, x, y, width, 124, 14);
  context.fillStyle = "rgba(28, 26, 37, .96)";
  context.fill();
  context.fillStyle = "#8f889e";
  context.font = '18px "Space Mono", monospace';
  context.textAlign = "center";
  context.fillText(String(index + 1).padStart(2, "0"), x + 28, y + 62);
  if (cover) coverImage(context, cover, x + 54, y + 14, 98, 96);
  else {
    context.fillStyle = "#30283e";
    roundRect(context, x + 54, y + 14, 98, 96, 10);
    context.fill();
  }
  context.textAlign = "left";
  context.fillStyle = "#f4eff7";
  context.font = '700 20px "DM Sans Variable", sans-serif';
  context.fillText(ellipsis(context, score.beatmapTitle, width - 330), x + 170, y + 38);
  context.fillStyle = "#aaa2b8";
  context.font = '16px "DM Sans Variable", sans-serif';
  context.fillText(
    ellipsis(context, `${score.artist} · ${score.version}`, width - 330),
    x + 170,
    y + 68,
  );
  context.fillStyle = "#ff79a8";
  context.font = '16px "Space Mono", monospace';
  context.fillText(
    `★ ${number(score.starRating, 2)}  ${score.mods.join(" ") || "NM"}`,
    x + 170,
    y + 98,
  );
  context.textAlign = "right";
  context.fillStyle = gradeColor(score.rank);
  context.font = '700 27px "Space Mono", monospace';
  context.fillText(score.rank, x + width - 142, y + 43);
  context.fillStyle = "#f4eff7";
  context.font = '700 25px "DM Sans Variable", sans-serif';
  context.fillText(`${number(score.pp, 2)} pp`, x + width - 18, y + 43);
  context.fillStyle = "#aaa2b8";
  context.font = '16px "DM Sans Variable", sans-serif';
  context.fillText(
    `${number(score.accuracy * 100, 2)}% · ${number(score.maxCombo)}×`,
    x + width - 18,
    y + 84,
  );
}

function coverImage(
  context: CanvasRenderingContext2D,
  image: ImageBitmap,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  context.drawImage(
    image,
    (image.width - sourceWidth) / 2,
    (image.height - sourceHeight) / 2,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height,
  );
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function ellipsis(context: CanvasRenderingContext2D, value: string, maxWidth: number): string {
  if (context.measureText(value).width <= maxWidth) return value;
  let result = value;
  while (result.length > 1 && context.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

function number(value: number | null, digits = 0): string {
  return value === null
    ? "—"
    : value.toLocaleString("en-US", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
}

function gradeColor(rank: string): string {
  if (rank.startsWith("SS")) return "#f7d66d";
  if (rank.startsWith("S")) return "#ffd66b";
  if (rank === "A") return "#7be3a1";
  return "#cbb2ff";
}

function safeFilename(value: string): string {
  const safe = Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return code < 32 || '\\/:*?"<>|'.includes(character) ? "_" : character;
  })
    .join("")
    .trim();
  return safe || "player";
}
