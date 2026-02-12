import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { applicantsApi } from '../utils/api';
import { 
  calculateRanksWithTies, 
  getDivisionIdForArcher, 
  getRankOrder 
} from '../utils/competition';

const AwardsView = ({ state, dispatch, selectedTournamentId, setSelectedTournamentId }) => {
  const [archers, setArchers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
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

  const divisionRankings = useMemo(() => {
    const groups = {};
    
    // Create gender-separated groups if enabled
    if (enableGenderSeparation) {
      for (const div of divisions) {
        groups[`${div.id}_male`] = { division: { ...div, gender: 'male' }, rows: [] };
        groups[`${div.id}_female`] = { division: { ...div, gender: 'female' }, rows: [] };
      }
    } else {
      for (const div of divisions) {
        groups[div.id] = { division: div, rows: [] };
      }
    }

    for (const a of archers) {
      const divId = getDivisionIdForArcher(a, divisions);
      const hitCount = getTotalHitCountAllStands(a);
      const gender = a.gender || 'male'; // Default to male if not specified
      
      let targetGroupId;
      if (enableGenderSeparation) {
        targetGroupId = `${divId}_${gender}`;
      } else {
        targetGroupId = divId;
      }
      
      if (!groups[targetGroupId]) {
        // Fallback to unassigned if division not found
        targetGroupId = enableGenderSeparation ? 'unassigned_male' : 'unassigned';
        if (!groups[targetGroupId]) {
          groups[targetGroupId] = { 
            division: { id: 'unassigned', label: '未分類', gender: enableGenderSeparation ? 'male' : undefined }, 
            rows: [] 
          };
        }
      }
      
      groups[targetGroupId].rows.push({
        ...a,
        hitCount,
        divisionId: targetGroupId
      });
    }

    const result = [];
    
    for (const key of Object.keys(groups)) {
      const g = groups[key];
      if (g.rows.length === 0) continue; // Skip empty groups
      const ranked = calculateRanksWithTiesCallback(g.rows.map(r => ({ ...r })));
      result.push({
        division: g.division,
        ranked,
      });
    }
    
    // Sort groups: maintain original division order, with male before female for each division
    result.sort((a, b) => {
      const getBaseDivisionId = (id) => {
        if (enableGenderSeparation) {
          return id.replace(/_male$|_female$/, '');
        }
        return id;
      };
      
      const getGenderOrder = (id) => {
        if (enableGenderSeparation) {
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
  }, [archers, divisions, enableGenderSeparation, getTotalHitCountAllStands, calculateRanksWithTiesCallback]);

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
                  {enableGenderSeparation && (
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
                                {archer.rank}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {archer.hitCount}
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