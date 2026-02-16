import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { applicantsApi } from '../utils/api';
import { API_URL } from '../utils/api';
import {
  calculateRanksWithTies,
  getDivisionIdForArcher,
  getRankOrder
} from '../utils/competition';

const RankingView = ({ state, dispatch, selectedTournamentId }) => {
  const [archers, setArchers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [shootOffType, setShootOffType] = useState(''); // 'shichuma' or 'enkin'
  const [selectedDivision, setSelectedDivision] = useState(''); // 部門選択用
  const [selectedGender, setSelectedGender] = useState(() => localStorage.getItem('ranking_selectedGender') || 'all'); // 'all' | 'male' | 'female'
  const [currentShichumaRound, setCurrentShichumaRound] = useState(1); // 現在の射数（1～4）
  const [shichumaResults, setShichumaResults] = useState({}); // {archerId: ['o', 'x', null, null]}
  const [eliminatedArchers, setEliminatedArchers] = useState(new Set()); // 脱落者ID
  const [eliminationRound, setEliminationRound] = useState({}); // {archerId: 脱落した射数}
  const [currentShootOffArchers, setCurrentShootOffArchers] = useState([]);
  const [eliminationOrder, setEliminationOrder] = useState([]);
  const [simultaneousEliminations, setSimultaneousEliminations] = useState([]);
  const [isShootOffActive, setIsShootOffActive] = useState(false);
  const [isSavingShichuma, setIsSavingShichuma] = useState(false); // 追加
  const [enkinResults, setEnkinResults] = useState({});
  const [enkinTargetRank, setEnkinTargetRank] = useState(null);
  const [showEnkinOption, setShowEnkinOption] = useState(false);
  const [remainingAfterFourArrows, setRemainingAfterFourArrows] = useState([]);
  const [enkinDefeated, setEnkinDefeated] = useState(new Set()); // 敗退した選手ID
  const [originalEnkinArchers, setOriginalEnkinArchers] = useState(new Set());
  const [enkinStartRank, setEnkinStartRank] = useState(2); // 運営側で選択可能な開始順位
  const [editingArrow, setEditingArrow] = useState(null); // {archerId, arrowIndex}
  const [shichumaFinalResults, setShichumaFinalResults] = useState(null); // 射詰競射の最終結果
  const [enkinFinalResults, setEnkinFinalResults] = useState(null); // 遠近競射の最終結果
  const [isLoadingResults, setIsLoadingResults] = useState(false); // 結果読み込み状態
  const [savedEnkinRanks, setSavedEnkinRanks] = useState(new Set()); // 保存済みの遠近競射枠
  const [skipShootOffFetchUntil, setSkipShootOffFetchUntil] = useState(0);
  const [ignoreServerFinalsUntil, setIgnoreServerFinalsUntil] = useState(0);
  const [suppressMergedDisplayUntil, setSuppressMergedDisplayUntil] = useState(0);
  const [useLocalOnlyFinals, setUseLocalOnlyFinals] = useState(false);

  const tournaments = state.registeredTournaments || [];
  const tournament = tournaments.find(t => t.id === selectedTournamentId) || null;

  // 部門設定
  const selectedTournament = state.registeredTournaments.find(t => t.id === selectedTournamentId);
  const localDefaultDivisions = [
    { id: 'lower', label: '級位~三段以下の部' },
    { id: 'middle', label: '四・五段の部' },
    { id: 'title', label: '称号者の部' }
  ];
  const divisions = (selectedTournament && selectedTournament.data && selectedTournament.data.divisions) ? selectedTournament.data.divisions : localDefaultDivisions;

  const enableGenderSeparation = selectedTournament?.data?.enableGenderSeparation || false;

  // 順位の正規化
  const normalizeRank = (rank) => {
    if (!rank) return '';
    return rank
      .replace('二段', '弐段')
      .replace('三段', '参段')
      .replace('二級', '弐級')
      .replace('一級', '壱級');
  };

  const rankOrder = ['無指定', '五級', '四級', '三級', '弐級', '壱級', '初段', '弐段', '参段', '四段', '五段', '錬士五段', '錬士六段', '教士七段', '教士八段', '範士八段', '範士九段'];

  // 部門判定ロジック
  const getDivisionIdForArcher = useCallback((archer, divisions) => {
    const rIdx = rankOrder.indexOf(normalizeRank(archer?.rank));
    for (const d of (divisions || [])) {
      const minIdx = d?.minRank ? rankOrder.indexOf(normalizeRank(d.minRank)) : 0;
      const maxIdx = d?.maxRank ? rankOrder.indexOf(normalizeRank(d.maxRank)) : 9999;
      if (rIdx >= minIdx && rIdx <= maxIdx) return d.id;
    }
    return 'unassigned';
  }, []);

  // 部門ごとに選手を分類
  const getArchersByDivision = useCallback((archers) => {
    const groups = {};
    for (const d of divisions) groups[d.id] = { division: d, archers: [] };
    if (!groups.unassigned) groups.unassigned = { division: { id: 'unassigned', label: '未分類' }, archers: [] };

    for (const archer of archers) {
      const divId = getDivisionIdForArcher(archer, divisions);
      if (!groups[divId]) groups[divId] = { division: { id: divId, label: divId }, archers: [] };
      groups[divId].archers.push(archer);
    }

    const result = [];
    for (const key in groups) {
      const g = groups[key];
      if (g.archers.length > 0) {
        result.push({
          division: g.division,
          archers: g.archers
        });
      }
    }
    
    result.sort((a, b) => {
      const ai = divisions.findIndex(d => d.id === a.division.id);
      const bi = divisions.findIndex(d => d.id === b.division.id);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
    
    return result;
  }, [divisions, getDivisionIdForArcher]);

  // getTotalHitCountAllStands関数を定義
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

  // リアルタイム同期(3秒ごとに他の端末の入力を反映)
  useEffect(() => {
    if (!selectedTournamentId || isShootOffActive) return; // 射詰中は同期しない
    const interval = setInterval(() => {
      fetchArchers(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedTournamentId, isShootOffActive]); // 依存配列に追加

  const fetchArchers = async (background = false) => {
    if (!selectedTournamentId) {
      setArchers([]);
      return;
    }
    if (!background) setIsLoading(true);
    else setIsSyncing(true);
    
    try {
      const response = await fetch(`${API_URL}/applicants/${selectedTournamentId}`);
      const result = await response.json();
      if (result.success) {
        // 通過者ページを基準にして通過判定ルールを適用した選手のみを対象にする
        const checkedIn = (result.data || []).filter(a => a.isCheckedIn);
        
        // 通過判定ルールを適用
        const passRule = tournament?.data?.passRule || state.tournament.passRule || 'four_or_more';
        const passedArchers = checkedIn.filter(archer => {
          const hitCount = getTotalHitCountAllStands(archer);
          const totalArrows = (tournament?.data?.arrowsRound1 || state.tournament.arrowsRound1 || 0) + 
                           (tournament?.data?.arrowsRound2 || state.tournament.arrowsRound2 || 0);
          
          switch (passRule) {
            case 'all_four':
              return hitCount === totalArrows; // 全て的中（全矢的中）
            case 'four_or_more':
              return hitCount >= 4; // 4本以上的中
            case 'three_or_more':
              return hitCount >= 3; // 3本以上的中
            case 'two_or_more':
              return hitCount >= 2; // 2本以上的中
            default:
              return hitCount >= 3; // デフォルトは3本以上
          }
        });
        
        setArchers(passedArchers);
      } else {
        setArchers([]);
      }
    } catch (e) {
      console.error('RankingView fetch error', e);
      setArchers([]);
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (!useLocalOnlyFinals) {
      fetchArchers();
      fetchShootOffResults();
    } else {
      console.log('Server sync disabled: skipping initial fetch of shoot-off results');
    }
  }, [selectedTournamentId]);

  useEffect(() => { localStorage.setItem('ranking_selectedGender', selectedGender || 'all'); }, [selectedGender]);

  // 順位決定戦結果を取得
  // 全ての順位決定戦の結果を取得
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
      const response = await fetch(`${API_URL}/ranking/shootoff/${selectedTournamentId}`);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          console.log('?? fetchShootOffResults - サーバーから取得したデータ:', {
            shichuma: result.data.shichuma,
            enkin: result.data.enkin?.results?.map(r => ({
              archerId: r.archerId,
              rank: r.rank,
              targetRank: r.targetRank
            }))
          });
          
          // 射詰結果のshootOffTypeを確認・補完
          if (result.data.shichuma && result.data.shichuma.results) {
            // サーバーから取得した射詰結果にshootOffTypeがない場合は補完
            const shichumaResultsWithShootOffType = {
              ...result.data.shichuma,
              results: result.data.shichuma.results.map(r => ({
                ...r,
                shootOffType: r.shootOffType || 'shichuma' // shootOffTypeがない場合は'shichuma'を設定
              }))
            };
            
            console.log('?? 射詰結果の詳細（補完後）:', shichumaResultsWithShootOffType.results.map(r => ({
              archerId: r.archerId,
              rank: r.rank,
              shootOffType: r.shootOffType,
              isWinner: r.isWinner
            })));
            
            setShichumaFinalResults(shichumaResultsWithShootOffType);
          } else {
            setShichumaFinalResults(result.data.shichuma);
          }
          setEnkinFinalResults(result.data.enkin);
          
          // 保存済みの遠近競射枠を取得
          const savedRanks = new Set();
          if (result.data.enkin && result.data.enkin.results) {
            result.data.enkin.results.forEach(r => {
              if (r.targetRank) {
                savedRanks.add(r.targetRank);
              }
            });
          }
          setSavedEnkinRanks(savedRanks);
        }
      } else {
        setShichumaFinalResults(null);
        setEnkinFinalResults(null);
        setSavedEnkinRanks(new Set());
      }
    } catch (error) {
      console.error('順位決定戦結果の取得エラー:', error);
      setShichumaFinalResults(null);
      setEnkinFinalResults(null);
      setSavedEnkinRanks(new Set());
    } finally {
      setIsLoadingResults(false);
    }
  };
  const fetchEnkinResults = async () => {
    if (!selectedTournamentId) return;
    if (useLocalOnlyFinals) {
      console.log('fetchEnkinResults skipped because useLocalOnlyFinals is enabled');
      return;
    }

    setIsLoadingResults(true);
    try {
      const response = await fetch(`${API_URL}/ranking/enkin/${selectedTournamentId}`);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setEnkinFinalResults(result.data);
        }
      } else {
        setEnkinFinalResults(null);
      }
    } catch (error) {
      console.error('遠近競射結果の取得エラー:', error);
      setEnkinFinalResults(null);
    } finally {
      setIsLoadingResults(false);
    }
  };

  // 結果取得を実行
  useEffect(() => {
    if (selectedTournamentId) {
      // fetchShichumaResults();  // fetchShootOffResultsで一括取得するためコメントアウト
      // fetchEnkinResults();      // fetchShootOffResultsで一括取得するためコメントアウト
      fetchShootOffResults();     // 射詰・遠近の両方を一括取得
    }
  }, [selectedTournamentId]);

  // デバッグ情報
  useEffect(() => {
    console.log('Debug info:', {
      selectedTournamentId,
      shichumaFinalResults,
      enkinFinalResults,
      isLoadingResults
    });
  }, [selectedTournamentId, shichumaFinalResults, enkinFinalResults, isLoadingResults]);

  const getTiedArchers = useCallback(() => {
    const rankGroups = {};
    archers.forEach(archer => {
      const hitCount = getTotalHitCountAllStands(archer);
      if (!rankGroups[hitCount]) {
        rankGroups[hitCount] = [];
      }
      rankGroups[hitCount].push(archer);
    });

    const awardRankLimit = tournament?.data?.awardRankLimit || 3;
    
    // 的中数の降順でソート
    const sortedGroups = Object.entries(rankGroups)
      .map(([hitCount, group]) => [parseInt(hitCount), group])
      .sort(([a], [b]) => b - a);
    
    const displayGroups = [];
    let currentRank = 1;
    
    for (const [hitCount, group] of sortedGroups) {
      // このグループの開始順位が表彰範囲内なら、グループ全体を対象にする
      if (currentRank <= awardRankLimit && group.length > 1) {
        displayGroups.push([hitCount, group]);
      } else if (currentRank > awardRankLimit && group.length > 1) {
        // 表彰範囲外だが同率の場合、そのグループは順位確定として扱う
        // ここではdisplayGroupsには追加しないが、categorizedGroupsで処理される
      } else if (currentRank > awardRankLimit && group.length === 1) {
        // 表彰範囲外で同率でない場合、順位確定として扱う
      }
      
      // 次のグループの開始順位を計算
      currentRank += group.length;
    }

    return displayGroups;
  }, [archers, tournament]);

  const saveShichumaResultToApi = async (archerId, arrowIndex, result) => {
    try {
      const response = await fetch(`${API_URL}/ranking/shichuma`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: selectedTournamentId,
          archerId,
          arrowIndex,
          result
        })
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn('射詰競射APIエンドポイントが未実装です');
          return; // ローカルのみで処理を続行
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // 更新後にデータを再取得(同期)
      fetchArchers(true);
    } catch (error) {
      console.error('射詰競射結果保存エラー:', error);
      if (error.message.includes('404')) {
        // 404エラーは通知しない（バックエンド未実装）
        return;
      }
      alert('射詰競射結果の保存に失敗しました: ' + error.message);
    }
  };

  // API経由で遠近競射結果を保存
  const saveEnkinResultToApi = async (archerId, distance, arrowType = 'normal') => {
    try {
      const response = await fetch(`${API_URL}/ranking/enkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: selectedTournamentId,
          archerId,
          rank: distance, // 的表面からの距離（mm）をrankとして送信
          arrowType // 'normal', 'saki', 'miss' など
        })
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn('遠近競射APIエンドポイントが未実装です');
          return; // ローカルのみで処理を続行
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // 更新後にデータを再取得(同期)
      fetchArchers(true);
    } catch (error) {
      console.error('遠近競射結果保存エラー:', error);
      if (error.message.includes('404')) {
        // 404エラーは通知しない（バックエンド未実装）
        return;
      }
      alert('遠近競射結果の保存に失敗しました: ' + error.message);
    }
  };

  const startShichumaShootOff = (tiedArchers) => {
    setShootOffType('shichuma');
    setIsShootOffActive(true);
    setCurrentShichumaRound(1);
    setShichumaResults({});
    setEliminatedArchers(new Set());
    setCurrentShootOffArchers(tiedArchers);
    setEliminationOrder([]);
    setSimultaneousEliminations([]);
    setOriginalEnkinArchers(new Set());
    setEliminationRound({});
  };

  const startEnkinShootOff = (tiedArchers, fromShichuma = false, targetRank = null, isNewFromShichuma = false) => {
    setShootOffType('enkin');
    setIsShootOffActive(true);
    setEnkinResults({});
    setCurrentShootOffArchers(tiedArchers);
    
    // 開始順位を設定
    if (targetRank !== null) {
      setEnkinTargetRank(targetRank);
    } else if (fromShichuma) {
      // 射詰競射からの遠近競射の場合、脱落順から次の順位を計算
      const nextRank = getNextEnkinTargetRank();
      setEnkinTargetRank(nextRank);
    } else {
      // 通常の遠近競射の場合
      setEnkinTargetRank(null);
    }
    
    if (fromShichuma && isNewFromShichuma) {
      // 射詰競射からの新規遠近競射選手
      setOriginalEnkinArchers(new Set());
    } else if (!fromShichuma) {
      // 元々の遠近競射選手
      setOriginalEnkinArchers(new Set(tiedArchers.map(a => a.archerId)));
    }
  };

  const handleShichumaShot = async (archerId, arrowIdx, result) => {
  // 1. 最新の結果を含めた状態を作成
  const updatedResults = { ...shichumaResults };
  const currentResults = updatedResults[archerId] || [];
  const newResults = [...currentResults];
  newResults[arrowIdx] = result;
  updatedResults[archerId] = newResults;
  
  // 2. ×になった場合は記録
  const updatedEliminated = new Set(eliminatedArchers);
  const updatedEliminationOrder = [...eliminationOrder];
  
  if (result === 'x') {
    updatedEliminated.add(archerId);
    
    const consecutiveHits = newResults.slice(0, arrowIdx).filter(r => r === 'o').length;
    
    updatedEliminationOrder.push({
      archerId: archerId,
      arrowIndex: arrowIdx + 1,
      consecutiveHits: consecutiveHits
    });
  }
  
  // 3. 状態を一括で更新
  setShichumaResults(updatedResults);
  setEliminatedArchers(updatedEliminated);
  setEliminationOrder(updatedEliminationOrder);
  
  if (result === 'x') {
    setEliminationRound(prev => ({
      ...prev,
      [archerId]: arrowIdx + 1
    }));
  }
  
  // APIに保存
  saveShichumaResultToApi(archerId, arrowIdx, result).catch(error => {
    console.error('射詰競射結果保存エラー:', error);
  });

  // 4. 全員の結果が入力されたかチェック
  const allInputComplete = currentShootOffArchers.every(archer => {
    const archerResults = updatedResults[archer.archerId] || [];
    
    if (updatedEliminated.has(archer.archerId)) {
      const elimInfo = updatedEliminationOrder.find(e => e.archerId === archer.archerId);
      if (!elimInfo) return false;
      // 脱落した本数までの結果が全て入力されているか
      for (let i = 0; i < elimInfo.arrowIndex; i++) {
        if (archerResults[i] === undefined) return false;
      }
      return true;
    } else {
      // 生存者は現在のラウンドまでの結果が必要
      return archerResults[arrowIdx] !== undefined;
    }
  });

  if (!allInputComplete) {
    return;
  }

  // 5. 1位候補（全○で脱落していない者）を探す
  const undefeatedArchers = currentShootOffArchers.filter(archer => {
    return !updatedEliminated.has(archer.archerId);
  });

  console.log('入力状況:', {
    round: arrowIdx + 1,
    total: currentShootOffArchers.length,
    eliminated: updatedEliminated.size,
    undefeated: undefeatedArchers.length
  });

  // === 射詰競射の進行状況をチェック ===
  const remainingCount = undefeatedArchers.length;
  const eliminatedCount = updatedEliminated.size;
  const totalCount = currentShootOffArchers.length;
  
  console.log('射詰進行状況:', {
    total: totalCount,
    remaining: remainingCount,
    eliminated: eliminatedCount,
    round: arrowIdx + 1
  });

  // === 順位決定のロジック ===
  if (remainingCount === 1) {
    // === 1位が決定した場合 ===
    const winner = undefeatedArchers[0];
    const winnerResults = updatedResults[winner.archerId] || [];
    const winnerConsecutiveHits = winnerResults.filter(r => r === 'o').length;
    
    console.log('1位決定:', winner.name);

    // 脱落者たちを脱落本数でグループ分け
    const eliminationGroups = {};
    updatedEliminationOrder.forEach(elimInfo => {
      const arrowNum = elimInfo.arrowIndex;
      if (!eliminationGroups[arrowNum]) {
        eliminationGroups[arrowNum] = [];
      }
      eliminationGroups[arrowNum].push(elimInfo.archerId);
    });

    console.log('脱落グループ:', eliminationGroups);

    // 同じ本数で脱落した者が複数いるかチェック（シンプルなロジック）
    const needsEnkin = [];
    Object.values(eliminationGroups).forEach(group => {
      if (group.length > 1) {
        // このグループは同点なので遠近競射で順位決定
        needsEnkin.push(...group);
      }
    });

    console.log('?? 遠近競射対象者ID:', needsEnkin);
    console.log('?? 遠近競射対象者:', needsEnkin.map(id => {
      const a = currentShootOffArchers.find(ar => ar.archerId === id);
      return a?.name || '不明';
    }));

    // === バックアップのシンプルなロジックを適用 ===
    // 最終順位を構築
    const finalEliminationOrder = [...updatedEliminationOrder];
    let currentRank = 2; // 1位は1なので2位から開始
    
    // 脱落順（本数が多い順）でグループを処理
    const sortedArrowNumbers = Object.keys(eliminationGroups)
      .map(Number)
      .sort((a, b) => b - a); // 降順（後に脱落した方が上位）

    sortedArrowNumbers.forEach(arrowNum => {
      const group = eliminationGroups[arrowNum];
      const groupSize = group.length;
      
      // このグループのメンバーに順位を割り当て
      group.forEach(memberId => {
        const elimInfo = finalEliminationOrder.find(e => e.archerId === memberId);
        if (elimInfo) {
          if (groupSize === 1) {
            // グループのメンバーが1人なら順位確定
            elimInfo.rank = currentRank;
          } else {
            // 複数人なら遠近で決定（仮の同順位）
            elimInfo.rank = currentRank;
          }
        }
      });
      currentRank += groupSize;
    });

    // 1位を追加
    finalEliminationOrder.push({ 
      archerId: winner.archerId, 
      rank: 1, 
      isWinner: true,
      consecutiveHits: winnerConsecutiveHits
    });

    setEliminationOrder(finalEliminationOrder);

    // === ここから修正：遠近不要ならすぐに保存、遠近必要なら表示のみ ===
    if (needsEnkin.length > 0) {
      // 遠近競射が必要：UI表示のみで、まだ保存しない
      const enkinArchers = currentShootOffArchers.filter(a => needsEnkin.includes(a.archerId));
      setRemainingAfterFourArrows(enkinArchers);
      setShowEnkinOption(true);
      setIsShootOffActive(true);
    } else {
      // 遠近不要：ここで最終結果を保存（一度だけ）
      console.log('?? 遠近競射なし - 射詰競射結果を保存');
      await saveFinalShichumaResults(finalEliminationOrder, updatedResults);
      setIsShootOffActive(false);
    }
    
    return;
  }
  
  // === 部分的順位決定のロジック（3人以上の場合） ===
  if (totalCount >= 3 && eliminatedCount >= 2) {
    // 3人以上で2人以上脱落した場合、残り1人になるまで続けるか、
    // または残り2人になった時点で新しい射詰ラウンドを開始
    if (remainingCount === 2) {
      console.log('残り2人 - 新しい射詰ラウンドへ');
      // 残り2人で新しい射詰を開始
      setCurrentShichumaRound(prev => prev + 1);
      return;
    }
  }

  // 7. まだ1位が決定していない場合
  // 次のラウンドへ進む
  if (undefeatedArchers.length >= 2 && arrowIdx < 3) {
    console.log('次のラウンドへ:', undefeatedArchers.length, '名が生存');
    setCurrentShichumaRound(prev => prev + 1);
  } else if (undefeatedArchers.length === 0) {
    // 全員脱落（ありえないが念のため）
    setIsShootOffActive(false);
  }
};

const handleStartEnkinFromShichuma = async () => {
  // 射詰競射の最終順位を構築
  const finalEliminationOrder = [...eliminationOrder];
  
  // 優勝者を追加
  const undefeatedArchers = currentShootOffArchers.filter(
    archer => !eliminatedArchers.has(archer.archerId)
  );
  
  if (undefeatedArchers.length === 1) {
    const winner = undefeatedArchers[0];
    const winnerResults = shichumaResults[winner.archerId] || [];
    const winnerConsecutiveHits = winnerResults.filter(r => r === 'o').length;
    
    finalEliminationOrder.push({
      archerId: winner.archerId,
      rank: 1,
      isWinner: true,
      consecutiveHits: winnerConsecutiveHits
    });
  }

  // 射詰競射の結果をAPIに保存
  await saveFinalShichumaResults(finalEliminationOrder, shichumaResults);

  // 遠近競射を開始
  const nextRank = getNextEnkinTargetRank();
  startEnkinShootOff(remainingAfterFourArrows, true, nextRank, true);
  setShowEnkinOption(false);
};

const getShichumaWinner = () => {
  if (Object.keys(shichumaResults).length === 0) return null;
  
  const remainingArchers = currentShootOffArchers.filter(
    archer => !eliminatedArchers.has(archer.archerId)
  );
  
  if (remainingArchers.length === 1) {
    const lastArcher = remainingArchers[0];
    const archerResults = shichumaResults[lastArcher.archerId] || [];
    
    const allArrowsCompleted = [0, 1, 2, 3].every(arrowIndex => 
      archerResults[arrowIndex] !== undefined
    );
    
    if (allArrowsCompleted) {
      return lastArcher;
    }
  }
  return null;
};

  const getShichumaFinalRanking = () => {
    const ranking = [];
    
    // ×になった選手を順位順に並べる
    eliminationOrder.forEach((eliminated, index) => {
      const archer = currentShootOffArchers.find(a => a.archerId === eliminated.archerId);
      if (archer) {
        const archerResults = shichumaResults[archer.archerId] || [];
        const consecutiveHits = eliminated.consecutiveHits !== undefined 
          ? eliminated.consecutiveHits 
          : archerResults.filter(r => r === 'o').length;
        
        // rankが設定されている場合はそれを使用、なければindex+1を使用
        const rank = eliminated.rank !== undefined ? eliminated.rank : index + 1;
          
        ranking.push({
          archer,
          rank: rank,
          eliminatedAt: eliminated.arrowIndex,
          type: 'eliminated',
          consecutiveHits
        });
      }
    });
    
    // 最後まで残った選手を最上位に
    const remainingArchers = currentShootOffArchers.filter(
      archer => !eliminatedArchers.has(archer.archerId)
    );
    
    remainingArchers.forEach((archer, index) => {
      const archerResults = shichumaResults[archer.archerId] || [];
      const consecutiveHits = archerResults.filter(r => r === 'o').length;
      
      // eliminationOrderからwinnerのrankを取得
      const winnerInfo = eliminationOrder.find(e => e.archerId === archer.archerId && e.isWinner);
      const rank = winnerInfo ? winnerInfo.rank : 1; // デフォルトは1位
      
      ranking.push({
        archer,
        rank: rank,
        eliminatedAt: null,
        type: 'survivor',
        consecutiveHits
      });
    });
    
    return ranking.sort((a, b) => a.rank - b.rank);
  };

  // 修正モードに入る
  const handleEditShichumaShot = (archerId, arrowIdx) => {
    setEditingArrow({ archerId, arrowIndex: arrowIdx });
  };

  // 修正をキャンセル
  const handleCancelEditShichuma = () => {
    setEditingArrow(null);
  };

  // 修正を確定
  const handleConfirmEditShichuma = (archerId, arrowIdx, newResult) => {
    const updatedResults = { ...shichumaResults };
    const currentResults = updatedResults[archerId] || [];
    const newResults = [...currentResults];
    
    const oldResult = newResults[arrowIdx];
    newResults[arrowIdx] = newResult;
    updatedResults[archerId] = newResults;
    
    // 脱落者リストと脱落順の再計算
    const updatedEliminated = new Set();
    const updatedEliminationOrder = [];
    
    currentShootOffArchers.forEach(archer => {
      const archerResults = updatedResults[archer.archerId] || [];
      const firstMissIndex = archerResults.findIndex(r => r === 'x');
      
      if (firstMissIndex !== -1) {
        updatedEliminated.add(archer.archerId);
        const consecutiveHits = archerResults.slice(0, firstMissIndex).filter(r => r === 'o').length;
        updatedEliminationOrder.push({
          archerId: archer.archerId,
          arrowIndex: firstMissIndex + 1,
          consecutiveHits: consecutiveHits
        });
      }
    });
    
    setShichumaResults(updatedResults);
    setEliminatedArchers(updatedEliminated);
    setEliminationOrder(updatedEliminationOrder);
    setEditingArrow(null);
    
    saveShichumaResultToApi(archerId, arrowIdx, newResult).catch(error => {
      console.error('射詰競射結果修正エラー:', error);
    });
    
    console.log(`?? Shichuma Result Edited: ${archerId} arrow${arrowIdx} changed from ${oldResult} to ${newResult}`);
  };

  // 全員の記録入力が完了したかチェック
  const isAllResultsEntered = () => {
    return currentShootOffArchers.every(archer => {
      const archerResults = shichumaResults[archer.archerId] || [];
      // 退場した選手は退場した時点までの結果が入力されているかチェック
      if (eliminatedArchers.has(archer.archerId)) {
        const eliminatedInfo = eliminationOrder.find(e => e.archerId === archer.archerId);
        if (eliminatedInfo) {
          // 退場した本目までの結果がすべて入力されているかチェック
          for (let i = 0; i <= eliminatedInfo.arrowIndex - 1; i++) {
            if (archerResults[i] === undefined) return false;
          }
          return true;
        }
        return false;
      } else {
        // 生存者は現在のラウンドまでの結果が入力されているかチェック
        return Array.from({length: currentShichumaRound}, (_, i) => 
          archerResults[i] !== undefined
        ).every(result => result);
      }
    });
  };

  // 射詰競射が完了したかチェック
  const isShichumaCompleted = () => {
    // 全員の結果が入力されていない場合は完了しない
    if (!isAllResultsEntered()) return false;
    
    // 以下のいずれかの場合に完了とみなす
    return (
      eliminationOrder.length === currentShootOffArchers.length - 1 || // 全員退場済み（1名残り）
      currentShootOffArchers.every(archer => eliminatedArchers.has(archer.archerId)) || // 全員退場
      (isAllResultsEntered() && currentShootOffArchers.filter(archer => !eliminatedArchers.has(archer.archerId)).length > 0) // 4本終了で生存者あり
    );
  };

  const tiedGroups = getTiedArchers();

  // ===== getAllTiedGroups 関数を追加 =====
const getAllTiedGroups = useCallback(() => {
  const rankGroups = {};
  const awardRankLimit = tournament?.data?.awardRankLimit || 3; // サーバーから取得
  
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

  // 的中数の降順でソート
  const sortedGroups = Object.entries(rankGroups)
    .map(([hitCount, group]) => [parseInt(hitCount), group])
    .sort(([a], [b]) => b - a);
  
  // 表彰範囲内のグループのみをフィルタリング（同率は全員含む）
  const displayGroups = [];
  let currentRank = 1;
  let remainingSlots = awardRankLimit;
  
  for (const [hitCount, group] of sortedGroups) {
    const isTied = group.length > 1;
    
    if (isTied) {
      // 同率グループは表彰枠を超えても全員を表示
      displayGroups.push([hitCount, group]);
      remainingSlots -= group.length;
    } else {
      // 同率でない場合
      if (remainingSlots > 0) {
        displayGroups.push([hitCount, group]);
        remainingSlots -= group.length;
      } else {
        // 表彰枠がない場合は終了
        break;
      }
    }
    
    // 次のグループの開始順位を計算
    currentRank += group.length;
  }
  
  console.log('?? getAllTiedGroups:', {
    totalArchers: archers.length,
    awardRankLimit,
    filteredGroups: displayGroups.length,
    groups: displayGroups.map(([hits, group]) => ({
      hitCount: hits,
      count: group.length,
      isTied: group.length > 1
    }))
  });
  
  return displayGroups;
}, [archers, getTotalHitCountAllStands, tournament?.data?.awardRankLimit, selectedGender, enableGenderSeparation]);

  // ===== categorizedGroups を部門対応に修正 =====
const categorizedGroups = useMemo(() => {
  // 部門ごとの初期化
  const divisionsData = {};
  divisions.forEach(div => {
    divisionsData[div.id] = {
      division: div,
      izume: [],
      enkin: [],
      confirmed: []
    };
  });
  
  const allGroups = getAllTiedGroups();
  const awardRankLimit = tournament?.data?.awardRankLimit || 3;
  
  console.log('?? categorizedGroups processing (by division):', allGroups.length, 'groups', 'awardRankLimit:', awardRankLimit);
  
  // 各部門ごとに順位計算を行う
  divisions.forEach(div => {
    // この部門の選手のみを抽出
    const divisionArchers = archers.filter(archer => {
      if (getDivisionIdForArcher(archer, divisions) !== div.id) return false;
      if (!enableGenderSeparation) return true;
      if (selectedGender === 'all') return true;
      const g = (archer.gender || 'male');
      if (selectedGender === 'male') return g === 'male';
      if (selectedGender === 'female') return g === 'female';
      return true;
    });
    
    // 部門内での的中数でグループ化
    const divisionRankGroups = {};
    divisionArchers.forEach(archer => {
      const hitCount = getTotalHitCountAllStands(archer);
      if (!divisionRankGroups[hitCount]) {
        divisionRankGroups[hitCount] = [];
      }
      divisionRankGroups[hitCount].push(archer);
    });

    // 的中数でソートしてグループ化
    const sortedDivisionGroups = Object.entries(divisionRankGroups)
      .map(([hitCount, group]) => [parseInt(hitCount), group])
      .sort(([a], [b]) => b - a);

    // 部門内での順位計算
    let currentDivisionRank = 1;
    
    sortedDivisionGroups.forEach(([hitCount, group]) => {
      const isTied = group.length > 1;
      const isFirstPlace = currentDivisionRank === 1;
      const isInAwardRange = currentDivisionRank <= awardRankLimit;
      
      console.log(`  ${div.label} Group: ${hitCount}本, ${group.length}名, rank=${currentDivisionRank}, tied=${isTied}, inAwardRange=${isInAwardRange}`);
      
      if (isTied) {
        if (isFirstPlace) {
          console.log(`    → 射詰競射対象 (${div.label})`);
          divisionsData[div.id].izume.push({ hitCount, group, rank: currentDivisionRank });
        } else if (isInAwardRange) {
          console.log(`    → 遠近競射対象（入賞圏内） (${div.label})`);
          divisionsData[div.id].enkin.push({ hitCount, group, rank: currentDivisionRank });
        } else {
          // 表彰圏外の同率は遠近競射の対象外とし、順位確定として扱う
          console.log(`    → 表彰圏外の同率（順位確定扱い） (${div.label})`);
          divisionsData[div.id].confirmed.push({ hitCount, group, rank: currentDivisionRank });
        }
      } else {
        console.log(`    → 順位確定 (${div.label})`);
        divisionsData[div.id].confirmed.push({ hitCount, group, rank: currentDivisionRank });
      }
      
      currentDivisionRank += group.length;
    });
  });
  
  // 部門順を維持して配列に変換
  const result = [];
  divisions.forEach(div => {
    if (divisionsData[div.id] && (
      divisionsData[div.id].izume.length > 0 || 
      divisionsData[div.id].enkin.length > 0 || 
      divisionsData[div.id].confirmed.length > 0
    )) {
      result.push(divisionsData[div.id]);
    }
  });
  
  console.log('? Final result (by division):', result.map(d => ({
    division: d.division.label,
    izume: d.izume.length,
    enkin: d.enkin.length,
    confirmed: d.confirmed.length
  })));
  
  return result;
}, [archers, getTotalHitCountAllStands, tournament?.data?.awardRankLimit, divisions, getDivisionIdForArcher, selectedGender, enableGenderSeparation]);

  // 遠近競射の順位計算
  const calculateEnkinRanking = () => {
    // 開始順位を取得（射詰からの遠近競射か、手動で設定された順位か）
    const startRank = enkinTargetRank !== null ? enkinTargetRank : getNextEnkinTargetRank();
    // ... (以下は変更なし)
    
    return currentShootOffArchers.map(archer => {
      const result = enkinResults[archer.archerId] || {};
      return {
        archerId: archer.archerId,
        rank: parseInt(result.rank) || startRank + currentShootOffArchers.length - 1, // 入力された順位、なければ最下位
        arrowType: result.arrowType || 'normal',
        isTied: false
      };
    }).sort((a, b) => {
      // 順位の昇順でソート
      return a.rank - b.rank;
    });
  };

  // 遠近競射結果処理
  const handleEnkinResult = (archerId, rank, arrowType = 'normal') => {
    setEnkinResults(prev => ({
      ...prev,
      [archerId]: { rank, arrowType }
    }));
    
    // APIにはrankとして送信（distanceの代わり）
    saveEnkinResultToApi(archerId, rank, arrowType).catch(error => {
      console.error('遠近競射結果保存エラー:', error);
      alert('遠近競射結果の保存に失敗しました: ' + error.message);
    });
  };

  // 遠近競射タイトル取得
  const getEnkinTitle = () => {
    if (enkinTargetRank !== null) {
      // 射詰競射からの遠近競射の場合
      // 表彰範囲外かチェック
      const awardRankLimit = tournament?.data?.awardRankLimit || 3;
      const willHaveDefeated = (enkinTargetRank + currentShootOffArchers.length - 1) > awardRankLimit;
      
      if (willHaveDefeated) {
        // 敗退者を含む場合（表彰範囲外）→ 単一順位表示
        return `${enkinTargetRank}位決定戦（遠近競射）`;
      } else if (currentShootOffArchers.length > 1) {
        // 表彰範囲内で複数名の場合 → 範囲表示
        const endRank = enkinTargetRank + currentShootOffArchers.length - 1;
        return `${enkinTargetRank}位～${endRank}位決定戦（遠近競射）`;
      } else {
        // 1名の場合 → 単一順位表示
        return `${enkinTargetRank}位決定戦（遠近競射）`;
      }
    }
    return '遠近競射';
  };

  // 遠近競射の選択肢生成ロジック修正
  // 射詰競射からの遠近競射の場合、enkinStartRankを使う必要がある
  const getEnkinRankOptions = () => {
    const startRank = enkinTargetRank !== null ? enkinTargetRank : enkinStartRank;
    const awardRankLimit = tournament?.data?.awardRankLimit || 3;
    const options = [];
    
    console.log('?? getEnkinRankOptions:', {
      startRank,
      awardRankLimit,
      enkinTargetRank,
      currentShootOffArchers: currentShootOffArchers.length
    });
    
    // 射詰競射からの遠近競射の場合
    if (enkinTargetRank !== null) {
      const endRank = startRank + currentShootOffArchers.length - 1;
      
      if (endRank <= awardRankLimit) {
        // 全員が表彰範囲内の場合：連続した順位を生成
        for (let i = 0; i < currentShootOffArchers.length; i++) {
          options.push(startRank + i);
        }
      } else if (startRank <= awardRankLimit) {
        // 開始順位は表彰範囲内だが、終了順位は表彰範囲外の場合
        // 表彰範囲内の最後の順位まで生成し、残りは敗退
        for (let i = startRank; i <= awardRankLimit; i++) {
          options.push(i);
        }
        // 表彰範囲外の選手にも順位を生成（表彰枠外の同率グループ対応）
        for (let i = awardRankLimit + 1; i <= endRank; i++) {
          options.push(i);
        }
      } else {
        // 開始順位が表彰範囲外の場合：連続した順位を全員生成
        for (let i = 0; i < currentShootOffArchers.length; i++) {
          options.push(startRank + i);
        }
      }
    } else {
      // 通常の遠近競射の場合はその枠に合わせて連続した順位を生成
      const endRank = startRank + currentShootOffArchers.length - 1;
      if (endRank <= awardRankLimit) {
        // 全員が表彰範囲内：連続した順位を生成
        for (let i = 0; i < currentShootOffArchers.length; i++) {
          options.push(startRank + i);
        }
      } else {
        // 表彰範囲を超える場合：表彰範囲内まで生成
        for (let i = startRank; i <= awardRankLimit; i++) {
          options.push(i);
        }
        // 表彰範囲外の選手にも順位を生成
        for (let i = awardRankLimit + 1; i <= endRank; i++) {
          options.push(i);
        }
      }
    }
    
    console.log('?? Generated options:', options);
    return options;
  };

  // 敗退状態を切り替える関数
  const toggleEnkinDefeated = (archerId) => {
    setEnkinDefeated(prev => {
      const newSet = new Set(prev);
      if (newSet.has(archerId)) {
        newSet.delete(archerId);
      } else {
        newSet.add(archerId);
      }
      return newSet;
    });
  };

  // 次の遠近競射対象順位を取得
  const getNextEnkinTargetRank = () => {
    console.log('?? getNextEnkinTargetRank - eliminationOrder:', eliminationOrder.map(e => ({ name: e.name, rank: e.rank })));
    
    if (eliminationOrder.length > 0) {
      // 射詰競射で確定した順位を除いた、次の空き順位を計算
      const usedRanks = new Set();
      const enkinCandidates = new Set();
      
      // eliminationOrderから設定済みのrankを収集
      eliminationOrder.forEach(e => {
        if (e.rank !== undefined && e.rank !== null) {
          usedRanks.add(e.rank);
          
          // 同じrankを持つ選手が複数いる場合、そのrankは遠近競射対象
          const sameRankCount = eliminationOrder.filter(other => other.rank === e.rank).length;
          if (sameRankCount > 1) {
            enkinCandidates.add(e.rank);
          }
        }
      });
      
      console.log('?? usedRanks:', Array.from(usedRanks));
      console.log('?? enkinCandidates:', Array.from(enkinCandidates));
      
      // 遠近競射対象のrankがある場合、そのrankを返す
      if (enkinCandidates.size > 0) {
        const targetRank = Math.min(...Array.from(enkinCandidates));
        console.log('?? getNextEnkinTargetRank: 遠近競射対象のrankを返す:', targetRank);
        return targetRank;
      }
      
      // 1位から順に空き順位を探す
      let nextRank = 1;
      while (usedRanks.has(nextRank)) {
        nextRank++;
      }
      
      console.log('?? getNextEnkinTargetRank:', {
        eliminationOrder: eliminationOrder.map(e => ({ name: e.name, rank: e.rank })),
        usedRanks: Array.from(usedRanks),
        nextRank: nextRank
      });
      
      return nextRank;
    }
    console.log('?? getNextEnkinTargetRank: eliminationOrderが空なのでデフォルトの2を返す');
    return 2; // デフォルトは2位から
  };

  // 遠近競射オプションキャンセル
  const handleCancelEnkinOption = () => {
    setShowEnkinOption(false);
    setRemainingAfterFourArrows([]);
  };

  // 射詰競射の最終結果をAPIに保存する関数
  const saveFinalShichumaResults = async (finalRanking, allResults) => {
    if (isSavingShichuma) return; // 二重実行防止
    
    console.log('?? saveFinalShichumaResults called with:', {
      finalRanking: finalRanking,
      allResults: allResults
    });
    
    setIsSavingShichuma(true);
    try {
      const shichumaFinalData = finalRanking.map(rankInfo => {
        // 選手の部門IDを取得
        const archer = currentShootOffArchers.find(a => a.archerId === rankInfo.archerId);
        const divisionId = archer ? getDivisionIdForArcher(archer, divisions) : 'unassigned';
        
        return {
          archerId: rankInfo.archerId,
          rank: rankInfo.rank,
          eliminatedAt: rankInfo.eliminatedAt,
          consecutiveHits: rankInfo.consecutiveHits,
          results: allResults[rankInfo.archerId] || [],
          isWinner: rankInfo.isWinner || false,
          shootOffType: 'shichuma',
          divisionId: divisionId // ← 追加
        };
      });
      
      console.log('?? shichumaFinalData to save:', shichumaFinalData);
      console.log('?? 保存する各選手のshootOffType:', shichumaFinalData.map(d => ({
        archerId: d.archerId,
        rank: d.rank,
        shootOffType: d.shootOffType,
        isWinner: d.isWinner,
        divisionId: d.divisionId
      })));


      const response = await fetch(`${API_URL}/ranking/shichuma/final`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: selectedTournamentId,
          shootOffType: 'shichuma',
          results: shichumaFinalData
        })
      });
      
      if (!response.ok) {
        throw new Error('API保存に失敗しました');
      }
      
      const result = await response.json();
      console.log('射詰競射結果をサーバーに保存しました:', result);
      
      // 即座にローカル状態を更新（遠近競射と同じパターン）
      setShichumaFinalResults(prev => {
        // 既存の射詰競射結果を保持
        const existingShichumaResults = prev?.results || [];
        
        console.log('?? 既存射詰結果:', existingShichumaResults.map(r => ({ 
          archerId: r.archerId, 
          rank: r.rank,
          divisionId: r.divisionId
        })));
        console.log('?? 新規射詰結果:', shichumaFinalData.map(r => ({ 
          archerId: r.archerId, 
          rank: r.rank,
          divisionId: r.divisionId
        })));
        
        // 同じdivisionIdの結果を上書き（他部門は保持）
        const filteredResults = existingShichumaResults.filter(r => {
          // 今回保存する選手と同じdivisionIdかチェック
          const sameDivision = shichumaFinalData.some(s => s.divisionId === r.divisionId);
          
          // 同じ部門の場合は除外（上書き）
          if (sameDivision) {
            return false;
          }
          // 異なる部門の結果は保持
          return true;
        });
        
        // 新しい結果を追加
        const mergedResults = [...filteredResults, ...shichumaFinalData];
        
        console.log('?? 統合後射詰結果:', mergedResults.map(r => ({ 
          archerId: r.archerId, 
          rank: r.rank,
          divisionId: r.divisionId
        })));
        
        return {
          completedAt: new Date().toISOString(),
          results: mergedResults
        };
      });
      
      // ユーザーに通知
      alert('射詰競射の結果を保存しました');
      
    } catch (error) {
      console.error('射詰競射結果保存エラー:', error);
      alert('射詰競射結果の保存に失敗しました: ' + error.message);
    } finally {
      setIsSavingShichuma(false);
    }
  };

  // 遠近競射完了時に最終順位を保存する関数（各枠ごとに保存）
  const saveFinalEnkinResults = async (finalRanking, targetRank = null) => {
    try {
      const enkinFinalData = finalRanking.map(rankInfo => {
        // 選手の部門IDを取得
        const archer = currentShootOffArchers.find(a => a.archerId === rankInfo.archerId);
        const divisionId = archer ? getDivisionIdForArcher(archer, divisions) : 'unassigned';
        
        return {
          archerId: rankInfo.archerId,
          rank: rankInfo.rank,
          arrowType: rankInfo.arrowType || 'normal',
          isDefeated: enkinDefeated.has(rankInfo.archerId),
          targetRank: targetRank,
          divisionId: divisionId // ← 追加
        };
      });
      
      console.log('?? 保存する遠近競射データ:', {
        targetRank,
        enkinFinalData: enkinFinalData.map(d => ({
          archerId: d.archerId,
          name: currentShootOffArchers.find(a => a.archerId === d.archerId)?.name,
          rank: d.rank,
          targetRank: d.targetRank
        }))
      });

      const response = await fetch(`${API_URL}/ranking/enkin/final`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: selectedTournamentId,
          shootOffType: 'enkin',
          targetRank: targetRank,
          results: enkinFinalData
        })
      });
      
      if (!response.ok) {
        throw new Error('API保存に失敗しました');
      }
      
      const result = await response.json();
      console.log('? 遠近競射結果をサーバーに保存しました:', result);
      console.log('?? サーバーから返ってきたデータ:', result.data);
      
      // 保存成功後にその枠を保存済みとして記録
      if (targetRank) {
        setSavedEnkinRanks(prev => new Set([...prev, targetRank]));
      }
      
      // 即座にローカル状態を更新（射詰競射の結果を保持）
      setEnkinFinalResults(prev => {
        // 既存の遠近競射結果を保持
        const existingEnkinResults = prev?.results || [];
        
        // 射詰→遠近の選手を特定（過去に射詰→遠近として保存されたすべての選手）
        const shichumaToEnkinArcherIds = new Set();
        if (shichumaFinalResults?.results) {
          // 射詰結果に存在し、かつ遠近結果にも存在する選手を射詰→遠近と判定
          shichumaFinalResults.results.forEach(sr => {
            const existsInEnkin = existingEnkinResults.some(er => er.archerId === sr.archerId);
            if (existsInEnkin) {
              shichumaToEnkinArcherIds.add(sr.archerId);
            }
          });
        }
        
        console.log('?? 射詰→遠近選手ID:', Array.from(shichumaToEnkinArcherIds));
        console.log('?? 現在保存データ:', enkinFinalData.map(d => ({ id: d.archerId, rank: d.rank })));
        
        // 同じtargetRankとdivisionIdの組み合わせの結果を上書き（上書き保存を許可）
        // ただし、射詰→遠近の選手は保持する（他のtargetRankで保存されている可能性があるため）
        const filteredResults = existingEnkinResults.filter(r => {
          // 今回保存する選手と同じdivisionIdかチェック
          const sameDivision = enkinFinalData.some(e => e.divisionId === r.divisionId);
          
          // 射詰→遠近の選手でない場合は、同じdivisionIdかつ同じtargetRankなら除外（上書き）
          if (!shichumaToEnkinArcherIds.has(r.archerId) && sameDivision) {
            return r.targetRank !== targetRank;
          }
          // 射詰→遠近の選手の場合は、今回保存する選手以外は保持
          return !enkinFinalData.some(e => e.archerId === r.archerId);
        });
        
        console.log('?? filteredResults (targetRankで除外後):', filteredResults.map(r => ({
          archerId: r.archerId,
          rank: r.rank,
          targetRank: r.targetRank
        })));
        
        // 新しい結果を追加
        const mergedResults = [...filteredResults, ...enkinFinalData];
        
        console.log('? mergedResults (新しい結果追加後):', mergedResults.map(r => ({
          archerId: r.archerId,
          rank: r.rank,
          targetRank: r.targetRank
        })));
        
        return {
          completedAt: prev?.completedAt || new Date().toISOString(),
          results: mergedResults
        };
      });
      
      // ユーザーに通知
      alert(`${targetRank ? `${targetRank}位決定戦` : '遠近競射'}の結果を保存しました`);
      
      // 即時反映：他端末でもすぐ見れるように
      await fetchShootOffResults();
      console.log('? ローカル状態更新完了 - fetchShootOffResultsは実行');
      
    } catch (error) {
      console.error('遠近競射結果保存エラー:', error);
      alert('遠近競射結果の保存に失敗しました: ' + error.message);
    }
  };

  // === 統合結果を作成する関数（射詰のすべてのシナリオに対応） ===
  const getMergedFinalResults = useCallback(() => {
    const mergedResults = [];
    // processedArchersを削除 - 部門ごとに独立して管理するため

    console.log('?? 統合結果作成開始（射詰全対応）');
    console.log('?? 入力データ:', {
      shichumaResults: shichumaFinalResults?.results?.length || 0,
      enkinResults: enkinFinalResults?.results?.length || 0,
      archersCount: archers.length
    });

    // 射詰結果の詳細をログ
    if (shichumaFinalResults?.results) {
      console.log('?? 射詰結果詳細:');
      shichumaFinalResults.results.forEach(result => {
        const archer = archers.find(a => a.archerId === result.archerId);
        const divisionId = archer ? getDivisionIdForArcher(archer, divisions) : '不明';
        console.log(`  ${result.archerId}: ${archer?.name || '不明'} -> 部門: ${divisionId}, 順位: ${result.rank}`);
      });
    }

    // 選手を部門ごとにグループ化
    const archersByDivision = {};
    archers.forEach(archer => {
      const divisionId = getDivisionIdForArcher(archer, divisions);
      if (!archersByDivision[divisionId]) {
        archersByDivision[divisionId] = [];
      }
      archersByDivision[divisionId].push(archer);
    });

    // 部門ごとに結果を処理
    Object.keys(archersByDivision).forEach(divisionId => {
      const divisionArchers = archersByDivision[divisionId];
      const divisionUsedRanks = new Set(); // 部門ごとの順位管理
      const divisionProcessedArchers = new Set(); // 部門ごとの選手管理
      
      console.log(`??? 部門 ${divisionId} の結果処理開始 (${divisionArchers.length}名)`);
      console.log(`?? 部門 ${divisionId} の選手:`, divisionArchers.map(a => ({ name: a.name, id: a.archerId })));

      // 遠近競射の結果を後から処理（射詰で決定していない選手のみ）
      if (enkinFinalResults && enkinFinalResults.results) {
        const divisionEnkinResults = enkinFinalResults.results.filter(result => {
          // 部門IDが保存されている場合はそれを優先
          if (result.divisionId) {
            return result.divisionId === divisionId;
          }
          // 部門IDがない場合は従来通りarcherIdで照合（後方互換性）
          return divisionArchers.some(archer => archer.archerId === result.archerId);
        });
        
        console.log(`  遠近競射結果: ${divisionEnkinResults.length}件`);
        console.log(`  ?? 部門 ${divisionId} の遠近競射選手:`, divisionEnkinResults.map(r => ({ 
          name: divisionArchers.find(a => a.archerId === r.archerId)?.name, 
          rank: r.rank 
        })));
        
        // 射詰競射の結果を先に処理（この部門の選手のみ）
        if (shichumaFinalResults && shichumaFinalResults.results) {
          const divisionShichumaResults = shichumaFinalResults.results.filter(result => {
            // 部門IDが保存されている場合はそれを優先
            if (result.divisionId) {
              return result.divisionId === divisionId;
            }
            // 部門IDがない場合は従来通りarcherIdで照合（後方互換性）
            return divisionArchers.some(archer => archer.archerId === result.archerId);
          });
          
          console.log(`  ?? 射詰競射結果: ${divisionShichumaResults.length}件`);
          console.log(`  ?? 部門 ${divisionId} の射詰競射選手:`, divisionShichumaResults.map(r => ({ 
            name: divisionArchers.find(a => a.archerId === r.archerId)?.name, 
            rank: r.rank 
          })));
          console.log(`  ?? 射詰結果詳細:`, divisionShichumaResults.map(r => ({
            name: divisionArchers.find(a => a.archerId === r.archerId)?.name,
            rank: r.rank,
            shootOffType: r.shootOffType,
            isWinner: r.isWinner
          })));
          
          divisionShichumaResults
            .sort((a, b) => a.rank - b.rank)
            .forEach(result => {
              const archer = divisionArchers.find(a => a.archerId === result.archerId);
              if (!archer) return;

              const finalRank = result.rank;
              
              // 射詰→遠近の選手かチェック（この部門内でのみチェック）
              const isFromShichumaToEnkin = divisionEnkinResults.some(e => e.archerId === result.archerId);
              console.log(`    ?? 射詰→遠近チェック: ${archer.name} -> ${isFromShichumaToEnkin ? '遠近あり' : '遠近なし'}`);
              
              // 射詰→遠近の選手はスキップ（遠近の結果を優先）
              if (isFromShichumaToEnkin) {
                console.log(`    スキップ: ${archer.name} (射詰→遠近で遠近の結果を優先)`);
                return;
              }
              
              // 重複チェック（選手IDと順位の両方をチェック）
              if (divisionProcessedArchers.has(result.archerId)) {
                console.warn(`    選手重複: ${archer.name} (ID: ${result.archerId}) - 射詰競射`);
                return; // 同じ選手はスキップ
              }
              
              // 射詰で確定した順位（1位など）は遠近競射の結果があっても射詰を優先
              if (divisionUsedRanks.has(finalRank)) {
                console.warn(`    ?? 順位重複: ${finalRank}位 (${archer.name}) - 射詰競射`);
                // 1位など射詰で確定した重要な順位は射詰を優先
                if (finalRank === 1 || result.isWinner) {
                  console.log(`    優先: ${archer.name} (射詰で${finalRank}位を確定)`);
                } else {
                  // 射詰で同順位の場合は両方とも表示（例：2人が2位）
                  console.log(`    同順位許可: ${archer.name} (射詰で${finalRank}位)`);
                }
              }

              console.log(`    射詰結果追加: ${archer.name} → ${finalRank}位`);

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
            // すでに射詰で決定済みの選手はスキップ
            if (divisionProcessedArchers.has(enkinResult.archerId)) {
              console.log(`    スキップ: ${enkinResult.archerId} (射詰で決定済み)`);
              return;
            }
            
            const archer = divisionArchers.find(a => a.archerId === enkinResult.archerId);
            if (!archer) return;

            // 敗退者はスキップ
            if (enkinResult.rank === '敗退' || enkinResult.isDefeated) {
              console.log(`    スキップ: ${archer.name} (敗退)`);
              return;
            }

            const finalRank = parseInt(enkinResult.rank);
            
            // 重複チェック
            if (divisionUsedRanks.has(finalRank)) {
              console.warn(`    ?? 順位重複: ${finalRank}位 (${archer.name}) - 遠近競射`);
              return;
            }

            console.log(`    遠近結果追加: ${archer.name} → ${finalRank}位`);

            // 射詰→遠近の選手かチェック
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

    // 的中数で順位が確定している選手を追加
    if (categorizedGroups && categorizedGroups.length > 0) {
      categorizedGroups.forEach(divisionData => {
        if (divisionData.confirmed && divisionData.confirmed.length > 0) {
          divisionData.confirmed.forEach(({ hitCount, group, rank }) => {
            group.forEach(archer => {
              // 部門ごとの順位管理のため、グローバルなprocessedArchersチェックは削除
              // 的中数で確定した順位はそのまま使用（調整なし）
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

    // 4. 最終ソート
    const sorted = mergedResults.sort((a, b) => {
      const aRank = typeof a.rank === 'number' ? a.rank : 9999;
      const bRank = typeof b.rank === 'number' ? b.rank : 9999;
      return aRank - bRank;
    });
    
    console.log('? 統合結果完成:', sorted.length, '件');
    sorted.forEach(result => {
      console.log(`  ${result.rank}位: ${result.name} (${result.rank_source})`);
    });
    
    return sorted.length > 0 ? sorted : null;
  }, [shichumaFinalResults, enkinFinalResults, archers, categorizedGroups]);

  // === 性別ごとの統合結果を作成する関数 ===
  const getMergedFinalResultsForGender = useCallback((gender) => {
    const mergedResults = [];
    const filteredArchers = archers.filter(a => (a.gender || 'male') === gender);

    // 選手を部門ごとにグループ化（性別でフィルタ済み）
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

      // 遠近競射の結果（この性別の選手のみ）
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

    // 的中数で順位が確定している選手を追加（categorizedGroups内の該当性別選手のみ）
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

  // 最終順位表を完全削除（射詰・遠近の全結果をサーバーから削除 + ローカルストレージ削除）
  const deleteFinalResults = async () => {
    if (!selectedTournamentId) {
      alert('大会が選択されていません');
      return;
    }
    const confirmed = window.confirm('🗑️ 最終順位表のすべての記録を完全削除しますか？\n\nこの操作は以下をすべて削除します：\n• 射詰の結果\n• 遠近競射の結果\n• 選手の記録フィールド\n\n元に戻すことはできません。本当に実行しますか？');
    if (!confirmed) return;

    try {
      console.log('\n🗑️🗑️🗑️ 最終順位表削除開始 🗑️🗑️🗑️');
      console.log(`  対象大会: ${selectedTournamentId}`);
      console.log(`\n【削除前の詳細データ確認】`);
      console.log(`  shichumaFinalResults:`, shichumaFinalResults);
      console.log(`  enkinFinalResults:`, enkinFinalResults);
      
      // archers から該当者の results フィールドを確認
      console.log(`\n【Archers の results フィールド確認】`);
      archers.forEach(archer => {
        const hitCount = archer.results ? Object.values(archer.results).flat().filter(r => r === 'o').length : 0;
        if (hitCount > 0) {
          console.log(`  ${archer.name}: ${hitCount}本的中`, archer.results);
        }
      });

      // サーバー側データ削除
      const urls = [
        { url: `${API_URL}/ranking/shichuma/${selectedTournamentId}`, method: 'DELETE', name: 'Shichuma' },
        { url: `${API_URL}/ranking/enkin/${selectedTournamentId}`, method: 'DELETE', name: 'Enkin' },
        { url: `${API_URL}/ranking/clear/${selectedTournamentId}`, method: 'POST', name: 'Clear' } // 選手フィールドクリア
      ];

      console.log(`  実行するエンドポイント:`);
      urls.forEach(u => console.log(`    - ${u.name}: ${u.method} ${u.url}`));

      const responses = await Promise.all(
        urls.map(req => 
          fetch(req.url, { method: req.method, headers: { 'Content-Type': 'application/json' } })
            .then(r => r.json().then(data => ({ 
              name: req.name,
              url: req.url, 
              ok: r.ok, 
              status: r.status,
              data: data
            })))
            .catch(err => ({ 
              name: req.name,
              url: req.url, 
              ok: false, 
              err,
              status: 0
            }))
        )
      );

      // 結果をログ出力
      console.log(`\n  📋 サーバーレスポンス:`);
      responses.forEach(r => {
        const status = r.status === 404 ? '✅ 404(データなし)' : (r.ok ? '✅ OK' : `❌ Error(${r.status})`);
        console.log(`    ${r.name}: ${status}`);
        if (r.data && r.data.stats) {
          console.log(`      ${JSON.stringify(r.data.stats)}`);
        }
      });

      const allOk = responses.every(r => r.ok || r.status === 404); // 404はデータなしで成功扱い

      if (allOk) {
        console.log(`\n  ✅ サーバー側削除成功！React状態をクリア中...`);
        
        // React 状態をクリア
        setShichumaFinalResults(null);
        setEnkinFinalResults(null);
        setShichumaResults({});
        setEnkinResults({});
        setEliminatedArchers(new Set());
        setEliminationOrder([]);
        setEliminationRound({});
        setSimultaneousEliminations([]);
        setCurrentShootOffArchers([]);
        setOriginalEnkinArchers(new Set());
        setSavedEnkinRanks(new Set());
        setEnkinTargetRank(null);
        setShootOffType('');
        setCurrentShichumaRound(1);
        setShowEnkinOption(false);
        setEnkinStartRank(2);
        setIsShootOffActive(false);
        setIsSavingShichuma(false);
        setIsLoadingResults(false);
        setEnkinDefeated(new Set());
        setRemainingAfterFourArrows([]);
        setEditingArrow(null);

        // ローカルストレージもクリア
        localStorage.removeItem('ranking_selectedGender');
        console.log(`  ✅ localStorage をクリア`);

        // 削除後の詳細確認ログ
        console.log(`\n【削除直後の状態確認】`);
        console.log(`  setShichumaFinalResults -> null (クリア予定)`);
        console.log(`  setEnkinFinalResults -> null (クリア予定)`);


        // 削除完了を確認するため少し待機してから再取得
        console.log(`  ⏳ 1秒待機中...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 最新データを再取得（削除後のサーバーデータを確実に反映）
        console.log(`  🔄 最新データを再取得中...`);
        await fetchArchers(true);
        await fetchShootOffResults();
        
        // 再取得後の状態確認
        console.log(`\n【再取得後のデータ状態確認】`);
        console.log(`  再取得後の shichumaFinalResults:`, shichumaFinalResults);
        console.log(`  再取得後の enkinFinalResults:`, enkinFinalResults);
        console.log(`\n【Archers の results フィールド再確認】`);
        archers.forEach(archer => {
          const hitCount = archer.results ? Object.values(archer.results).flat().filter(r => r === 'o').length : 0;
          if (hitCount > 0) {
            console.log(`  ${archer.name}: ${hitCount}本的中 (残存状態!)`, archer.results);
          }
        });
        

        console.log(`✅✅✅ 最終順位表完全削除完了 ✅✅✅\n`);
        alert('✅ 最終順位表をすべて削除しました。\n\nページをリロードして確認します。');
        
        // ページをリロードして確実に反映
        setTimeout(() => window.location.reload(), 500);
      } else {
        const failed = responses.filter(r => !r.ok && r.status !== 404);
        console.error('❌ 削除に失敗しました', failed);
        alert('❌ サーバー削除に失敗しました。コンソールを確認してください。');
      }
    } catch (e) {
      console.error('❌ 最終順位表削除エラー', e);
      alert('削除処理中にエラーが発生しました。');
    }
  };

  // === 統合結果の表示 ===
  const renderMergedResults = () => {
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
          <p className="text-gray-500 text-center py-4">順位決定戦の結果がありません</p>
        </div>
      );
    }

    // 部門ごとに結果を分類
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

    // 部門順を維持して配列に変換
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

    // 選択した部門でフィルタリング（部門＋性別を考慮）
    let displayResults;
    if (selectedDivision === '') {
      // 全部門表示：性別フィルタが有効なら該当性別のみ表示
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
          <p className="text-gray-500 text-center py-4">
            {selectedDivision === '' ? '順位決定戦の結果がありません' : 'この部門の順位決定戦の結果がありません'}
          </p>
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
                  <tr className="bg-green-100">
                    <th className="border border-green-300 px-4 py-2 text-left">順位</th>
                    <th className="border border-green-300 px-4 py-2 text-left">氏名</th>
                    <th className="border border-green-300 px-4 py-2 text-left">所属</th>
                    <th className="border border-green-300 px-4 py-2 text-left">部門</th>
                    <th className="border border-green-300 px-4 py-2 text-center">決定方法</th>
                    <th className="border border-green-300 px-4 py-2 text-center">詳細</th>
                  </tr>
                </thead>
                <tbody>
                  {divisionData.results.map((result, index) => {
                    const archer = archers.find(a => a.archerId === result.archerId);
                    return (
                      <tr key={`${result.archerId}-${result.shootOffType || 'unknown'}`} className={`hover:bg-green-50 ${
                        result.isDefeated ? 'bg-red-50' : ''
                      }`}>
                        <td className="border border-green-300 px-4 py-2 font-bold">
                          {typeof result.rank === 'string' && result.rank === '敗退' ? (
                            <span className="text-red-700">敗退</span>
                          ) : (
                            <span className="text-green-900">{result.rank}位</span>
                          )}
                        </td>
                        <td className="border border-green-300 px-4 py-2 font-semibold">
                          {result.name}
                        </td>
                        <td className="border border-green-300 px-4 py-2 text-gray-600">
                          {result.affiliation}
                        </td>
                        <td className="border border-green-300 px-4 py-2 text-gray-600">
                          {archer?.rank || '-'}
                        </td>
                        <td className="border border-green-300 px-4 py-2 text-center">
                            {(() => {
                              // 個別の選手のshootOffTypeを優先して表示
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
                          <div>
                            {(() => {
                              // 射詰競射だけで全順位が決定したかチェック
                              //（遠近競射を使わずに射詰の結果のみで順位が確定した場合）
                              const hasEnkinResults = divisionData.results.some(r => r.shootOffType === 'enkin');
                              const hasShichumaResults = divisionData.results.some(r => r.shootOffType === 'shichuma');
                              const allDeterminedByShootOff = divisionData.results.every(r => 
                                r.shootOffType === 'shichuma' || r.shootOffType === 'enkin'
                              );
                              
                              if (hasShichumaResults && !hasEnkinResults && allDeterminedByShootOff) {
                                // 射詰だけで全順位が決定された場合の表記
                                if (result.isWinner) {
                                  return <span className="text-yellow-700 font-bold">?? 優勝</span>;
                                } else {
                                  return <span className="text-blue-700 font-bold">射詰{result.rank}位</span>;
                                }
                              } else {
                                // 通常の射詰表記
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
                          </div>
                        )}
                        {result.shootOffType === 'enkin' && (
                          <div>
                            <span className="text-orange-700">
                              {(() => {
                                // enkinFinalResultsから同じtargetRankの選手を取得
                                const sameTargetRankResults = enkinFinalResults?.results?.filter(r => r.targetRank === result.targetRank) || [];
                                const groupSize = sameTargetRankResults.length;
                                
                                // 表彰範囲外かチェック（タイトル表示と同じロジック）
                                const awardRankLimit = tournament?.data?.awardRankLimit || 3;
                                const willHaveDefeated = (result.targetRank + groupSize - 1) > awardRankLimit;
                                
                                // 射射詰→遠近の選手がいるかチェック
                                const hasShichumaToEnkin = sameTargetRankResults.some(r => 
                                  shichumaFinalResults?.results?.some(s => s.archerId === r.archerId)
                                );
                                
                                if (willHaveDefeated) {
                                  // 敗退者を含む場合（表彰範囲外）→ 単一順位表示
                                  return `${result.targetRank}位決定戦`;
                                } else if (hasShichumaToEnkin && groupSize > 1) {
                                  // 射射詰→遠近で複数名の場合（表彰範囲内）→ 範囲表示
                                  const endRank = result.targetRank + groupSize - 1;
                                  return `${result.targetRank}位～${endRank}位決定戦`;
                                } else if (groupSize > 1) {
                                  // 通常の複数名の場合（表彰範囲内）→ 範囲表示
                                  const endRank = result.targetRank + groupSize - 1;
                                  return `${result.targetRank}位～${endRank}位決定戦`;
                                } else {
                                  // 1名の場合 → 単一順位表示
                                  return `${result.targetRank}位決定戦`;
                                }
                               })()}
                            </span>
                            <span className="text-gray-600 ml-1">→{result.rank}位</span>
                          </div>
                        )}
                        {result.rank_source === 'confirmed' && (
                          <div>
                            <span className="text-green-700">{result.hitCount}本的中</span>
                          </div>
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
  };

  return (
    <div className="view-container">
      <div className="view-header">
        {/* ... */}
        <div className="flex items-center gap-2">
          <h1>順位決定戦</h1>
          {isSyncing && (
            <span className="text-sm text-blue-600 flex items-center gap-1">
              <RefreshCw size={14} className="animate-spin" />
              同期中
            </span>
          )}
          <button onClick={deleteFinalResults} className="btn" style={{ marginLeft: '0.5rem', backgroundColor: '#ef4444', color: '#fff' }}>
            最終順位表を完全削除
          </button>
        </div>
      </div>
      <div className="view-content">
        {!selectedTournamentId ? (
          <div className="card">大会を選択してください</div>
        ) : isLoading ? (
          <div className="card">読み込み中...</div>
        ) : (
          <>
            {/* === 部門選択 === */}
            <div className="card">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>部門を選択</label>
              <div className="button-group">
                <button 
                  onClick={() => setSelectedDivision('')}
                  className={`btn ${selectedDivision === '' ? 'btn-active' : ''}`}
                  style={{ flex: 1 }}
                >
                  全部門
                </button>
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

              <p className="hint" style={{ marginTop: '0.5rem' }}>
                {selectedDivision === '' 
                  ? `全部門の選手: ${enableGenderSeparation && selectedGender !== 'all' ? archers.filter(a => (a.gender || 'male') === selectedGender).length : archers.length}人`
                  : `${divisions.find(d => d.id === selectedDivision)?.label || selectedDivision}: ${archers.filter(a => getDivisionIdForArcher(a, divisions) === selectedDivision && ( !enableGenderSeparation || selectedGender === 'all' || (a.gender || 'male') === selectedGender )).length}人`
                }
              </p>
            </div>

            {/* === 部門ごとの順位決定戦表示 === */}
            {(selectedDivision === '' ? categorizedGroups : categorizedGroups.filter(d => d.division.id === selectedDivision)).map(divisionData => (
              <div key={divisionData.division.id} className="space-y-4">
                {/* 部門タイトル */}
                <div className="card border-l-4 border-purple-500">
                  <h2 className="card-title text-purple-700">?? {divisionData.division.label}</h2>
                </div>
                {/* === 1. 射詰競射（優勝決定戦）の表示エリア === */}
                {divisionData.izume.length > 0 && (
                  <div className="card border-l-4 border-blue-500">
                    <h3 className="card-title text-blue-700">?? 射詰競射 対象（優勝決定）</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      1位が同率のため、射詰競射を行います。
                    </p>
                    {divisionData.izume.map(({ hitCount, group, rank }) => (
                      <div key={`${divisionData.division.id}_${rank}_izume`} className="mb-4 bg-blue-50 p-3 rounded">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold">{hitCount}本的中 - {group.length}名</span>
                          <button 
                            onClick={() => startShichumaShootOff(group)}
                            className="btn-primary"
                          >
                            射詰競射を開始
                          </button>
                        </div>
                        <div className="space-y-1 bg-white p-2 rounded border">
                          {group.map(archer => (
                            <div key={archer.archerId} className="flex justify-between text-sm">
                              <span>{archer.name} ({archer.affiliation})</span>
                              <span>{archer.rank}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* === 2. 遠近競射（順位決定）の表示エリア === */}
                {divisionData.enkin.length > 0 && (
                  <div className="card border-l-4 border-orange-500">
                    <h3 className="card-title text-orange-700">?? 遠近競射 対象（順位決定）</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      入賞圏内で同順位がいるため、遠近競射を行います。
                    </p>
                    {divisionData.enkin.map(({ hitCount, group, rank }) => (
                      <div key={`${divisionData.division.id}_${rank}_enkin`} className="mb-4 bg-orange-50 p-3 rounded">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold">
                            {(() => {
                              // 敗退者がいるかチェック（group内に射詰から来た選手がいるか）
                              const hasShichumaToEnkin = group.some(archer => 
                                shichumaFinalResults?.results?.some(r => r.archerId === archer.archerId)
                              );
                              
                              // 敗退者を含むかチェック（表彰範囲外になる可能性）
                              const awardRankLimit = tournament?.data?.awardRankLimit || 3;
                              const willHaveDefeated = (rank + group.length - 1) > awardRankLimit;
                              
                              if (willHaveDefeated) {
                                // 敗退者を含む場合（表彰範囲外）→ 単一順位表示
                                return `${rank}位決定戦 - ${group.length}名`;
                              } else if (hasShichumaToEnkin && group.length > 1) {
                                // 射射詰→遠近で複数名の場合（表彰範囲内）→ 範囲表示
                                return `${rank}位～${rank + group.length - 1}位決定戦 - ${group.length}名`;
                              } else if (group.length > 1) {
                                // 通常の複数名の場合（表彰範囲内）→ 範囲表示
                                return `${rank}位～${rank + group.length - 1}位決定戦 - ${group.length}名`;
                              } else {
                                // 1名の場合 → 単一順位表示
                                return `${rank}位決定戦 - ${group.length}名`;
                              }
                            })()}
                          </span>
                          <button 
                            onClick={() => startEnkinShootOff(group, false, rank)}
                            className="btn-primary bg-orange-600 hover:bg-orange-700"
                          >
                            遠近競射を開始
                          </button>
                        </div>
                        <div className="space-y-1 bg-white p-2 rounded border">
                          {group.map(archer => (
                            <div key={archer.archerId} className="flex justify-between text-sm">
                              <span>{archer.name} ({archer.affiliation})</span>
                              <span>{archer.rank}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* === 3. 順位確定者の表示エリア === */}
                {divisionData.confirmed.length > 0 && (
                  <div className="card border-l-4 border-green-500">
                    <h3 className="card-title text-green-700">? 順位確定</h3>
                    <div className="space-y-3">
                      {divisionData.confirmed.map(({ hitCount, group, rank }) => (
                        <div key={`${divisionData.division.id}_${rank}_confirmed`} className="bg-green-50 p-2 rounded flex justify-between items-center">
                          <div>
                            <span className="font-bold text-green-900 mr-2">{rank}位</span>
                            <span>{group[0].name}</span>
                            <span className="text-xs text-gray-600 ml-2">({group[0].affiliation})</span>
                          </div>
                          <span className="font-bold text-green-800">{hitCount}本</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isShootOffActive && shootOffType === 'shichuma' && (
              <div className="card">
                <h2 className="card-title">射詰競射中</h2>
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">
                    射詰競射ルール：
                  </p>
                  <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                    <li>各競技者が1本ずつ矢を放ち、失中者を除いていく順位決定方法</li>
                    <li>継続的中数の多い方を上位とする</li>
                    <li>優勝者確定まで射詰競射を継続する（最後の1人が決定するまで）</li>
                    <li>同点（同じ本数で脱落）の場合のみ遠近競射で順位決定</li>
                  </ul>
                </div>

                {/* === 遠近競射が必要な場合 === */}
                {showEnkinOption && remainingAfterFourArrows.length > 0 && (
                  <div className="mt-4 p-4 bg-yellow-50 border rounded">
                    <h3 className="font-bold text-yellow-800">同点グループ発生 - 遠近競射で順位決定</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      同じ本数で脱落した複数名の順位を遠近競射で決定します
                    </p>
                    <div className="space-y-2">
                      <div className="text-sm">
                        <strong>遠近競射対象者:</strong>
                        <ul className="list-disc list-inside mt-1">
                          {remainingAfterFourArrows.map(archer => (
                            <li key={archer.archerId}>{archer.name} ({archer.affiliation})</li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={handleStartEnkinFromShichuma}
                          className="btn-primary"
                        >
                          遠近競射を開始
                        </button>
                        <button
                          onClick={handleCancelEnkinOption}
                          className="btn-secondary"
                        >
                          キャンセル
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* === 遠近不要で順位が確定した場合 === */}
                {!showEnkinOption && !isShootOffActive && eliminationOrder.length > 0 && (
                  <div className="mt-4 p-4 bg-green-50 border rounded">
                    <h3 className="font-bold text-green-800 mb-3">射詰競射終了 - 順位確定</h3>
                    <div className="space-y-2">
                      {getShichumaFinalRanking().map(({archer, rank, eliminatedAt, type, consecutiveHits}) => {
                        const archerResults = shichumaResults[archer.archerId] || [];
                        const shotRecords = Array.from({length: Math.max(4, archerResults.length)}, (_, i) => {
                          return archerResults[i] || (i < currentShichumaRound - 1 ? null : null);
                        });
                        
                        return (
                          <div key={archer.archerId} className="border rounded p-3 bg-white">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <span className="font-bold text-lg">{rank}位</span>
                                <span className="font-semibold ml-3">{archer.name}</span>
                              </div>
                              <span className="text-sm text-gray-600">
                                {type === 'eliminated' 
                                  ? `${eliminatedAt}本目で脱落 (継続的中: ${consecutiveHits}本)` 
                                  : `優勝 (継続的中: ${consecutiveHits}本)`}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{archer.affiliation}</p>
                            
                            {/* 記録表示 */}
                            <div className="mt-2 flex gap-1 items-center">
                              <span className="text-xs font-semibold text-gray-500 w-12">記録:</span>
                              <div className="flex gap-1">
                                {shotRecords.map((result, idx) => (
                                  <div key={idx} className="text-center">
                                    <span className="text-xs text-gray-500">{idx + 1}本</span>
                                    <div className={`w-6 h-6 rounded flex items-center justify-center text-sm font-bold ${
                                      result === 'o' ? 'bg-gray-900 text-white' : 
                                      result === 'x' ? 'bg-red-200 text-red-700' : 'bg-gray-100 text-gray-400'
                                    }`}>
                                      {result === 'o' ? '◯' : result === 'x' ? '×' : '―'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* === 入力フォーム（1位決定前のみ表示） === */}
                {isShootOffActive && !showEnkinOption && (
                  <div className="space-y-4 mt-4">
                    {currentShootOffArchers.map(archer => (
                      <div key={archer.archerId} className="border rounded p-4">
                        <h4 className="font-semibold mb-2">{archer.name}</h4>
                        <div className="flex gap-2">
                          {Array.from({length: Math.max(currentShichumaRound, 4)}, (_, arrowIndex) => {
                            const result = shichumaResults[archer.archerId]?.[arrowIndex];
                            const isCurrentRound = arrowIndex === currentShichumaRound - 1;
                            const isEditing = editingArrow?.archerId === archer.archerId && editingArrow?.arrowIndex === arrowIndex;
                            return (
                              <div key={arrowIndex} className="text-center">
                                <p className="text-sm mb-1">{arrowIndex + 1}本目</p>
                                {isEditing ? (
                                  <div className="flex flex-col gap-1">
                                    <button
                                      onClick={() => handleConfirmEditShichuma(archer.archerId, arrowIndex, 'o')}
                                      className="btn-circle btn-hit"
                                    >
                                      ◯
                                    </button>
                                    <button
                                      onClick={() => handleConfirmEditShichuma(archer.archerId, arrowIndex, 'x')}
                                      className="btn-circle btn-miss"
                                    >
                                      ×
                                    </button>
                                    <button
                                      onClick={handleCancelEditShichuma}
                                      className="btn-fix text-xs"
                                    >
                                      キャンセル
                                    </button>
                                  </div>
                                ) : result ? (
                                  <div className="flex flex-col gap-1">
                                    <span className={`text-2xl font-bold ${result === 'o' ? 'text-green-600' : 'text-red-600'}`}>
                                      {result === 'o' ? '◯' : '×'}
                                    </span>
                                    <button
                                      onClick={() => handleEditShichumaShot(archer.archerId, arrowIndex)}
                                      className="btn-fix text-xs"
                                    >
                                      修正
                                    </button>
                                  </div>
                                ) : isCurrentRound && !eliminatedArchers.has(archer.archerId) ? (
                                  <>
                                    <button
                                      onClick={() => handleShichumaShot(archer.archerId, arrowIndex, 'o')}
                                      className="btn-circle btn-hit"
                                    >
                                      ◯
                                    </button>
                                    <button
                                      onClick={() => handleShichumaShot(archer.archerId, arrowIndex, 'x')}
                                      className="btn-circle btn-miss ml-1"
                                    >
                                      ×
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-gray-400 text-2xl">―</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {isShootOffActive && shootOffType === 'enkin' && (
              <div className="card">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="card-title">{getEnkinTitle()}中</h2>
                  {enkinTargetRank === null && (
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">開始順位:</label>
                      <select 
                        value={enkinStartRank} 
                        onChange={(e) => setEnkinStartRank(parseInt(e.target.value))}
                        className="input"
                      >
                        {[2, 3, 4, 5, 6, 7, 8].map(rank => (
                          <option key={rank} value={rank}>{rank}位</option>
                        ))}
                      </select>
                    </div>
                  )
                }
                </div>
                <div className="mb-4">
                  <p className="text-sm text-gray-600">
                    ルール：順位を入力
                  </p>
                  {enkinTargetRank !== null && (
                    <div className="mt-2 p-2 bg-blue-50 border rounded">
                      <p className="text-sm text-blue-800">
                        <strong>射詰競射からの遠近競射決定戦</strong>
                      </p>
                      <p className="text-xs text-blue-600">
                        射詰競射で同時に×になった選手たちの順位を決定します
                      </p>
                    </div>
                  )}
                </div>
                
                {/* 選手をグループ分けして表示 */}
                <div className="space-y-6">
                  {/* 射詰競射からの選手 */}
                  {originalEnkinArchers.size === 0 && currentShootOffArchers.length > 0 && (
                    <div className="mb-4 p-3 bg-orange-50 border rounded">
                      <h4 className="font-semibold text-sm mb-2 text-orange-800">射詰競射からの選手</h4>
                      <div className="text-sm space-y-1">
                        {currentShootOffArchers.map(archer => {
                          const eliminatedInfo = eliminationOrder.find(e => e.archerId === archer.archerId);
                          return (
                            <div key={archer.archerId} className="flex justify-between items-center">
                              <span>{archer.name} ({archer.affiliation})</span>
                              <span className="text-xs text-gray-500">
                                {eliminatedInfo ? `${eliminatedInfo.arrowIndex}本目で×` : '4本完射'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* 元々の遠近競射選手 */}
                  {originalEnkinArchers.size > 0 && (
                    <div className="mb-4 p-3 bg-blue-50 border rounded">
                      <h4 className="font-semibold text-sm mb-2 text-blue-800">元々の遠近競射選手</h4>
                      <div className="text-sm space-y-1">
                        {currentShootOffArchers.filter(archer => originalEnkinArchers.has(archer.archerId)).map(archer => (
                          <div key={archer.archerId} className="flex justify-between items-center">
                            <span>{archer.name} ({archer.affiliation})</span>
                            <span className="text-xs text-gray-500">遠近競射対象</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    {currentShootOffArchers.map(archer => (
                      <div key={archer.archerId} className="border rounded p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold">{archer.name}</h4>
                          {originalEnkinArchers.size === 0 && (
                            <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                              射詰から
                            </span>
                          )}
                          {originalEnkinArchers.size > 0 && originalEnkinArchers.has(archer.archerId) && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              元々遠近
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{archer.affiliation}</p>
                        <div className="flex items-center gap-4">
                          <select
                            value={(enkinResults[archer.archerId]?.rank) || ''}
                            onChange={(e) => {
                              handleEnkinResult(archer.archerId, e.target.value, 'normal');
                            }}
                            className="input"
                          >
                            <option value="">順位を選択</option>
                            {getEnkinRankOptions().map(rank => (
                              <option key={rank} value={rank}>{rank}位</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {Object.keys(enkinResults).length === currentShootOffArchers.length && (
                  <div className="mt-4">
                    <h3 className="font-bold mb-2">遠近競射結果</h3>
                    <div className="space-y-2">
                      {calculateEnkinRanking().map(({archerId, rank}) => {
                        const archer = currentShootOffArchers.find(a => a.archerId === archerId);
                        if (!archer) return null;
                        
                        return (
                          <div key={archerId} className={`flex justify-between items-center p-2 border rounded ${
                            enkinDefeated.has(archerId) ? 'bg-red-50 border-red-200' : 'bg-white'
                          }`}>
                            <div className="flex items-center gap-3">
                              <span className="font-semibold">
                                {enkinResults[archerId]?.rank && !enkinDefeated.has(archerId) ? `${rank}位` : '敗退'}: {archer.name}
                              </span>
                              {enkinDefeated.has(archerId) && (
                                <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                  敗退
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <select
                                value={enkinResults[archerId]?.rank || ''}
                                onChange={(e) => {
                                  handleEnkinResult(archerId, e.target.value, 'normal');
                                  // 敗退状態をリセット
                                  if (enkinDefeated.has(archerId)) {
                                    setEnkinDefeated(prev => {
                                      const newSet = new Set(prev);
                                      newSet.delete(archerId);
                                      return newSet;
                                    });
                                  }
                                }}
                                className="input text-sm"
                                disabled={enkinDefeated.has(archerId)}
                              >
                                <option value="">順位を選択</option>
                                {getEnkinRankOptions().map(rank => (
                                  <option key={rank} value={rank}>{rank}位</option>
                                ))}
                              </select>
                              {currentShootOffArchers.length > 1 && !enkinResults[archerId]?.rank && (
                                <button
                                  onClick={() => toggleEnkinDefeated(archerId)}
                                  className={`btn-sm ${enkinDefeated.has(archerId) ? 'btn-secondary' : 'btn-danger'}`}
                                >
                                  {enkinDefeated.has(archerId) ? '復活' : '敗退'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => saveFinalEnkinResults(calculateEnkinRanking(), enkinTargetRank || getNextEnkinTargetRank())}
                        className="btn-primary"
                      >
                        {savedEnkinRanks.has(enkinTargetRank || getNextEnkinTargetRank()) ? 'この枠の順位を上書き保存' : 'この枠の順位を保存'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}            
            
            {/* === 最終統合結果のみ表示 === */}
            <div style={{ marginTop: '2rem' }}>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">?? 最終順位決定表</h2>
              {renderMergedResults()}
            </div>

            {!shichumaFinalResults && !enkinFinalResults && isLoadingResults && (
              <div className="card">
                <p className="text-gray-500">結果を読み込み中...</p>
              </div>
            )}
          </>          
        )}
      </div>
    </div>
  );
};

// SettingsView component has been moved to src/components/SettingsView.jsx


export default RankingView;