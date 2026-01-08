import React, { useMemo, useCallback } from 'react';

const QualifiersView = ({ archers, tournament, getRankCategory }) => {
  // 通過判定関数をメモ化
  const isPassed = useCallback((archer) => {
    // 結果が未設定の場合は即座に判定保留
    if (!archer.results?.stand1) return false;
    
    const results = archer.results.stand1;
    const currentRound = tournament?.currentRound || 1;
    const isFirstRound = currentRound === 1;
    const endIndex = isFirstRound ? (tournament?.arrowsRound1 || 0) : ((tournament?.arrowsRound1 || 0) + (tournament?.arrowsRound2 || 0));
    
    // 必要な部分だけを処理
    let hitCount = 0;
    let hasNull = false;
    
    for (let i = 0; i < endIndex; i++) {
      if (i >= results.length) {
        hasNull = true;
        break;
      }
      if (results[i] === null) {
        hasNull = true;
        break;
      }
      if (results[i] === 'o') hitCount++;
    }
    
    // 未入力の場合は不通過
    if (hasNull) return false;
    
    // 大会設定の通過ルールに基づいて判定
    const passRule = tournament?.passRule || 'all_four';
    const currentRoundArrows = isFirstRound ? (tournament?.arrowsRound1 || 0) : (tournament?.arrowsRound2 || 0);
    
    if (passRule === 'all_four') {
      return hitCount === currentRoundArrows;
    } else if (passRule === 'four_or_more') {
      return hitCount >= Math.min(4, currentRoundArrows);
    } else if (passRule === 'three_or_more') {
      return hitCount >= Math.min(3, currentRoundArrows);
    } else if (passRule === 'two_or_more') {
      return hitCount >= Math.min(2, currentRoundArrows);
    }
    
    // デフォルトは全て的中
    return hitCount === currentRoundArrows;
  }, [tournament]);

  // パフォーマンス向上のため、メモ化
  const passedArchers = useMemo(() => {
    if (!Array.isArray(archers)) return [];
    return archers.filter(archer => isPassed(archer));
  }, [archers, isPassed]);

  return (
    <div className="view-container">
      <div className="view-header">
        <h1>予選通過者一覧</h1>
        <p className="text-sm text-gray-600">現在の通過者: {passedArchers.length}名</p>
      </div>
      <div className="view-content">
        <div className="card">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">順位</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">氏名</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">支部</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">段位</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {passedArchers.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">
                      通過者はまだいません
                    </td>
                  </tr>
                ) : (
                  passedArchers.map((archer, index) => {
                    const { ceremony, rank } = getRankCategory(archer.rank);
                    return (
                      <tr key={archer.archerId}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {index + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {archer.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {archer.affiliation}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {ceremony}{rank}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QualifiersView;
