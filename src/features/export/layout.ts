export interface ExportLayout {
  columns: number;
  rows: number;
  width: number;
  height: number;
  cardWidth: number;
}

export function exportLayout(scoreCount: number, limit: 20 | 50): ExportLayout {
  const columns = limit === 50 ? 5 : 2;
  const cardWidth = 592;
  const gap = 18;
  const rows = Math.max(1, Math.ceil(scoreCount / columns));
  return {
    columns,
    rows,
    cardWidth,
    width: 80 + columns * cardWidth + (columns - 1) * gap,
    height: 340 + rows * 142 + 84,
  };
}
