// Competition logic utilities

export const judgeNearFarCompetition = (results) => {
  if (results.length === 0) return results;

  // 的中数でソート（降順）
  const sorted = [...results].sort((a, b) => b.hitCount - a.hitCount);

  // 全員の的中数を確認
  const maxHits = sorted[0].hitCount;
  
  // ケース1: 全員が全中（4矢すべて中）→ 順位決定戦なし
  if (maxHits === 4 && sorted.every(r => r.hitCount === 4)) {
    return sorted;
  }

  // ケース2: 複数人が全中または部分的中で、最後の矢で分かれた場合
  // 最後の矢で外れた人のみ対象（全中した人は対象外）
  const hasFullHit = results.some(r => r.hitCount === 4);
  const hasLastArrowMiss = results.some(r => {
    const archer = r.archer || r;
    const results_arr = archer.results || [];
    return !results_arr[3];
  });

  if (hasFullHit && hasLastArrowMiss) {
    const lastArrowMissers = results.filter(r => {
      const archer = r.archer || r;
      const results_arr = archer.results || [];
      return !results_arr[3];
    });
    
    // 最後の矢で外れた人たちの中でのみ順位を決める
    const sortedMissers = lastArrowMissers.sort((a, b) => b.hitCount - a.hitCount);
    return sortedMissers;
  }

  // ケース3: 通常の的中数での順位決定
  return sorted;
};

export const calculateRanksWithTies = (items) => {
  const sorted = [...items].sort((a, b) => b.hitCount - a.hitCount);
  let currentRank = 1;
  let prevHitCount = null;
  let sameRankCount = 0;

  return sorted.map((item, index) => {
    if (prevHitCount !== null && item.hitCount === prevHitCount) {
      sameRankCount++;
    } else {
      currentRank = index + 1 + sameRankCount;
      sameRankCount = 0;
    }
    
    prevHitCount = item.hitCount;
    return { ...item, rank: currentRank };
  });
};

export const normalizeRank = (rank) => {
  if (!rank) return '';
  return rank
    .replace('二段', '弐段')
    .replace('三段', '参段');
};

export const getRankOrder = () => [
  '無指定', '五級', '四級', '三級', '弐級', '壱級', 
  '初段', '弐段', '参段', '四段', '五段', 
  '錬士五段', '錬士六段', '教士七段', '教士八段', 
  '範士八段', '範士九段'
];

export const getRankIndex = (rank) => {
  const r = normalizeRank(rank);
  const idx = getRankOrder().indexOf(r);
  return idx === -1 ? 9999 : idx;
};

export const getDivisionIdForArcher = (archer, divisions) => {
  const rIdx = getRankIndex(archer?.rank);
  for (const d of (divisions || [])) {
    const minIdx = d?.minRank ? getRankIndex(d.minRank) : 0;
    const maxIdx = d?.maxRank ? getRankIndex(d.maxRank) : 9999;
    if (rIdx >= minIdx && rIdx <= maxIdx) return d.id;
  }
  return 'unassigned';
};
