import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LogOut, RotateCcw, Copy, Check, Filter, X, Maximize2, ChevronLeft, ChevronRight, Users, User, RefreshCw } from 'lucide-react';
import { applicantsApi, rankingApi, API_URL } from '../utils/api';
import { judgeNearFarCompetition, calculateRanksWithTies } from '../utils/competition';
import { getStoredAttachments, getLocalDateKey } from '../utils/tournament';
import { groupByTeam, generateTeamStandOrder, fetchTeamOrder, saveTeamOrder } from '../utils/teamCompetition';
import ProgramView from './ProgramView';
import QualifiersView from '../QualifiersView';

const TournamentView = ({ state, stands, checkInCount }) => {
  const [view, setView] = useState('standings'); // 'standings', 'qualifiers', or 'shichuma'
  const [selectedTournamentId, setSelectedTournamentId] = useState(() => {
    return localStorage.getItem('selectedTournamentId') || '';
  });
  const [isArcherVerified, setIsArcherVerified] = useState(false);
  const [archerIdInputModal, setArcherIdInputModal] = useState('');
  const [archerIdError, setArcherIdError] = useState('');
  const [archers, setArchers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const archersPerPage = 12; // 1ページあたりの選手数
  const programArchersPerPage = 36;
  const [totalPages, setTotalPages] = useState(1);
  const [indexOfFirstArcher, setIndexOfFirstArcher] = useState(0);
  const [indexOfLastArcher, setIndexOfLastArcher] = useState(archersPerPage);
  const [currentArchers, setCurrentArchers] = useState([]);
  const [currentPageProgram, setCurrentPageProgram] = useState(1);
  const [shichumaData, setShichumaData] = useState(null);
  const [isLoadingShichuma, setIsLoadingShichuma] = useState(true);
  const [finalResults, setFinalResults] = useState(null);
  const [isLoadingFinalResults, setIsLoadingFinalResults] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);
  
  // ページネーションの状態を更新するエフェクト
  useEffect(() => {
    const indexOfLast = currentPage * archersPerPage;
    const indexOfFirst = indexOfLast - archersPerPage;
    setIndexOfFirstArcher(indexOfFirst);
    setIndexOfLastArcher(indexOfLast);
    setCurrentArchers(archers.slice(indexOfFirst, indexOfLast));
    setTotalPages(Math.ceil(archers.length / archersPerPage));
  }, [archers, currentPage, archersPerPage]);

  useEffect(() => {
    setCurrentPageProgram(1);
  }, [selectedTournamentId]);

  useEffect(() => {
    if (selectedTournamentId) {
      localStorage.setItem('selectedTournamentId', selectedTournamentId);
    } else {
      localStorage.removeItem('selectedTournamentId');
    }
  }, [selectedTournamentId]);

  const filteredTournaments = state.registeredTournaments.filter(tournament => 
    tournament.id
  );

  const rankOrder = ['無指定', '五級', '四級', '三級', '弐級', '壱級', '初段', '弐段', '参段', '四段', '五段', '錬士五段', '錬士六段', '教士七段', '教士八段', '範士八段', '範士九段'];

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

  // 順位の正規化
  const normalizeRank = (rank) => {
    if (!rank) return '';
    return rank
      .replace('二段', '弐段')
      .replace('三段', '参段')
      .replace('二級', '弐級')
      .replace('一級', '壱級');
  };

  const fetchAndSortArchers = async () => {
    if (!selectedTournamentId) return;

    // ローディング表示は初回のみ、または手動更新時のみにする
    // setIsLoading(true); 
    try {
      const result = await applicantsApi.getByTournament(selectedTournamentId);

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

        const tpl = state.registeredTournaments.find(t => t.id === selectedTournamentId);
        const enableGenderSeparation = tpl?.data?.enableGenderSeparation || false;
        const femaleFirst = enableGenderSeparation && (tpl?.data?.femaleFirst || false);
        const competitionType = tpl?.data?.competitionType || 'individual';
        const isTeamCompetition = competitionType === 'team';

        let archersWithOrder;
        
        if (isTeamCompetition) {
          // 団体戦：チームごとにグループ化してランダム配置
          const teams = groupByTeam(checkedIn);
          
          // 保存されたチーム順序を取得
          const savedOrder = await fetchTeamOrder(selectedTournamentId);
          
          // 保存された順序がある場合は必ずそれを使用
          const teamsWithOrder = generateTeamStandOrder(teams, savedOrder);
          
          // 保存された順序がない場合のみ新規保存
          if (!savedOrder) {
            const teamOrder = teamsWithOrder.map(t => t.teamKey);
            await saveTeamOrder(selectedTournamentId, teamOrder);
          }
          
          // チームメンバーを平坦化
          archersWithOrder = [];
          teamsWithOrder.forEach(team => {
            team.members.forEach(member => {
              archersWithOrder.push(member);
            });
          });
        } else {
          // 個人戦：既存のロジック
          const sortedArchers = [...checkedIn].sort((a, b) => {
            // 男女分けが有効な場合、femaleFirst設定に従って並べる
            if (enableGenderSeparation) {
              const aGender = a.gender || "male";
              const bGender = b.gender || "male";
              if (aGender !== bGender) {
                return femaleFirst
                  ? (aGender === "female" ? -1 : 1)
                  : (aGender === "male" ? -1 : 1);
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

          archersWithOrder = sortedArchers.map((archer, index) => ({
            ...archer,
            standOrder: index + 1
          }));
        }

        setArchers(archersWithOrder);
      }
    } catch (error) {
      console.error('選手データの取得に失敗しました:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleArcherIdSubmit = () => {
    const val = (archerIdInputModal || '').trim();
    if (!val) {
      setArcherIdError('選手IDを入力してください');
      return;
    }
    const pick = state.registeredTournaments.find(t => val.startsWith(t.id));
    if (!pick) {
      setArcherIdError('該当する大会が見つかりません');
      return;
    }
    setSelectedTournamentId(pick.id);
    setIsArcherVerified(true);
    try {
      localStorage.setItem('tournamentViewVerifiedDate', getLocalDateKey());
      localStorage.setItem('tournamentViewVerifiedTournamentId', pick.id);
    } catch {}
    setArcherIdInputModal('');
    setArcherIdError('');
    setIsLoading(true);
    // small timeout to allow selectedTournamentId effect to run
    setTimeout(() => { fetchAndSortArchers(); }, 50);
  };

  useEffect(() => {
    if (selectedTournamentId) {
      setIsLoading(true);
      fetchAndSortArchers();
    }
  }, [selectedTournamentId]);

  // 当日1回だけID入力にする
  useEffect(() => {
    try {
      const storedDate = localStorage.getItem('tournamentViewVerifiedDate');
      const storedTournamentId = localStorage.getItem('tournamentViewVerifiedTournamentId');
      const today = getLocalDateKey();
      if (storedDate === today && storedTournamentId) {
        setSelectedTournamentId(storedTournamentId);
        setIsArcherVerified(true);
      } else {
        setIsArcherVerified(false);
      }
    } catch {
      setIsArcherVerified(false);
    }
  }, []);

  // 自動更新 (リアルタイム表示用) - 10秒ごとに更新(負荷軽減のため5秒から10秒に延長)
  useEffect(() => {
    if (!selectedTournamentId || !autoRefresh) return;
    const interval = setInterval(() => {
      fetchAndSortArchers();
    }, 10000); // 10秒間隔に変更
    return () => clearInterval(interval);
  }, [selectedTournamentId, autoRefresh]);

  useEffect(() => {
    const fetchShichumaResults = async () => {
      if (!selectedTournamentId) return;

      setIsLoadingShichuma(true);
      try {
        const result = await rankingApi.shichuma.get(selectedTournamentId);
        
        if (result.success) {
          setShichumaData(result.data);
        }
      } catch (error) {
        // 404は正常な状態（まだ結果がない場合）
        if (error.status === 404) {
          setShichumaData(null);
        } else {
          console.error('射詰競射結果の取得エラー:', error);
          setShichumaData(null);
        }
      } finally {
        setIsLoadingShichuma(false);
      }
    };

    const fetchFinalResults = async () => {
      if (!selectedTournamentId) return;

      setIsLoadingFinalResults(true);
      try {
        const response = await fetch(`${API_URL}/ranking/shootoff/${selectedTournamentId}`);
        
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setFinalResults(result.data);
          }
        } else {
          setFinalResults(null);
        }
      } catch (error) {
        console.error('最終順位表の取得エラー:', error);
        setFinalResults(null);
      } finally {
        setIsLoadingFinalResults(false);
      }
    };

    fetchShichumaResults();
    fetchFinalResults();
  }, [selectedTournamentId]);

  // 順位決定戦ページからの更新を監視（リアルタイム更新）
  useEffect(() => {
    if (!selectedTournamentId || !autoRefresh) return;

    const fetchFinalResultsOnly = async () => {
      try {
        const response = await fetch(`${API_URL}/ranking/shootoff/${selectedTournamentId}`);
        
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            // データが変更された場合のみ更新
            const currentData = JSON.stringify(finalResults);
            const newData = JSON.stringify(result.data);
            
            if (currentData !== newData) {
              console.log('🏆 最終順位表が更新されました');
              setFinalResults(result.data);
              setLastUpdated(new Date());
              setShowUpdateNotification(true);
              
              // 3秒後に通知を非表示
              setTimeout(() => {
                setShowUpdateNotification(false);
              }, 3000);
            }
          }
        }
      } catch (error) {
        console.error('最終順位表のリアルタイム更新エラー:', error);
      }
    };

    // 5秒ごとに最終順位表をチェック（順位決定戦ページの更新を検知）
    const interval = setInterval(fetchFinalResultsOnly, 5000);
    
    return () => clearInterval(interval);
  }, [selectedTournamentId, autoRefresh, finalResults]);

  // 手動更新関数
  const handleRefreshFinalResults = async () => {
    if (!selectedTournamentId) return;
    
    setIsLoadingFinalResults(true);
    try {
      const response = await fetch(`${API_URL}/ranking/shootoff/${selectedTournamentId}`);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setFinalResults(result.data);
          setLastUpdated(new Date());
          console.log('🔄 最終順位表を手動更新しました');
        }
      } else {
        setFinalResults(null);
      }
    } catch (error) {
      console.error('最終順位表の手動更新エラー:', error);
      setFinalResults(null);
    } finally {
      setIsLoadingFinalResults(false);
    }
  };

  const tournament = state.tournament;
  const currentRound = tournament.currentRound || 1;
  const arrowsPerStand = currentRound === 1 ? tournament.arrowsRound1 : tournament.arrowsRound2;

  // 部門設定
  const selectedTournament = state.registeredTournaments.find(t => t.id === selectedTournamentId);
  const competitionType = selectedTournament?.data?.competitionType || 'individual';
  const isTeamCompetition = competitionType === 'team';
  const localDefaultDivisions = [
    { id: 'lower', label: '級位~三段以下の部' },
    { id: 'middle', label: '四・五段の部' },
    { id: 'title', label: '称号者の部' }
  ];
  const divisions = (selectedTournament && selectedTournament.data && selectedTournament.data.divisions) ? selectedTournament.data.divisions : localDefaultDivisions;
  const enableGenderSeparation = selectedTournament?.data?.enableGenderSeparation || false;

  const printProgram = async () => {
    if (!selectedTournamentId) { alert('大会を選択してください'); return; }
    // get selected tournament data
    const tpl = state.registeredTournaments.find(t => t.id === selectedTournamentId);
    const tplData = tpl?.data || {};
    const perPage = programArchersPerPage;
    const title = tplData?.name || selectedTournamentId;
    const attachments = getStoredAttachments(selectedTournamentId);
    
    // 団体戦の場合はチームランダム並び替え
    let printArchers = [...archers];
    if (tplData?.competitionType === 'team') {
      const teams = groupByTeam(archers);
      // 保存された順序を取得
      const savedOrder = await fetchTeamOrder(selectedTournamentId);
      const shuffledTeams = generateTeamStandOrder(teams, savedOrder);
      printArchers = [];
      shuffledTeams.forEach(team => {
        team.members.forEach(member => {
          printArchers.push(member);
        });
      });
    }
    
    const pages = Math.max(1, Math.ceil(printArchers.length / perPage));

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
    html += `<p>${tplData?.datetime || ''}</p>`;
    html += `<p>${tplData?.location || ''}</p>`;
    html += `<p>目的: ${tplData?.purpose || ''}</p>`;
    html += `<p>主催: ${tplData?.organizer || ''}</p>`;
    html += `<p>後援: ${tplData?.coOrganizer || ''}</p>`;
    html += `<p>主管: ${tplData?.administrator || ''}</p>`;
    html += `<p>種目: ${tplData?.event || ''}</p>`;
    html += `<p>種類: ${tplData?.type || ''}</p>`;
    html += `<p>種別: ${tplData?.category || ''}</p>`;
    html += `<p>内容: ${tplData?.description || ''}</p>`;
    html += `<p>競技方法: ${tplData?.competitionMethod || ''}</p>`;
    html += `<p>表彰: ${tplData?.award || ''}</p>`;
    html += `<p>参加資格: ${tplData?.qualifications || ''}</p>`;
    html += `<p>適用規則: ${tplData?.applicableRules || ''}</p>`;
    html += `<p>申込方法: ${tplData?.applicationMethod || ''}</p>`;
    html += `<p>その他: ${tplData?.remarks || ''}</p>`;
    if (attachments.length > 0) {
      html += `<div class="att"><h2 style="margin:0 0 6px">添付資料</h2><ul style="margin:0;padding-left:18px">`;
      for (const att of attachments) {
        const safeName = (att?.name || 'file').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const href = att?.dataUrl || '';
        html += `<li style="margin:0 0 4px"><a href="${href}" target="_blank" rel="noopener noreferrer">${safeName}</a></li>`;
      }
      html += `</ul>`;
      // Image previews (only for image/*)
      for (const att of attachments) {
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

    // Page 2..: standings table only
    for (let p = 0; p < pages; p++) {
      html += `<div class="page">`;
      html += `<h2 style="margin:0 0 8px">立ち順表</h2>`;

      const arrows1 = tplData?.arrowsRound1 || 0;
      const arrows2 = tplData?.arrowsRound2 || 0;
      html += `<table><thead><tr><th>#</th><th>氏名</th><th>所属</th><th>段位</th><th>性別</th><th>1立ち目</th><th>2立ち目</th></tr></thead><tbody>`;

      const start = p * perPage;
      const end = Math.min(start + perPage, printArchers.length);
      for (let i = start; i < end; i++) {
        const a = printArchers[i];
        html += `<tr><td style="width:60px">${a.standOrder || i+1}</td><td>${a.name || ''}</td><td>${a.affiliation || ''}</td><td>${a.rank || ''}</td><td>${a.gender === 'female' ? '女' : '男'}</td>`;
        // 1立ち目 placeholders
        html += `<td style="white-space:nowrap">`;
        for (let x = 0; x < arrows1; x++) {
          html += `<span style="display:inline-block;width:18px;height:14px;margin:0 3px;font-size:12px;line-height:14px">&nbsp;</span>`;
        }
        html += `</td>`;
        // 2立ち目 placeholders
        html += `<td style="white-space:nowrap">`;
        for (let x = 0; x < arrows2; x++) {
          html += `<span style="display:inline-block;width:18px;height:14px;margin:0 3px;font-size:12px;line-height:14px">&nbsp;</span>`;
        }
        html += `</td>`;
        html += `</tr>`;
      }

      html += `</tbody></table></div>`;
    }

    html += `</body></html>`;

    const win = window.open('', '_blank');
    if (!win) { alert('ポップアップがブロックされました。ポップアップを許可してください。'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    // Give browser a moment to render
    setTimeout(() => { win.print(); }, 300);
  };

  // 最終順位表を表示する関数（ProgramViewと同じロジック）
  const renderFinalResults = () => {
    const awardRankLimit = selectedTournament?.data?.awardRankLimit || 3;

    // 的中数確定結果を生成
    const createConfirmedResults = () => {
      const confirmedResults = [];
      const getTotalHitCount = (archer) => {
        const arrows1 = selectedTournament?.data?.arrowsRound1 ?? 4;
        const arrows2 = selectedTournament?.data?.arrowsRound2 ?? 4;
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
        const divArchers = archers.filter(a => getDivisionIdForArcher(a, divisions) === div.id);
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

    // 部門ごとに処理
    divisions.forEach(div => {
      const divArchers = archers.filter(a => getDivisionIdForArcher(a, divisions) === div.id);
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

    // 的中数確定結果を追加
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

    // 表彰範囲でフィルタリング・ソート
    Object.keys(resultsByDivision).forEach(k => {
      resultsByDivision[k].results = resultsByDivision[k].results
        .filter(r => typeof r.rank === 'number' && r.rank <= awardRankLimit && r.rank > 0 && !r.isDefeated && r.rank !== '敗退')
        .sort((a, b) => a.rank - b.rank);
    });

    // 部門順を維持して配列に変換
    const divisionResults = [];
    const femaleFirst = enableGenderSeparation && (selectedTournament?.data?.femaleFirst ?? false);
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
                🔄 順位決定戦ページから更新されました
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
                        <span className="text-xs">(表彰範囲：{awardRankLimit}位まで)</span>
                      </td>
                    </tr>
                  ) : (
                    divisionData.results.map(result => {
                      const archer = archers.find(a => a.archerId === result.archerId);
                      const getTotalHitCount = (a) => {
                        const arrows1 = selectedTournament?.data?.arrowsRound1 ?? 4;
                        const arrows2 = selectedTournament?.data?.arrowsRound2 ?? 4;
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
                      return (
                        <tr key={`${result.archerId}-${result.shootOffType || 'unknown'}`} className="hover:bg-green-50">
                          <td className="border border-green-300 px-4 py-2 font-bold">
                            <span className="text-green-900">{result.rank}位</span>
                          </td>
                          <td className="border border-green-300 px-4 py-2 text-center font-semibold">
                            {getTotalHitCount(archer) || '-'}
                          </td>
                          <td className="border border-green-300 px-4 py-2 font-semibold">{result.name}</td>
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

  // パフォーマンス向上のため、メモ化された関数を使用

  // パフォーマンス向上のため、メモ化された関数を使用
  const isPassed = useCallback((archer) => {
    // 結果が未設定の場合は即座に判定保留
    if (!archer.results?.stand1) return null;
    
    const results = archer.results.stand1;
    const currentRound = tournament.currentRound || 1;
    const isFirstRound = currentRound === 1;
    const endIndex = isFirstRound ? tournament.arrowsRound1 : (tournament.arrowsRound1 + tournament.arrowsRound2);
    
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
    
    // 未入力の場合は判定保留
    if (hasNull) return null;
    
    // 大会設定の通過ルールに基づいて判定
    const passRule = tournament.passRule || 'all_four';
    const currentRoundArrows = isFirstRound ? tournament.arrowsRound1 : tournament.arrowsRound2;
    
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
    return archers.filter(archer => isPassed(archer) === true);
  }, [archers, isPassed]);

  // ページ変更ハンドラー
  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  const paginateProgram = (pageNumber) => setCurrentPageProgram(pageNumber);

  if (view === 'qualifiers') {
    return (
      <div className="view-container">
        <div className="view-header">
          <button 
            onClick={() => setView('standings')}
            className="flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> 立ち順表に戻る
          </button>
          <div className="flex justify-between items-center">
            <h1>予選通過者一覧</h1>
            <span className="text-sm text-gray-600">
              {passedArchers.length} / {archers.length} 名
            </span>
          </div>
        </div>
        <div className="view-content">
          <QualifiersView 
            archers={archers} 
            tournament={tournament} 
            getRankCategory={getRankCategory}
            enableGenderSeparation={enableGenderSeparation}
            femaleFirst={selectedTournament?.data?.femaleFirst || false}
          />
        </div>
      </div>
    );
  }

  if (view === 'shichuma') {

    return (
      <div className="view-container">
        <div className="view-header">
          <button 
            onClick={() => setView('standings')}
            className="flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> 立ち順表に戻る
          </button>
          <h1>競射結果</h1>
        </div>
        <div className="view-content">
          {/* 最終順位表のみを表示 */}
          {renderFinalResults()}
        </div>
      </div>
    );
  }

  if (view === 'program') {
    return (
      <div className="view-container">
        <div className="view-header">
          <button 
            onClick={() => setView('standings')}
            className="flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> 立ち順表に戻る
          </button>
        </div>
        <ProgramView state={state} />
      </div>
    );
  }

  return (
    <>
      {!isArcherVerified ? (
        <div className="view-container">
          <div className="login-container">
            <div className="login-box">
              <div className="login-header">
                <User size={32} />
                <h1>選手IDで大会を開く</h1>
              </div>
              <p className="hint">受付された選手IDを入力してください（必須）</p>
              <input
                type="text"
                value={archerIdInputModal}
                onChange={(e) => { setArcherIdInputModal(e.target.value); setArcherIdError(''); }}
                onKeyPress={(e) => e.key === 'Enter' && handleArcherIdSubmit()}
                placeholder="選手IDを入力"
                className="input"
              />
              {archerIdError && <p className="error-text">{archerIdError}</p>}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => handleArcherIdSubmit()} className="btn-primary">開く</button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="view-container">
          <div className="view-header">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#1f2937' }}>大会進行 (リアルタイム)</h1>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {autoRefresh && (
                  <span style={{ fontSize: '0.875rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', backgroundColor: '#d1fae5', borderRadius: '0.5rem', fontWeight: 600 }}>
                    <span style={{ display: 'inline-block', width: '0.5rem', height: '0.5rem', backgroundColor: '#10b981', borderRadius: '50%', animation: 'pulse 1.5s ease-in-out infinite' }}></span>
                    Live更新中
                  </span>
                )}
              </div>
            </div>
            <div className="card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ fontSize: '3rem' }}>🏹</div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, marginBottom: '0.5rem' }}>
                    {(state.registeredTournaments.find(t => t.id === selectedTournamentId)?.data?.name) || selectedTournamentId || '大会が選択されていません'}
                  </h2>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 2rem', fontSize: '0.875rem', opacity: 0.95 }}>
                    <div>📅 {state.registeredTournaments.find(t => t.id === selectedTournamentId)?.data?.datetime || '日時未設定'}</div>
                    <div>📍 {state.registeredTournaments.find(t => t.id === selectedTournamentId)?.data?.location || '場所未設定'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="view-content">
            {selectedTournamentId && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                  <div className="card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.5rem' }}>👥 受付済み</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 700 }}>{archers.length}<span style={{ fontSize: '1rem', marginLeft: '0.5rem' }}>人</span></div>
                  </div>
                  
                  <div 
                    className="card" 
                    style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white', textAlign: 'center', cursor: 'pointer', transition: 'transform 0.2s', display: isTeamCompetition ? 'none' : 'block' }}
                    onClick={() => setView('qualifiers')}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.5rem' }}>✅ 通過者</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 700 }}>{passedArchers.length}<span style={{ fontSize: '1rem', marginLeft: '0.5rem' }}>人</span></div>
                  </div>
                  
                  <div 
                    className="card" 
                    style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white', textAlign: 'center', cursor: 'pointer', transition: 'transform 0.2s' }}
                    onClick={() => setView('program')}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.5rem' }}>📋 プログラム</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: '0.5rem' }}>表示/印刷</div>
                  </div>
                  
                  <div 
                    className="card" 
                    style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', color: 'white', textAlign: 'center', cursor: 'pointer', transition: 'transform 0.2s' }}
                    onClick={() => setView('shichuma')}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.5rem' }}>🏆 競射結果</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: '0.5rem' }}>結果表示</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem', display: isTeamCompetition ? 'none' : 'grid' }}>
                  <div className="card" style={{ padding: '1rem', textAlign: 'center', borderLeft: '4px solid #3b82f6' }}>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, marginBottom: '0.5rem' }}>📏 通過ルール</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1f2937' }}>
                      {tournament.passRule === 'all_four' ? '全て的中' :
                       tournament.passRule === 'four_or_more' ? '4本以上' :
                       tournament.passRule === 'three_or_more' ? '3本以上' :
                       tournament.passRule === 'two_or_more' ? '2本以上' : '未設定'}
                    </div>
                  </div>
                  
                  <div className="card" style={{ padding: '1rem', textAlign: 'center', borderLeft: '4px solid #10b981' }}>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, marginBottom: '0.5rem' }}>🎯 1立ち目</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937' }}>{tournament.arrowsRound1 || 0}<span style={{ fontSize: '0.875rem', marginLeft: '0.25rem' }}>本</span></div>
                  </div>
                  
                  <div className="card" style={{ padding: '1rem', textAlign: 'center', borderLeft: '4px solid #f59e0b' }}>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, marginBottom: '0.5rem' }}>🎯 2立ち目</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937' }}>{tournament.arrowsRound2 || 0}<span style={{ fontSize: '0.875rem', marginLeft: '0.25rem' }}>本</span></div>
                  </div>
                </div>

                <div className="card" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937', margin: 0 }}>📊 立ち順表</h2>
                  </div>
                  <div className="table-responsive">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">氏名</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">支部</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">段位</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">性別</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">1立ち目</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">2立ち目</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">結果</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {isLoading && archers.length === 0 ? (
                          <tr>
                            <td colSpan="8" className="px-4 py-4 text-center text-sm text-gray-500">
                              読み込み中...
                            </td>
                          </tr>
                        ) : archers.length === 0 ? (
                          <tr>
                            <td colSpan="8" className="px-4 py-4 text-center text-sm text-gray-500">
                              受付済みの選手がいません
                            </td>
                          </tr>
                        ) : (
                          <>
                            {(() => {
                              const enableGenderSeparation = tournament?.data?.enableGenderSeparation || false;
                              
                              if (enableGenderSeparation) {
                                // 男女分け表示
                                const maleArchers = currentArchers.filter(a => (a.gender || 'male') === 'male');
                                const femaleArchers = currentArchers.filter(a => a.gender === 'female');
                                
                                return (
                                  <>
                                    {maleArchers.length > 0 && (
                                      <>
                                        <tr>
                                          <td colSpan="8" className="px-4 py-2 bg-blue-50 text-center font-medium text-blue-700">
                                            男部門
                                          </td>
                                        </tr>
                                        {maleArchers.map((archer) => {
                                          const { ceremony, rank } = getRankCategory(archer.rank);
                                          const _s1raw = archer.results?.stand1 || [];
                                          const stand1Result = Array.from({ length: tournament.arrowsRound1 }, (_, i) => _s1raw[i] ?? null);
                                          const stand2Result = Array.from({ length: tournament.arrowsRound2 }, (_, i) => _s1raw[tournament.arrowsRound1 + i] ?? null);
                                          const passed = isPassed(archer);
                                          
                                          return (
                                            <tr 
                                              key={archer.archerId} 
                                              className={`${passed ? 'bg-green-50' : ''} hover:bg-gray-50`}
                                            >
                                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {archer.standOrder}
                                              </td>
                                              <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="flex items-center">
                                                  <span className="font-medium">{archer.name}</span>
                                                </div>
                                              </td>
                                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                {archer.affiliation}
                                              </td>
                                              <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                                                {ceremony}{rank}
                                              </td>
                                              <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                                                男
                                              </td>
                                              <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="flex gap-1 justify-center">
                                                  {stand1Result.map((result, idx) => (
                                                    <span 
                                                      key={idx} 
                                                      className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-medium ${
                                                        result === 'o' ? 'bg-gray-900 text-white' : 
                                                        result === 'x' ? 'bg-gray-200 text-gray-600' : 'bg-gray-100 text-gray-400'
                                                      }`}
                                                    >
                                                      {result === 'o' ? '◯' : result === 'x' ? '×' : '?'}
                                                    </span>
                                                  ))}
                                                </div>
                                              </td>
                                              <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="flex gap-1 justify-center">
                                                  {stand2Result.map((result, idx) => (
                                                    <span 
                                                      key={idx} 
                                                      className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-medium ${
                                                        result === 'o' ? 'bg-gray-900 text-white' : 
                                                        result === 'x' ? 'bg-gray-200 text-gray-600' : 'bg-gray-100 text-gray-400'
                                                      }`}
                                                    >
                                                      {result === 'o' ? '◯' : result === 'x' ? '×' : '?'}
                                                    </span>
                                                  ))}
                                                </div>
                                              </td>
                                              <td className="px-4 py-3 whitespace-nowrap text-center">
                                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                                  passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                  {passed ? '合格' : '不合格'}
                                                </span>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </>
                                    )}
                                    
                                    {femaleArchers.length > 0 && (
                                      <>
                                        <tr>
                                          <td colSpan="8" className="px-4 py-2 bg-pink-50 text-center font-medium text-pink-700">
                                            女部門
                                          </td>
                                        </tr>
                                        {femaleArchers.map((archer) => {
                                          const { ceremony, rank } = getRankCategory(archer.rank);
                                          const _s1raw = archer.results?.stand1 || [];
                                          const stand1Result = Array.from({ length: tournament.arrowsRound1 }, (_, i) => _s1raw[i] ?? null);
                                          const stand2Result = Array.from({ length: tournament.arrowsRound2 }, (_, i) => _s1raw[tournament.arrowsRound1 + i] ?? null);
                                          const passed = isPassed(archer);
                                          
                                          return (
                                            <tr 
                                              key={archer.archerId} 
                                              className={`${passed ? 'bg-green-50' : ''} hover:bg-gray-50`}
                                            >
                                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {archer.standOrder}
                                              </td>
                                              <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="flex items-center">
                                                  <span className="font-medium">{archer.name}</span>
                                                </div>
                                              </td>
                                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                {archer.affiliation}
                                              </td>
                                              <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                                                {ceremony}{rank}
                                              </td>
                                              <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                                                女
                                              </td>
                                              <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="flex gap-1 justify-center">
                                                  {stand1Result.map((result, idx) => (
                                                    <span 
                                                      key={idx} 
                                                      className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-medium ${
                                                        result === 'o' ? 'bg-gray-900 text-white' : 
                                                        result === 'x' ? 'bg-gray-200 text-gray-600' : 'bg-gray-100 text-gray-400'
                                                      }`}
                                                    >
                                                      {result === 'o' ? '◯' : result === 'x' ? '×' : '?'}
                                                    </span>
                                                  ))}
                                                </div>
                                              </td>
                                              <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="flex gap-1 justify-center">
                                                  {stand2Result.map((result, idx) => (
                                                    <span 
                                                      key={idx} 
                                                      className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-medium ${
                                                        result === 'o' ? 'bg-gray-900 text-white' : 
                                                        result === 'x' ? 'bg-gray-200 text-gray-600' : 'bg-gray-100 text-gray-400'
                                                      }`}
                                                    >
                                                      {result === 'o' ? '◯' : result === 'x' ? '×' : '?'}
                                                    </span>
                                                  ))}
                                                </div>
                                              </td>
                                              <td className="px-4 py-3 whitespace-nowrap text-center">
                                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                                  passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                  {passed ? '合格' : '不合格'}
                                                </span>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </>
                                    )}
                                  </>
                                );
                              } else {
                                // 通常表示（男女混合）
                                return currentArchers.map((archer) => {
                            const { ceremony, rank } = getRankCategory(archer.rank);
                            const _s1raw = archer.results?.stand1 || [];
                            const stand1Result = Array.from({ length: tournament.arrowsRound1 }, (_, i) => _s1raw[i] ?? null);
                            const stand2Result = Array.from({ length: tournament.arrowsRound2 }, (_, i) => _s1raw[tournament.arrowsRound1 + i] ?? null);
                            const passed = isPassed(archer);
                            
                            return (
                              <tr 
                                key={archer.archerId} 
                                className={`${passed ? 'bg-green-50' : ''} hover:bg-gray-50`}
                              >
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {archer.standOrder}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <span className="font-medium">{archer.name}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                  {archer.affiliation}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                                  {ceremony}{rank}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                                  {archer.gender === 'female' ? '女' : '男'}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="flex gap-1 justify-center">
                                    {stand1Result.map((result, idx) => (
                                      <span 
                                        key={idx} 
                                        className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-medium ${
                                          result === 'o' ? 'bg-gray-900 text-white' : 
                                          result === 'x' ? 'bg-gray-200 text-gray-600' : 'bg-gray-100 text-gray-400'
                                        }`}
                                      >
                                        {result === 'o' ? '◯' : result === 'x' ? '×' : '?'}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="flex gap-1 justify-center">
                                    {stand2Result.map((result, idx) => (
                                      <span 
                                        key={idx} 
                                        className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-medium ${
                                          result === 'o' ? 'bg-gray-900 text-white' : 
                                          result === 'x' ? 'bg-gray-200 text-gray-600' : 'bg-gray-100 text-gray-400'
                                        }`}
                                      >
                                        {result === 'o' ? '◯' : result === 'x' ? '×' : '?'}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                  {passed === true && (
                                    <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded-full">
                                      通過
                                    </span>
                                  )}
                                  {passed === false && (
                                    <span className="px-2 py-1 text-xs font-semibold text-gray-600 bg-gray-100 rounded-full">
                                      ?
                                    </span>
                                  )}
                                  {passed === null && (
                                    <span className="px-2 py-1 text-xs font-semibold text-yellow-800 bg-yellow-100 rounded-full">
                                      未完了
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          });
                              }
                            })()}
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ページネーション */}
                {archers.length > archersPerPage && (
                  <div className="flex items-center justify-between mt-4">
                    <div>
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">{indexOfFirstArcher + 1}</span> ? <span className="font-medium">
                          {Math.min(indexOfLastArcher, archers.length)}
                        </span> / <span className="font-medium">{archers.length}</span> 名
                      </p>
                    </div>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => paginate(currentPage - 1)}
                        disabled={currentPage === 1}
                        className={`px-3 py-1 rounded-md ${currentPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-100'}`}
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        // 現在のページを中心に表示するように調整
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => paginate(pageNum)}
                            className={`w-8 h-8 rounded-md text-sm font-medium ${
                              currentPage === pageNum 
                                ? 'bg-blue-600 text-white' 
                                : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      
                      <button
                        onClick={() => paginate(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className={`px-3 py-1 rounded-md ${currentPage === totalPages ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-100'}`}
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};


export default TournamentView;