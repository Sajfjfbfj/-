import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Lock, LogOut, RotateCcw, Copy, Check, QrCode, Maximize2, Filter, X, User, Camera, RefreshCw, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import QRCodeScanner from './QRCodeScanner';
import AwardsView from './AwardsView';
import { tournamentsApi, applicantsApi, resultsApi, rankingApi, API_URL } from '../utils/api';
import { 
  getLocalDateKey, 
  distanceKm, 
  normalizeTournamentFormData, 
  getStoredAttachments, 
  setStoredAttachments 
} from '../utils/tournament';
import { 
  judgeNearFarCompetition, 
  calculateRanksWithTies,
  normalizeRank,
  getRankOrder,
  getRankIndex,
  getDivisionIdForArcher
} from '../utils/competition';

const RankingView = ({ state, dispatch, selectedTournamentId, setSelectedTournamentId, onLogout }) => {
  const [archers, setArchers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [shootOffType, setShootOffType] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('');
  const [selectedGender, setSelectedGender] = useState(() => localStorage.getItem('ranking_selectedGender') || 'all');
  const [currentShichumaRound, setCurrentShichumaRound] = useState(1);
  const [shichumaResults, setShichumaResults] = useState({});
  const [eliminatedArchers, setEliminatedArchers] = useState(new Set());
  const [eliminationOrder, setEliminationOrder] = useState([]);
  const [eliminationRound, setEliminationRound] = useState({});
  const [simultaneousEliminations, setSimultaneousEliminations] = useState([]);
  const [currentShootOffArchers, setCurrentShootOffArchers] = useState([]);
  const [originalEnkinArchers, setOriginalEnkinArchers] = useState(new Set());
  const [savedEnkinRanks, setSavedEnkinRanks] = useState(new Set());
  const [enkinTargetRank, setEnkinTargetRank] = useState(null);
  const [enkinStartRank, setEnkinStartRank] = useState(2);
  const [isShootOffActive, setIsShootOffActive] = useState(false);
  const [isSavingShichuma, setIsSavingShichuma] = useState(false);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [shichumaFinalResults, setShichumaFinalResults] = useState(null);
  const [enkinFinalResults, setEnkinFinalResults] = useState(null);
  const [enkinDefeated, setEnkinDefeated] = useState(new Set());
  const [remainingAfterFourArrows, setRemainingAfterFourArrows] = useState([]);
  const [editingArrow, setEditingArrow] = useState(null);
  const [showEnkinOption, setShowEnkinOption] = useState(false);
  const [skipShootOffFetchUntil, setSkipShootOffFetchUntil] = useState(0);
  const [ignoreServerFinalsUntil, setIgnoreServerFinalsUntil] = useState(0);
  const [suppressMergedDisplayUntil, setSuppressMergedDisplayUntil] = useState(0);
  const [useLocalOnlyFinals, setUseLocalOnlyFinals] = useState(false);

  const tournaments = state.registeredTournaments || [];
  const tournament = tournaments.find(t => t.id === selectedTournamentId) || null;

  const localDefaultDivisions = [
    { id: 'lower', label: '級位~三段以下の部' },
    { id: 'middle', label: '四・五段の部' },
    { id: 'title', label: '称号者の部' }
  ];
  const divisions = (selectedTournament && selectedTournament.data && selectedTournament.data.divisions) ? selectedTournament.data.divisions : localDefaultDivisions;

  const enableGenderSeparation = selectedTournament?.data?.enableGenderSeparation || false;

  useEffect(() => { localStorage.setItem('ranking_selectedGender', selectedGender || 'all'); }, [selectedGender]);

  const normalizeRank = (rank) => {
    if (!rank) return '';
    return rank
      .replace('二段', '弐段')
      .replace('三段', '参段')
      .replace('二級', '弐級')
      .replace('一級', '壱級');
  };

  const rankOrder = useMemo(() => (['無指定', '五級', '四級', '三級', '弐級', '壱級', '初段', '弐段', '参段', '四段', '五段', '錬士五段', '錬士六段', '教士七段', '教士八段', '範士八段', '範士九段']), []);

  const rankIndex = useCallback((rank) => {
    const r = normalizeRank(rank);
    const idx = rankOrder.indexOf(r);
    return idx === -1 ? 9999 : idx;
  }, [normalizeRank, rankOrder]);

  const getDivisionIdForArcher = useCallback((archer, divisions) => {
    const rIdx = rankIndex(archer?.rank);
    for (const d of (divisions || [])) {
      const minIdx = d?.minRank ? rankIndex(d.minRank) : 0;
      const maxIdx = d?.maxRank ? rankIndex(d.maxRank) : 9999;
      if (rIdx >= minIdx && rIdx <= maxIdx) return d.id;
    }
    return 'unassigned';
  }, [rankIndex]);

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

  const calculateRanksWithTies = useCallback((items) => {
    const sorted = [...items].sort((a, b) => b.hitCount - a.hitCount);
    let currentRank = 1;
    let prevHitCount = null;
    return sorted.map((item, index) => {
      if (prevHitCount !== null && item.hitCount !== prevHitCount) currentRank = index + 1;
      prevHitCount = item.hitCount;
      return { ...item, rank: currentRank };
    });
  }, []);

  useEffect(() => {
    if (!useLocalOnlyFinals) {
      fetchArchers();
      fetchShootOffResults();
    } else {
      console.log('Server sync disabled: skipping initial fetch of shoot-off results');
    }
  }, [selectedTournamentId]);

  const fetchArchers = async (forceRefresh = false) => {
    if (!selectedTournamentId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/applicants/${selectedTournamentId}`);
      const result = await response.json();
      if (result.success) {
        const checkedIn = (result.data || []).filter(a => a.isCheckedIn);
        setArchers(checkedIn);
      } else {
        setArchers([]);
      }
    } catch (e) {
      console.error('RankingView fetch error', e);
      setArchers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchShootOffResults = async () => {
    if (!selectedTournamentId) return;
    if (useLocalOnlyFinals) {
      console.log('fetchShootOffResults skipped because useLocalOnlyFinals is enabled');
      return;
    }
    if (Date.now() < (skipShootOffFetchUntil || 0)) {
      console.log('fetchShootOffResults skipped due to recent reset');
      return;
    }
    
    setIsLoadingResults(true);
    try {
      const response = await fetch(`${API_URL}/ranking/shoot-off/${selectedTournamentId}`);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          console.log('?? fetchShootOffResults - サーバーから取得したデータ:', {
            shichuma: result.data.shichuma,
            enkin: result.data.enkin?.results?.map(r => ({
              archerId: r.archerId,
              rank: r.rank,
              arrowType: r.arrowType,
              isDefeated: r.isDefeated,
              targetRank: r.targetRank
            }))
          });
          
          if (result.data.shichuma && result.data.shichuma.results) {
            const shichumaResultsWithShootOffType = {
              ...result.data.shichuma,
              results: result.data.shichuma.results.map(r => ({
                ...r,
                shootOffType: r.shootOffType || 'shichuma'
              }))
            };
            
            setShichumaFinalResults(shichumaResultsWithShootOffType);
          } else {
            setShichumaFinalResults(result.data.shichuma);
          }
          setEnkinFinalResults(result.data.enkin);
          
          if (result.data.enkin && result.data.enkin.results) {
            const savedRanks = new Set(result.data.enkin.results.map(r => r.targetRank).filter(Boolean));
            setSavedEnkinRanks(savedRanks);
          }
        }
      } else if (response.status === 404) {
        setShichumaFinalResults(null);
        setEnkinFinalResults(null);
        setSavedEnkinRanks(new Set());
      }
    } catch (error) {
      console.error('Shoot-off results fetch error:', error);
      setShichumaFinalResults(null);
      setEnkinFinalResults(null);
      setSavedEnkinRanks(new Set());
    } finally {
      setIsLoadingResults(false);
    }
  };

  const getAllTiedGroups = useMemo(() => {
    if (!archers.length) return [];
    
    const rankGroups = {};
    archers.forEach(archer => {
      if (enableGenderSeparation && selectedGender !== 'all') {
        const g = (archer.gender || 'male');
        if (selectedGender === 'male' && g !== 'male') return;
        if (selectedGender === 'female' && g !== 'female') return;
      }
      const hitCount = getTotalHitCountAllStands(archer);
      if (!rankGroups[hitCount]) {
        rankGroups[hitCount] = [];
      }
      rankGroups[hitCount].push(archer);
    });

    const awardRankLimit = tournament?.data?.awardRankLimit || 3;

    const sortedHitCounts = Object.keys(rankGroups)
      .map(Number)
      .sort((a, b) => b - a);

    const displayGroups = [];
    let currentRank = 1;

    for (const hitCount of sortedHitCounts) {
      const group = rankGroups[hitCount];
      if (group.length === 0) continue;

      const isAwardRank = currentRank <= awardRankLimit;
      const isTie = group.length > 1;

      if (isAwardRank && isTie) {
        displayGroups.push({ hitCount, group, rank: currentRank, needsShootOff: true });
      } else if (isAwardRank) {
        displayGroups.push({ hitCount, group, rank: currentRank, needsShootOff: false });
      }

      currentRank += group.length;
    }
    
    console.log('?? getAllTiedGroups:', {
      totalArchers: archers.length,
      awardRankLimit,
      filteredGroups: displayGroups.length,
      groups: displayGroups.map(g => ({ hitCount: g.hitCount, count: g.group.length, rank: g.rank, needsShootOff: g.needsShootOff }))
    });
    
    return displayGroups;
  }, [archers, getTotalHitCountAllStands, tournament?.data?.awardRankLimit, selectedGender, enableGenderSeparation]);

  const categorizedGroups = useMemo(() => {
    const allGroups = getAllTiedGroups();
    const awardRankLimit = tournament?.data?.awardRankLimit || 3;
    
    console.log('?? categorizedGroups processing (by division):', allGroups.length, 'groups', 'awardRankLimit:', awardRankLimit);
    
    const result = [];
    divisions.forEach(div => {
      const divisionArchers = archers.filter(archer => {
        if (getDivisionIdForArcher(archer, divisions) !== div.id) return false;
        if (!enableGenderSeparation) return true;
        if (selectedGender === 'all') return true;
        const g = (archer.gender || 'male');
        if (selectedGender === 'male') return g === 'male';
        if (selectedGender === 'female') return g === 'female';
        return true;
      });
      
      const divisionRankGroups = {};
      divisionArchers.forEach(archer => {
        const hitCount = getTotalHitCountAllStands(archer);
        if (!divisionRankGroups[hitCount]) {
          divisionRankGroups[hitCount] = [];
        }
        divisionRankGroups[hitCount].push(archer);
      });

      const sortedHitCounts = Object.keys(divisionRankGroups)
        .map(Number)
        .sort((a, b) => b - a);

      let currentDivisionRank = 1;
      const divisionData = { division: div, izume: [], enkin: [], confirmed: [] };

      for (const hitCount of sortedHitCounts) {
        const group = divisionRankGroups[hitCount];
        if (group.length === 0) continue;

        const isAwardRank = currentDivisionRank <= awardRankLimit;
        const isTie = group.length > 1;

        if (isAwardRank && isTie && currentDivisionRank === 1) {
          console.log(`    → 射詰競射対象（優勝決定） (${div.label})`);
          divisionData.izume.push({ hitCount, group, rank: currentDivisionRank });
        } else if (isAwardRank && isTie) {
          console.log(`    → 遠近競射対象（入賞圏内） (${div.label})`);
          divisionData.enkin.push({ hitCount, group, rank: currentDivisionRank });
        } else {
          console.log(`    → 順位確定 (${div.label})`);
          divisionData.confirmed.push({ hitCount, group, rank: currentDivisionRank });
        }

        currentDivisionRank += group.length;
      }

      result.push(divisionData);
    });
    
    console.log('? Final result (by division):', result.map(d => ({
      division: d.division.label,
      izume: d.izume.length,
      enkin: d.enkin.length,
      confirmed: d.confirmed.length
    })));
    
    return result;
  }, [archers, getTotalHitCountAllStands, tournament?.data?.awardRankLimit, divisions, getDivisionIdForArcher, selectedGender, enableGenderSeparation]);

  const getMergedFinalResults = useCallback(() => {
    if (Date.now() < (suppressMergedDisplayUntil || 0)) {
      return (
        <div className="card">
          <p className="text-gray-500 text-center py-4">最終順位表はリセットされています（再表示までしばらくお待ちください）</p>
        </div>
      );
    }
    let mergedResults = null;

    if (enableGenderSeparation) {
      const gendersToCompute = selectedGender === 'all' ? ['male', 'female'] : [selectedGender];
      const mergedLists = gendersToCompute.map(g => getMergedFinalResultsForGender(g)).filter(Boolean);
      mergedResults = [].concat(...mergedLists);
    } else {
      mergedResults = getMergedFinalResults();
    }

    if (!mergedResults || mergedResults.length === 0) {
      return (
        <div className="card">
          <p className="text-gray-500 text-center py-4">最終順位がありません</p>
        </div>
      );
    }

    const resultsByDivision = {};
    divisions.forEach(div => {
      if (enableGenderSeparation) {
        resultsByDivision[`${div.id}_male`] = { division: { ...div, id: `${div.id}_male`, label: `${div.label}（男）` }, results: [] };
        resultsByDivision[`${div.id}_female`] = { division: { ...div, id: `${div.id}_female`, label: `${div.label}（女）` }, results: [] };
      } else {
        resultsByDivision[div.id] = { division: div, results: [] };
      }
    });
    if (!resultsByDivision.unassigned) {
      if (enableGenderSeparation) {
        resultsByDivision['unassigned_male'] = { division: { id: 'unassigned_male', label: '未分類（男）' }, results: [] };
        resultsByDivision['unassigned_female'] = { division: { id: 'unassigned_female', label: '未分類（女）' }, results: [] };
      } else {
        resultsByDivision.unassigned = { division: { id: 'unassigned', label: '未分類' }, results: [] };
      }
    }

    mergedResults.forEach(result => {
      const archer = archers.find(a => a.archerId === result.archerId);
      if (archer) {
        const divId = getDivisionIdForArcher(archer, divisions);
        const gender = archer.gender || 'male';
        const targetDivId = enableGenderSeparation ? `${divId}_${gender}` : divId;
        if (!resultsByDivision[targetDivId]) {
          if (enableGenderSeparation) {
            resultsByDivision[targetDivId] = { division: { id: targetDivId, label: `${divId}（${gender === 'male' ? '男' : '女'}）` }, results: [] };
          } else {
            resultsByDivision[targetDivId] = { division: { id: targetDivId, label: targetDivId }, results: [] };
          }
        }
        resultsByDivision[targetDivId].results.push(result);
      }
    });

    const divisionResults = [];
    divisions.forEach(div => {
      if (enableGenderSeparation) {
        if (resultsByDivision[`${div.id}_male`] && resultsByDivision[`${div.id}_male`].results.length > 0) {
          divisionResults.push(resultsByDivision[`${div.id}_male`]);
        }
        if (resultsByDivision[`${div.id}_female`] && resultsByDivision[`${div.id}_female`].results.length > 0) {
          divisionResults.push(resultsByDivision[`${div.id}_female`]);
        }
      } else {
        if (resultsByDivision[div.id] && resultsByDivision[div.id].results.length > 0) {
          divisionResults.push(resultsByDivision[div.id]);
        }
      }
    });

    let displayResults;
    if (selectedDivision === '') {
      if (enableGenderSeparation && selectedGender !== 'all') {
        displayResults = divisionResults.filter(d => d.division.id.endsWith(`_${selectedGender}`));
      } else {
        displayResults = divisionResults;
      }
    } else {
      if (enableGenderSeparation) {
        if (selectedGender === 'all') {
          displayResults = divisionResults.filter(d => d.division.id.replace(/_male$|_female$/, '') === selectedDivision);
        } else {
          displayResults = divisionResults.filter(d => d.division.id === `${selectedDivision}_${selectedGender}`);
        }
      } else {
        displayResults = divisionResults.filter(d => d.division.id === selectedDivision);
      }
    }

    if (displayResults.length === 0) {
      return (
        <div className="card">
          <p className="text-gray-500 text-center py-4">該当する結果がありません</p>
        </div>
      );
    }

    return (
      <>
        {displayResults.map(divisionData => (
          <div key={divisionData.division.id} className="card border-l-4 border-green-500">
            <h3 className="card-title text-green-700 mb-4">? 最終順位表 - {divisionData.division.label}</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-green-300">
                <thead>
                  <tr className="bg-green-50">
                    <th className="border border-green-300 px-4 py-2 text-left font-semibold text-green-800">順位</th>
                    <th className="border border-green-300 px-4 py-2 text-left font-semibold text-green-800">氏名</th>
                    <th className="border border-green-300 px-4 py-2 text-left font-semibold text-green-800">所属</th>
                    <th className="border border-green-300 px-4 py-2 text-center font-semibold text-green-800">段位</th>
                    <th className="border border-green-300 px-4 py-2 text-center font-semibold text-green-800">決定方法</th>
                    <th className="border border-green-300 px-4 py-2 text-center font-semibold text-green-800">備考</th>
                  </tr>
                </thead>
                <tbody>
                  {divisionData.results
                    .sort((a, b) => a.rank - b.rank)
                    .map((result, index) => {
                      const archer = archers.find(a => a.archerId === result.archerId);
                      if (!archer) return null;
                      
                      return (
                        <tr key={result.archerId} className="hover:bg-green-50">
                          <td className="border border-green-300 px-4 py-2 font-bold text-green-800">
                            {result.rank}位
                          </td>
                          <td className="border border-green-300 px-4 py-2">
                            <span className="font-medium">{archer.name}</span>
                          </td>
                          <td className="border border-green-300 px-4 py-2 text-sm text-gray-600">
                            {archer.affiliation}
                          </td>
                          <td className="border border-green-300 px-4 py-2 text-center">
                            {archer?.rank || '-'}
                          </td>
                          <td className="border border-green-300 px-4 py-2 text-center">
                            {(() => {
                              if (result.shootOffType === 'shichuma') {
                                return (
                                  <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                    射詰
                                  </span>
                                );
                              } else if (result.shootOffType === 'enkin') {
                                return (
                                  <span className="text-sm bg-orange-100 text-orange-800 px-2 py-1 rounded">
                                    遠近
                                  </span>
                                );
                              } else if (result.rank_source === 'confirmed') {
                                return (
                                  <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">
                                    的中数
                                  </span>
                                );
                              } else {
                                return (
                                  <span className="text-sm bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                    -
                                  </span>
                                );
                              }
                            })()}
                          </td>
                          <td className="border border-green-300 px-4 py-2 text-sm text-center">
                            {result.shootOffType === 'shichuma' && (
                              <>
                                {(() => {
                                  const hasEnkinResults = divisionData.results.some(r => r.shootOffType === 'enkin');
                                  const hasShichumaResults = divisionData.results.some(r => r.shootOffType === 'shichuma');
                                  const allDeterminedByShootOff = divisionData.results.every(r => 
                                    r.shootOffType === 'shichuma' || r.shootOffType === 'enkin'
                                  );
                                  
                                  if (hasShichumaResults && !hasEnkinResults && allDeterminedByShootOff) {
                                    if (result.isWinner) {
                                      return <span className="text-yellow-700 font-bold">?? 優勝</span>;
                                    } else {
                                      return <span className="text-blue-700 font-bold">射詰{result.rank}位</span>;
                                    }
                                  } else {
                                    return (
                                      <>
                                        {result.isWinner && (
                                          <span className="text-yellow-700 font-bold">?? 優勝</span>
                                        )}
                                        {result.eliminatedAt && (
                                          <span className="text-red-700">{result.eliminatedAt}本目脱落</span>
                                        )}
                                        {!result.isWinner && !result.eliminatedAt && (
                                          <span>射詰{result.rank}位</span>
                                        )}
                                      </>
                                    );
                                  }
                                })()}
                                {result.isFromEnkin && (
                                  <span className="text-blue-600 ml-2">→遠近で{result.rank}位確定</span>
                                )}
                              </>
                            )}
                            {result.shootOffType === 'enkin' && (
                              <>
                                <span className="text-orange-700">
                                  {result.arrowType === 'near' ? '近的' : '遠的'}で{result.rank}位
                                </span>
                                {result.isDefeated && (
                                  <span className="text-red-600 ml-2">(敗退)</span>
                                )}
                              </>
                            )}
                            {result.rank_source === 'confirmed' && (
                              <span className="text-green-700">
                                的中数{result.hitCount}本
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </>
    );
  }, [shichumaFinalResults, enkinFinalResults, archers, categorizedGroups, selectedDivision, selectedGender, enableGenderSeparation, divisions, getDivisionIdForArcher, getTotalHitCountAllStands, suppressMergedDisplayUntil]);

  const getMergedFinalResultsForGender = useCallback((gender) => {
    const mergedResults = [];
    const filteredArchers = archers.filter(a => (a.gender || 'male') === gender);

    const archersByDivision = {};
    filteredArchers.forEach(archer => {
      const divisionId = getDivisionIdForArcher(archer, divisions);
      if (!archersByDivision[divisionId]) archersByDivision[divisionId] = [];
      archersByDivision[divisionId].push(archer);
    });

    Object.keys(archersByDivision).forEach(divisionId => {
      const divisionArchers = archersByDivision[divisionId];
      const divisionUsedRanks = new Set();
      const divisionProcessedArchers = new Set();

      if (enkinFinalResults && enkinFinalResults.results) {
        const divisionEnkinResults = enkinFinalResults.results.filter(result => {
          if (result.divisionId) return result.divisionId === divisionId;
          return divisionArchers.some(a => a.archerId === result.archerId);
        }).filter(r => {
          const ar = archers.find(a => a.archerId === r.archerId);
          return ar && (ar.gender || 'male') === gender;
        });

        if (shichumaFinalResults && shichumaFinalResults.results) {
          const divisionShichumaResults = shichumaFinalResults.results.filter(result => {
            if (result.divisionId) return result.divisionId === divisionId;
            return divisionArchers.some(a => a.archerId === result.archerId);
          }).filter(r => {
            const ar = archers.find(a => a.archerId === r.archerId);
            return ar && (ar.gender || 'male') === gender;
          });

          divisionShichumaResults
            .sort((a, b) => a.rank - b.rank)
            .forEach(result => {
              const archer = divisionArchers.find(a => a.archerId === result.archerId);
              if (!archer) return;
              const finalRank = result.rank;
              const isFromShichumaToEnkin = divisionEnkinResults.some(e => e.archerId === result.archerId);
              if (isFromShichumaToEnkin) return;
              if (divisionProcessedArchers.has(result.archerId)) return;

              mergedResults.push({
                archerId: result.archerId,
                name: archer.name,
                affiliation: archer.affiliation,
                rank: finalRank,
                rank_source: 'shichuma',
                shootOffType: 'shichuma',
                isWinner: result.isWinner,
                consecutiveHits: result.consecutiveHits,
                eliminatedAt: result.eliminatedAt,
                results: result.results || [],
                divisionId: divisionId
              });

              divisionUsedRanks.add(finalRank);
              divisionProcessedArchers.add(result.archerId);
            });
        }

        divisionEnkinResults
          .sort((a, b) => {
            const aTarget = a.targetRank !== null ? a.targetRank : 9999;
            const bTarget = b.targetRank !== null ? b.targetRank : 9999;
            if (aTarget !== bTarget) return aTarget - bTarget;
            const aRank = parseInt(a.rank) || 9999;
            const bRank = parseInt(b.rank) || 9999;
            return aRank - bRank;
          })
          .forEach(enkinResult => {
            if (divisionProcessedArchers.has(enkinResult.archerId)) return;
            const archer = divisionArchers.find(a => a.archerId === enkinResult.archerId);
            if (!archer) return;
            if (enkinResult.rank === '敗退' || enkinResult.isDefeated) return;
            const finalRank = parseInt(enkinResult.rank);
            if (divisionUsedRanks.has(finalRank)) return;

            const isFromShichuma = shichumaFinalResults?.results?.some(s => s.archerId === enkinResult.archerId);

            mergedResults.push({
              archerId: enkinResult.archerId,
              name: archer.name,
              affiliation: archer.affiliation,
              rank: finalRank,
              rank_source: 'enkin',
              shootOffType: 'enkin',
              isDefeated: enkinResult.isDefeated,
              arrowType: enkinResult.arrowType,
              targetRank: enkinResult.targetRank,
              isFromEnkin: isFromShichuma,
              divisionId: divisionId
            });

            divisionUsedRanks.add(finalRank);
            divisionProcessedArchers.add(enkinResult.archerId);
          });
      }
    });

    if (categorizedGroups && categorizedGroups.length > 0) {
      categorizedGroups.forEach(divisionData => {
        if (divisionData.confirmed && divisionData.confirmed.length > 0) {
          divisionData.confirmed.forEach(({ hitCount, group, rank }) => {
            group.filter(a => (a.gender || 'male') === gender).forEach(archer => {
              mergedResults.push({
                archerId: archer.archerId,
                name: archer.name,
                affiliation: archer.affiliation,
                rank: rank,
                rank_source: 'confirmed',
                shootOffType: null,
                hitCount: hitCount
              });
            });
          });
        }
      });
    }

    const sorted = mergedResults.sort((a, b) => {
      const aRank = typeof a.rank === 'number' ? a.rank : 9999;
      const bRank = typeof b.rank === 'number' ? b.rank : 9999;
      return aRank - bRank;
    });

    return sorted.length > 0 ? sorted : null;
  }, [shichumaFinalResults, enkinFinalResults, archers, categorizedGroups]);

  const renderMergedResults = () => {
    return getMergedFinalResults();
  };

  return (
    <div className="view-container">
      <div className="admin-header">
        <h1>最終順位決定</h1>
        <button onClick={onLogout} className="btn-secondary">
          <LogOut size={16} className="mr-1" />
          ログアウト
        </button>
      </div>
      <div className="view-content">
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="card-title">部門選択</h2>
            <div className="flex gap-2">
              <button onClick={() => fetchShootOffResults()} className="btn-secondary" disabled={isLoadingResults}>
                <RefreshCw size={16} className={`mr-1 ${isLoadingResults ? 'animate-spin' : ''}`} />
                結果を再読み込み
              </button>
              {isLoadingResults && (
                <span className="text-sm text-gray-500 self-center">
                  同期中
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button 
              onClick={() => setSelectedDivision('')} 
              className={`btn ${selectedDivision === '' ? 'btn-active' : ''}`}
              style={{ flex: '1 1 calc(33.333% - 0.5rem)', minWidth: '150px' }}
            >
              全部門
            </button>
            {divisions.map(division => (
              <button
                key={division.id}
                onClick={() => setSelectedDivision(division.id)}
                className={`btn ${selectedDivision === division.id ? 'btn-active' : ''}`}
                style={{ flex: '1 1 calc(33.333% - 0.5rem)', minWidth: '150px' }}
              >
                {division.label}
              </button>
            ))}
          </div>
          {enableGenderSeparation && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button onClick={() => setSelectedGender('all')} className={`btn ${selectedGender === 'all' ? 'btn-active' : ''}`} style={{ flex: 1 }}>全員</button>
              <button onClick={() => setSelectedGender('male')} className={`btn ${selectedGender === 'male' ? 'btn-active' : ''}`} style={{ flex: 1 }}>男子</button>
              <button onClick={() => setSelectedGender('female')} className={`btn ${selectedGender === 'female' ? 'btn-active' : ''}`} style={{ flex: 1 }}>女子</button>
            </div>
          )}

          <p className="hint" style={{ marginTop: '0.5rem' }}>
            {selectedDivision === '' 
              ? `全部門の選手: ${enableGenderSeparation && selectedGender !== 'all' ? archers.filter(a => (a.gender || 'male') === selectedGender).length : archers.length}人`
              : `${divisions.find(d => d.id === selectedDivision)?.label || selectedDivision}: ${archers.filter(a => getDivisionIdForArcher(a, divisions) === selectedDivision && ( !enableGenderSeparation || selectedGender === 'all' || (a.gender || 'male') === selectedGender )).length}人`
            }
          </p>
        </div>

        <div style={{ marginTop: '2rem' }}>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">?? 最終順位決定表</h2>
          {renderMergedResults()}
        </div>
      </div>
    </div>
  );
};

export default RankingView;