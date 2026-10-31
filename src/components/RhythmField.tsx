import { useEffect, useLayoutEffect, useRef, useState } from "react";

const randomBetween = (minimum: number, maximum: number) =>
  minimum + Math.random() * (maximum - minimum);

const shapePaths = {
  circle: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18",
  square: "M3 3h18v18H3Z",
  triangle: "M12 3 22 21H2Z",
} as const;

const shapeNames = Object.keys(shapePaths) as Array<keyof typeof shapePaths>;
const colors = ["#c9b2ff", "#b6cde5", "#dbb8d0"];
const sparkIds = Array.from({ length: 32 }, (_, index) => index);
const textRegions = [
  ".site-header",
  ".hero-copy",
  ".search-zone",
  ".empty-state",
  ".player-summary",
  ".results-heading",
  ".result-freshness",
  ".result-footnote",
  "footer",
].join(", ");

function createPlacement(container: HTMLElement) {
  const x = randomBetween(16, Math.max(16, container.clientWidth - 16));
  const y = randomBetween(24, Math.max(24, container.clientHeight - 24));
  const size = randomBetween(14, 32);
  const containerBounds = container.getBoundingClientRect();
  const padding = size / 2 + 8;
  const behindText = Array.from(container.parentElement?.querySelectorAll(textRegions) ?? []).some(
    (element) => {
      const bounds = element.getBoundingClientRect();
      return (
        bounds.width > 0 &&
        bounds.height > 0 &&
        containerBounds.left + x + padding > bounds.left &&
        containerBounds.left + x - padding < bounds.right &&
        containerBounds.top + y + padding > bounds.top &&
        containerBounds.top + y - padding < bounds.bottom
      );
    },
  );

  return {
    x,
    y,
    size,
    angle: randomBetween(-25, 25),
    behindText,
    skipped: behindText && Math.random() < 0.3,
    shape: shapeNames[Math.floor(Math.random() * shapeNames.length)],
    flash: !behindText && Math.random() < 0.16,
    color: colors[Math.floor(Math.random() * colors.length)],
  };
}

function Spark() {
  const element = useRef<HTMLSpanElement>(null);
  const [timing] = useState(() => ({
    duration: randomBetween(4.5, 8),
    delay: randomBetween(-8, 0),
  }));
  const [point, setPoint] = useState<ReturnType<typeof createPlacement> | null>(null);

  useLayoutEffect(() => {
    const container = element.current?.parentElement;
    if (container) setPoint(createPlacement(container));
  }, []);

  return (
    <span
      ref={element}
      className={`rhythm-spark${point?.flash ? " rhythm-spark-flash" : ""}${point?.behindText ? " rhythm-spark-subtle" : ""}`}
      style={{
        left: point?.x,
        top: point?.y,
        width: point?.size,
        height: point?.size,
        visibility: point && !point.skipped ? undefined : "hidden",
        color: point?.flash ? "#e3d8ff" : point?.color,
        animationDuration: `${timing.duration}s`,
        animationDelay: `${timing.delay}s`,
      }}
      onAnimationIteration={(event) => {
        const container = event.currentTarget.parentElement;
        if (container) setPoint(createPlacement(container));
      }}
    >
      <svg
        className="rhythm-spark-shape"
        viewBox="0 0 24 24"
        aria-hidden="true"
        style={{ rotate: `${point?.angle ?? 0}deg` }}
      >
        <path d={shapePaths[point?.shape ?? "circle"]} />
      </svg>
    </span>
  );
}

export default function RhythmField() {
  const field = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = field.current;
    if (!container) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        (entry.target as HTMLElement).dataset.offscreen = String(!entry.isIntersecting);
      }
    });
    for (const spark of container.children) observer.observe(spark);
    const onVisibility = () => {
      container.dataset.paused = String(document.hidden);
    };
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div ref={field} className="rhythm-field" aria-hidden="true">
      {sparkIds.map((id) => (
        <Spark key={id} />
      ))}
    </div>
  );
}
