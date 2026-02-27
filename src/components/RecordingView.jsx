import React, { useState, useEffect, useCallback, useRef } from 'react';
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

  // 保存中のデータを管理するRef。バックグラウンド同期がpending中の変更を上書きしないようにする
  // キー: "archerId:standKey"  値: [...results]
  const pendingUpdatesRef = useRef({});

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
        
        const normalizeRankLocal = (rank) => {
          if (!rank) return '';
          return rank
            .replace('二段', '弐段')
            .replace('三段', '参段')
            .replace('二級', '弐級')
            .replace('一級', '壱級');
        };

        const sortedArchers = [...checkedIn].sort((a, b) => {
          // 部門ごとの男女分け設定を確認
          const aDivId = getDivisionIdForArcher(a, divisions);
          const bDivId = getDivisionIdForArcher(b, divisions);
          const aDivision = divisions.find(d => d.id === aDivId);
          const bDivision = divisions.find(d => d.id === bDivId);
          const aGenderSeparation = aDivision?.enableGenderSeparation || tournament?.data?.enableGenderSeparation || false;
          const bGenderSeparation = bDivision?.enableGenderSeparation || tournament?.data?.enableGenderSeparation || false;
          
          // 男女分けが有効な場合、男を先に配置
          if (aGenderSeparation || bGenderSeparation) {
            const aGender = a.gender || "male";
            const bGender = b.gender || "male";
            if (aGender !== bGender) {
              return aGender === "male" ? -1 : 1;
            }
          }

          const aRank = normalizeRankLocal(a.rank);
          const bRank = normalizeRankLocal(b.rank);
          const aIndex = rankOrder.indexOf(aRank);
          const bIndex = rankOrder.indexOf(bRank);

          if (aIndex !== bIndex) {
            if (aIndex === -1 && bIndex === -1) return 0;
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return aIndex - bIndex;
          }

          const aDate = a.rankAcquiredDate ? new Date(a.rankAcquiredDate).getTime() : Number.NEGATIVE_INFINITY;
          const bDate = b.rankAcquiredDate ? new Date(b.rankAcquiredDate).getTime() : Number.NEGATIVE_INFINITY;
          return bDate - aDate;
        });

        const totalNeeded = tournament.arrowsRound1 + tournament.arrowsRound2;
        const defaultResults = {};
        for (let i = 1; i <= 6; i++) defaultResults[`stand${i}`] = Array(totalNeeded).fill(null);

        const archersWithOrder = sortedArchers.map((archer, index) => {
          const baseArcher = {
            ...archer,
            standOrder: index + 1,
            division: getDivisionIdForArcher(archer, divisions),
            results: Object.assign({}, defaultResults, archer.results || {})
          };

          // pending中の変更がある場合はAPIの古いデータで上書きしない
          const pending = pendingUpdatesRef.current;
          const mergedResults = { ...baseArcher.results };
          for (const key of Object.keys(pending)) {
            const [pendingArcherId, standKey] = key.split(':');
            if (pendingArcherId === archer.archerId) {
              mergedResults[standKey] = pending[key];
            }
          }

          return { ...baseArcher, results: mergedResults };
        });

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
    
    // 選択された部門の男女分け設定を確認
    const division = divisions.find(d => d.id === selectedDivision);
    const divGenderSeparation = division?.enableGenderSeparation || tournament?.data?.enableGenderSeparation || false;
    
    if (!divGenderSeparation) return true;
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
  const saveResultToApi = async (archerId, standNum, arrowIndex, result, updatedResults) => {
    const standKey = `stand${standNum}`;
    const pendingKey = `${archerId}:${standKey}`;

    try {
      await fetch(`${API_URL}/archer/${archerId}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: selectedTournamentId,
          stand: standNum,
          results: updatedResults
        })
      });
      
      console.log('記録保存成功:', { archerId, stand: standNum, arrowIndex, result });
    } catch (error) {
      console.error('記録保存エラー:', error);
      alert('ネットワークエラーにより保存できませんでした');
    } finally {
      // 保存完了(成功・失敗問わず)後にpendingから除去
      delete pendingUpdatesRef.current[pendingKey];
    }
  };

  const handleRecord = (archerId, standNum, arrowIndex, result) => {
    // 楽観的UI更新(即時反映)
    const archer = archers.find(a => a.archerId === archerId);
    if (!archer) return;

    const standKey = `stand${standNum}`;
    
    const existingResults = (archer.results && archer.results[standKey]) 
      ? [...archer.results[standKey]] 
      : Array(tournament.arrowsRound1 + tournament.arrowsRound2).fill(null);
    
    const adjustedArrowIndex = selectedRound === 2 
      ? tournament.arrowsRound1 + arrowIndex 
      : arrowIndex;
    
    existingResults[adjustedArrowIndex] = result;

    // pendingに登録してバックグラウンド同期が上書きしないようにする
    const pendingKey = `${archerId}:${standKey}`;
    pendingUpdatesRef.current[pendingKey] = existingResults;

    const updatedArchers = archers.map(a => 
      a.archerId === archerId 
        ? { ...a, results: { ...a.results, [standKey]: existingResults } } 
        : a
    );
    
    setArchers(updatedArchers);

    // APIへ送信。更新後のresultsをそのまま渡す（stale closureを避ける）
    saveResultToApi(archerId, standNum, adjustedArrowIndex, result, existingResults);
  };

  const handleUndo = (archerId, standNum, arrowIndex) => {
    // 楽観的UI更新
    const archer = archers.find(a => a.archerId === archerId);
    if (!archer) return;

    const standKey = `stand${standNum}`;
    const currentArrows = getCurrentArrowsPerStand();
    
    const existing = (archer.results && archer.results[standKey]) 
      ? [...archer.results[standKey]] 
      : Array(tournament.arrowsRound1 + tournament.arrowsRound2).fill(null);
    
    // adjustedArrowIndex でそのラウンドの正しい位置をnullにする
    const adjustedArrowIndex = selectedRound === 2
      ? tournament.arrowsRound1 + arrowIndex
      : arrowIndex;

    existing[adjustedArrowIndex] = null;

    // pendingに登録
    const pendingKey = `${archerId}:${standKey}`;
    pendingUpdatesRef.current[pendingKey] = existing;

    const updatedArchers = archers.map(a => 
      a.archerId === archerId 
        ? { ...a, results: { ...a.results, [standKey]: existing } } 
        : a
    );
    
    setArchers(updatedArchers);

    // APIへ送信
    saveResultToApi(archerId, standNum, adjustedArrowIndex, null, existing);
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
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%'}}>
          <div>
            <h1>📝 記録入力</h1>
            <p style={{margin:'0.5rem 0 0 0', fontSize:'0.875rem', color:'#6b7280'}}>部門ごとに立ち順を管理 (自動保存)</p>
          </div>
          {isSyncing && (
            <div style={{display:'flex', alignItems:'center', gap:'0.5rem', color:'#10b981', fontSize:'0.875rem', fontWeight:500}}>
              <RefreshCw size={16} className="animate-spin" />
              <span>同期中</span>
            </div>
          )}
        </div>
      </div>
      <div className="view-content">
        
        {selectedTournamentId && (
          <>
            <div className="card">
              <label style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.9375rem', fontWeight: 600, color:'#1f2937' }}>🎯 部門を選択</label>
              <div className="button-group">
                {divisions.map(div => (
                  <button 
                    key={div.id}
                    onClick={() => setSelectedDivision(div.id)}
                    className={`btn ${selectedDivision === div.id ? 'btn-active' : ''}`}
                  >
                    {div.label}
                  </button>
                ))}
              </div>
              {(() => {
                const division = divisions.find(d => d.id === selectedDivision);
                const divGenderSeparation = division?.enableGenderSeparation || tournament?.data?.enableGenderSeparation || false;
                
                return divGenderSeparation && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color:'#6b7280' }}>性別フィルター</label>
                    <div className="button-group">
                      <button onClick={() => setSelectedGender('all')} className={`btn ${selectedGender === 'all' ? 'btn-active' : ''}`}>全員</button>
                      <button onClick={() => setSelectedGender('male')} className={`btn ${selectedGender === 'male' ? 'btn-active' : ''}`}>👨 男子</button>
                      <button onClick={() => setSelectedGender('female')} className={`btn ${selectedGender === 'female' ? 'btn-active' : ''}`}>👩 女子</button>
                    </div>
                  </div>
                );
              })()}
              <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f0f9ff', borderRadius: '0.5rem', border: '1px solid #bfdbfe' }}>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#1e40af', fontWeight: 500 }}>👥 この部門の選手数: {divisionArchers.length}人</p>
              </div>
            </div>

            <div className="card">
              <div className="round-selector">
                <label style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.9375rem', fontWeight: 600, color:'#1f2937' }}>🏹 ラウンド選択</label>
                <div className="button-group">
                  <button 
                    onClick={() => setSelectedRound(1)}
                    className={`btn ${selectedRound === 1 ? 'btn-active' : ''}`}
                  >
                    1立ち目 ({tournament.arrowsRound1}本)
                  </button>
                  <button 
                    onClick={() => setSelectedRound(2)}
                    className={`btn ${selectedRound === 2 ? 'btn-active' : ''}`}
                  >
                    2立ち目 ({tournament.arrowsRound2}本)
                  </button>
                </div>
                <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#4b5563', textAlign: 'center', fontWeight: 500 }}>
                  <p style={{margin:0}}>📍 現在: {selectedRound}立ち目 ({getCurrentArrowsPerStand()}本)</p>
                </div>
              </div>
            </div>

            <div className="archer-records">
              {standArchers.length === 0 ? (
                <div className="card">
                  <p className="empty-text">🔍 この立に割り当てられた選手がいません</p>
                </div>
              ) : (
                standArchers.map(archer => {
                  const currentArrows = getCurrentArrowsPerStand();
                  const { ceremony, rank } = getRankCategory(archer.rank);
                  const archerRank = ranks[archer.archerId];
                  const roundComplete = isRoundComplete(archer);

                  return (
                    <div key={archer.archerId} className="archer-record">
                      <div className="archer-info">
                        <p><strong>🎯 {archer.standOrder}. {archer.name}</strong></p>
                        <p className="text-sm" style={{color:'#6b7280'}}>🏛️ {archer.affiliation} | 🎖️ {ceremony}{rank}</p>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                          <p className="text-sm" style={{ color: '#10b981', fontWeight: 600, margin: 0 }}>
                            ✅ 的中: {getTotalHitCount(archer)}本
                          </p>
                          <p className="text-sm" style={{ color: '#2563eb', fontWeight: 600, margin: 0 }}>
                            🏆 順位: {archerRank}位
                          </p>
                        </div>
                      </div>
                      <span className={`status ${roundComplete ? 'status-complete' : 'status-input'}`}>
                        {roundComplete ? '✓ 完了' : '⏳ 入力中'}
                      </span>
                      <div className="arrows-grid" style={{ gridTemplateColumns: `repeat(${Math.min(currentArrows, 4)}, 1fr)` }}>
                        {getCurrentStandResults(archer).map((result, arrowIdx) => (
                          <div key={arrowIdx} className="arrow-input">
                            <p>{arrowIdx + 1}本目</p>
                            {result === null ? (
                              <div className="arrow-buttons">
                                <button onClick={() => handleRecord(archer.archerId, selectedStand, arrowIdx, 'o')} className="btn-circle btn-hit" disabled={roundComplete}>◯</button>
                                <button onClick={() => handleRecord(archer.archerId, selectedStand, arrowIdx, 'x')} className="btn-circle btn-miss" disabled={roundComplete}>×</button>
                                <button onClick={() => handleRecord(archer.archerId, selectedStand, arrowIdx, '?')} className="btn-circle btn-unknown" disabled={roundComplete}>?</button>
                              </div>
                            ) : (
                              <div className="arrow-result">
                                <button disabled className={`btn-circle ${result === 'o' ? 'btn-hit' : result === 'x' ? 'btn-miss' : 'btn-unknown'}`}>
                                  {result === 'o' ? '◯' : result === 'x' ? '×' : '?'}
                                </button>
                                <button onClick={() => handleUndo(archer.archerId, selectedStand, arrowIdx)} className="btn-fix">🔄 修正</button>
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