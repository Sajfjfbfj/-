import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { API_URL } from '../utils/api';

const RecordingView = ({ state, dispatch, stands }) => {
  const [selectedTournamentId, setSelectedTournamentId] = useState(() => localStorage.getItem('selectedTournamentId') || '');
  const [selectedDivision, setSelectedDivision] = useState(() => localStorage.getItem('recording_selectedDivision') || '');
  const [selectedStand, setSelectedStand] = useState(() => parseInt(localStorage.getItem('recording_selectedStand')) || 1);
  const [selectedRound, setSelectedRound] = useState(() => parseInt(localStorage.getItem('recording_selectedRound')) || 1); // 1: 1立ち目, 2: 2立ち目
  const [selectedGender, setSelectedGender] = useState(() => localStorage.getItem('recording_selectedGender') || 'all'); // 'all' | 'male' | 'female'
  const [archers, setArchers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (selectedTournamentId) localStorage.setItem('selectedTournamentId', selectedTournamentId);
    else localStorage.removeItem('selectedTournamentId');
  }, [selectedTournamentId]);

  useEffect(() => { localStorage.setItem('recording_selectedDivision', selectedDivision || ''); }, [selectedDivision]);
  useEffect(() => { localStorage.setItem('recording_selectedStand', selectedStand); }, [selectedStand]);
  useEffect(() => { localStorage.setItem('recording_selectedRound', selectedRound); }, [selectedRound]);
  useEffect(() => { localStorage.setItem('recording_selectedGender', selectedGender || 'all'); }, [selectedGender]);

  const tournament = state.tournament;
  const rankOrder = ['無指定', '五級', '四級', '三級', '弐級', '壱級', '初段', '弐段', '参段', '四段', '五段', '錬士五段', '錬士六段', '教士七段', '教士八段', '範士八段', '範士九段'];

  const normalizeRank = (rank) => {
    if (!rank) return '';
    return rank
      .replace('二段', '弐段')
      .replace('三段', '参段')
      .replace('二級', '弐級')
      .replace('一級', '壱級');
  };

  const getDivisionIdsForArcher = (archer, divisions) => {
    const rIdx = rankOrder.indexOf(normalizeRank(archer?.rank));
    const matchingDivisions = [];
    for (const d of (divisions || [])) {
      const minIdx = d?.minRank ? rankOrder.indexOf(normalizeRank(d.minRank)) : 0;
      const maxIdx = d?.maxRank ? rankOrder.indexOf(normalizeRank(d.maxRank)) : rankOrder.length - 1;
      if (rIdx >= minIdx && rIdx <= maxIdx) {
        matchingDivisions.push(d.id);
      }
    }
    return matchingDivisions.length > 0 ? matchingDivisions : ['unassigned'];
  };

  const getDivisionIdForArcher = (archer, divisions) => {
    const divisionIds = getDivisionIdsForArcher(archer, divisions);
    return divisionIds[0] || 'unassigned';
  };
  
  const getCurrentArrowsPerStand = () => {
    return selectedRound === 1 ? tournament.arrowsRound1 : tournament.arrowsRound2;
  };
  
  const getCurrentStandResults = (archer) => {
    const standKey = `stand${selectedStand}`;
    const currentArrows = getCurrentArrowsPerStand();
    
    const arrowsNeeded = selectedRound === 1 ? tournament.arrowsRound1 : tournament.arrowsRound2;
    const existing = (archer.results && archer.results[standKey]) 
      ? [...archer.results[standKey]] 
      : [];
    
    const startIndex = selectedRound === 1 ? 0 : tournament.arrowsRound1;
    const roundResults = [];
    for (let i = 0; i < arrowsNeeded; i++) {
      roundResults.push(i + startIndex < existing.length ? existing[i + startIndex] : null);
    }
    
    return roundResults;
  };

  const isRoundComplete = (archer) => {
    const results = getCurrentStandResults(archer);
    return results.every(result => result !== null);
  };

  const getRankCategory = (rankStr) => {
    const ceremonyRanks = ['錬士', '教士', '範士'];
    let ceremony = '';
    let rank = rankStr;

    for (const c of ceremonyRanks) {
      if (rankStr && rankStr.includes(c)) {
        ceremony = c;
        rank = rankStr.replace(c, '');
        break;
      }
    }
    return { ceremony, rank };
  };

  const getDivision = (rank) => {
    const { ceremony } = getRankCategory(rank);
    if (ceremony) return 'title';
    const levelIndex = rankOrder.indexOf(rank);
    if (levelIndex <= rankOrder.indexOf('参段')) return 'lower';
    if (levelIndex <= rankOrder.indexOf('五段')) return 'middle';
    return 'lower';
  };

  const selectedTournament = state.registeredTournaments.find(t => t.id === selectedTournamentId);
  const localDefaultDivisions = [
    { id: 'lower', label: '級位~三段以下の部' },
    { id: 'middle', label: '四・五段の部' },
    { id: 'title', label: '称号者の部' }
  ];
  const divisions = (selectedTournament && selectedTournament.data && selectedTournament.data.divisions) ? selectedTournament.data.divisions : localDefaultDivisions;

  const fetchAndSortArchers = async (background = false) => {
    if (!selectedTournamentId) return;

    if (!background) setIsLoading(true);
    else setIsSyncing(true);

    try {
      const response = await fetch(`${API_URL}/applicants/${selectedTournamentId}`);
      const result = await response.json();

      if (result.success) {
        const checkedIn = result.data.filter(a => a.isCheckedIn);
        
        const normalizeRank = (rank) => {
          if (!rank) return '';
          return rank
            .replace('二段', '弐段')
            .replace('三段', '参段')
            .replace('二級', '弐級')
            .replace('一級', '壱級');
        };

        const sortedArchers = [...checkedIn].sort((a, b) => {
          // 男女分けが有効な場合、男を先に配置
          const enableGenderSeparation = tournament?.data?.enableGenderSeparation || false;
          if (enableGenderSeparation) {
            const aGender = a.gender || "male";
            const bGender = b.gender || "male";
            if (aGender !== bGender) {
              return aGender === "male" ? -1 : 1;
            }
          }

          const aRank = normalizeRank(a.rank);
          const bRank = normalizeRank(b.rank);
          const aIndex = rankOrder.indexOf(aRank);
          const bIndex = rankOrder.indexOf(bRank);

          // 段位の順序：5級（低い）→範士9段（高い）の順に並べる
          if (aIndex !== bIndex) {
            if (aIndex === -1 && bIndex === -1) return 0;
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return aIndex - bIndex;
          }

          // 同じ段位内では習得日が若い順（習得日が早い順）
          const aDate = a.rankAcquiredDate ? new Date(a.rankAcquiredDate) : new Date(0);
          const bDate = b.rankAcquiredDate ? new Date(b.rankAcquiredDate) : new Date(0);
          return aDate.getTime() - bDate.getTime();
        });

        // 立ち順番号を付与
        const totalNeeded = tournament.arrowsRound1 + tournament.arrowsRound2;
        const defaultResults = {};
        for (let i = 1; i <= 6; i++) defaultResults[`stand${i}`] = Array(totalNeeded).fill(null);

        const archersWithOrder = sortedArchers.map((archer, index) => ({
          ...archer,
          standOrder: index + 1,
          division: getDivisionIdForArcher(archer, divisions),
          results: Object.assign({}, defaultResults, archer.results || {})
        }));

        setArchers(archersWithOrder);
        
        if (!selectedDivision && archersWithOrder.length > 0) {
          const firstArcherDivision = getDivisionIdForArcher(archersWithOrder[0], divisions);
          setSelectedDivision(firstArcherDivision);
        }
      }
    } catch (error) {
      console.error('選手データの取得に失敗しました:', error);
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (selectedTournamentId) {
      fetchAndSortArchers();
    }
  }, [selectedTournamentId]);

  // 部門設定が変更されたら選手を再割り当て
  useEffect(() => {
    if (selectedTournamentId && archers.length > 0) {
      fetchAndSortArchers(true);
    }
  }, [divisions]);

  // リアルタイム同期(3秒ごとに他の端末の入力を反映)
  useEffect(() => {
    if (!selectedTournamentId) return;
    const interval = setInterval(() => {
      fetchAndSortArchers(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedTournamentId]);

  const filteredTournaments = state.registeredTournaments;
  const enableGenderSeparation = selectedTournament?.data?.enableGenderSeparation || false;

  const divisionArchers = archers.filter(a => {
    const archerDivisions = getDivisionIdsForArcher(a, divisions);
    if (!archerDivisions.includes(selectedDivision)) return false;
    if (!enableGenderSeparation) return true;
    if (selectedGender === 'all') return true;
    const g = (a.gender || 'male');
    if (selectedGender === 'male') return g === 'male';
    if (selectedGender === 'female') return g === 'female';
    return true;
  });

  const getArchersForStand = (standNumber) => {
    const archersPerStand = tournament.archersPerStand;
    const startIdx = (standNumber - 1) * archersPerStand;
    return divisionArchers.slice(startIdx, startIdx + archersPerStand);
  };

  const standArchers = getArchersForStand(selectedStand);

  // API経由で記録を保存
  const saveResultToApi = async (archerId, standNum, arrowIndex, result) => {
    try {
      await fetch(`${API_URL}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: selectedTournamentId,
          archerId,
          stand: standNum,
          arrowIndex: arrowIndex,
          result,
          round: selectedRound // ラウンド情報を追加
        })
      });
      // 更新後にデータを再取得(同期)
      fetchAndSortArchers(true);
    } catch (error) {
      console.error('記録保存エラー:', error);
      alert('ネットワークエラーにより保存できませんでした');
    }
  };

  const handleRecord = (archerId, standNum, arrowIndex, result) => {
    // 楽観的UI更新(即時反映)
    const archer = archers.find(a => a.archerId === archerId);
    if (!archer) return;

    const standKey = `stand${standNum}`;
    const currentArrows = getCurrentArrowsPerStand();
    
    // 現在のラウンドの結果のみを扱う
    const existing = (archer.results && archer.results[standKey]) 
      ? [...archer.results[standKey]] 
      : [];
      
    // 現在のラウンドの結果を更新
    const roundResults = [];
    for (let i = 0; i < currentArrows; i++) {
      if (i === arrowIndex) {
        roundResults.push(result);
      } else if (i < existing.length) {
        roundResults.push(existing[i]);
      } else {
        roundResults.push(null);
      }
    }

    // ラウンド1と2の結果を結合
    let finalResults = [];
    if (selectedRound === 1) {
      const round2Results = (archer.results?.[standKey]?.slice(tournament.arrowsRound1) || []);
      finalResults = [...roundResults, ...round2Results];
    } else {
      const round1Results = (archer.results?.[standKey]?.slice(0, tournament.arrowsRound1) || Array(tournament.arrowsRound1).fill(null));
      finalResults = [...round1Results, ...roundResults];
    }

    const updatedArchers = archers.map(a => 
      a.archerId === archerId 
        ? { ...a, results: { ...a.results, [standKey]: finalResults } } 
        : a
    );
    
    setArchers(updatedArchers);

    // APIへ送信
    const adjustedArrowIndex = selectedRound === 2 
      ? tournament.arrowsRound1 + arrowIndex 
      : arrowIndex;
    saveResultToApi(archerId, standNum, adjustedArrowIndex, result);
  };

  const handleUndo = (archerId, standNum, arrowIndex) => {
    // 楽観的UI更新
    const archer = archers.find(a => a.archerId === archerId);
    if (!archer) return;

    const standKey = `stand${standNum}`;
    const currentArrows = getCurrentArrowsPerStand();
    
    // 現在のラウンドの結果を取得
    const existing = (archer.results && archer.results[standKey]) 
      ? [...archer.results[standKey]] 
      : [];
    
    // 現在のラウンドの結果を更新
    const roundResults = [];
    for (let i = 0; i < currentArrows; i++) {
      if (i === arrowIndex) {
        roundResults.push(null);
      } else if (i < existing.length) {
        roundResults.push(existing[i]);
      } else {
        roundResults.push(null);
      }
    }

    // ラウンド1と2の結果を結合
    let finalResults = [];
    if (selectedRound === 1) {
      const round2Results = (archer.results?.[standKey]?.slice(tournament.arrowsRound1) || []);
      finalResults = [...roundResults, ...round2Results];
    } else {
      const round1Results = (archer.results?.[standKey]?.slice(0, tournament.arrowsRound1) || Array(tournament.arrowsRound1).fill(null));
      finalResults = [...round1Results, ...roundResults];
    }

    const updatedArchers = archers.map(a => 
      a.archerId === archerId 
        ? { ...a, results: { ...a.results, [standKey]: finalResults } } 
        : a
    );
    
    setArchers(updatedArchers);

    // APIへ送信 (nullを送る)
    const adjustedArrowIndex = selectedRound === 2 
      ? tournament.arrowsRound1 + arrowIndex 
      : arrowIndex;
    saveResultToApi(archerId, standNum, adjustedArrowIndex, null);
  };

  const getHitCount = (archer, standNum, roundNum = null) => {
    const results = archer.results?.[`stand${standNum}`] || [];
    const start = roundNum === 2 ? tournament.arrowsRound1 : 0;
    const length = roundNum === 2 ? tournament.arrowsRound2 : tournament.arrowsRound1;
    return (results.slice(start, start + length) || []).filter(r => r === 'o').length;
  };
  
  const getCurrentRoundHitCount = (archer) => {
    const results = getCurrentStandResults(archer);
    return results.filter(r => r === 'o').length;
  };
  
  const getTotalHitCount = (archer) => {
    const stand1Hits = getHitCount(archer, selectedStand, 1);
    const stand2Hits = getHitCount(archer, selectedStand, 2);
    return stand1Hits + stand2Hits;
  };

  const calculateRanks = () => {
    const hitCounts = divisionArchers.map(archer => ({
      archerId: archer.archerId,
      hitCount: getHitCount(archer, selectedStand, 1) + getHitCount(archer, selectedStand, 2)
    }));
    const sorted = hitCounts.sort((a, b) => b.hitCount - a.hitCount);
    const ranks = {};
    let currentRank = 1;
    let prevHitCount = null;
    sorted.forEach((item, index) => {
      if (prevHitCount !== null && item.hitCount !== prevHitCount) {
        currentRank = index + 1;
      }
      ranks[item.archerId] = currentRank;
      prevHitCount = item.hitCount;
    });
    return ranks;
  };

  const ranks = calculateRanks();

  return (
    <div className="view-container">
      <div className="view-header">
        <div style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>
          <h1>記録入力</h1>
          {isSyncing && <RefreshCw size={16} className="animate-spin text-blue-500" />}
        </div>
        <p>部門ごとに立ち順を管理 (自動保存)</p>
      </div>
      <div className="view-content">
        
        {selectedTournamentId && (
          <>
            <div className="card">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>部門を選択</label>
              <div className="button-group">
                {divisions.map(div => (
                  <button 
                    key={div.id}
                    onClick={() => setSelectedDivision(div.id)}
                    className={`btn ${selectedDivision === div.id ? 'btn-active' : ''}`}
                    style={{ flex: 1 }}
                  >
                    {div.label}
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
              <p className="hint" style={{ marginTop: '0.5rem' }}>この部門の選手数: {divisionArchers.length}人</p>
            </div>

            <div className="card">
              <div className="round-selector">
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>ラウンド選択</label>
                <div className="button-group" style={{ marginBottom: '1rem' }}>
                  <button 
                    onClick={() => setSelectedRound(1)}
                    className={`btn ${selectedRound === 1 ? 'btn-active' : ''}`}
                    style={{ flex: 1 }}
                  >
                    1立ち目 ({tournament.arrowsRound1}本)
                  </button>
                  <button 
                    onClick={() => setSelectedRound(2)}
                    className={`btn ${selectedRound === 2 ? 'btn-active' : ''}`}
                    style={{ flex: 1 }}
                  >
                    2立ち目 ({tournament.arrowsRound2}本)
                  </button>
                </div>
                <div style={{ fontSize: '0.875rem', color: '#4b5563', textAlign: 'center' }}>
                  <p>現在のラウンド: {selectedRound}立ち目 ({getCurrentArrowsPerStand()}本)</p>
                </div>
              </div>
            </div>

            <div className="archer-records">
              {standArchers.length === 0 ? (
                <p className="empty-text">この立に割り当てられた選手がいません</p>
              ) : (
                standArchers.map(archer => {
                  const currentArrows = getCurrentArrowsPerStand();
                  const { ceremony, rank } = getRankCategory(archer.rank);
                  const archerRank = ranks[archer.archerId];
                  const roundComplete = isRoundComplete(archer);

                  return (
                    <div key={archer.archerId} className="archer-record">
                      <div className="archer-info">
                        <p><strong>{archer.standOrder}. {archer.name}</strong></p>
                        <p className="text-sm">{archer.affiliation} | {ceremony}{rank}</p>
                        <p className="text-sm" style={{ color: '#2563eb', fontWeight: 500, marginTop: '0.25rem' }}>
                          的中: {getTotalHitCount(archer)}本 / 順位: {archerRank}位
                        </p>
                      </div>
                      <span className={`status ${roundComplete ? 'status-complete' : 'status-input'}`}>
                        {roundComplete ? '完了' : '入力中'}
                      </span>
                      <div className="arrows-grid" style={{ gridTemplateColumns: `repeat(${currentArrows}, 1fr)` }}>
                        {getCurrentStandResults(archer).map((result, arrowIdx) => (
                          <div key={arrowIdx} className="arrow-input">
                            <p>{arrowIdx + 1}</p>
                            {result === null ? (
                              <div className="arrow-buttons">
                                <button onClick={() => handleRecord(archer.archerId, selectedStand, arrowIdx, 'o')} className="btn-circle btn-hit" disabled={roundComplete}>◯</button>
                                <button onClick={() => handleRecord(archer.archerId, selectedStand, arrowIdx, 'x')} className="btn-circle btn-miss" disabled={roundComplete}>×</button>
                              </div>
                            ) : (
                              <div className="arrow-result">
                                <button disabled className={`btn-circle ${result === 'o' ? 'btn-hit' : 'btn-miss'}`}>{result === 'o' ? '◯' : '×'}</button>
                                <button onClick={() => handleUndo(archer.archerId, selectedStand, arrowIdx)} className="btn-fix">修正</button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};


export default RecordingView;