import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { applicantsApi, API_URL } from '../utils/api';
import { 
  calculateRanksWithTies, 
  getRankOrder 
} from '../utils/competition';
import { getDivisionForArcher } from '../utils/tournament';

const AwardsView = ({ state, dispatch, selectedTournamentId, setSelectedTournamentId }) => {
  const [archers, setArchers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [shootoffResults, setShootoffResults] = useState(null);
  const [shichumaFinalResults, setShichumaFinalResults] = useState(() => {
    // ローカルストレージから読み込み
    try {
      const saved = localStorage.getItem(`shichumaResults_${selectedTournamentId}`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [enkinFinalResults, setEnkinFinalResults] = useState(() => {
    // ローカルストレージから読み込み
    try {
      const saved = localStorage.getItem(`enkinResults_${selectedTournamentId}`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const tournaments = state.registeredTournaments || [];
  const tournament = tournaments.find(t => t.id === selectedTournamentId) || null;

  const rankOrder = useMemo(() => getRankOrder(), []);

  const getTotalHitCountAllStands = useCallback((archer) => {
    const arrows1 = tournament?.data?.arrowsRound1 || state.tournament.arrowsRound1 || 0;
    const arrows2 = tournament?.data?.arrowsRound2 || state.tournament.arrowsRound2 || 0;
    const total = arrows1 + arrows2;
    const results = archer?.results || {};
    let count = 0;
    for (let s = 1; s <= 6; s++) {
      const arr = results[`stand${s}`] || [];
      for (let i = 0; i < Math.min(total, arr.length); i++) {
        if (arr[i] === 'o') count++;
      }
    }
    return count;
  }, [tournament, state.tournament]);

  const calculateRanksWithTiesCallback = useCallback((items) => {
    return calculateRanksWithTies(items);
  }, []);

  useEffect(() => {
    const fetchArchers = async () => {
      if (!selectedTournamentId) {
        setArchers([]);
        return;
      }
      setIsLoading(true);
      try {
        const result = await applicantsApi.getByTournament(selectedTournamentId);
        if (result.success) {
          const checkedIn = (result.data || []).filter(a => a.isCheckedIn);
          setArchers(checkedIn);
        } else {
          setArchers([]);
        }
      } catch (error) {
        console.error('Failed to fetch archers:', error);
        setArchers([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchArchers();
  }, [selectedTournamentId]);

  // ローカルストレージに保存
  useEffect(() => {
    if (selectedTournamentId && shichumaFinalResults) {
      localStorage.setItem(`shichumaResults_${selectedTournamentId}`, JSON.stringify(shichumaFinalResults));
    }
  }, [shichumaFinalResults, selectedTournamentId]);

  useEffect(() => {
    if (selectedTournamentId && enkinFinalResults) {
      localStorage.setItem(`enkinResults_${selectedTournamentId}`, JSON.stringify(enkinFinalResults));
    }
  }, [enkinFinalResults, selectedTournamentId]);

  // ★ 競射結果を取得・10秒ごとにポーリング（RankingViewと同じロジック）
  const fetchShootoffResults = useCallback(async () => {
    if (!selectedTournamentId) return;
    try {
      const response = await fetch(`${API_URL}/ranking/shootoff/${selectedTournamentId}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // サーバーから取得したデータでローカルを更新
          if (result.data.shichuma) {
            setShichumaFinalResults(result.data.shichuma);
          }
          if (result.data.enkin) {
            setEnkinFinalResults(result.data.enkin);
          }
          setShootoffResults(result.data);
        }
      }
    } catch (e) {
      console.warn('AwardsView shootoff fetch error:', e);
    }
  }, [selectedTournamentId]);

  useEffect(() => {
    fetchShootoffResults();
  }, [fetchShootoffResults]);

  useEffect(() => {
    if (!selectedTournamentId) return;
    const interval = setInterval(fetchShootoffResults, 10000);
    return () => clearInterval(interval);
  }, [selectedTournamentId, fetchShootoffResults]);

  const selectedTournament = state.registeredTournaments.find(t => t.id === selectedTournamentId);
  const localDefaultDivisions = [
    { id: 'lower', label: '級位~三段以下の部' },
    { id: 'middle', label: '四・五段の部' },
    { id: 'title', label: '称号者の部' }
  ];
  const divisions = (selectedTournament && selectedTournament.data && selectedTournament.data.divisions) 
    ? selectedTournament.data.divisions 
    : localDefaultDivisions;

  const awardRankLimit = tournament?.data?.awardRankLimit || 3;
  const enableGenderSeparation = selectedTournament?.data?.enableGenderSeparation || false;
  const femaleFirst = enableGenderSeparation && (selectedTournament?.data?.femaleFirst ?? false);

  const divisionRankings = useMemo(() => {
    // RankingViewのgetMergedFinalResultsと同じロジックで統合結果を構築
    const mergedResults = [];
    const processedArcherIds = new Set();

    // 部門ごとに処理
    divisions.forEach(div => {
      const divArchers = archers.filter(a => getDivisionForArcher(a, divisions) === div.id);
      const divisionUsedRanks = new Set();
      const divisionProcessedArchers = new Set();

      const divisionEnkinResults = (enkinFinalResults?.results || []).filter(result => {
        if (result.divisionId) return result.divisionId === div.id;
        return divArchers.some(a => a.archerId === result.archerId);
      });

      // 射詰競射の結果を処理
      if (shichumaFinalResults?.results) {
        const divShichumaResults = shichumaFinalResults.results.filter(result => {
          if (result.divisionId) return result.divisionId === div.id;
          return divArchers.some(a => a.archerId === result.archerId);
        });

        [...divShichumaResults]
          .sort((a, b) => a.rank - b.rank)
          .forEach(result => {
            const archer = divArchers.find(a => a.archerId === result.archerId);
            if (!archer) return;
            const isFromShichumaToEnkin = result.pendingEnkin || divisionEnkinResults.some(e => e.archerId === result.archerId);
            if (isFromShichumaToEnkin) return;
            if (divisionProcessedArchers.has(result.archerId)) return;

            mergedResults.push({
              archerId: result.archerId,
              name: archer.name,
              affiliation: archer.affiliation,
              rank: result.rank,
              rank_source: 'shichuma',
              shootOffType: 'shichuma',
              hitCount: getTotalHitCountAllStands(archer),
              divisionId: div.id,
              danRank: archer.rank
            });
            divisionUsedRanks.add(result.rank);
            divisionProcessedArchers.add(result.archerId);
            processedArcherIds.add(result.archerId);
          });
      }

      // 遠近競射の結果を処理
      if (divisionEnkinResults.length > 0) {
        [...divisionEnkinResults]
          .sort((a, b) => {
            const aT = a.targetRank != null ? a.targetRank : 9999;
            const bT = b.targetRank != null ? b.targetRank : 9999;
            if (aT !== bT) return aT - bT;
            return (parseInt(a.rank) || 9999) - (parseInt(b.rank) || 9999);
          })
          .forEach(result => {
            if (divisionProcessedArchers.has(result.archerId)) return;
            const archer = divArchers.find(a => a.archerId === result.archerId);
            if (!archer) return;
            if (result.rank === '敗退' || result.isDefeated) return;
            const finalRank = parseInt(result.rank);
            if (divisionUsedRanks.has(finalRank)) return;

            mergedResults.push({
              archerId: result.archerId,
              name: archer.name,
              affiliation: archer.affiliation,
              rank: finalRank,
              rank_source: 'enkin',
              shootOffType: 'enkin',
              hitCount: getTotalHitCountAllStands(archer),
              divisionId: div.id,
              danRank: archer.rank
            });
            divisionUsedRanks.add(finalRank);
            divisionProcessedArchers.add(result.archerId);
            processedArcherIds.add(result.archerId);
          });
      }
    });

    // 的中数確定結果を追加
    divisions.forEach(div => {
      const divArchers = archers.filter(a => getDivisionForArcher(a, divisions) === div.id);
      const rankGroups = {};
      divArchers.forEach(archer => {
        const hitCount = getTotalHitCountAllStands(archer);
        if (!rankGroups[hitCount]) rankGroups[hitCount] = [];
        rankGroups[hitCount].push(archer);
      });
      const sortedGroups = Object.entries(rankGroups)
        .map(([h, g]) => [parseInt(h), g])
        .sort(([a], [b]) => b - a);
      let currentRank = 1;
      sortedGroups.forEach(([hitCount, group]) => {
        const isTied = group.length > 1;
        const isInAwardRange = currentRank <= awardRankLimit;
        if (!isTied && isInAwardRange) {
          group.forEach(archer => {
            if (!processedArcherIds.has(archer.archerId)) {
              mergedResults.push({
                archerId: archer.archerId,
                name: archer.name,
                affiliation: archer.affiliation,
                rank: currentRank,
                rank_source: 'confirmed',
                shootOffType: null,
                hitCount: hitCount,
                divisionId: div.id,
                danRank: archer.rank
              });
              processedArcherIds.add(archer.archerId);
            }
          });
        }
        currentRank += group.length;
      });
    });

    // 部門ごとに分類
    const resultsByDivision = {};
    divisions.forEach(div => {
      const divGenderSeparation = div.enableGenderSeparation || enableGenderSeparation;
      if (divGenderSeparation) {
        resultsByDivision[`${div.id}_male`] = { division: { ...div, gender: 'male' }, ranked: [] };
        resultsByDivision[`${div.id}_female`] = { division: { ...div, gender: 'female' }, ranked: [] };
      } else {
        resultsByDivision[div.id] = { division: div, ranked: [] };
      }
    });

    mergedResults.forEach(result => {
      const archer = archers.find(a => a.archerId === result.archerId);
      if (archer) {
        const divId = result.divisionId;
        const gender = archer.gender || 'male';
        const divisionConfig = divisions.find(d => d.id === divId);
        const divGenderSeparation = divisionConfig?.enableGenderSeparation || enableGenderSeparation;
        const targetDivId = divGenderSeparation ? `${divId}_${gender}` : divId;
        if (!resultsByDivision[targetDivId]) {
          resultsByDivision[targetDivId] = { division: { id: targetDivId, label: targetDivId }, ranked: [] };
        }
        resultsByDivision[targetDivId].ranked.push({
          ...result,
          shootoffSource: result.shootOffType === 'shichuma' ? '射詰' : result.shootOffType === 'enkin' ? '遠近' : null
        });
      }
    });

    const result = [];
    divisions.forEach(div => {
      const divGenderSeparation = div.enableGenderSeparation || enableGenderSeparation;
      if (divGenderSeparation) {
        const firstG = femaleFirst ? 'female' : 'male';
        const secondG = femaleFirst ? 'male' : 'female';
        const firstL = femaleFirst ? '女' : '男';
        const secondL = femaleFirst ? '男' : '女';
        if (resultsByDivision[`${div.id}_${firstG}`]?.ranked.length > 0) {
          result.push(resultsByDivision[`${div.id}_${firstG}`]);
        }
        if (resultsByDivision[`${div.id}_${secondG}`]?.ranked.length > 0) {
          result.push(resultsByDivision[`${div.id}_${secondG}`]);
        }
      } else {
        if (resultsByDivision[div.id]?.ranked.length > 0) {
          result.push(resultsByDivision[div.id]);
        }
      }
    });

    return result;
  }, [archers, divisions, enableGenderSeparation, femaleFirst, getTotalHitCountAllStands, shichumaFinalResults, enkinFinalResults, awardRankLimit]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 最終順位表（RankingViewと同じ形式） */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4">🏆 最終順位表</h2>
        <p className="text-sm text-gray-600 mb-4">表彰範囲：{awardRankLimit}位まで</p>
        
        {divisionRankings.length === 0 ? (
          <p className="text-gray-500">最終順位表の記録がありません</p>
        ) : (
          <div className="space-y-6">
            {divisionRankings.map((group, groupIndex) => (
              <div key={groupIndex}>
                <h3 className="text-lg font-semibold text-green-600 mb-3">
                  {group.division.label}
                  {group.division.gender && (
                    <span className="ml-2 text-sm text-gray-500">
                      （{group.division.gender === 'male' ? '男' : '女'}）
                    </span>
                  )}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-green-300">
                    <thead>
                      <tr className="bg-green-100">
                        <th className="border border-green-300 px-4 py-2 text-left">順位</th>
                        <th className="border border-green-300 px-4 py-2 text-center">的中数</th>
                        <th className="border border-green-300 px-4 py-2 text-left">氏名</th>
                        <th className="border border-green-300 px-4 py-2 text-center">詳細</th>
                        <th className="border border-green-300 px-4 py-2 text-left">所属</th>
                        <th className="border border-green-300 px-4 py-2 text-left">段位</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.ranked.filter(archer => archer.rank <= awardRankLimit).length === 0 ? (
                        <tr>
                          <td colSpan="6" className="border border-green-300 px-4 py-8 text-center text-gray-500">
                            この部門の最終順位表の記録がありません<br />
                            <span className="text-xs">（表彰範囲：{awardRankLimit}位まで）</span>
                          </td>
                        </tr>
                      ) : (
                        group.ranked
                          .filter(archer => archer.rank <= awardRankLimit)
                          .map((archer, index) => (
                            <tr key={archer.id || archer.archerId || `archer-${index}`} className="hover:bg-green-50">
                              <td className="border border-green-300 px-4 py-2 font-bold">
                                <span className="text-green-900">{archer.rank}位</span>
                              </td>
                              <td className="border border-green-300 px-4 py-2 text-center font-semibold">
                                {archer.hitCount || '-'}
                              </td>
                              <td className="border border-green-300 px-4 py-2 font-semibold">
                                {archer.name}
                              </td>
                              <td className="border border-green-300 px-4 py-2 text-sm text-center">
                                {archer.shootoffSource ? (
                                  <span className={`text-sm px-2 py-1 rounded ${
                                    archer.shootoffSource === '射詰' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                                  }`}>
                                    {archer.shootoffSource}
                                  </span>
                                ) : (
                                  <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">的中数</span>
                                )}
                              </td>
                              <td className="border border-green-300 px-4 py-2 text-gray-600">
                                {archer.affiliation}
                              </td>
                              <td className="border border-green-300 px-4 py-2 text-gray-600">
                                {archer.danRank || archer.rank || '-'}
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AwardsView;