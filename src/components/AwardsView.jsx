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
  const tournaments = state.registeredTournaments || [];
  const tournament = tournaments.find(t => t.id === selectedTournamentId) || null;

  const rankOrder = useMemo(() => getRankOrder(), []);

  const getTotalHitCountAllStands = useCallback((archer) => {
    const arrows1 = tournament?.data?.arrowsRound1 || state.tournament.arrowsRound1 || 0;
    const arrows2 = tournament?.data?.arrowsRound2 || state.tournament.arrowsRound2 || 0;
    const total = arrows1 + arrows2;
    
    let count = 0;
    for (let i = 0; i < total; i++) {
      const standKey = `stand${Math.floor(i / 4) + 1}`;
      const arrowIndex = i % 4;
      const results = archer.results || {};
      const standResults = results[standKey] || [];
      if (standResults[arrowIndex] === 'o') count++;
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

  // ★ 競射結果を取得・10秒ごとにポーリング
  const fetchShootoffResults = useCallback(async () => {
    if (!selectedTournamentId) return;
    try {
      const response = await fetch(`${API_URL}/ranking/shootoff/${selectedTournamentId}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
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
    // 競射結果に含まれる選手IDセットを作成（的中数ベースの順位を上書きするため）
    const shootoffArcherIds = new Set([
      ...((shootoffResults?.shichuma?.results || []).map(r => r.archerId)),
      ...((shootoffResults?.enkin?.results || []).filter(r => !r.isDefeated && r.rank !== '敗退').map(r => r.archerId)),
    ]);

    // 競射結果から archerId → 最終順位 マップを構築
    const shootoffRankMap = {};
    if (shootoffResults?.shichuma?.results) {
      for (const r of shootoffResults.shichuma.results) {
        if (!r.pendingEnkin) shootoffRankMap[r.archerId] = { rank: r.rank, source: '射詰' };
      }
    }
    if (shootoffResults?.enkin?.results) {
      for (const r of shootoffResults.enkin.results) {
        if (!r.isDefeated && r.rank !== '敗退') {
          const rank = typeof r.rank === 'number' ? r.rank : parseInt(r.rank);
          if (!isNaN(rank)) shootoffRankMap[r.archerId] = { rank, source: '遠近' };
        }
      }
    }

    const groups = {};
    
    // Create groups based on individual division gender separation settings
    for (const div of divisions) {
      const divGenderSeparation = div.enableGenderSeparation || enableGenderSeparation;
      if (divGenderSeparation) {
        groups[`${div.id}_male`] = { division: { ...div, gender: 'male' }, rows: [] };
        groups[`${div.id}_female`] = { division: { ...div, gender: 'female' }, rows: [] };
      } else {
        groups[div.id] = { division: div, rows: [] };
      }
    }

    for (const a of archers) {
      const division = getDivisionForArcher(a, divisions);
      const divId = division.replace(/_male$|_female$/, '');
      const hitCount = getTotalHitCountAllStands(a);
      const gender = a.gender || 'male'; // Default to male if not specified
      
      // Find division configuration to check gender separation
      const divisionConfig = divisions.find(d => d.id === divId);
      const divGenderSeparation = divisionConfig?.enableGenderSeparation || enableGenderSeparation;
      
      let targetGroupId;
      if (divGenderSeparation) {
        targetGroupId = `${divId}_${gender}`;
      } else {
        targetGroupId = divId;
      }
      
      if (!groups[targetGroupId]) {
        // Fallback to unassigned if division not found
        targetGroupId = divGenderSeparation ? 'unassigned_male' : 'unassigned';
        if (!groups[targetGroupId]) {
          groups[targetGroupId] = { 
            division: { id: 'unassigned', label: '未分類', gender: divGenderSeparation ? 'male' : undefined }, 
            rows: [] 
          };
        }
      }
      
      groups[targetGroupId].rows.push({
        ...a,
        hitCount,
        divisionId: targetGroupId,
        // 競射結果があれば source を付与（表示用）
        shootoffSource: shootoffRankMap[a.archerId]?.source || null,
      });
    }

    const result = [];
    
    for (const key of Object.keys(groups)) {
      const g = groups[key];
      if (g.rows.length === 0) continue; // Skip empty groups

      // 的中数ベースで順位計算
      const hitRanked = calculateRanksWithTiesCallback(g.rows.map(r => ({ ...r })));

      // 競射結果がある場合は上書き
      const ranked = hitRanked.map(archer => {
        const so = shootoffRankMap[archer.archerId];
        if (so) {
          return { ...archer, rank: so.rank, shootoffSource: so.source };
        }
        return archer;
      });

      // 競射対象で順位が同率になっている場合を再整理して最終ソート
      ranked.sort((a, b) => a.rank - b.rank);

      result.push({
        division: g.division,
        ranked,
      });
    }
    
    // Sort groups: maintain original division order, with configured gender first for each division
    result.sort((a, b) => {
      const getBaseDivisionId = (id) => {
        const hasGenderSuffix = /_male$|_female$/.test(id);
        if (hasGenderSuffix) {
          return id.replace(/_male$|_female$/, '');
        }
        return id;
      };
      
      const getGenderOrder = (id) => {
        if (/_male$|_female$/.test(id)) {
          if (femaleFirst) {
            return id.endsWith('_female') ? 0 : 1;
          }
          return id.endsWith('_male') ? 0 : 1;
        }
        return 0;
      };
      
      const baseA = getBaseDivisionId(a.division.id);
      const baseB = getBaseDivisionId(b.division.id);
      const ai = divisions.findIndex(d => d.id === baseA);
      const bi = divisions.findIndex(d => d.id === baseB);
      
      if (ai !== bi) {
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      }
      
      // If same base division, sort by gender
      return getGenderOrder(a.division.id) - getGenderOrder(b.division.id);
    });
    
    return result;
  }, [archers, divisions, enableGenderSeparation, femaleFirst, getTotalHitCountAllStands, calculateRanksWithTiesCallback, shootoffResults]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4">表彰</h2>
        
        {divisionRankings.length === 0 ? (
          <p className="text-gray-500">該当する選手がいません</p>
        ) : (
          <div className="space-y-8">
            {divisionRankings.map((group, groupIndex) => (
              <div key={groupIndex} className="border rounded-lg p-4">
                <h3 className="text-xl font-semibold mb-4">
                  {group.division.label}
                  {group.division.gender && (
                    <span className="ml-2 text-sm text-gray-500">
                      ({group.division.gender === 'male' ? '男子' : '女子'})
                    </span>
                  )}
                </h3>
                
                {group.ranked.length === 0 ? (
                  <p className="text-gray-500">該当選手なし</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            順位
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            氏名
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            所属
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            段位
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            的中数
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            決定
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {group.ranked
                          .filter(archer => archer.rank <= awardRankLimit)
                          .map((archer, index) => (
                            <tr key={archer.id || archer.archerId || `archer-${index}`} className={archer.rank <= 3 ? 'bg-yellow-50' : ''}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center justify-center px-2 py-1 text-xs font-bold rounded-full ${
                                  archer.rank === 1 ? 'bg-yellow-400 text-white' :
                                  archer.rank === 2 ? 'bg-gray-400 text-white' :
                                  archer.rank === 3 ? 'bg-orange-400 text-white' :
                                  'bg-gray-200 text-gray-800'
                                }`}>
                                  {archer.rank}位
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {archer.name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {archer.affiliation}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {archer.danRank || archer.grade || '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {archer.hitCount}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {archer.shootoffSource ? (
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    archer.shootoffSource === '射詰' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                                  }`}>
                                    {archer.shootoffSource}
                                  </span>
                                ) : (
                                  <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">的中数</span>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AwardsView;