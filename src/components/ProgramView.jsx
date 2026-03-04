import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { getStoredAttachments } from '../utils/tournament';
import { API_URL } from '../utils/api';
import { ensureJapaneseFont } from '../utils/jspdfJapaneseFont';
import { autoSelectTournamentByGeolocationAndDate } from '../utils/tournamentSelection';
import { groupByTeam, calculateTeamHitCount, generateTeamStandOrder, fetchTeamOrder, saveTeamOrder } from '../utils/teamCompetition';

const ProgramView = ({ state }) => {

  const [selectedTournamentId, setSelectedTournamentId] = useState(() => localStorage.getItem('selectedTournamentId') || '');
  const [archers, setArchers] = useState([]);
  const [allApplicants, setAllApplicants] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [geoStatus, setGeoStatus] = useState('');
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

        // 団体戦の場合はチームごとにグループ化してランダム配置
        let sortedAll;
        if (tournament?.data?.competitionType === 'team') {
          // チームごとにグループ化
          const teamGroups = {};
          applicants.forEach(archer => {
            if (archer.isTeamMember && archer.teamName) {
              const teamKey = `${archer.affiliation}_${archer.teamName}`;
              if (!teamGroups[teamKey]) {
                teamGroups[teamKey] = [];
              }
              teamGroups[teamKey].push(archer);
            }
          });
          
          // 各チーム内でメンバーを登録順にソート
          Object.values(teamGroups).forEach(team => {
            team.sort((a, b) => new Date(a.appliedAt) - new Date(b.appliedAt));
          });
          
          // 保存されたチーム順序を取得
          const savedOrder = await fetchTeamOrder(selectedTournamentId);
          
          // チームをランダムにシャッフル（保存された順序があればそれを使用）
          const teamKeys = Object.keys(teamGroups);
          let orderedTeamKeys;
          
          if (savedOrder && Array.isArray(savedOrder) && savedOrder.length > 0) {
            // 保存された順序を使用
            orderedTeamKeys = savedOrder.filter(key => teamKeys.includes(key));
            // 新しいチームがあれば末尾に追加
            const newTeams = teamKeys.filter(key => !savedOrder.includes(key));
            if (newTeams.length > 0) {
              orderedTeamKeys = [...orderedTeamKeys, ...newTeams];
              // 新しいチームが追加された場合のみ保存
              await saveTeamOrder(selectedTournamentId, orderedTeamKeys);
            }
          } else {
            // 新規にランダム配置
            orderedTeamKeys = [...teamKeys];
            for (let i = orderedTeamKeys.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [orderedTeamKeys[i], orderedTeamKeys[j]] = [orderedTeamKeys[j], orderedTeamKeys[i]];
            }
            // 順序を保存
            await saveTeamOrder(selectedTournamentId, orderedTeamKeys);
          }
          
          // シャッフルされた順序でチームメンバーを配列に追加
          sortedAll = [];
          orderedTeamKeys.forEach(teamKey => {
            sortedAll.push(...teamGroups[teamKey]);
          });
        } else {
          // 個人戦の場合は従来のソート
          sortedAll = [...applicants].sort((a, b) => {
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
          });
        }
        
        // standOrderを付与
        sortedAll = sortedAll.map((s, idx) => ({ ...s, standOrder: idx + 1 }));

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
  const isTeamCompetition = tournament?.data?.competitionType === 'team';

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

    // === RankingViewのcategorizedGroups.confirmedと同一ロジックで的中数確定結果を生成 ===
    const awardRankLimit = tournament?.data?.awardRankLimit || 3;

    const getTotalHitCount = (archer) => {
      const arrows1 = tournament?.data?.arrowsRound1 ?? 4;
      const arrows2 = tournament?.data?.arrowsRound2 ?? 4;
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
    };

    // Create confirmed results from archers data (RankingView categorizedGroups.confirmed equivalent)
    const createConfirmedResults = () => {
      const confirmedResults = [];
      divisions.forEach(div => {
        const divArchers = archers.filter(a => getDivisionIdForArcher(a) === div.id);
        const rankGroups = {};
        divArchers.forEach(archer => {
          const hitCount = getTotalHitCount(archer);
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
              confirmedResults.push({
                archerId: archer.archerId,
                name: archer.name,
                affiliation: archer.affiliation,
                rank: currentRank,
                rank_source: 'confirmed',
                shootOffType: null,
                hitCount: hitCount,
                divisionId: div.id
              });
            });
          }
          currentRank += group.length;
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
    const processedArcherIds = new Set();

    // === RankingViewのgetMergedFinalResults()と同一の部門ごとロジックで統合結果を構築 ===
    divisions.forEach(div => {
      const divArchers = archers.filter(a => getDivisionIdForArcher(a) === div.id);
      const divisionUsedRanks = new Set();
      const divisionProcessedArchers = new Set();

      const divisionEnkinResults = (finalResults?.enkin?.results || []).filter(result => {
        if (result.divisionId) return result.divisionId === div.id;
        return divArchers.some(a => a.archerId === result.archerId);
      });

      // 射詰競射の結果を処理
      if (finalResults?.shichuma?.results) {
        const divShichumaResults = finalResults.shichuma.results.filter(result => {
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
              isWinner: result.isWinner,
              consecutiveHits: result.consecutiveHits,
              eliminatedAt: result.eliminatedAt,
              isDefeated: result.isDefeated,
              pendingEnkin: result.pendingEnkin,
              divisionId: div.id
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

            const isFromShichuma = !!(finalResults?.shichuma?.results?.some(s => s.archerId === result.archerId));
            mergedResults.push({
              archerId: result.archerId,
              name: archer.name,
              affiliation: archer.affiliation,
              rank: finalRank,
              rank_source: 'enkin',
              shootOffType: 'enkin',
              isDefeated: result.isDefeated,
              targetRank: result.targetRank,
              isFromEnkin: isFromShichuma,
              divisionId: div.id
            });
            divisionUsedRanks.add(finalRank);
            divisionProcessedArchers.add(result.archerId);
            processedArcherIds.add(result.archerId);
          });
      }
    });

    // 的中数確定結果を追加（RankingViewのcategorizedGroups.confirmed相当）
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

    // === 部門ごとに結果を分類（RankingViewのrenderMergedResultsと同一ロジック）===
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

    // 表彰範囲でフィルタリング・ソート
    Object.keys(resultsByDivision).forEach(k => {
      resultsByDivision[k].results = resultsByDivision[k].results
        .filter(r => typeof r.rank === 'number' && r.rank <= awardRankLimit && r.rank > 0 && !r.isDefeated && r.rank !== '敗退')
        .sort((a, b) => a.rank - b.rank);
    });

    // 部門順を維持して配列に変換（femaleFirst順序対応）
    const divisionResults = [];
    divisions.forEach(div => {
      if (enableGenderSeparation) {
        const firstG = femaleFirst ? 'female' : 'male';
        const secondG = femaleFirst ? 'male' : 'female';
        const firstL = femaleFirst ? '女' : '男';
        const secondL = femaleFirst ? '男' : '女';
        divisionResults.push(resultsByDivision[`${div.id}_${firstG}`] || { division: { ...div, id: `${div.id}_${firstG}`, label: `${div.label}（${firstL}）` }, results: [] });
        divisionResults.push(resultsByDivision[`${div.id}_${secondG}`] || { division: { ...div, id: `${div.id}_${secondG}`, label: `${div.label}（${secondL}）` }, results: [] });
      } else {
        divisionResults.push(resultsByDivision[div.id] || { division: div, results: [] });
      }
    });

    return (
      <div className="card mt-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="card-title text-green-700">🏆 最終順位表</h3>
            <p className="text-sm text-gray-600 mt-1">表彰範囲：{awardRankLimit}位まで</p>
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
              <span className="text-xs text-gray-500">最終更新: {lastUpdated.toLocaleTimeString('ja-JP')}</span>
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
                    <th className="border border-green-300 px-4 py-2 text-center">的中数</th>
                    <th className="border border-green-300 px-4 py-2 text-left">氏名</th>
                    <th className="border border-green-300 px-4 py-2 text-center">詳細</th>
                    <th className="border border-green-300 px-4 py-2 text-left">所属</th>
                    <th className="border border-green-300 px-4 py-2 text-left">段位</th>
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
                          <td className="border border-green-300 px-4 py-2 text-center font-semibold">
                            {(() => {
                              const getTotalHitCountLocal = (a) => {
                                const arrows1 = tournament?.data?.arrowsRound1 ?? 4;
                                const arrows2 = tournament?.data?.arrowsRound2 ?? 4;
                                const total = arrows1 + arrows2;
                                const results = a?.results || {};
                                let count = 0;
                                for (let s = 1; s <= 6; s++) {
                                  const arr = results[`stand${s}`] || [];
                                  for (let i = 0; i < Math.min(total, arr.length); i++) {
                                    if (arr[i] === 'o') count++;
                                  }
                                }
                                return count;
                              };
                              return getTotalHitCountLocal(archer) || '-';
                            })()}
                          </td>
                          <td className="border border-green-300 px-4 py-2 font-semibold">{result.name}</td>
                          {/* 詳細セル - RankingViewと同一 */}
                          <td className="border border-green-300 px-4 py-2 text-sm text-center">
                            {result.shootOffType === 'shichuma' && '射詰'}
                            {result.shootOffType === 'enkin' && '遠近'}
                            {result.rank_source === 'confirmed' && '的中数'}
                            {!result.shootOffType && result.rank_source !== 'confirmed' && '-'}
                          </td>
                          <td className="border border-green-300 px-4 py-2 text-gray-600">{result.affiliation}</td>
                          <td className="border border-green-300 px-4 py-2 text-gray-600">{archer?.rank || '-'}</td>
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

    // Create confirmed results from archers data (RankingView categorizedGroups.confirmed equivalent)
    const createConfirmedResults = () => {
      const confirmedResults = [];
      const awardRankLimitLocal = tournament?.data?.awardRankLimit || 3;
      const getTotalHitCountLocal = (archer) => {
        const arrows1 = tournament?.data?.arrowsRound1 ?? 4;
        const arrows2 = tournament?.data?.arrowsRound2 ?? 4;
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
      };
      divisions.forEach(div => {
        const divArchers = archers.filter(a => getDivisionIdForArcher(a) === div.id);
        const rankGroups = {};
        divArchers.forEach(archer => {
          const hitCount = getTotalHitCountLocal(archer);
          if (!rankGroups[hitCount]) rankGroups[hitCount] = [];
          rankGroups[hitCount].push(archer);
        });
        const sortedGroups = Object.entries(rankGroups)
          .map(([h, g]) => [parseInt(h), g])
          .sort(([a], [b]) => b - a);
        let currentRank = 1;
        sortedGroups.forEach(([hitCount, group]) => {
          const isTied = group.length > 1;
          const isInAwardRange = currentRank <= awardRankLimitLocal;
          if (!isTied && isInAwardRange) {
            group.forEach(archer => {
              confirmedResults.push({
                archerId: archer.archerId,
                name: archer.name,
                affiliation: archer.affiliation,
                rank: currentRank,
                rank_source: 'confirmed',
                shootOffType: null,
                hitCount: hitCount,
                divisionId: div.id
              });
            });
          }
          currentRank += group.length;
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
      body{font-family: Arial, Helvetica, sans-serif; padding:6mm; color:#111}
      h1,h2{margin:0 0 8px}
      .header{margin-bottom:12px}
      .division{margin-bottom:16px;page-break-inside:avoid}
      table{width:100%;border-collapse:collapse;margin-top:6px}
      th,td{border:1px solid #333;padding:1.8mm;font-size:8.5pt;text-align:left}
      th{background:#dcdcdc;font-weight:700;text-align:center}
      .rank{font-weight:700;text-align:center}
      .method{text-align:center}
      .detail{text-align:center;font-size:8pt}
      .no-results{text-align:center;color:#666;padding:12px}
      .page{page-break-after:always}
      .last-page{page-break-after:auto}
      .print-button{position:fixed;top:20px;right:20px;padding:12px 24px;background:#2563eb;color:white;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;box-shadow:0 4px 6px rgba(0,0,0,0.1);z-index:1000}
      .print-button:hover{background:#1d4ed8}
      @media print{.print-button{display:none}}
    `;

    let html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${styles}</style></head><body>`;
    html += `<button class="print-button" onclick="window.print()">🖨️ 印刷する</button>`;
    
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
        html += `<th>順位</th><th>的中数</th><th>氏名</th><th>詳細</th><th>所属</th><th>段位</th>`;
        html += `</tr></thead><tbody>`;
        
        divisionData.results.forEach(result => {
          const archer = archers.find(a => a.archerId === result.archerId);
          // 的中数を計算
          const getTotalHitCountLocal = (a) => {
            const arrows1 = tournament?.data?.arrowsRound1 ?? 4;
            const arrows2 = tournament?.data?.arrowsRound2 ?? 4;
            const total = arrows1 + arrows2;
            const results = a?.results || {};
            let count = 0;
            for (let s = 1; s <= 6; s++) {
              const arr = results[`stand${s}`] || [];
              for (let i = 0; i < Math.min(total, arr.length); i++) {
                if (arr[i] === 'o') count++;
              }
            }
            return count;
          };
          const hitCount = getTotalHitCountLocal(archer);
          
          // 詳細テキスト - RankingViewと同一ロジック
          let detail = '-';
          if (result.shootOffType === 'shichuma') {
            const hasEnkin = divisionData.results.some(x => x.shootOffType === 'enkin');
            const hasShichuma = divisionData.results.some(x => x.shootOffType === 'shichuma');
            const allByShootOff = divisionData.results.every(x => x.shootOffType === 'shichuma' || x.shootOffType === 'enkin');
            if (hasShichuma && !hasEnkin && allByShootOff) {
              detail = result.isWinner ? '🏆 優勝' : `射詰${result.rank}位`;
            } else {
              if (result.isWinner) detail = '🏆 優勝';
              else if (result.eliminatedAt) detail = `${result.eliminatedAt}本目脱落`;
              else detail = `射詰${result.rank}位`;
            }
          } else if (result.shootOffType === 'enkin') {
            const sameTargetRankResults = (finalResults?.enkin?.results || []).filter(x => x.targetRank === result.targetRank);
            const groupSize = sameTargetRankResults.length;
            const willHaveDefeated = (result.targetRank + groupSize - 1) > awardRankLimit;
            const rangeText = willHaveDefeated || groupSize <= 1
              ? `${result.targetRank}位決定戦`
              : `${result.targetRank}位～${result.targetRank + groupSize - 1}位決定戦`;
            detail = `${rangeText} →${result.rank}位`;
          } else if (result.rank_source === 'confirmed') {
            detail = `${result.hitCount}本的中`;
          }

          html += `<tr>`;
          html += `<td class="rank">${result.rank}位</td>`;
          html += `<td style="text-align:center;font-weight:600">${hitCount || '-'}</td>`;
          html += `<td>${result.name}</td>`;
          html += `<td class="detail">${detail}</td>`;
          html += `<td>${result.affiliation}</td>`;
          html += `<td>${archer?.rank || '-'}</td>`;
          html += `</tr>`;
        });
        
        html += `</tbody></table>`;
      }
      html += `</div>`;
    });

    html += `</body></html>`;

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      alert('ポップアップがブロックされました。ポップアップを許可してください。');
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
  };

  const printProgram = () => {
    if (!selectedTournamentId) { alert('大会を選択してください'); return; }
    
    console.log('🖨️ printProgramが呼ばれました');
    
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
      .print-button{position:fixed;top:20px;right:20px;padding:12px 24px;background:#2563eb;color:white;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;box-shadow:0 4px 6px rgba(0,0,0,0.1);z-index:1000}
      .print-button:hover{background:#1d4ed8}
      @media print{.print-button{display:none}}
    `;

    let html = `<!doctype html><html><head><meta charset="utf-8"><title>${title} プログラム</title><style>${styles}</style></head><body>`;
    html += `<button class="print-button" onclick="window.print()">🖨️ 印刷する</button>`;

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
        html += `<table><thead><tr>`;
        html += `<th rowspan="2">番号</th><th rowspan="2">選手名</th><th rowspan="2">支部</th><th rowspan="2">性別</th><th rowspan="2">称号段位</th>`;
        html += `<th colspan="${arrows1}" style="border-left:2px solid #999">1立目</th>`;
        html += `<th colspan="${arrows2}" style="border-left:2px solid #999">2立目</th>`;
        html += `<th rowspan="2" style="border-left:2px solid #999">競射</th><th rowspan="2">合計</th>`;
        html += `</tr><tr>`;
        for (let i = 1; i <= arrows1; i++) html += `<th style="border-left:1px solid #ddd">${i}</th>`;
        for (let i = 1; i <= arrows2; i++) html += `<th style="border-left:1px solid #ddd">${i}</th>`;
        html += `</tr></thead><tbody>`;

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
        const rankOrderLocal = ['無指定','五級','四級','三級','弐級','壱級','初段','弐段','参段','四段','五段','錬士五段','錬士六段','教士七段','教士八段','範士八段','範士九段'];
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
          const divId = getDivisionIdLocal(archer);
          const sameDiv = sortedCheckedInForPrint.filter(a => getDivisionIdLocal(a) === divId);
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
          const r1 = getArcherRoundResultsForPrint(a, 1);
          const r2 = getArcherRoundResultsForPrint(a, 2);
          const totalHits = [...r1, ...r2].filter(x => x === 'o').length;
          html += `<tr><td style="width:60px">${a.standOrder || i+1}</td><td>${a.name || ''}</td><td>${a.affiliation || ''}</td><td>${a.gender === 'female' ? '女' : '男'}</td><td>${a.rank || ''}</td>`;

          // 1立目 results
          if (r1.length > 0) {
            r1.forEach(r => {
              const color = r === 'o' ? '#16a34a' : r === 'x' ? '#dc2626' : '#9ca3af';
              html += `<td style="border-left:1px solid #ddd;text-align:center;color:${color};font-weight:${r === 'o' ? 700 : 400}">${sym(r)}</td>`;
            });
          } else {
            for (let x = 0; x < arrows1; x++) html += `<td style="border-left:1px solid #ddd;text-align:center">&nbsp;</td>`;
          }

          // 2立目 results
          if (r2.length > 0) {
            r2.forEach(r => {
              const color = r === 'o' ? '#16a34a' : r === 'x' ? '#dc2626' : '#9ca3af';
              html += `<td style="border-left:1px solid #ddd;text-align:center;color:${color};font-weight:${r === 'o' ? 700 : 400}">${sym(r)}</td>`;
            });
          } else {
            for (let x = 0; x < arrows2; x++) html += `<td style="border-left:1px solid #ddd;text-align:center">&nbsp;</td>`;
          }

          html += `<td style="border-left:2px solid #999;text-align:center"></td>`;
          html += `<td style="text-align:center;font-weight:700">${totalHits}</td></tr>`;
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
          // 的中数を計算
          const getTotalHitCountLocal = (archer) => {
            const arrows1 = tournament?.data?.arrowsRound1 ?? 4;
            const arrows2 = tournament?.data?.arrowsRound2 ?? 4;
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
          };
          const hitCount = getTotalHitCountLocal(a);

          // 詳細テキスト - RankingViewと同一ロジック
          let detail = '-';
          if (r.shootOffType === 'shichuma') {
            const hasEnkin = results.some(x => x.shootOffType === 'enkin');
            const hasShichuma = results.some(x => x.shootOffType === 'shichuma');
            const allByShootOff = results.every(x => x.shootOffType === 'shichuma' || x.shootOffType === 'enkin');
            if (hasShichuma && !hasEnkin && allByShootOff) {
              detail = r.isWinner ? '🏆 優勝' : `射詰${r.rank}位`;
            } else {
              if (r.isWinner) detail = '🏆 優勝';
              else if (r.eliminatedAt) detail = `${r.eliminatedAt}本目脱落`;
              else detail = `射詰${r.rank}位`;
            }
          } else if (r.shootOffType === 'enkin') {
            const sameTargetRankResults = (finalResults?.enkin?.results || []).filter(x => x.targetRank === r.targetRank);
            const groupSize = sameTargetRankResults.length;
            const willHaveDefeated = (r.targetRank + groupSize - 1) > awardRankLimit;
            const rangeText = willHaveDefeated || groupSize <= 1
              ? `${r.targetRank}位決定戦`
              : `${r.targetRank}位～${r.targetRank + groupSize - 1}位決定戦`;
            detail = `${rangeText} →${r.rank}位`;
          } else if (r.rank_source === 'confirmed') {
            detail = `${r.hitCount}本的中`;
          }

          return `<tr>`
            + `<td style="font-weight:700">${escapeHtml(r.rank)}位</td>`
            + `<td style="text-align:center;font-weight:600">${escapeHtml(hitCount || '-')}</td>`
            + `<td>${escapeHtml(r.name)}</td>`
            + `<td style="text-align:center">${escapeHtml(detail)}</td>`
            + `<td>${escapeHtml(r.affiliation)}</td>`
            + `<td>${escapeHtml(a?.rank || '-')}</td>`
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
          + `<th>順位</th><th>的中数</th><th>氏名</th><th>詳細</th><th>所属</th><th>段位</th>`
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

    // 常に最終順位表を含める（利用可能な場合）
    if (finalResults && (finalResults.shichuma || finalResults.enkin)) {
      html += buildFinalResultsHtml();
    }

    html += `</body></html>`;

    console.log('📝 HTML生成完了:', html.length, '文字');

    try {
      const win = window.open('', '_blank', 'width=800,height=600');
      console.log('👉 window.open結果:', win);
      
      if (!win) {
        alert('ポップアップがブロックされました。ポップアップを許可してください。');
        return;
      }
      
      win.document.write(html);
      win.document.close();
      win.focus();
      console.log('✅ 印刷プレビューを開きました');
    } catch (error) {
      console.error('❌ エラー:', error);
      alert('印刷プレビューの表示に失敗しました: ' + error.message);
    }
  };

  const downloadProgramPdf = async () => {
    if (!selectedTournamentId) { alert('大会を選択してください'); return; }
    const title = tournament?.data?.name || selectedTournamentId;
    const exportSource = programTableMode === 'all_applicants' ? allApplicants : archers;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const fontInfo = await ensureJapaneseFont(doc);
    
    // 大会名を中央揃えで表示
    doc.setFontSize(16);
    const pageWidth = doc.internal.pageSize.getWidth();
    const titleText = `${title} プログラム表`;
    const titleWidth = doc.getTextWidth(titleText);
    doc.text(titleText, (pageWidth - titleWidth) / 2, 20);

    // 大会概要を追加（画像の順番に合わせる）
    const overview = [
      ['大会期日', tournament?.data?.datetime || ''],
      ['場　　所', tournament?.data?.location || ''],
      ['大会次第', tournament?.data?.schedule || ''],
      ['競技種別', tournament?.data?.category || ''],
      ['競技方法', tournament?.data?.competitionMethod || ''],
      ['表　　彰', tournament?.data?.award || ''],
      ['参加資格', tournament?.data?.qualifications || ''],
      ['適用規則', tournament?.data?.applicableRules || '']
    ].filter(([_, val]) => val);

    if (overview.length > 0) {
      autoTable(doc, {
        body: overview,
        startY: 30,
        styles: { 
          fontSize: 12, 
          cellPadding: 5, 
          lineWidth: 0.3,
          lineColor: [0, 0, 0],
          textColor: [0, 0, 0],
          ...(fontInfo?.loaded ? { font: fontInfo.fontName } : {}) 
        },
        columnStyles: { 
          0: { cellWidth: 45, halign: 'left', fontStyle: 'bold' },
          1: { cellWidth: 125, halign: 'left' }
        },
        margin: { left: 20, right: 20 },
        theme: 'grid'
      });
      doc.addPage();
    }

    const arrows1 = tournament?.data?.arrowsRound1 ?? 2;
    const arrows2 = tournament?.data?.arrowsRound2 ?? 4;

    const head = programTableMode === 'all_applicants'
      ? [['#', '氏名', '所属', '段位', '性別']]
      : [
          [
            { content: '番号', rowSpan: 2 },
            { content: '選手名', rowSpan: 2 },
            { content: '支部', rowSpan: 2 },
            { content: '性別', rowSpan: 2 },
            { content: '称号段位', rowSpan: 2 },
            { content: '1立目', colSpan: arrows1 },
            { content: '2立目', colSpan: arrows2 },
            { content: '競射', rowSpan: 2 },
            { content: '合計', rowSpan: 2 }
          ],
          [...Array.from({ length: arrows1 }, (_, i) => `${i+1}`), ...Array.from({ length: arrows2 }, (_, i) => `${i+1}`)]
        ];

    // 36人ごとにページ分割
    const perPage = archersPerPage;
    const totalPages = Math.ceil(exportSource.length / perPage);
    
    for (let page = 0; page < totalPages; page++) {
      if (page > 0) doc.addPage();
      
      const start = page * perPage;
      const end = Math.min(start + perPage, exportSource.length);
      const pageData = exportSource.slice(start, end);
      
      const body = pageData.map((a, idx) => {
        const base = [
          String(a.standOrder || start + idx + 1),
          String(a.name || ''),
          String(a.affiliation || ''),
          a.gender === 'female' ? '女' : '男',
          String(a.rank || '')
        ];
        if (programTableMode === 'all_applicants') return base;

        const r1 = getArcherRoundResults(a, 1).map(resultSymbol);
        const r2 = getArcherRoundResults(a, 2).map(resultSymbol);
        const totalHits = [...getArcherRoundResults(a, 1), ...getArcherRoundResults(a, 2)].filter(r => r === 'o').length;
        return [...base, ...r1, ...r2, '', totalHits];
      });
      
      autoTable(doc, {
        head,
        body,
        startY: 8,
        styles: { 
          fontSize: 8.5, 
          cellPadding: 1.8, 
          halign: 'center',
          lineWidth: 0.1,
          lineColor: [0, 0, 0],
          textColor: [0, 0, 0],
          ...(fontInfo?.loaded ? { font: fontInfo.fontName } : {}) 
        },
        headStyles: { 
          fillColor: [220, 220, 220], 
          textColor: [0, 0, 0], 
          halign: 'center',
          fontStyle: 'bold',
          lineWidth: 0.2,
          fontSize: 8.5,
          cellPadding: 1.8
        },
        margin: { left: 6, right: 6, top: 6, bottom: 6 }
      });
    }

    const safeTitle = String(title).replace(/[\\/:*?"<>|]/g, '_');
    doc.save(`${safeTitle}_program.pdf`);
  };

  const downloadProgramExcel = () => {
    if (!selectedTournamentId) { alert('大会を選択してください'); return; }
    const title = tournament?.data?.name || selectedTournamentId;
    const exportSource = programTableMode === 'all_applicants' ? allApplicants : archers;

    const overviewData = [
      ['大会期日', tournament?.data?.datetime || ''],
      ['場　　所', tournament?.data?.location || ''],
      ['大会次第', tournament?.data?.schedule || ''],
      ['競技種別', tournament?.data?.category || ''],
      ['競技方法', tournament?.data?.competitionMethod || ''],
      ['表　　彰', tournament?.data?.award || ''],
      ['参加資格', tournament?.data?.qualifications || ''],
      ['適用規則', tournament?.data?.applicableRules || '']
    ].filter(([_, val]) => val);

    const arrows1 = tournament?.data?.arrowsRound1 ?? 2;
    const arrows2 = tournament?.data?.arrowsRound2 ?? 4;

    const header = programTableMode === 'all_applicants'
      ? ['#', '氏名', '所属', '段位', '性別']
      : ['番号', '選手名', '支部', '性別', '称号段位', ...Array.from({ length: arrows1 }, (_, i) => `1立目-${i+1}`), ...Array.from({ length: arrows2 }, (_, i) => `2立目-${i+1}`), '競射', '合計'];

    const wb = XLSX.utils.book_new();
    
    // 36人ごとにシート分割
    const perPage = archersPerPage;
    const totalPages = Math.ceil(exportSource.length / perPage);
    
    for (let page = 0; page < totalPages; page++) {
      const start = page * perPage;
      const end = Math.min(start + perPage, exportSource.length);
      const pageData = exportSource.slice(start, end);
      
      const rows = pageData.map((a, idx) => {
        const base = [
          a.standOrder || start + idx + 1,
          a.name || '',
          a.affiliation || '',
          a.gender === 'female' ? '女' : '男',
          a.rank || ''
        ];
        if (programTableMode === 'all_applicants') return base;

        const r1 = getArcherRoundResults(a, 1).map(resultSymbol);
        const r2 = getArcherRoundResults(a, 2).map(resultSymbol);
        const totalHits = [...getArcherRoundResults(a, 1), ...getArcherRoundResults(a, 2)].filter(r => r === 'o').length;
        return [...base, ...r1, ...r2, '', totalHits];
      });

      const sheetData = page === 0 ? [...overviewData, [], header, ...rows] : [header, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(wb, ws, `Page${page + 1}`);
    }
    
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
              {enableGenderSeparation && (
                <p><strong>プログラム表順序:</strong> {femaleFirst ? '女子→男子' : '男子→女子'}</p>
              )}
              <p><strong>目的:</strong> {tournament?.data?.purpose || '-'}</p>
              {tournament?.data?.schedule && (
                <>
                  <p><strong>大会次第:</strong></p>
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: '0.5rem 0 1rem 0', padding: '0.75rem', background: '#f0f9ff', border: '2px solid #bfdbfe', borderRadius: '0.5rem', fontSize: '0.875rem', lineHeight: '1.6' }}>{tournament.data.schedule}</pre>
                </>
              )}
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
                <h2 className="card-title">{isTeamCompetition ? 'チーム順表' : '立ち順表'}</h2>
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
                      <th rowSpan="2" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider align-middle">番号</th>
                      <th rowSpan="2" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider align-middle">選手名</th>
                      <th rowSpan="2" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider align-middle">支部</th>
                      <th rowSpan="2" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider align-middle">性別</th>
                      <th rowSpan="2" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider align-middle">称号段位</th>
                      {programTableMode === 'checked_in' && (
                        <>
                          <th colSpan={tournament?.data?.arrowsRound1 ?? 2} className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l border-gray-300">1立目</th>
                          <th colSpan={tournament?.data?.arrowsRound2 ?? 4} className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l border-gray-300">2立目</th>
                          <th rowSpan="2" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider align-middle border-l border-gray-300">競射</th>
                          <th rowSpan="2" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider align-middle">合計</th>
                        </>
                      )}
                    </tr>
                    {programTableMode === 'checked_in' && (
                      <tr>
                        {Array.from({ length: tournament?.data?.arrowsRound1 ?? 2 }, (_, i) => (
                          <th key={`r1-${i}`} className="px-2 py-2 text-center text-xs font-medium text-gray-500 border-l border-gray-300">{i + 1}</th>
                        ))}
                        {Array.from({ length: tournament?.data?.arrowsRound2 ?? 4 }, (_, i) => (
                          <th key={`r2-${i}`} className="px-2 py-2 text-center text-xs font-medium text-gray-500 border-l border-gray-300">{i + 1}</th>
                        ))}
                      </tr>
                    )}
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {isLoading && programSource.length === 0 ? (
                      <tr><td colSpan={programTableMode === 'checked_in' ? (5 + (tournament?.data?.arrowsRound1 ?? 2) + (tournament?.data?.arrowsRound2 ?? 4) + 2) : 5} className="px-4 py-4 text-center">読み込み中...</td></tr>
                    ) : programSource.length === 0 ? (
                      <tr><td colSpan={programTableMode === 'checked_in' ? (5 + (tournament?.data?.arrowsRound1 ?? 2) + (tournament?.data?.arrowsRound2 ?? 4) + 2) : 5} className="px-4 py-4 text-center">選手が登録されていません</td></tr>
                    ) : (
                      currentArchers.map(a => {
                        const r1Results = getArcherRoundResults(a, 1);
                        const r2Results = getArcherRoundResults(a, 2);
                        const totalHits = [...r1Results, ...r2Results].filter(r => r === 'o').length;
                        return (
                          <tr key={a.archerId}>
                            <td className="px-4 py-3 text-sm font-medium">{a.standOrder}</td>
                            <td className="px-4 py-3">{a.name}</td>
                            <td className="px-4 py-3">{a.affiliation}</td>
                            <td className="px-4 py-3 text-center">{a.gender === 'female' ? '女' : '男'}</td>
                            <td className="px-4 py-3 text-center">{a.rank}</td>

                            {programTableMode === 'checked_in' && (
                              <>
                                {r1Results.map((r, idx) => (
                                  <td key={`r1-${idx}`} className="px-2 py-3 text-center border-l border-gray-200" style={{
                                    color: r === 'o' ? '#16a34a' : r === 'x' ? '#dc2626' : '#6b7280',
                                    fontWeight: r === 'o' ? 700 : 400,
                                    fontSize: '13px'
                                  }}>
                                    {resultSymbol(r) || ''}
                                  </td>
                                ))}
                                {r2Results.map((r, idx) => (
                                  <td key={`r2-${idx}`} className="px-2 py-3 text-center border-l border-gray-200" style={{
                                    color: r === 'o' ? '#16a34a' : r === 'x' ? '#dc2626' : '#6b7280',
                                    fontWeight: r === 'o' ? 700 : 400,
                                    fontSize: '13px'
                                  }}>
                                    {resultSymbol(r) || ''}
                                  </td>
                                ))}
                                <td className="px-2 py-3 text-center border-l border-gray-300"></td>
                                <td className="px-2 py-3 text-center font-semibold">{totalHits}</td>
                              </>
                            )}
                          </tr>
                        );
                      })
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