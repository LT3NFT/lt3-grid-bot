function getAspectRatioForLayout(layout) {
  const a = layout?.aspectRatio;
  if (Number.isFinite(a) && a > 0) return a;
  return 1;
}

function rankForAspect(aspect) {
  if (aspect >= 0.88 && aspect <= 1.12) return { priority: 0, score: Math.abs(aspect - 1) };
  if (aspect > 1.12 && aspect <= 1.35) return { priority: 1, score: Math.abs(aspect - 1) };
  if (aspect >= 0.7 && aspect <= 0.8) return { priority: 2, score: Math.abs(aspect - 0.75) };
  return { priority: 3, score: Math.min(Math.abs(aspect - 1), Math.abs(aspect - 0.75)) };
}

export function rankLayoutsSquareFirst(layouts) {
  if (!layouts.length) return [];

  const ranked = layouts
    .map((layout, index) => ({
      layout,
      index,
      aspect: getAspectRatioForLayout(layout),
      rank: rankForAspect(getAspectRatioForLayout(layout)),
    }))
    .filter((x) => x.layout && x.layout.id);

  ranked.sort((a, b) => {
    if (a.rank.priority !== b.rank.priority) return a.rank.priority - b.rank.priority;
    if (a.rank.score !== b.rank.score) return a.rank.score - b.rank.score;
    return a.index - b.index;
  });

  return ranked.map((x) => x.layout);
}

export function pickBestLayout(layouts) {
  const ranked = rankLayoutsSquareFirst(layouts);
  return ranked[0] || layouts[0] || null;
}
