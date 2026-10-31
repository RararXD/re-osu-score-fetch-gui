export function normalizePlayer(player: string): string {
  const normalized = player.trim().toLocaleLowerCase("en-US");
  return /^\d+$/u.test(normalized) ? normalized.replace(/^0+(?=\d)/u, "") : normalized;
}
