import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { getStoredAttachments } from '../utils/tournament';
import { API_URL } from '../utils/api';
import { ensureJapaneseFont } from '../utils/jspdfJapaneseFont';

const ProgramView = ({ state }) => {

  const [selectedTournamentId, setSelectedTournamentId] = useState(() => localStorage.getItem('selectedTournamentId') || '');
  const [archers, setArchers] = useState([]);
  const [allApplicants, setAllApplicants] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [finalResults, setFinalResults] = useState(null);
  const [isLoadingFinalResults, setIsLoadingFinalResults] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');
  const [fetchError, setFetchError] = useState(null);
  const [programTableMode, setProgramTableMode] = useState('checked_in');
  const archersPerPage = 36;

  useEffect(() => {
    if (selectedTournamentId) localStorage.setItem('selectedTournamentId', selectedTournamentId);
    else localStorage.removeItem('selectedTournamentId');
  }, [selectedTournamentId]);

  const fetchArchers = useCallback(async () => {
    if (!selectedTournamentId) {
      setArchers([]);
      setAllApplicants([]);
      return;
    }
    setIsLoading(true);
    try {
      const resp = await fetch(`${API_URL}/applicants/${selectedTournamentId}`);
      const json = await resp.json();
      if (json.success) {
        const applicants = json.data || [];
        const rankOrderLocal = ['無指定','五級','四級','三級','弐級','壱級','初段','弐段','参段','四段','五段','錬士五段','錬士六段','教士七段','教士八段','範士八段','範士九段'];
        const normalize = (r) => {
          if (!r) return '無指定';
          return String(r).trim().replace(/[\s　]+/g, '')
            .replace(/[１２]/g, (m) => (m === '１' ? '1' : '2'))
            .replace(/[３４５]/g, (m) => (m === '３' ? '3' : m === '４' ? '4' : '5'))
            .replace('二段', '弐段')
            .replace('三段', '参段')
            .replace('二級', '弐級')
            .replace('一級', '壱級')
            .replace(/5級/g, '五級')
            .replace(/4級/g, '四級')
            .replace(/3級/g, '三級')
            .replace(/2級/g, '弐級')
            .replace(/1級/g, '壱級')
            .replace(/2段/g, '弐段')
            .replace(/3段/g, '参段')
            .replace(/錬士5段/g, '錬士五段')
            .replace(/錬士6段/g, '錬士六段')
            .replace(/教士7段/g, '教士七段')
            .replace(/教士8段/g, '教士八段')
            .replace(/範士8段/g, '範士八段')
            .replace(/範士9段/g, '範士九段');
        };

        const divisionsLocal = (tournament?.data?.divisions) || [];
        const divisionOrderLocal = [...divisionsLocal]
          .sort((a, b) => {
            const ai = a?.minRank ? rankOrderLocal.indexOf(normalize(a.minRank)) : 0;
            const bi = b?.minRank ? rankOrderLocal.indexOf(normalize(b.minRank)) : 0;
            const as = ai === -1 ? Number.POSITIVE_INFINITY : ai;
            const bs = bi === -1 ? Number.POSITIVE_INFINITY : bi;
            return as - bs;
          })
          .map(d => d?.id)
          .filter(Boolean);

        const getDivisionIdLocal = (archer) => {
          const rIdx = rankOrderLocal.indexOf(normalize(archer?.rank));
          for (const d of divisionsLocal) {
            const minIdx = d?.minRank ? rankOrderLocal.indexOf(normalize(d.minRank)) : 0;
            const maxIdx = d?.maxRank ? rankOrderLocal.indexOf(normalize(d.maxRank)) : rankOrderLocal.length - 1;
            if (rIdx >= minIdx && rIdx <= maxIdx) return d.id;
          }
          return 'unassigned';
        };

        const enableGenderSeparationLocal = state.tournament?.enableGenderSeparation
          ?? tournament?.data?.enableGenderSeparation
          ?? tournament?.enableGenderSeparation
          ?? false;
        const femaleFirstLocal = enableGenderSeparationLocal && (tournament?.data?.femaleFirst ?? false);

        const sortedAll = [...applicants]
          .sort((a, b) => {
            if (enableGenderSeparationLocal) {
              const adiv = getDivisionIdLocal(a);
              const bdiv = getDivisionIdLocal(b);
              const adi = divisionOrderLocal.indexOf(adiv);
              const bdi = divisionOrderLocal.indexOf(bdiv);
              if (adi !== bdi) {
                if (adi === -1) return 1;
                if (bdi === -1) return -1;
                return adi - bdi;
              }

              const ag = a.gender || 'male';
              const bg = b.gender || 'male';
              if (ag !== bg) return femaleFirstLocal
                ? (ag === 'female' ? -1 : 1)
                : (ag === 'male' ? -1 : 1);
            }
            const ar = normalize(a.rank);
            const br = normalize(b.rank);
            const ai = rankOrderLocal.indexOf(ar);
            const bi = rankOrderLocal.indexOf(br);
            if (ai !== bi) {
              if (ai === -1) return 1;
              if (bi === -1) return -1;
              return ai - bi;
            }

            const adRaw = a.rankAcquiredDate ? new Date(a.rankAcquiredDate).getTime() : Number.NEGATIVE_INFINITY;
            const bdRaw = b.rankAcquiredDate ? new Date(b.rankAcquiredDate).getTime() : Number.NEGATIVE_INFINITY;
            const ad = Number.isFinite(adRaw) ? adRaw : Number.NEGATIVE_INFINITY;
            const bd = Number.isFinite(bdRaw) ? bdRaw : Number.NEGATIVE_INFINITY;
            if (ad !== bd) return bd - ad;

            return String(a.name || '').localeCompare(String(b.name || ''), 'ja');
          })
          .map((s, idx) => ({ ...s, standOrder: idx + 1 }));

        const sortedCheckedIn = sortedAll
          .filter(a => a.isCheckedIn)
          .map((s, idx) => ({ ...s, standOrder: idx + 1 }));

        setAllApplicants(sortedAll);
        setArchers(sortedCheckedIn);
      }
    } catch (err) {
      console.error('ProgramView fetch error', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTournamentId]);

  // 初回と大会変更時に取得
  useEffect(() => {
    fetchArchers();
  }, [fetchArchers]);

  // ★ 30秒ごとに自動更新
  useEffect(() => {
    if (!selectedTournamentId) return;
    const interval = setInterval(fetchArchers, 30000);
    return () => clearInterval(interval);
  }, [selectedTournamentId, fetchArchers]);

  // バックグラウンド取得（ローディング表示なし・変化があれば通知）
  const fetchFinalResultsBg = useCallback(async () => {
    if (!selectedTournamentId) return;
    try {
      const response = await fetch(`${API_URL}/ranking/shootoff/${selectedTournamentId}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setFinalResults(prev => {
            const prevStr = JSON.stringify(prev);
            const nextStr = JSON.stringify(result.data);
            if (prevStr === nextStr) return prev; // 変化なし → 再レンダリングしない
            // データが変化した場合のみ更新通知を表示
            setLastUpdated(new Date());
            setUpdateMessage('🔄 順位決定戦から自動反映されました');
            setShowUpdateNotification(true);
            setTimeout(() => setShowUpdateNotification(false), 4000);
            return result.data;
          });
        }
      }
    } catch (error) {
      // バックグラウンド取得の失敗は静かに無視
      console.warn('最終順位表バックグラウンド取得エラー:', error);
    }
  }, [selectedTournamentId]);

  // 初回取得（ローディング表示あり）
  useEffect(() => {
    const fetchFinalResults = async () => {
      if (!selectedTournamentId) return;

      setIsLoadingFinalResults(true);
      setFetchError(null);
      try {
        const response = await fetch(`${API_URL}/ranking/shootoff/${selectedTournamentId}`);

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setFinalResults(result.data);
          }
        } else {
          setFinalResults(null);
          setFetchError(`最終順位表の取得に失敗しました (${response.status})`);
        }
      } catch (error) {
        console.error('最終順位表の取得エラー:', error);
        setFinalResults(null);
        setFetchError('ネットワークエラー: 最終順位表を取得できません');
      } finally {
        setIsLoadingFinalResults(false);
      }
    };

    fetchFinalResults();
  }, [selectedTournamentId]);

  // ★ 10秒ごとに自動ポーリング（順位決定戦ページの保存を即座に反映）
  useEffect(() => {
    if (!selectedTournamentId) return;
    const interval = setInterval(fetchFinalResultsBg, 10000);
    return () => clearInterval(interval);
  }, [selectedTournamentId, fetchFinalResultsBg]);

  const handleRefreshFinalResults = async () => {
    if (!selectedTournamentId) return;

    setIsLoadingFinalResults(true);
    setFetchError(null);
    try {
      const response = await fetch(`${API_URL}/ranking/shootoff/${selectedTournamentId}`);

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setFinalResults(result.data);
          setLastUpdated(new Date());
          setUpdateMessage('✅ 最終順位表を手動更新しました');
          setShowUpdateNotification(true);
          setTimeout(() => {
            setShowUpdateNotification(false);
          }, 3000);
        }
      } else {
        setFinalResults(null);
        setFetchError(`手動更新に失敗しました (${response.status})`);
      }
    } catch (error) {
      console.error('最終順位表の手動更新エラー:', error);
      setFinalResults(null);
      setFetchError('手動更新中にネットワークエラーが発生しました');
    } finally {
      setIsLoadingFinalResults(false);
    }
  };

  const tournaments = state.registeredTournaments || [];
  const tournament = tournaments.find(t => t.id === selectedTournamentId) || null;
  const attachments = useMemo(() => getStoredAttachments(selectedTournamentId), [selectedTournamentId]);

  // ---- 共通定義 ----
  const rankOrder = ['無指定','五級','四級','三級','弐級','壱級','初段','弐段','参段','四段','五段','錬士五段','錬士六段','教士七段','教士八段','範士八段','範士九段'];
  const normalizeRank = (r) => {
    if (!r) return '無指定';
    return String(r).trim().replace(/[\s　]+/g, '')
      .replace(/[１２]/g, (m) => (m === '１' ? '1' : '2'))
      .replace(/[３４５]/g, (m) => (m === '３' ? '3' : m === '４' ? '4' : '5'))
      .replace('二段', '弐段')
      .replace('三段', '参段')
      .replace('二級', '弐級')
      .replace('一級', '壱級')
      .replace(/5級/g, '五級')
      .replace(/4級/g, '四級')
      .replace(/3級/g, '三級')
      .replace(/2級/g, '弐級')
      .replace(/1級/g, '壱級')
      .replace(/2段/g, '弐段')
      .replace(/3段/g, '参段')
      .replace(/錬士5段/g, '錬士五段')
      .replace(/錬士6段/g, '錬士六段')
      .replace(/教士7段/g, '教士七段')
      .replace(/教士8段/g, '教士八段')
      .replace(/範士8段/g, '範士八段')
      .replace(/範士9段/g, '範士九段');
  };

  const localDefaultDivisions = [
    { id: 'lower', label: '級位~三段以下の部' },
    { id: 'middle', label: '四・五段の部' },
    { id: 'title', label: '称号者の部' }
  ];
  const divisions = (tournament?.data?.divisions) ? tournament.data.divisions : localDefaultDivisions;

  const divisionOrder = [...divisions]
    .sort((a, b) => {
      const ai = a?.minRank ? rankOrder.indexOf(normalizeRank(a.minRank)) : 0;
      const bi = b?.minRank ? rankOrder.indexOf(normalizeRank(b.minRank)) : 0;
      const as = ai === -1 ? Number.POSITIVE_INFINITY : ai;
      const bs = bi === -1 ? Number.POSITIVE_INFINITY : bi;
      return as - bs;
    })
    .map(d => d?.id)
    .filter(Boolean);

  const enableGenderSeparation = tournament?.data?.enableGenderSeparation ?? tournament?.enableGenderSeparation ?? false;
  const femaleFirst = enableGenderSeparation && (tournament?.data?.femaleFirst ?? false);

  const getDivisionIdForArcher = (archer) => {
    const rIdx = rankOrder.indexOf(normalizeRank(archer?.rank));
    for (const d of divisions) {
      const minIdx = d?.minRank ? rankOrder.indexOf(normalizeRank(d.minRank)) : 0;
      const maxIdx = d?.maxRank ? rankOrder.indexOf(normalizeRank(d.maxRank)) : rankOrder.length - 1;
      if (rIdx >= minIdx && rIdx <= maxIdx) return d.id;
    }
    return 'unassigned';
  };

  const resultSymbol = (r) => r === 'o' ? '◯' : r === 'x' ? '×' : r === '?' ? '?' : '';

  const getArcherRoundResults = (archer, roundNum) => {
    const arrowsRound1 = state.tournament?.arrowsRound1
                      ?? tournament?.data?.arrowsRound1
                      ?? tournament?.arrowsRound1
                      ?? 4;
    const arrowsRound2 = state.tournament?.arrowsRound2
                      ?? tournament?.data?.arrowsRound2
                      ?? tournament?.arrowsRound2
                      ?? 4;

    const padTo = (arr, n) => {
      const out = Array.isArray(arr) ? [...arr] : [];
      while (out.length < n) out.push(null);
      return out.slice(0, n);
    };

    const resultsObj = archer?.results || {};
    let standResults = [];
    for (let s = 1; s <= 6; s++) {
      const arr = resultsObj[`stand${s}`];
      if (Array.isArray(arr) && arr.some(v => v !== null && v !== undefined)) {
        standResults = arr;
        break;
      }
    }

    if (!Array.isArray(standResults) || standResults.length === 0) {
      return roundNum === 1 ? padTo([], arrowsRound1) : padTo([], arrowsRound2);
    }

    if (roundNum === 1) {
      return padTo(standResults.slice(0, arrowsRound1), arrowsRound1);
    }
    return padTo(standResults.slice(arrowsRound1, arrowsRound1 + arrowsRound2), arrowsRound2);
  };

  const renderFinalResults = () => {
    if (fetchError) {
      return (
        <div className="card mt-6">
          <h3 className="card-title text-green-700 mb-4">🏆 最終順位表</h3>
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex items-center gap-2">
              <span className="text-red-600">⚠️</span>
              <span className="text-red-700">{fetchError}</span>
            </div>
            <button
              onClick={handleRefreshFinalResults}
              disabled={isLoadingFinalResults}
              className="mt-2 flex items-center gap-1 px-3 py-1 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded-md transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingFinalResults ? 'animate-spin' : ''}`} />
              再試行
            </button>
          </div>
        </div>
      );
    }

    if (isLoadingFinalResults && !finalResults) {
      return (
        <div className="card mt-6">
          <h3 className="card-title text-green-700 mb-4">🏆 最終順位表</h3>
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-700"></div>
            <p className="mt-2 text-gray-600">最終順位表を読み込み中...</p>
          </div>
        </div>
      );
    }

    // Create confirmed results from archers data (same logic as RankingView)
    const createConfirmedResults = () => {
      const confirmedResults = [];
      const awardRankLimit = tournament?.data?.awardRankLimit || 3;

      // Group archers by division
      const archersByDivision = {};
      archers.forEach(archer => {
        const divisionId = getDivisionIdForArcher(archer);
        if (!archersByDivision[divisionId]) {
          archersByDivision[divisionId] = [];
        }
        archersByDivision[divisionId].push(archer);
      });

      Object.keys(archersByDivision).forEach(divisionId => {
        const divisionArchers = archersByDivision[divisionId];
        
        // Calculate ranks based on hit counts
        const archersWithHitCounts = divisionArchers.map(archer => {
          // Calculate total hit count from all stands
          let totalHitCount = 0;
          let hasResults = false;
          
          for (let stand = 1; stand <= 6; stand++) {
            const standResults = archer.results?.[`stand${stand}`] || [];
            if (standResults.length > 0) {
              hasResults = true;
              const arrows1 = tournament?.data?.arrowsRound1 ?? 4;
              const arrows2 = tournament?.data?.arrowsRound2 ?? 4;
              const totalArrows = arrows1 + arrows2;
              
              // Count hits from this stand
              const hits = standResults.filter(r => r === 'o').length;
              totalHitCount += hits;
              
              // Only count the first valid stand (to avoid double counting)
              break;
            }
          }
          
          return {
            ...archer,
            hitCount: totalHitCount,
            hasResults: hasResults
          };
        });

        // Sort by hit count (descending) and assign ranks
        const sortedArchers = archersWithHitCounts
          .filter(a => a.hasResults)
          .sort((a, b) => b.hitCount - a.hitCount);

        let currentRank = 1;
        let prevHitCount = null;
        const assignedRanks = new Set();

        sortedArchers.forEach((archer, index) => {
          // Check if this archer is already in shichuma or enkin results
          const inShichuma = finalResults?.shichuma?.results?.some(r => r.archerId === archer.archerId);
          const inEnkin = finalResults?.enkin?.results?.some(r => r.archerId === archer.archerId);
          
          // Only add confirmed results for archers not in shootoff results
          if (!inShichuma && !inEnkin && currentRank <= awardRankLimit) {
            // Handle ties
            if (prevHitCount !== null && archer.hitCount !== prevHitCount) {
              currentRank = index + 1;
            }
            
            // Skip if rank is already taken
            if (assignedRanks.has(currentRank)) {
              currentRank++;
            }
            
            if (currentRank <= awardRankLimit) {
              confirmedResults.push({
                archerId: archer.archerId,
                name: archer.name,
                affiliation: archer.affiliation,
                rank: currentRank,
                rank_source: 'confirmed',
                shootOffType: null,
                hitCount: archer.hitCount,
                divisionId: divisionId
              });
              
              assignedRanks.add(currentRank);
              prevHitCount = archer.hitCount;
            }
          }
        });
      });

      return confirmedResults;
    };

    const confirmedResults = createConfirmedResults();
    const hasAnyResults = finalResults?.shichuma || finalResults?.enkin || confirmedResults.length > 0;

    if (!hasAnyResults) {
      return (
        <div className="card mt-6">
          <h3 className="card-title text-green-700 mb-4">🏆 最終順位表</h3>
          <p className="text-gray-500 text-center py-4">最終順位表の記録がありません</p>
        </div>
      );
    }

    const mergedResults = [];
    const awardRankLimit = tournament?.data?.awardRankLimit || 3;

    const enkinArcherIds = new Set(
      (finalResults.enkin?.results || []).map(r => r.archerId)
    );
    const processedArcherIds = new Set();

    // Process shichuma results
    if (finalResults.shichuma && finalResults.shichuma.results) {
      finalResults.shichuma.results
        .sort((a, b) => a.rank - b.rank)
        .forEach(result => {
          const archer = archers.find(a => a.archerId === result.archerId);
          if (!archer) return;

          const isFromShichumaToEnkin = result.pendingEnkin || enkinArcherIds.has(result.archerId);
          if (isFromShichumaToEnkin) return;

          if (processedArcherIds.has(result.archerId)) return;

          mergedResults.push({
            archerId: result.archerId,
            name: archer.name,
            affiliation: archer.affiliation,
            rank: result.rank,
            rank_source: 'shichuma',
            shootOffType: 'shichuma',
            isWinner: result.isWinner,
            eliminatedAt: result.eliminatedAt,
            consecutiveHits: result.consecutiveHits,
            isDefeated: result.isDefeated,
            pendingEnkin: result.pendingEnkin,
            divisionId: getDivisionIdForArcher(archer)
          });
          processedArcherIds.add(result.archerId);
        });
    }

    // Process enkin results
    if (finalResults.enkin && finalResults.enkin.results) {
      finalResults.enkin.results
        .sort((a, b) => {
          const aTarget = a.targetRank != null ? a.targetRank : 9999;
          const bTarget = b.targetRank != null ? b.targetRank : 9999;
          if (aTarget !== bTarget) return aTarget - bTarget;
          return (parseInt(a.rank) || 9999) - (parseInt(b.rank) || 9999);
        })
        .forEach(result => {
          const archer = archers.find(a => a.archerId === result.archerId);
          if (!archer) return;

          if (result.rank === '敗退' || result.isDefeated) return;

          if (processedArcherIds.has(result.archerId)) return;

          mergedResults.push({
            archerId: result.archerId,
            name: archer.name,
            affiliation: archer.affiliation,
            rank: typeof result.rank === 'number' ? result.rank : parseInt(result.rank),
            rank_source: 'enkin',
            shootOffType: 'enkin',
            targetRank: result.targetRank,
            isDefeated: result.isDefeated,
            divisionId: getDivisionIdForArcher(archer)
          });
          processedArcherIds.add(result.archerId);
        });
    }

    // Process confirmed results
    confirmedResults.forEach(result => {
      if (!processedArcherIds.has(result.archerId)) {
        mergedResults.push(result);
        processedArcherIds.add(result.archerId);
      }
    });

    if (mergedResults.length === 0) {
      return (
        <div className="card mt-6">
          <h3 className="card-title text-green-700 mb-4">🏆 最終順位表</h3>
          <p className="text-gray-500 text-center py-4">最終順位表の記録がありません</p>
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
        const divId = getDivisionIdForArcher(archer);
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

    Object.keys(resultsByDivision).forEach(divId => {
      resultsByDivision[divId].results = resultsByDivision[divId].results
        .filter(result => {
          if (result.rank === '敗退' || result.isDefeated) {
            return false;
          }
          return typeof result.rank === 'number' && result.rank <= awardRankLimit;
        })
        .sort((a, b) => a.rank - b.rank);
    });

    const divisionResults = [];
    divisionOrder.forEach(divId => {
      if (enableGenderSeparation) {
        const firstGender = femaleFirst ? 'female' : 'male';
        const secondGender = femaleFirst ? 'male' : 'female';
        const firstLabel = femaleFirst ? '女' : '男';
        const secondLabel = femaleFirst ? '男' : '女';
        divisionResults.push(resultsByDivision[`${divId}_${firstGender}`] || {
          division: { ...divisions.find(d => d.id === divId), id: `${divId}_${firstGender}`, label: `${divisions.find(d => d.id === divId).label}（${firstLabel}）` },
          results: []
        });
        divisionResults.push(resultsByDivision[`${divId}_${secondGender}`] || {
          division: { ...divisions.find(d => d.id === divId), id: `${divId}_${secondGender}`, label: `${divisions.find(d => d.id === divId).label}（${secondLabel}）` },
          results: []
        });
      } else {
        divisionResults.push(resultsByDivision[divId] || {
          division: divisions.find(d => d.id === divId),
          results: []
        });
      }
    });

    return (
      <div className="card mt-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="card-title text-green-700">🏆 最終順位表</h3>
            <p className="text-sm text-gray-600 mt-1">
              表彰範囲：{awardRankLimit}位まで
            </p>
          </div>
          <div className="flex items-center gap-2">
            {showUpdateNotification && (
              <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium animate-pulse">
                {updateMessage || '🔄 順位決定戦ページから更新されました'}
              </div>
            )}
            <button
              onClick={handleRefreshFinalResults}
              disabled={isLoadingFinalResults}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
              title="最終順位表を手動更新"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingFinalResults ? 'animate-spin' : ''}`} />
              更新
            </button>
            <button
              onClick={printFinalResults}
              disabled={!finalResults || (!finalResults.shichuma && !finalResults.enkin && !archers.some(a => a.results && Object.values(a.results).some(r => Array.isArray(r) && r.length > 0)))}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:bg-gray-100 disabled:text-gray-400"
              title="最終順位表を印刷"
            >
              🖨️ 印刷
            </button>
            {lastUpdated && (
              <span className="text-xs text-gray-500">
                最終更新: {lastUpdated.toLocaleTimeString('ja-JP')}
              </span>
            )}
          </div>
        </div>
        {divisionResults.map(divisionData => (
          <div key={divisionData.division.id} className="mb-6">
            <h4 className="text-lg font-semibold text-green-600 mb-3">{divisionData.division.label}</h4>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-green-300">
                <thead>
                  <tr className="bg-green-100">
                    <th className="border border-green-300 px-4 py-2 text-left">順位</th>
                    <th className="border border-green-300 px-4 py-2 text-left">氏名</th>
                    <th className="border border-green-300 px-4 py-2 text-left">所属</th>
                    <th className="border border-green-300 px-4 py-2 text-left">段位</th>
                    <th className="border border-green-300 px-4 py-2 text-center">決定方法</th>
                    <th className="border border-green-300 px-4 py-2 text-center">詳細</th>
                  </tr>
                </thead>
                <tbody>
                  {divisionData.results.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="border border-green-300 px-4 py-8 text-center text-gray-500">
                        この部門の最終順位表の記録がありません<br />
                        <span className="text-xs">（表彰範囲：{awardRankLimit}位まで）</span>
                      </td>
                    </tr>
                  ) : (
                    divisionData.results.map(result => {
                      const archer = archers.find(a => a.archerId === result.archerId);
                      return (
                        <tr key={`${result.archerId}-${result.shootOffType || 'unknown'}`} className="hover:bg-green-50">
                          <td className="border border-green-300 px-4 py-2 font-bold">
                            <span className="text-green-900">{result.rank}位</span>
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
                              if (result.shootOffType === 'shichuma') {
                                return (
                                  <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">射詰</span>
                                );
                              } else if (result.shootOffType === 'enkin') {
                                return (
                                  <span className="text-sm bg-orange-100 text-orange-800 px-2 py-1 rounded">遠近</span>
                                );
                              } else if (result.rank_source === 'confirmed') {
                                return (
                                  <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">的中数</span>
                                );
                              }
                              return (
                                <span className="text-sm bg-gray-100 text-gray-600 px-2 py-1 rounded">-</span>
                              );
                            })()}
                          </td>
                          <td className="border border-green-300 px-4 py-2 text-sm text-center">
                            {result.shootOffType === 'shichuma' && (
                              <div>
                                {(() => {
                                  if (result.isWinner) {
                                    return <span className="text-yellow-700 font-bold">🏆 優勝</span>;
                                  } else if (result.pendingEnkin) {
                                    return <span className="text-orange-600 font-bold">遠近待ち</span>;
                                  } else if (result.eliminatedAt) {
                                    return <span className="text-red-700">{result.eliminatedAt}本目脱落</span>;
                                  }
                                  return <span className="text-blue-700 font-bold">射詰{result.rank}位</span>;
                                })()}
                              </div>
                            )}
                            {result.shootOffType === 'enkin' && (
                              <div>
                                <span className="text-orange-700">
                                  遠近競射{result.rank}位
                                  {result.targetRank && ` (対象順位: ${result.targetRank}位)`}
                                </span>
                              </div>
                            )}
                            {result.shootOffType === 'confirmed' && (
                              <div>
                                <span className="text-green-700">{result.hitCount}本的中</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const printFinalResults = () => {
    if (!selectedTournamentId) {
      alert('最終順位表の記録がありません');
      return;
    }

    // Create confirmed results from archers data (same logic as renderFinalResults)
    const createConfirmedResults = () => {
      const confirmedResults = [];
      const awardRankLimit = tournament?.data?.awardRankLimit || 3;

      // Group archers by division
      const archersByDivision = {};
      archers.forEach(archer => {
        const divisionId = getDivisionIdForArcher(archer);
        if (!archersByDivision[divisionId]) {
          archersByDivision[divisionId] = [];
        }
        archersByDivision[divisionId].push(archer);
      });

      Object.keys(archersByDivision).forEach(divisionId => {
        const divisionArchers = archersByDivision[divisionId];
        
        // Calculate ranks based on hit counts
        const archersWithHitCounts = divisionArchers.map(archer => {
          // Calculate total hit count from all stands
          let totalHitCount = 0;
          let hasResults = false;
          
          for (let stand = 1; stand <= 6; stand++) {
            const standResults = archer.results?.[`stand${stand}`] || [];
            if (standResults.length > 0) {
              hasResults = true;
              const arrows1 = tournament?.data?.arrowsRound1 ?? 4;
              const arrows2 = tournament?.data?.arrowsRound2 ?? 4;
              const totalArrows = arrows1 + arrows2;
              
              // Count hits from this stand
              const hits = standResults.filter(r => r === 'o').length;
              totalHitCount += hits;
              
              // Only count the first valid stand (to avoid double counting)
              break;
            }
          }
          
          return {
            ...archer,
            hitCount: totalHitCount,
            hasResults: hasResults
          };
        });

        // Sort by hit count (descending) and assign ranks
        const sortedArchers = archersWithHitCounts
          .filter(a => a.hasResults)
          .sort((a, b) => b.hitCount - a.hitCount);

        let currentRank = 1;
        let prevHitCount = null;
        const assignedRanks = new Set();

        sortedArchers.forEach((archer, index) => {
          // Check if this archer is already in shichuma or enkin results
          const inShichuma = finalResults?.shichuma?.results?.some(r => r.archerId === archer.archerId);
          const inEnkin = finalResults?.enkin?.results?.some(r => r.archerId === archer.archerId);
          
          // Only add confirmed results for archers not in shootoff results
          if (!inShichuma && !inEnkin && currentRank <= awardRankLimit) {
            // Handle ties
            if (prevHitCount !== null && archer.hitCount !== prevHitCount) {
              currentRank = index + 1;
            }
            
            // Skip if rank is already taken
            if (assignedRanks.has(currentRank)) {
              currentRank++;
            }
            
            if (currentRank <= awardRankLimit) {
              confirmedResults.push({
                archerId: archer.archerId,
                name: archer.name,
                affiliation: archer.affiliation,
                rank: currentRank,
                rank_source: 'confirmed',
                shootOffType: null,
                hitCount: archer.hitCount,
                divisionId: divisionId
              });
              
              assignedRanks.add(currentRank);
              prevHitCount = archer.hitCount;
            }
          }
        });
      });

      return confirmedResults;
    };

    const confirmedResults = createConfirmedResults();
    const hasAnyResults = finalResults?.shichuma || finalResults?.enkin || confirmedResults.length > 0;

    if (!hasAnyResults) {
      alert('最終順位表の記録がありません');
      return;
    }

    const title = `${tournament?.data?.name || selectedTournamentId} 最終順位表`;
    const awardRankLimit = tournament?.data?.awardRankLimit || 3;

    const styles = `
      body{font-family: Arial, Helvetica, sans-serif; padding:20px; color:#111}
      h1,h2{margin:0 0 12px}
      .header{margin-bottom:20px}
      .division{margin-bottom:24px;page-break-inside:avoid}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th,td{border:1px solid #333;padding:8px;font-size:12px;text-align:left}
      th{background:#f0f0f0;font-weight:700;text-align:center}
      .rank{font-weight:700;text-align:center}
      .method{text-align:center}
      .detail{text-align:center;font-size:11px}
      .no-results{text-align:center;color:#666;padding:16px}
      .page{page-break-after:always}
      .last-page{page-break-after:auto}
    `;

    let html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${styles}</style></head><body>`;
    
    // Header
    html += `<div class="header">`;
    html += `<h1>${title}</h1>`;
    html += `<p>表彰範囲：${awardRankLimit}位まで</p>`;
    html += `<p>印刷日時：${new Date().toLocaleString('ja-JP')}</p>`;
    html += `</div>`;

    // Process final results data (similar to renderFinalResults)
    const mergedResults = [];
    const enkinArcherIds = new Set((finalResults?.enkin?.results || []).map(r => r.archerId));
    const processedArcherIds = new Set();

    if (finalResults?.shichuma && finalResults.shichuma.results) {
      finalResults.shichuma.results
        .sort((a, b) => a.rank - b.rank)
        .forEach(result => {
          const archer = archers.find(a => a.archerId === result.archerId);
          if (!archer) return;

          const isFromShichumaToEnkin = result.pendingEnkin || enkinArcherIds.has(result.archerId);
          if (isFromShichumaToEnkin) return;
          if (processedArcherIds.has(result.archerId)) return;

          mergedResults.push({
            archerId: result.archerId,
            name: archer.name,
            affiliation: archer.affiliation,
            rank: result.rank,
            rank_source: 'shichuma',
            shootOffType: 'shichuma',
            isWinner: result.isWinner,
            eliminatedAt: result.eliminatedAt,
            consecutiveHits: result.consecutiveHits,
            isDefeated: result.isDefeated,
            pendingEnkin: result.pendingEnkin,
            divisionId: getDivisionIdForArcher(archer)
          });
          processedArcherIds.add(result.archerId);
        });
    }

    if (finalResults?.enkin && finalResults.enkin.results) {
      finalResults.enkin.results
        .sort((a, b) => {
          const aTarget = a.targetRank != null ? a.targetRank : 9999;
          const bTarget = b.targetRank != null ? b.targetRank : 9999;
          if (aTarget !== bTarget) return aTarget - bTarget;
          return (parseInt(a.rank) || 9999) - (parseInt(b.rank) || 9999);
        })
        .forEach(result => {
          const archer = archers.find(a => a.archerId === result.archerId);
          if (!archer) return;
          if (result.rank === '敗退' || result.isDefeated) return;
          if (processedArcherIds.has(result.archerId)) return;

          mergedResults.push({
            archerId: result.archerId,
            name: archer.name,
            affiliation: archer.affiliation,
            rank: typeof result.rank === 'number' ? result.rank : parseInt(result.rank),
            rank_source: 'enkin',
            shootOffType: 'enkin',
            targetRank: result.targetRank,
            isDefeated: result.isDefeated,
            divisionId: getDivisionIdForArcher(archer)
          });
          processedArcherIds.add(result.archerId);
        });
    }

    // Add confirmed results
    confirmedResults.forEach(result => {
      if (!processedArcherIds.has(result.archerId)) {
        mergedResults.push(result);
        processedArcherIds.add(result.archerId);
      }
    });

    // Group by division for print
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
        const divId = getDivisionIdForArcher(archer);
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

    // Filter and sort results for print
    Object.keys(resultsByDivision).forEach(divId => {
      resultsByDivision[divId].results = resultsByDivision[divId].results
        .filter(result => {
          if (result.rank === '敗退' || result.isDefeated) return false;
          return typeof result.rank === 'number' && result.rank <= awardRankLimit;
        })
        .sort((a, b) => a.rank - b.rank);
    });

    // Generate division results in order
    const divisionResults = [];
    divisionOrder.forEach(divId => {
      if (enableGenderSeparation) {
        const firstGender = femaleFirst ? 'female' : 'male';
        const secondGender = femaleFirst ? 'male' : 'female';
        const firstLabel = femaleFirst ? '女' : '男';
        const secondLabel = femaleFirst ? '男' : '女';
        divisionResults.push(resultsByDivision[`${divId}_${firstGender}`] || {
          division: { ...divisions.find(d => d.id === divId), id: `${divId}_${firstGender}`, label: `${divisions.find(d => d.id === divId).label}（${firstLabel}）` },
          results: []
        });
        divisionResults.push(resultsByDivision[`${divId}_${secondGender}`] || {
          division: { ...divisions.find(d => d.id === divId), id: `${divId}_${secondGender}`, label: `${divisions.find(d => d.id === divId).label}（${secondLabel}）` },
          results: []
        });
      } else {
        divisionResults.push(resultsByDivision[divId] || {
          division: divisions.find(d => d.id === divId),
          results: []
        });
      }
    });

    // Generate HTML for each division
    divisionResults.forEach((divisionData, index) => {
      const isLast = index === divisionResults.length - 1;
      html += `<div class="division ${isLast ? 'last-page' : 'page'}">`;
      html += `<h2>${divisionData.division.label}</h2>`;
      
      if (divisionData.results.length === 0) {
        html += `<div class="no-results">この部門の最終順位表の記録がありません<br>（表彰範囲：${awardRankLimit}位まで）</div>`;
      } else {
        html += `<table>`;
        html += `<thead><tr>`;
        html += `<th>順位</th><th>氏名</th><th>所属</th><th>段位</th><th>決定方法</th><th>詳細</th>`;
        html += `</tr></thead><tbody>`;
        
        divisionData.results.forEach(result => {
          const archer = archers.find(a => a.archerId === result.archerId);
          const method = result.shootOffType === 'shichuma' ? '射詰'
                        : result.shootOffType === 'enkin' ? '遠近'
                        : result.rank_source === 'confirmed' ? '的中数' : '-';
          
          const detail = result.shootOffType === 'shichuma'
            ? (result.isWinner ? '優勝' : (result.pendingEnkin ? '遠近待ち' : (result.eliminatedAt ? `${result.eliminatedAt}本目脱落` : `射詰${result.rank}位`)))
            : result.shootOffType === 'enkin'
              ? `遠近競射${result.rank}位${result.targetRank ? ` (対象順位: ${result.targetRank}位)` : ''}`
              : result.shootOffType === 'confirmed'
                ? `${result.hitCount}本的中`
                : '-';

          html += `<tr>`;
          html += `<td class="rank">${result.rank}位</td>`;
          html += `<td>${result.name}</td>`;
          html += `<td>${result.affiliation}</td>`;
          html += `<td>${archer?.rank || '-'}</td>`;
          html += `<td class="method">${method}</td>`;
          html += `<td class="detail">${detail}</td>`;
          html += `</tr>`;
        });
        
        html += `</tbody></table>`;
      }
      html += `</div>`;
    });

    html += `</body></html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    } else {
      alert('印刷ウィンドウを開けませんでした。ポップアップブロックを確認してください。');
    }
  };

  const printProgram = () => {
    if (!selectedTournamentId) { alert('大会を選択してください'); return; }
    const printSource = programTableMode === 'all_applicants' ? allApplicants : archers;

    const perPage = archersPerPage;
    const pages = Math.max(1, Math.ceil(printSource.length / perPage));
    const title = tournament?.data?.name || selectedTournamentId;
    const attachmentsForPrint = getStoredAttachments(selectedTournamentId);

    const styles = `
      body{font-family: Arial, Helvetica, sans-serif; padding:20px; color:#111}
      h1,h2{margin:0 0 8px}
      .tourney{margin-bottom:16px}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th,td{border:1px solid #ddd;padding:6px;font-size:12px}
      th{background:#f7f7f7}
      .page{page-break-after:always;margin-bottom:20px}
      .att{margin-top:10px}
      .att-item{margin:0 0 8px}
      .att-img{max-width:100%;height:auto;border:1px solid #ddd}
    `;

    let html = `<!doctype html><html><head><meta charset="utf-8"><title>${title} プログラム</title><style>${styles}</style></head><body>`;

    // Page 1: tournament info only
    html += `<div class="page"><div class="tourney"><h1>${title}</h1>`;
    html += `<p>${tournament?.data?.datetime || ''}</p>`;
    html += `<p>${tournament?.data?.location || ''}</p>`;
    html += `<p>目的: ${tournament?.data?.purpose || ''}</p>`;
    html += `<p>主催: ${tournament?.data?.organizer || ''}</p>`;
    html += `<p>後援: ${tournament?.data?.coOrganizer || ''}</p>`;
    html += `<p>主管: ${tournament?.data?.administrator || ''}</p>`;
    html += `<p>種目: ${tournament?.data?.event || ''}</p>`;
    html += `<p>種類: ${tournament?.data?.type || ''}</p>`;
    html += `<p>種別: ${tournament?.data?.category || ''}</p>`;
    html += `<p>内容: ${tournament?.data?.description || ''}</p>`;
    html += `<p>競技方法: ${tournament?.data?.competitionMethod || ''}</p>`;
    html += `<p>表彰: ${tournament?.data?.award || ''}</p>`;
    html += `<p>参加資格: ${tournament?.data?.qualifications || ''}</p>`;
    html += `<p>適用規則: ${tournament?.data?.applicableRules || ''}</p>`;
    html += `<p>申込方法: ${tournament?.data?.applicationMethod || ''}</p>`;
    html += `<p>その他: ${tournament?.data?.remarks || ''}</p>`;
    if (attachmentsForPrint.length > 0) {
      html += `<div class="att"><h2 style="margin:0 0 6px">添付資料</h2><ul style="margin:0;padding-left:18px">`;
      for (const att of attachmentsForPrint) {
        const safeName = (att?.name || 'file').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const href = att?.dataUrl || '';
        html += `<li style="margin:0 0 4px"><a href="${href}" target="_blank" rel="noopener noreferrer">${safeName}</a></li>`;
      }
      html += `</ul>`;
      for (const att of attachmentsForPrint) {
        const href = att?.dataUrl || '';
        const type = (att?.type || '').toLowerCase();
        const isImage = type.startsWith('image/') || href.startsWith('data:image/');
        if (!isImage || !href) continue;
        const safeName = (att?.name || 'image').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        html += `<div class="att-item"><div style="font-size:12px;margin:6px 0 4px">${safeName}</div><img class="att-img" src="${href}" alt="${safeName}" /></div>`;
      }
      html += `</div>`;
    }
    html += `</div></div>`;

    for (let p = 0; p < pages; p++) {
      html += `<div class="page">`;
      html += `<h2 style="margin:0 0 8px">立ち順表</h2>`;

      if (programTableMode === 'all_applicants') {
        html += `<table><thead><tr><th>#</th><th>氏名</th><th>所属</th><th>段位</th><th>性別</th></tr></thead><tbody>`;
      } else {
        const arrows1 = tournament?.data?.arrowsRound1
                      ?? tournament?.arrowsRound1
                      ?? state.tournament?.arrowsRound1
                      ?? 4;
        const arrows2 = tournament?.data?.arrowsRound2
                      ?? tournament?.arrowsRound2
                      ?? state.tournament?.arrowsRound2
                      ?? 4;
        html += `<table><thead><tr><th>#</th><th>氏名</th><th>所属</th><th>段位</th><th>性別</th><th>1立ち目</th><th>2立ち目</th></tr></thead><tbody>`;

        const archersPerStand = tournament?.data?.archersPerStand
                              ?? tournament?.archersPerStand
                              ?? state.tournament?.archersPerStand
                              ?? 6;
        const enableGenderSeparation = tournament?.data?.enableGenderSeparation
                                    ?? tournament?.enableGenderSeparation
                                    ?? state.tournament?.enableGenderSeparation
                                    ?? false;
        const femaleFirstForPrint = enableGenderSeparation && (tournament?.data?.femaleFirst ?? false);

        const localDivisions = (tournament?.data?.divisions) || [
          { id: 'lower' }, { id: 'middle' }, { id: 'title' }
        ];
        const normalizeRankLocal = (r) => {
          if (!r) return '無指定';
          return String(r).trim().replace(/[\s　]+/g, '')
            .replace(/[１２]/g, (m) => (m === '１' ? '1' : '2'))
            .replace(/[３４５]/g, (m) => (m === '３' ? '3' : m === '４' ? '4' : '5'))
            .replace('二段', '弐段')
            .replace('三段', '参段')
            .replace('二級', '弐級')
            .replace('一級', '壱級')
            .replace(/5級/g, '五級')
            .replace(/4級/g, '四級')
            .replace(/3級/g, '三級')
            .replace(/2級/g, '弐級')
            .replace(/1級/g, '壱級')
            .replace(/2段/g, '弐段')
            .replace(/3段/g, '参段')
            .replace(/錬士5段/g, '錬士五段')
            .replace(/錬士6段/g, '錬士六段')
            .replace(/教士7段/g, '教士七段')
            .replace(/教士8段/g, '教士八段')
            .replace(/範士8段/g, '範士八段')
            .replace(/範士9段/g, '範士九段');
        };

        const divisionOrderForPrint = [...localDivisions]
          .sort((a, b) => {
            const ai = a?.minRank ? rankOrderLocal.indexOf(normalizeRankLocal(a.minRank)) : 0;
            const bi = b?.minRank ? rankOrderLocal.indexOf(normalizeRankLocal(b.minRank)) : 0;
            const as = ai === -1 ? Number.POSITIVE_INFINITY : ai;
            const bs = bi === -1 ? Number.POSITIVE_INFINITY : bi;
            return as - bs;
          })
          .map(d => d?.id)
          .filter(Boolean);

        const getDivisionIdLocal = (archer) => {
          const rIdx = rankOrderLocal.indexOf(normalizeRankLocal(archer?.rank));
          for (const d of localDivisions) {
            const minIdx = d?.minRank ? rankOrderLocal.indexOf(normalizeRankLocal(d.minRank)) : 0;
            const maxIdx = d?.maxRank ? rankOrderLocal.indexOf(normalizeRankLocal(d.maxRank)) : rankOrderLocal.length - 1;
            if (rIdx >= minIdx && rIdx <= maxIdx) return d.id;
          }
          return 'unassigned';
        };

        const checkedInForPrint = printSource.filter(a => a.isCheckedIn);
        const sortedCheckedInForPrint = [...checkedInForPrint].sort((a, b) => {
          if (enableGenderSeparation) {
            const adiv = getDivisionIdLocal(a);
            const bdiv = getDivisionIdLocal(b);
            const adi = divisionOrderForPrint.indexOf(adiv);
            const bdi = divisionOrderForPrint.indexOf(bdiv);
            if (adi !== bdi) {
              if (adi === -1) return 1;
              if (bdi === -1) return -1;
              return adi - bdi;
            }

            const ag = a.gender || 'male', bg = b.gender || 'male';
            if (ag !== bg) return femaleFirstForPrint
              ? (ag === 'female' ? -1 : 1)
              : (ag === 'male' ? -1 : 1);
          }
          const ai = rankOrderLocal.indexOf(normalizeRankLocal(a.rank));
          const bi = rankOrderLocal.indexOf(normalizeRankLocal(b.rank));
          if (ai !== bi) {
            if (ai === -1) return 1;
            if (bi === -1) return -1;
            return ai - bi;
          }
          const ad = a.rankAcquiredDate ? new Date(a.rankAcquiredDate).getTime() : Number.NEGATIVE_INFINITY;
          const bd = b.rankAcquiredDate ? new Date(b.rankAcquiredDate).getTime() : Number.NEGATIVE_INFINITY;
          return bd - ad;
        });

        const getStandNumForPrint = (archer) => {
          const divId = getDivLocal(archer);
          const sameDiv = sortedCheckedInForPrint.filter(a => getDivLocal(a) === divId);
          const idx = sameDiv.findIndex(a => a.archerId === archer.archerId);
          if (idx === -1) return null;
          return Math.floor(idx / archersPerStand) + 1;
        };

        const getArcherRoundResultsForPrint = (archer, roundNum) => {
          const arrowsRound1 = state.tournament?.arrowsRound1
                          ?? tournament?.data?.arrowsRound1
                          ?? tournament?.arrowsRound1
                          ?? 4;
          const arrowsRound2 = state.tournament?.arrowsRound2
                          ?? tournament?.data?.arrowsRound2
                          ?? tournament?.arrowsRound2
                          ?? 4;

          const standNum = getStandNumForPrint(archer);
          if (standNum === null) return [];
          const standKey = `stand${standNum}`;
          const standResults = archer.results?.[standKey] || [];
          if (standResults.length === 0) return [];
          if (roundNum === 1) return standResults.slice(0, arrowsRound1);
          return standResults.slice(arrowsRound1, arrowsRound1 + arrowsRound2);
        };

        const sym = (r) => r === 'o' ? '◯' : r === 'x' ? '×' : r === '?' ? '?' : '';

        // 印刷対象の矢数分を空枠で埋めるために arrows1/arrows2 を参照する
        // （ここで宣言した arrows1/arrows2 はこの else ブロック内で有効）

        // NOTE: 行生成の中で getArcherRoundResultsForPrint/sym を使用する
        //       ため、この else ブロック内でのみ結果列を構築する

        const start = p * perPage;
        const end = Math.min(start + perPage, printSource.length);
        for (let i = start; i < end; i++) {
          const a = printSource[i];
          html += `<tr><td style="width:60px">${a.standOrder || i+1}</td><td>${a.name || ''}</td><td>${a.affiliation || ''}</td><td>${a.rank || ''}</td><td>${a.gender === 'female' ? '女' : '男'}</td>`;

          // 1立ち目 results
          html += `<td style="white-space:nowrap;text-align:center">`;
          const r1 = getArcherRoundResultsForPrint(a, 1);
          if (r1.length > 0) {
            r1.forEach(r => {
              const color = r === 'o' ? '#16a34a' : r === 'x' ? '#dc2626' : '#9ca3af';
              html += `<span style="display:inline-block;width:20px;text-align:center;font-size:13px;color:${color};font-weight:${r === 'o' ? 700 : 400}">${sym(r)}</span>`;
            });
          } else {
            for (let x = 0; x < arrows1; x++) html += `<span style="display:inline-block;width:20px;text-align:center">&nbsp;</span>`;
          }
          html += `</td>`;

          // 2立ち目 results
          html += `<td style="white-space:nowrap;text-align:center">`;
          const r2 = getArcherRoundResultsForPrint(a, 2);
          if (r2.length > 0) {
            r2.forEach(r => {
              const color = r === 'o' ? '#16a34a' : r === 'x' ? '#dc2626' : '#9ca3af';
              html += `<span style="display:inline-block;width:20px;text-align:center;font-size:13px;color:${color};font-weight:${r === 'o' ? 700 : 400}">${sym(r)}</span>`;
            });
          } else {
            for (let x = 0; x < arrows2; x++) html += `<span style="display:inline-block;width:20px;text-align:center">&nbsp;</span>`;
          }
          html += `</td></tr>`;
        }

        html += `</tbody></table></div>`;
        continue;
      }

      const start = p * perPage;
      const end = Math.min(start + perPage, printSource.length);
      for (let i = start; i < end; i++) {
        const a = printSource[i];
        html += `<tr><td style="width:60px">${a.standOrder || i+1}</td><td>${a.name || ''}</td><td>${a.affiliation || ''}</td><td>${a.rank || ''}</td><td>${a.gender === 'female' ? '女' : '男'}</td></tr>`;
      }

      html += `</tbody></table></div>`;
    }

    const escapeHtml = (s) => String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    const awardRankLimit = tournament?.data?.awardRankLimit || 3;
    const buildFinalResultsRows = (results, getArcherById) => {
      return results
        .filter(r => typeof r.rank === 'number' && r.rank <= awardRankLimit && r.rank > 0 && r.rank !== '敗退' && !r.isDefeated)
        .sort((a, b) => a.rank - b.rank)
        .map(r => {
          const a = getArcherById(r.archerId);
          const method = r.shootOffType === 'shichuma' ? '射詰'
                      : r.shootOffType === 'enkin' ? '遠近'
                      : r.rank_source === 'confirmed' ? '的中数' : '-';
          const detail = r.shootOffType === 'shichuma'
            ? (r.isWinner ? '優勝' : (r.pendingEnkin ? '遠近待ち' : (r.eliminatedAt ? `${r.eliminatedAt}本目脱落` : `射詰${r.rank}位`)))
            : r.shootOffType === 'enkin'
              ? `遠近競射${r.rank}位${r.targetRank ? ` (対象順位: ${r.targetRank}位)` : ''}`
              : r.shootOffType === 'confirmed'
                ? `${r.hitCount}本的中`
                : '-';

          return `<tr>`
            + `<td style="font-weight:700">${escapeHtml(r.rank)}位</td>`
            + `<td>${escapeHtml(r.name)}</td>`
            + `<td>${escapeHtml(r.affiliation)}</td>`
            + `<td>${escapeHtml(a?.rank || '-')}</td>`
            + `<td style="text-align:center">${escapeHtml(method)}</td>`
            + `<td style="text-align:center">${escapeHtml(detail)}</td>`
            + `</tr>`;
        })
        .join('');
    };

    const buildFinalResultsHtml = () => {
      if (!finalResults || (!finalResults.shichuma && !finalResults.enkin)) {
        return `<div class="page"><h2 style="margin:0 0 8px">🏆 最終順位表</h2><p style="margin:8px 0;color:#666">最終順位表の記録がありません</p></div>`;
      }

      const mergedResults = [];
      const enkinArcherIds = new Set(
        (finalResults.enkin?.results || []).map(r => r.archerId)
      );
      const processedArcherIds = new Set();
      const getArcherById = (id) => archers.find(a => a.archerId === id);

      if (finalResults.shichuma && finalResults.shichuma.results) {
        [...finalResults.shichuma.results]
          .sort((a, b) => a.rank - b.rank)
          .forEach(result => {
            const a = getArcherById(result.archerId);
            if (!a) return;

            const isFromShichumaToEnkin = result.pendingEnkin || enkinArcherIds.has(result.archerId);
            if (isFromShichumaToEnkin) return;

            if (processedArcherIds.has(result.archerId)) return;

            mergedResults.push({
              archerId: result.archerId,
              name: a.name,
              affiliation: a.affiliation,
              rank: result.rank,
              rank_source: 'shichuma',
              shootOffType: 'shichuma',
              isWinner: result.isWinner,
              eliminatedAt: result.eliminatedAt,
              consecutiveHits: result.consecutiveHits,
              isDefeated: result.isDefeated,
              pendingEnkin: result.pendingEnkin,
              divisionId: getDivisionIdForArcher(a)
            });
            processedArcherIds.add(result.archerId);
          });
      }

      if (finalResults.enkin && finalResults.enkin.results) {
        [...finalResults.enkin.results]
          .sort((a, b) => {
            const aTarget = a.targetRank != null ? a.targetRank : 9999;
            const bTarget = b.targetRank != null ? b.targetRank : 9999;
            if (aTarget !== bTarget) return aTarget - bTarget;
            return (parseInt(a.rank) || 9999) - (parseInt(b.rank) || 9999);
          })
          .forEach(result => {
            const a = getArcherById(result.archerId);
            if (!a) return;
            if (result.rank === '敗退' || result.isDefeated) return;

            if (processedArcherIds.has(result.archerId)) return;

            mergedResults.push({
              archerId: result.archerId,
              name: a.name,
              affiliation: a.affiliation,
              rank: typeof result.rank === 'number' ? result.rank : parseInt(result.rank),
              rank_source: 'enkin',
              shootOffType: 'enkin',
              targetRank: result.targetRank,
              isDefeated: result.isDefeated,
              divisionId: getDivisionIdForArcher(a)
            });
            processedArcherIds.add(result.archerId);
          });
      }

      const resultsByDivision = {};
      const baseDivisions = (tournament?.data?.divisions) || divisions;
      baseDivisions.forEach(div => {
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

      mergedResults.forEach(r => {
        const a = getArcherById(r.archerId);
        if (!a) return;
        const divId = getDivisionIdForArcher(a);
        const gender = a.gender || 'male';
        const key = enableGenderSeparation ? `${divId}_${gender}` : divId;
        if (!resultsByDivision[key]) {
          resultsByDivision[key] = {
            division: { id: key, label: key },
            results: []
          };
        }
        resultsByDivision[key].results.push(r);
      });

      Object.keys(resultsByDivision).forEach(k => {
        resultsByDivision[k].results = resultsByDivision[k].results
          .filter(r => typeof r.rank === 'number' && r.rank <= awardRankLimit && r.rank > 0 && r.rank !== '敗退' && !r.isDefeated)
          .sort((a, b) => a.rank - b.rank);
      });

      const orderedDivisions = [];
      baseDivisions.forEach(div => {
        if (enableGenderSeparation) {
          const firstGender = femaleFirst ? 'female' : 'male';
          const secondGender = femaleFirst ? 'male' : 'female';
          const firstLabel = femaleFirst ? '女' : '男';
          const secondLabel = femaleFirst ? '男' : '女';
          orderedDivisions.push(resultsByDivision[`${div.id}_${firstGender}`] || { division: { ...div, id: `${div.id}_${firstGender}`, label: `${div.label}（${firstLabel}）` }, results: [] });
          orderedDivisions.push(resultsByDivision[`${div.id}_${secondGender}`] || { division: { ...div, id: `${div.id}_${secondGender}`, label: `${div.label}（${secondLabel}）` }, results: [] });
        } else {
          orderedDivisions.push(resultsByDivision[div.id] || { division: div, results: [] });
        }
      });

      let block = `<div class="page"><h2 style="margin:0 0 8px">🏆 最終順位表</h2>`
        + `<p style="margin:0 0 8px;color:#555">表彰範囲：${escapeHtml(awardRankLimit)}位まで</p>`;

      orderedDivisions.forEach(divData => {
        block += `<h3 style="margin:14px 0 6px">${escapeHtml(divData.division.label || divData.division.id)}</h3>`;
        block += `<table><thead><tr>`
          + `<th>順位</th><th>氏名</th><th>所属</th><th>段位</th><th>決定方法</th><th>詳細</th>`
          + `</tr></thead><tbody>`;
        if (!divData.results || divData.results.length === 0) {
          block += `<tr><td colspan="6" style="text-align:center;color:#666;padding:16px">この部門の最終順位表の記録がありません</td></tr>`;
        } else {
          block += buildFinalResultsRows(divData.results, getArcherById);
        }
        block += `</tbody></table>`;
      });
      block += `</div>`;
      return block;
    };

    if (programTableMode !== 'all_applicants') {
      html += buildFinalResultsHtml();
    }

    html += `</body></html>`;

    const win = window.open('', '_blank');
    if (!win) { alert('ポップアップがブロックされました。ポップアップを許可してください。'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 300);
  };

  const downloadProgramPdf = async () => {
    if (!selectedTournamentId) { alert('大会を選択してください'); return; }
    const title = tournament?.data?.name || selectedTournamentId;
    const exportSource = programTableMode === 'all_applicants' ? allApplicants : archers;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const fontInfo = await ensureJapaneseFont(doc);
    doc.setFontSize(14);
    doc.text(`${title} プログラム表`, 14, 16);
    doc.setFontSize(10);
    const datetime = tournament?.data?.datetime || '';
    const location = tournament?.data?.location || '';
    if (datetime) doc.text(datetime, 14, 22);
    if (location) doc.text(location, 14, 27);

    const head = programTableMode === 'all_applicants'
      ? [['#', '氏名', '所属', '段位', '性別']]
      : [['#', '氏名', '所属', '段位', '性別', '1立ち目', '2立ち目']];

    const body = exportSource.map((a, idx) => {
      const base = [
        String(a.standOrder || idx + 1),
        String(a.name || ''),
        String(a.affiliation || ''),
        String(a.rank || ''),
        a.gender === 'female' ? '女' : '男'
      ];
      if (programTableMode === 'all_applicants') return base;

      const r1 = getArcherRoundResults(a, 1).map(resultSymbol).join('');
      const r2 = getArcherRoundResults(a, 2).map(resultSymbol).join('');
      return [...base, r1, r2];
    });

    autoTable(doc, {
      head,
      body,
      startY: 32,
      styles: { fontSize: 9, cellPadding: 1.5, ...(fontInfo?.loaded ? { font: fontInfo.fontName } : {}) },
      headStyles: { fillColor: [245, 245, 245], textColor: 20 },
      margin: { left: 10, right: 10 }
    });

    const safeTitle = String(title).replace(/[\\/:*?"<>|]/g, '_');
    doc.save(`${safeTitle}_program.pdf`);
  };

  const downloadProgramExcel = () => {
    if (!selectedTournamentId) { alert('大会を選択してください'); return; }
    const title = tournament?.data?.name || selectedTournamentId;
    const exportSource = programTableMode === 'all_applicants' ? allApplicants : archers;

    const header = programTableMode === 'all_applicants'
      ? ['#', '氏名', '所属', '段位', '性別']
      : ['#', '氏名', '所属', '段位', '性別', '1立ち目', '2立ち目'];

    const rows = exportSource.map((a, idx) => {
      const base = [
        a.standOrder || idx + 1,
        a.name || '',
        a.affiliation || '',
        a.rank || '',
        a.gender === 'female' ? '女' : '男'
      ];
      if (programTableMode === 'all_applicants') return base;

      const r1 = getArcherRoundResults(a, 1).map(resultSymbol).join('');
      const r2 = getArcherRoundResults(a, 2).map(resultSymbol).join('');
      return [...base, r1, r2];
    });

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'program');
    const safeTitle = String(title).replace(/[\\/:*?"<>|]/g, '_');
    XLSX.writeFile(wb, `${safeTitle}_program.xlsx`);
  };

  const programSource = useMemo(() => {
    return programTableMode === 'all_applicants' ? allApplicants : archers;
  }, [programTableMode, allApplicants, archers]);

  const totalPages = Math.max(1, Math.ceil(programSource.length / archersPerPage));
  const [currentPage, setCurrentPage] = useState(1);
  const indexOfFirst = (currentPage - 1) * archersPerPage;
  const indexOfLast = indexOfFirst + archersPerPage;
  const currentArchers = useMemo(() => programSource.slice(indexOfFirst, indexOfLast), [programSource, indexOfFirst, indexOfLast]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn" onClick={printProgram}>🖨️ 印刷</button>
          <button className="btn" onClick={downloadProgramPdf}>PDF</button>
          <button className="btn" onClick={downloadProgramExcel}>Excel</button>
        </div>
      </div>

      <div className="view-content">
        {!selectedTournamentId ? (
          <div className="card">大会を選択してください</div>
        ) : (
          <>
            <div className="card" style={{ marginBottom: '1rem' }}>
              <h2 className="card-title">大会概要</h2>
              <p><strong>大会名:</strong> {tournament?.data?.name || '未設定'}</p>
              <p><strong>日時:</strong> {tournament?.data?.datetime || '未設定'}</p>
              <p><strong>場所:</strong> {tournament?.data?.location || '未設定'}</p>
              <p><strong>目的:</strong> {tournament?.data?.purpose || '-'}</p>
              <p><strong>主催:</strong> {tournament?.data?.organizer || '-'}</p>
              <p><strong>後援:</strong> {tournament?.data?.coOrganizer || '-'}</p>
              <p><strong>主管:</strong> {tournament?.data?.administrator || '-'}</p>
              <p><strong>種目:</strong> {tournament?.data?.event || '-'}</p>
              <p><strong>種類:</strong> {tournament?.data?.type || '-'}</p>
              <p><strong>種別:</strong> {tournament?.data?.category || '-'}</p>
              <p><strong>内容:</strong> {tournament?.data?.description || '-'}</p>
              <p><strong>競技方法:</strong> {tournament?.data?.competitionMethod || '-'}</p>
              <p><strong>表彰:</strong> {tournament?.data?.award || '-'}</p>
              <p><strong>参加資格:</strong> {tournament?.data?.qualifications || '-'}</p>
              <p><strong>適用規則:</strong> {tournament?.data?.applicableRules || '-'}</p>
              <p><strong>申込方法:</strong> {tournament?.data?.applicationMethod || '-'}</p>
              <p><strong>その他:</strong> {tournament?.data?.remarks || '-'}</p>
            </div>

            <div className="card" style={{ marginBottom: '1rem' }}>
              <h2 className="card-title">添付資料</h2>
              {attachments.length > 0 ? (
                <div className="space-y-2">
                  {attachments.map((att, idx) => (
                    <div key={`${att?.name || 'file'}_${idx}`} className="flex items-center justify-between">
                      <a className="text-sm text-blue-600 hover:underline" href={att?.dataUrl || ''} target="_blank" rel="noopener noreferrer">
                        {att?.name || `file_${idx+1}`}
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">添付資料はありません</p>
              )}
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <h2 className="card-title">立ち順表</h2>
                <div className="flex items-center gap-2">
                  <button
                    className={`btn ${programTableMode === 'checked_in' ? 'btn-active' : ''}`}
                    onClick={() => { setProgramTableMode('checked_in'); setCurrentPage(1); }}
                  >
                    チェックイン済み
                  </button>
                  <button
                    className={`btn ${programTableMode === 'all_applicants' ? 'btn-active' : ''}`}
                    onClick={() => { setProgramTableMode('all_applicants'); setCurrentPage(1); }}
                  >
                    申込者全員
                  </button>
                </div>
              </div>
              <div className="table-responsive">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">氏名</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">所属</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">段位</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">性別</th>
                      {programTableMode === 'checked_in' && (
                        <>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">1立ち目</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">2立ち目</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {isLoading && programSource.length === 0 ? (
                      <tr><td colSpan={programTableMode === 'checked_in' ? 7 : 5} className="px-4 py-4 text-center">読み込み中...</td></tr>
                    ) : programSource.length === 0 ? (
                      <tr><td colSpan={programTableMode === 'checked_in' ? 7 : 5} className="px-4 py-4 text-center">選手が登録されていません</td></tr>
                    ) : (
                      currentArchers.map(a => (
                        <tr key={a.archerId}>
                          <td className="px-4 py-3 text-sm font-medium">{a.standOrder}</td>
                          <td className="px-4 py-3">{a.name}</td>
                          <td className="px-4 py-3">{a.affiliation}</td>
                          <td className="px-4 py-3 text-center">{a.rank}</td>
                          <td className="px-4 py-3 text-center">{a.gender === 'female' ? '女' : '男'}</td>

                          {programTableMode === 'checked_in' && (
                            <>
                              <td className="px-4 py-3">
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
                                  {getArcherRoundResults(a, 1).map((r, idx) => (
                                    <span key={idx} style={{
                                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                      width: '20px', height: '20px', fontSize: '13px',
                                      color: r === 'o' ? '#16a34a' : r === 'x' ? '#dc2626' : '#6b7280',
                                      fontWeight: r === 'o' ? 700 : 400
                                    }}>
                                      {resultSymbol(r) || '　'}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
                                  {getArcherRoundResults(a, 2).map((r, idx) => (
                                    <span key={idx} style={{
                                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                      width: '20px', height: '20px', fontSize: '13px',
                                      color: r === 'o' ? '#16a34a' : r === 'x' ? '#dc2626' : '#6b7280',
                                      fontWeight: r === 'o' ? 700 : 400
                                    }}>
                                      {resultSymbol(r) || '　'}
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {programSource.length > archersPerPage && (
                <div className="flex items-center justify-between mt-4">
                  <div>
                    <p className="text-sm">{indexOfFirst + 1} 〜 {Math.min(indexOfLast, programSource.length)} / {programSource.length} 名</p>
                  </div>
                  <div className="flex space-x-1">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1} className="btn">前へ</button>
                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                      {Array.from({ length: totalPages }, (_, i) => (
                        <button key={i} onClick={() => setCurrentPage(i+1)} className={`btn ${currentPage === i+1 ? 'btn-active' : ''}`}>{i+1}</button>
                      ))}
                    </div>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages} className="btn">次へ</button>
                  </div>
                </div>
              )}
            </div>

            {renderFinalResults()}
          </>
        )}
      </div>
    </div>
  );
};

export default ProgramView;