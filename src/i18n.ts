export type Language = "zh-CN" | "en-US";

const messages = {
  "zh-CN": {
    brand: "Raru 查分器",
    visitOsu: "访问 osu!",
    heroBefore: "把你的",
    heroAfterFirst: "最佳成绩，",
    heroAfterSecond: "排成一眼看懂的节奏。",
    heroDetailFirst: "查询任意玩家的 Best 20 / Best 50，",
    heroDetailSecond: "查看 pp、准确率与谱面难度，再保存成图片。",
    playerPlaceholder: "输入玩家用户名或数字 ID",
    playerLabel: "查找玩家",
    search: "查询成绩",
    searching: "正在查询",
    playerDefault: "玩家默认",
    bestCount: "成绩数量",
    ruleset: "游戏模式",
    loading: "正在加载成绩",
    publicScores: "无需登录 · 公开成绩",
    recent: "最近查询",
    clearRecent: "清除",
    results: "最佳成绩",
    exportImage: "下载 B{limit} 图片",
    exporting: "正在生成图片",
    exportFailed: "图片生成失败，请重试。",
    refreshed: "{seconds} 秒后可刷新",
    refreshReady: "可以重新查询最新成绩",
    cacheHit: "边缘缓存",
    cacheMiss: "实时获取",
    retry: "重试",
    retryIn: "{seconds} 秒后可重试",
    retryReady: "可以重试，或修改玩家名称后重新查询。",
    refresh: "刷新成绩",
    emptyTitle: "输入一位玩家，成绩会在这里展开。",
    emptyDetail: "选择游戏模式，查看最佳成绩。B20 / B50 即时切换，喜欢的成绩可以保存成图片。",
    noScores: "这位玩家在当前模式还没有可显示的最佳成绩。",
    pp: "表现分",
    rank: "全球排名",
    accuracy: "准确率",
    playTime: "游玩时长",
    scoresCount: "{count} 条",
    updatedAt: "更新于 {time}",
    sourceNote: "SR 为未应用 Mods 的基础难度；pp 与公开成绩来自 osu!。",
    unofficial: "非官方 fan-made 项目，与 peppy / osu! 无隶属关系。",
    github: "GitHub",
    switchLanguage: "Switch to English",
    unknownError: "查询失败，请稍后重试。",
    PLAYER_NOT_FOUND: "没有找到该玩家，请检查用户名或 ID。",
    RATE_LIMITED: "查询过于频繁，请稍后再试。",
    NOT_CONFIGURED: "服务端尚未配置 osu! API 凭据。",
    UPSTREAM_BUSY: "查询服务暂时繁忙，请在倒计时结束后重试。",
    UPSTREAM_ERROR: "osu! 暂时无法访问，请稍后重试。",
    INVALID_REQUEST: "请检查玩家名称、模式和成绩数量。",
  },
  "en-US": {
    brand: "Raru Score",
    visitOsu: "Visit osu!",
    heroBefore: "Turn your",
    heroAfterFirst: "best scores into",
    heroAfterSecond: "a rhythm you can read at a glance.",
    heroDetailFirst: "Look up any player's Best 20 / Best 50,",
    heroDetailSecond: "explore pp, accuracy and star rating, then save it as an image.",
    playerPlaceholder: "Enter a player username or numeric ID",
    playerLabel: "Find a player",
    search: "Search scores",
    searching: "Searching",
    playerDefault: "Player default",
    bestCount: "Score count",
    ruleset: "Ruleset",
    loading: "Loading scores",
    publicScores: "No sign-in · Public scores",
    recent: "Recent",
    clearRecent: "Clear",
    results: "Best scores",
    exportImage: "Download B{limit} image",
    exporting: "Generating image",
    exportFailed: "Image generation failed. Try again.",
    refreshed: "Refresh available in {seconds}s",
    refreshReady: "Ready to fetch the latest scores",
    cacheHit: "Edge cache",
    cacheMiss: "Fetched live",
    retry: "Try again",
    retryIn: "Try again in {seconds}s",
    retryReady: "Try again, or edit the player name to start a new search.",
    refresh: "Refresh scores",
    emptyTitle: "Search for a player and their scores will unfold here.",
    emptyDetail:
      "Choose a ruleset and explore their best plays. Switch instantly between B20 and B50, then save an image to share.",
    noScores: "This player has no best scores to show in the selected mode.",
    pp: "Performance",
    rank: "Global rank",
    accuracy: "Accuracy",
    playTime: "Play time",
    scoresCount: "{count} scores",
    updatedAt: "Updated {time}",
    sourceNote: "SR is the base difficulty without mods; pp and public scores come from osu!.",
    unofficial: "Unofficial fan-made project. Not affiliated with peppy or osu!.",
    github: "GitHub",
    switchLanguage: "切换到中文",
    unknownError: "The lookup failed. Please try again.",
    PLAYER_NOT_FOUND: "That player could not be found. Check the username or ID.",
    RATE_LIMITED: "Too many searches. Please try again shortly.",
    NOT_CONFIGURED: "The server has no osu! API credentials configured.",
    UPSTREAM_BUSY: "The lookup service is busy. Try again after the countdown.",
    UPSTREAM_ERROR: "osu! is temporarily unavailable. Please try again.",
    INVALID_REQUEST: "Check the player name, mode and score count.",
  },
} as const;

export type MessageKey = keyof (typeof messages)["en-US"];

export function detectLanguage(): Language {
  try {
    const stored = localStorage.getItem("raru-language");
    if (stored === "zh-CN" || stored === "en-US") return stored;
  } catch {
    // Storage may be unavailable; browser language remains a safe fallback.
  }
  return navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en-US";
}

export function translate(
  language: Language,
  key: MessageKey,
  values: Record<string, string | number> = {},
): string {
  let result: string = messages[language][key];
  for (const [name, value] of Object.entries(values)) {
    result = result.replaceAll(`{${name}}`, String(value));
  }
  return result;
}
