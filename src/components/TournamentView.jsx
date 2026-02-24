import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LogOut, RotateCcw, Copy, Check, Filter, X, Maximize2, ChevronLeft, ChevronRight, Users, User, RefreshCw } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { applicantsApi, rankingApi, API_URL } from '../utils/api';
import { judgeNearFarCompetition, calculateRanksWithTies } from '../utils/competition';
import { getLocalDateKey } from '../utils/tournament';
import { getStoredAttachments } from '../utils/tournament';
import { ensureJapaneseFont } from '../utils/jspdfJapaneseFont';
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
  const [allApplicants, setAllApplicants] = useState([]);
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
  const [updateMessage, setUpdateMessage] = useState('');
  const [fetchError, setFetchError] = useState(null);
  const [programTableMode, setProgramTableMode] = useState('checked_in');
  
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

  // 部門設定
  const selectedTournament = state.registeredTournaments.find(t => t.id === selectedTournamentId);
  const localDefaultDivisions = [
    { id: 'lower', label: '級位~三段以下の部' },
    { id: 'middle', label: '四・五段の部' },
    { id: 'title', label: '称号者の部' }
  ];
  const divisions = (selectedTournament && selectedTournament.data && selectedTournament.data.divisions) ? selectedTournament.data.divisions : localDefaultDivisions;
  const enableGenderSeparation = selectedTournament?.data?.enableGenderSeparation || false;
  const femaleFirst = enableGenderSeparation && (selectedTournament?.data?.femaleFirst ?? false);

  // 順位の正規化
  const normalizeRank = (rank) => {
    if (!rank) return '';
    return String(rank).trim().replace(/[\s　]+/g, '')
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
      .replace(/3段/g, '参段');
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

  const fetchAndSortArchers = async () => {
    if (!selectedTournamentId) return;

    // ローディング表示は初回のみ、または手動更新時のみにする
    // setIsLoading(true); 
    try {
      const result = await applicantsApi.getByTournament(selectedTournamentId);

      if (result.success) {
        const applicants = result.data || [];
        const checkedIn = applicants.filter(a => a.isCheckedIn);
        
        const normalizeRank = (rank) => {
          if (!rank) return '';
          return String(rank).trim().replace(/[\s　]+/g, '')
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
            .replace(/3段/g, '参段');
        };

        // 部門の表示順（minRankのインデックスで昇順）
        const currentDivisions = selectedTournament?.data?.divisions || [
          { id: 'lower', minRank: '無指定' },
          { id: 'middle', minRank: '四段' },
          { id: 'title', minRank: '錬士五段' }
        ];
        const divisionOrder = [...currentDivisions]
          .sort((x, y) => {
            const xi = x?.minRank ? rankOrder.indexOf(normalizeRank(x.minRank)) : 0;
            const yi = y?.minRank ? rankOrder.indexOf(normalizeRank(y.minRank)) : 0;
            return (xi === -1 ? Infinity : xi) - (yi === -1 ? Infinity : yi);
          })
          .map(d => d.id)
          .filter(Boolean);

        const getDivIdLocal = (archer) => {
          const rIdx = rankOrder.indexOf(normalizeRank(archer?.rank));
          for (const d of currentDivisions) {
            const minIdx = d?.minRank ? rankOrder.indexOf(normalizeRank(d.minRank)) : 0;
            const maxIdx = d?.maxRank ? rankOrder.indexOf(normalizeRank(d.maxRank)) : rankOrder.length - 1;
            if (rIdx >= minIdx && rIdx <= maxIdx) return d.id;
          }
          return 'unassigned';
        };

        const compareArcher = (a, b) => {
          // ① 部門順（低段位の部 → 高段位の部）
          const aDivId = getDivIdLocal(a);
          const bDivId = getDivIdLocal(b);
          const aDivIdx = divisionOrder.indexOf(aDivId);
          const bDivIdx = divisionOrder.indexOf(bDivId);
          if (aDivIdx !== bDivIdx) {
            if (aDivIdx === -1) return 1;
            if (bDivIdx === -1) return -1;
            return aDivIdx - bDivIdx;
          }

          // ② 同一部門内：性別（femaleFirst 設定に従う）
          // ※ tournament は state.tournament（設定値のみ）で .data を持たないため selectedTournament?.data を参照する
          const enableGenderSeparation = selectedTournament?.data?.enableGenderSeparation || false;
          const femaleFirstLocal = enableGenderSeparation && (selectedTournament?.data?.femaleFirst ?? false);
          if (enableGenderSeparation) {
            const aGender = a.gender || "male";
            const bGender = b.gender || "male";
            if (aGender !== bGender) {
              return femaleFirstLocal
                ? (aGender === "female" ? -1 : 1)
                : (aGender === "male" ? -1 : 1);
            }
          }

          // ③ 同一部門・同一性別内：段位昇順（無指定→五級→…→範士九段）
          const aRank = normalizeRank(a.rank);
          const bRank = normalizeRank(b.rank);
          const aIndex = rankOrder.indexOf(aRank);
          const bIndex = rankOrder.indexOf(bRank);
          if (aIndex !== bIndex) {
            if (aIndex === -1 && bIndex === -1) return 0;
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return aIndex - bIndex;
          }

          // ④ 同じ段位内：習得日が新しい順
          const aDate = a.rankAcquiredDate ? new Date(a.rankAcquiredDate).getTime() : Number.NEGATIVE_INFINITY;
          const bDate = b.rankAcquiredDate ? new Date(b.rankAcquiredDate).getTime() : Number.NEGATIVE_INFINITY;
          return bDate - aDate;
        };

        const sortedAllApplicants = [...applicants]
          .sort(compareArcher)
          .map((archer, index) => ({
            ...archer,
            standOrder: index + 1
          }));

        const sortedArchers = [...checkedIn]
          .sort(compareArcher);

        const archersWithOrder = sortedArchers.map((archer, index) => ({
          ...archer,
          standOrder: index + 1
        }));

        setAllApplicants(sortedAllApplicants);
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
              // 変更の詳細を分析
              const hasShichumaChanges = result.data?.shichuma && 
                JSON.stringify(finalResults?.shichuma) !== JSON.stringify(result.data.shichuma);
              const hasEnkinChanges = result.data?.enkin && 
                JSON.stringify(finalResults?.enkin) !== JSON.stringify(result.data.enkin);
              
              let updateMessage = '🏆 最終順位表が更新されました';
              if (hasShichumaChanges && !hasEnkinChanges) {
                updateMessage = '🏆 射詰競射の結果が更新されました';
              } else if (!hasShichumaChanges && hasEnkinChanges) {
                updateMessage = '🏆 遠近競射の結果が更新されました';
              } else if (hasShichumaChanges && hasEnkinChanges) {
                updateMessage = '🏆 順位決定戦の結果が更新されました';
              }
              
              console.log(updateMessage);
              setFinalResults(result.data);
              setLastUpdated(new Date());
              setUpdateMessage(updateMessage);
              setShowUpdateNotification(true);
              setFetchError(null); // エラーをクリア
              
              // 3秒後に通知を非表示
              setTimeout(() => {
                setShowUpdateNotification(false);
              }, 3000);
            }
          }
        } else {
          setFetchError(`リアルタイム更新に失敗しました (${response.status})`);
        }
      } catch (error) {
        console.error('最終順位表のリアルタイム更新エラー:', error);
        setFetchError('リアルタイム更新中にネットワークエラーが発生しました');
      }
    };

    // 3秒ごとに最終順位表をチェック（順位決定戦ページの更新を検知）
    const interval = setInterval(fetchFinalResultsOnly, 3000);
    
    return () => clearInterval(interval);
  }, [selectedTournamentId, autoRefresh, finalResults]);

  // 手動更新関数
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
          setUpdateMessage('🔄 最終順位表を手動更新しました');
          setShowUpdateNotification(true);
          console.log('🔄 最終順位表を手動更新しました');
          
          // 3秒後に通知を非表示
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

  const tournament = state.tournament;
  const currentRound = tournament.currentRound || 1;
  const arrowsPerStand = currentRound === 1 ? tournament.arrowsRound1 : tournament.arrowsRound2;

  const printProgram = () => {
    if (!selectedTournamentId) { alert('大会を選択してください'); return; }
    // get selected tournament data
    const tpl = state.registeredTournaments.find(t => t.id === selectedTournamentId);
    const tplData = tpl?.data || {};
    const printSource = programTableMode === 'all_applicants' ? allApplicants : archers;
    const perPage = programArchersPerPage;
    const pages = Math.max(1, Math.ceil(printSource.length / perPage));
    const title = tplData?.name || selectedTournamentId;
    const attachments = getStoredAttachments(selectedTournamentId);

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

    // Page 2..: standings table
    for (let p = 0; p < pages; p++) {
      html += `<div class="page">`;
      html += `<h2 style="margin:0 0 8px">立ち順表</h2>`;

      const arrows1 = tplData?.arrowsRound1 || 0;
      const arrows2 = tplData?.arrowsRound2 || 0;

      if (programTableMode === 'all_applicants') {
        html += `<table><thead><tr><th>#</th><th>氏名</th><th>所属</th><th>段位</th><th>性別</th></tr></thead><tbody>`;

        const start = p * perPage;
        const end = Math.min(start + perPage, printSource.length);
        for (let i = start; i < end; i++) {
          const a = printSource[i];
          html += `<tr><td style="width:60px">${a.standOrder || i+1}</td><td>${a.name || ''}</td><td>${a.affiliation || ''}</td><td>${a.rank || ''}</td><td>${a.gender === 'female' ? '女' : '男'}</td></tr>`;
        }

        html += `</tbody></table></div>`;
        continue;
      }

      html += `<table><thead><tr><th>#</th><th>氏名</th><th>所属</th><th>段位</th><th>性別</th><th>1立ち目</th><th>2立ち目</th></tr></thead><tbody>`;

      const start = p * perPage;
      const end = Math.min(start + perPage, printSource.length);
      for (let i = start; i < end; i++) {
        const a = printSource[i];
        html += `<tr><td style="width:60px">${a.standOrder || i+1}</td><td>${a.name || ''}</td><td>${a.affiliation || ''}</td><td>${a.rank || ''}</td><td>${a.gender === 'female' ? '女' : '男'}</td>`;
        // 記録データが入っていいるstandキーを自動検出し、適切な結果を取得
        const getArcherRoundResultsForPrint = (archer, roundNum) => {
          const arrowsRound1 = tplData?.arrowsRound1 ?? 4;
          const arrowsRound2 = tplData?.arrowsRound2 ?? 4;
          const archersPerStand = tplData?.archersPerStand ?? 6;
          const enableGenderSeparation = tplData?.enableGenderSeparation ?? false;
          const femaleFirstPrint = enableGenderSeparation && (tplData?.femaleFirst ?? false);

          // 立ち番号を計算するロジック（ProgramViewと同じ）
          const getStandNumForPrint = (archer) => {
            const normalizeRankLocal = (r) => (r||'').replace('二段','弐段').replace('三段','参段').replace('二級','弐級').replace('一級','壱級');
            const rankOrderLocal = ['無指定','五級','四級','三級','弐級','壱級','初段','弐段','参段','四段','五段','錬士五段','錬士六段','教士七段','教士八段','範士八段','範士九段'];
            
            const getDivLocal = (archer) => {
              const rIdx = rankOrderLocal.indexOf(normalizeRankLocal(archer?.rank));
              for (const d of divisions) {
                const minIdx = d?.minRank ? rankOrderLocal.indexOf(normalizeRankLocal(d.minRank)) : 0;
                const maxIdx = d?.maxRank ? rankOrderLocal.indexOf(normalizeRankLocal(d.maxRank)) : rankOrderLocal.length - 1;
                if (rIdx >= minIdx && rIdx <= maxIdx) return d.id;
              }
              return 'unassigned';
            };

            const divOrderForPrint2 = [...divisions]
              .sort((x, y) => {
                const xi = x?.minRank ? rankOrderLocal.indexOf(normalizeRankLocal(x.minRank)) : 0;
                const yi = y?.minRank ? rankOrderLocal.indexOf(normalizeRankLocal(y.minRank)) : 0;
                return (xi === -1 ? Infinity : xi) - (yi === -1 ? Infinity : yi);
              })
              .map(d => d.id)
              .filter(Boolean);

            const checkedInForPrint = printSource.filter(a => a.isCheckedIn);
            const sortedCheckedInForPrint = [...checkedInForPrint].sort((a, b) => {
              // ① 部門順
              const aDivIdx = divOrderForPrint2.indexOf(getDivLocal(a));
              const bDivIdx = divOrderForPrint2.indexOf(getDivLocal(b));
              if (aDivIdx !== bDivIdx) {
                if (aDivIdx === -1) return 1;
                if (bDivIdx === -1) return -1;
                return aDivIdx - bDivIdx;
              }
              // ② 性別
              if (enableGenderSeparation) {
                const ag = a.gender || 'male', bg = b.gender || 'male';
                if (ag !== bg) return femaleFirstPrint
                  ? (ag === 'female' ? -1 : 1)
                  : (ag === 'male' ? -1 : 1);
              }
              // ③ 段位昇順
              const ai = rankOrderLocal.indexOf(normalizeRankLocal(a.rank));
              const bi = rankOrderLocal.indexOf(normalizeRankLocal(b.rank));
              if (ai !== bi) {
                if (ai === -1) return 1;
                if (bi === -1) return -1;
                return ai - bi;
              }
              // ④ 習得日降順
              const ad = a.rankAcquiredDate ? new Date(a.rankAcquiredDate).getTime() : Number.NEGATIVE_INFINITY;
              const bd = b.rankAcquiredDate ? new Date(b.rankAcquiredDate).getTime() : Number.NEGATIVE_INFINITY;
              return bd - ad;
            });

            const divId = getDivLocal(archer);
            const sameDiv = sortedCheckedInForPrint.filter(a => getDivLocal(a) === divId);
            const idx = sameDiv.findIndex(a => a.archerId === archer.archerId);
            if (idx === -1) return null;
            return Math.floor(idx / archersPerStand) + 1;
          };

          const standNum = getStandNumForPrint(archer);
          if (standNum === null) return [];

          const standKey = `stand${standNum}`;
          const standResults = archer.results?.[standKey] || [];
          
          if (standResults.length === 0) return [];
          if (roundNum === 1) return standResults.slice(0, arrowsRound1);
          return standResults.slice(arrowsRound1, arrowsRound1 + arrowsRound2);
        };

        const sym = (r) => r === 'o' ? '◯' : r === 'x' ? '×' : r === '?' ? '?' : '　';

        // 1立ち目 actual results
        const stand1Results = getArcherRoundResultsForPrint(a, 1);
        html += `<td style="white-space:nowrap;text-align:center">`;
        if (stand1Results.length > 0) {
          stand1Results.forEach(r => {
            const color = r === 'o' ? '#16a34a' : r === 'x' ? '#dc2626' : '#9ca3af';
            html += `<span style="display:inline-block;width:20px;text-align:center;font-size:13px;color:${color};font-weight:${r === 'o' ? 700 : 400}">${sym(r)}</span>`;
          });
        } else {
          for (let x = 0; x < arrows1; x++) html += `<span style="display:inline-block;width:20px;text-align:center">&nbsp;</span>`;
        }
        html += `</td>`;
        // 2立ち目 actual results
        const stand2Results = getArcherRoundResultsForPrint(a, 2);
        html += `<td style="white-space:nowrap;text-align:center">`;
        if (stand2Results.length > 0) {
          stand2Results.forEach(r => {
            const color = r === 'o' ? '#16a34a' : r === 'x' ? '#dc2626' : '#9ca3af';
            html += `<span style="display:inline-block;width:20px;text-align:center;font-size:13px;color:${color};font-weight:${r === 'o' ? 700 : 400}">${sym(r)}</span>`;
          });
        } else {
          for (let x = 0; x < arrows2; x++) html += `<span style="display:inline-block;width:20px;text-align:center">&nbsp;</span>`;
        }
        html += `</td>`;
        html += `</tr>`;
      }

      html += `</tbody></table></div>`;
    }

    const escapeHtml = (s) => String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    const awardRankLimit = tplData?.awardRankLimit || 3;
    const enableGenderSeparationFinal = tplData?.enableGenderSeparation ?? false;
    const femaleFirstFinal = enableGenderSeparationFinal && (tplData?.femaleFirst ?? false);

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
      const enkinArcherIds = new Set((finalResults.enkin?.results || []).map(r => r.archerId));
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
              divisionId: getDivisionIdForArcher(a, divisions)
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
              divisionId: getDivisionIdForArcher(a, divisions)
            });
            processedArcherIds.add(result.archerId);
          });
      }

      const resultsByDivision = {};
      const baseDivisions = (tplData?.divisions) || divisions;
      baseDivisions.forEach(div => {
        if (enableGenderSeparationFinal) {
          resultsByDivision[`${div.id}_male`] = { division: { ...div, id: `${div.id}_male`, label: `${div.label}（男）` }, results: [] };
          resultsByDivision[`${div.id}_female`] = { division: { ...div, id: `${div.id}_female`, label: `${div.label}（女）` }, results: [] };
        } else {
          resultsByDivision[div.id] = { division: div, results: [] };
        }
      });
      if (!resultsByDivision.unassigned) {
        if (enableGenderSeparationFinal) {
          resultsByDivision['unassigned_male'] = { division: { id: 'unassigned_male', label: '未分類（男）' }, results: [] };
          resultsByDivision['unassigned_female'] = { division: { id: 'unassigned_female', label: '未分類（女）' }, results: [] };
        } else {
          resultsByDivision.unassigned = { division: { id: 'unassigned', label: '未分類' }, results: [] };
        }
      }

      mergedResults.forEach(r => {
        const a = getArcherById(r.archerId);
        if (!a) return;
        const divId = getDivisionIdForArcher(a, divisions);
        const gender = a.gender || 'male';
        const key = enableGenderSeparationFinal ? `${divId}_${gender}` : divId;
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
        if (enableGenderSeparationFinal) {
          const firstG = femaleFirstFinal ? 'female' : 'male';
          const secondG = femaleFirstFinal ? 'male' : 'female';
          const firstL = femaleFirstFinal ? '女' : '男';
          const secondL = femaleFirstFinal ? '男' : '女';
          orderedDivisions.push(resultsByDivision[`${div.id}_${firstG}`] || { division: { ...div, id: `${div.id}_${firstG}`, label: `${div.label}（${firstL}）` }, results: [] });
          orderedDivisions.push(resultsByDivision[`${div.id}_${secondG}`] || { division: { ...div, id: `${div.id}_${secondG}`, label: `${div.label}（${secondL}）` }, results: [] });
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
    // Give browser a moment to render
    setTimeout(() => { win.print(); }, 300);
  };

  const downloadProgramPdf = async () => {
    if (!selectedTournamentId) { alert('大会を選択してください'); return; }
    const tpl = state.registeredTournaments.find(t => t.id === selectedTournamentId);
    const tplData = tpl?.data || {};
    const title = tplData?.name || selectedTournamentId;
    const exportSource = programTableMode === 'all_applicants' ? allApplicants : archers;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const fontInfo = await ensureJapaneseFont(doc);
    doc.setFontSize(14);
    doc.text(`${title} プログラム表`, 14, 16);
    doc.setFontSize(10);
    const datetime = tplData?.datetime || '';
    const location = tplData?.location || '';
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
    const tpl = state.registeredTournaments.find(t => t.id === selectedTournamentId);
    const tplData = tpl?.data || {};
    const title = tplData?.name || selectedTournamentId;
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

  // パフォーマンス向上のため、メモ化された関数を使用

  /**
   * ★ 修正ポイント ★
   * RecordingView と同じロジックで「チェックイン済み選手のみ」を
   * 「enableGenderSeparation を考慮した順」でソートし、
   * その中での部門内インデックスから立ち番号を計算する。
   * これにより RecordingView で入力した stand{N} のキーと一致する。
   */
  const getStandNumForArcher = (archer, localArchers, localDivisions) => {
    const archersPerStand = tournament?.archersPerStand ?? 6;
    // ※ tournament は state.tournament（設定値のみ）で enableGenderSeparation を持たない場合があるため
    //    selectedTournament?.data を優先参照する
    const enableGenderSeparation = selectedTournament?.data?.enableGenderSeparation ?? tournament?.enableGenderSeparation ?? false;
    const femaleFirstStand = enableGenderSeparation && (selectedTournament?.data?.femaleFirst ?? false);

    const useDivisions = localDivisions || divisions;

    const divisionOrderStand = [...useDivisions]
      .sort((x, y) => {
        const xi = x?.minRank ? rankOrder.indexOf(normalizeRank(x.minRank)) : 0;
        const yi = y?.minRank ? rankOrder.indexOf(normalizeRank(y.minRank)) : 0;
        return (xi === -1 ? Infinity : xi) - (yi === -1 ? Infinity : yi);
      })
      .map(d => d.id)
      .filter(Boolean);

    const getDivId = (a) => {
      const rIdx = rankOrder.indexOf(normalizeRank(a?.rank));
      for (const d of useDivisions) {
        const minIdx = d?.minRank ? rankOrder.indexOf(normalizeRank(d.minRank)) : 0;
        const maxIdx = d?.maxRank ? rankOrder.indexOf(normalizeRank(d.maxRank)) : rankOrder.length - 1;
        if (rIdx >= minIdx && rIdx <= maxIdx) return d.id;
      }
      return 'unassigned';
    };

    // チェックイン済みのみ抽出 → 部門→性別→段位 の順でソート（RecordingView と同じ）
    const checkedIn = (localArchers || archers).filter(a => a.isCheckedIn);
    const sortedCheckedIn = [...checkedIn].sort((a, b) => {
      // ① 部門順
      const aDivIdx = divisionOrderStand.indexOf(getDivId(a));
      const bDivIdx = divisionOrderStand.indexOf(getDivId(b));
      if (aDivIdx !== bDivIdx) {
        if (aDivIdx === -1) return 1;
        if (bDivIdx === -1) return -1;
        return aDivIdx - bDivIdx;
      }
      // ② 性別
      if (enableGenderSeparation) {
        const ag = a.gender || 'male', bg = b.gender || 'male';
        if (ag !== bg) return femaleFirstStand
          ? (ag === 'female' ? -1 : 1)
          : (ag === 'male' ? -1 : 1);
      }
      // ③ 段位昇順
      const ai = rankOrder.indexOf(normalizeRank(a.rank));
      const bi = rankOrder.indexOf(normalizeRank(b.rank));
      if (ai !== bi) {
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      }
      // ④ 習得日降順
      const ad = a.rankAcquiredDate ? new Date(a.rankAcquiredDate).getTime() : Number.NEGATIVE_INFINITY;
      const bd = b.rankAcquiredDate ? new Date(b.rankAcquiredDate).getTime() : Number.NEGATIVE_INFINITY;
      return bd - ad;
    });

    const divisionId = getDivId(archer);
    const sameDiv = sortedCheckedIn.filter(a => getDivId(a) === divisionId);
    const idxInDiv = sameDiv.findIndex(a => a.archerId === archer.archerId);
    if (idxInDiv === -1) return null;
    return Math.floor(idxInDiv / archersPerStand) + 1;
  };

  // 選手のresultsから実際にデータが入っていいるstandキーを探して返す
  const findActiveStandResults = (archer) => {
    if (!archer.results) return [];
    const standKeys = Object.keys(archer.results)
      .filter(k => /^stand\d+$/.test(k))
      .sort((a, b) => parseInt(a.replace('stand', '')) - parseInt(b.replace('stand', '')));
    for (const key of standKeys) {
      const data = archer.results[key];
      if (Array.isArray(data) && data.some(v => v !== null)) {
        return data;
      }
    }
    return [];
  };

  const getArcherRoundResults = (archer, roundNum) => {
    // state.tournament を第一優先にする（最も信頼できるソース）
    const arrowsRound1 = tournament?.arrowsRound1 ?? 4; // デフォルト値
    const arrowsRound2 = tournament?.arrowsRound2 ?? 4;

    // 選手の立ち番号を取得
    const standNum = getStandNumForArcher(archer);
    if (standNum === null) return [];

    // 立ち番号に対応する結果を取得
    const standKey = `stand${standNum}`;
    const standResults = archer.results?.[standKey] || [];
    
    if (standResults.length === 0) return [];
    if (roundNum === 1) return standResults.slice(0, arrowsRound1);
    return standResults.slice(arrowsRound1, arrowsRound1 + arrowsRound2);
  };

  const resultSymbol = (r) => r === 'o' ? '◯' : r === 'x' ? '×' : r === '?' ? '?' : '';

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

  // 最終順位表を表示する関数（RankingViewから移植）
  const renderFinalResults = () => {
    // エラー表示
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

    if (!finalResults || (!finalResults.shichuma && !finalResults.enkin)) {
      return (
        <div className="card mt-6">
          <h3 className="card-title text-green-700 mb-4">🏆 最終順位表</h3>
          <p className="text-gray-500 text-center py-4">最終順位表の記録がありません</p>
        </div>
      );
    }

    // 統合結果を作成（RankingViewのgetMergedFinalResultsと同じ重複排除ロジック）
    const mergedResults = [];
    const awardRankLimit = tournament?.data?.awardRankLimit || 3; // 表彰範囲を取得

    // 遠近競射の選手IDセットを事前に作成（射詰→遠近の重複排除に使用）
    const enkinArcherIds = new Set(
      (finalResults.enkin?.results || []).map(r => r.archerId)
    );
    const processedArcherIds = new Set(); // 追加済み選手の管理

    // 射詰競射結果を追加（遠近競射に進んだ選手はスキップ）
    if (finalResults.shichuma && finalResults.shichuma.results) {
      finalResults.shichuma.results
        .sort((a, b) => a.rank - b.rank)
        .forEach(result => {
          const archer = archers.find(a => a.archerId === result.archerId);
          if (!archer) return;

          // 遠近競射に進んだ選手はスキップ（遠近の結果を優先）
          const isFromShichumaToEnkin = result.pendingEnkin || enkinArcherIds.has(result.archerId);
          if (isFromShichumaToEnkin) return;

          // 重複チェック
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
            divisionId: getDivisionIdForArcher(archer, divisions)
          });
          processedArcherIds.add(result.archerId);
        });
    }

    // 遠近競射結果を追加（敗退者・すでに追加済みの選手はスキップ）
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

          // 敗退者はスキップ
          if (result.rank === '敗退' || result.isDefeated) return;

          // 重複チェック（射詰で確定済みの選手はスキップ）
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
            divisionId: getDivisionIdForArcher(archer, divisions)
          });
          processedArcherIds.add(result.archerId);
        });
    }

    if (mergedResults.length === 0) {
      return (
        <div className="card mt-6">
          <h3 className="card-title text-green-700 mb-4">🏆 最終順位表</h3>
          <p className="text-gray-500 text-center py-4">最終順位表の記録がありません</p>
        </div>
      );
    }

    // 部門ごとに結果を分類（RankingViewと同じロジック）
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

    // 表彰範囲で結果をフィルタリング
    Object.keys(resultsByDivision).forEach(divId => {
      resultsByDivision[divId].results = resultsByDivision[divId].results
        .filter(result => {
          // 敗退者は完全に非表示
          if (result.rank === '敗退' || result.isDefeated) {
            return false;
          }
          // 順位が数値で表彰範囲内の場合のみ表示
          return typeof result.rank === 'number' && result.rank <= awardRankLimit;
        })
        .sort((a, b) => {
          // 順位でソート
          return a.rank - b.rank;
        });
    });

    // 部門順を維持して配列に変換（femaleFirst に従って男女の順序を決定）
    const divisionResults = [];
    divisions.forEach(div => {
      if (enableGenderSeparation) {
        const firstG = femaleFirst ? 'female' : 'male';
        const secondG = femaleFirst ? 'male' : 'female';
        const firstL = femaleFirst ? '女' : '男';
        const secondL = femaleFirst ? '男' : '女';
        divisionResults.push(resultsByDivision[`${div.id}_${firstG}`] || {
          division: { ...div, id: `${div.id}_${firstG}`, label: `${div.label}（${firstL}）` },
          results: []
        });
        divisionResults.push(resultsByDivision[`${div.id}_${secondG}`] || {
          division: { ...div, id: `${div.id}_${secondG}`, label: `${div.label}（${secondL}）` },
          results: []
        });
      } else {
        divisionResults.push(resultsByDivision[div.id] || {
          division: div,
          results: []
        });
      }
    });

    // すべての部門を表示するため、結果がない場合のチェックは不要

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
                        この部門の最終順位表の記録がありません<br/>
                        <span className="text-xs">（表彰範囲：{awardRankLimit}位まで）</span>
                      </td>
                    </tr>
                  ) : (
                    divisionData.results.map((result, index) => {
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
                              if (result.isWinner) {
                                return <span className="text-yellow-700 font-bold">🏆 優勝</span>;
                              } else if (result.pendingEnkin) {
                                return <span className="text-orange-600 font-bold">遠近待ち</span>;
                              } else if (result.eliminatedAt) {
                                return <span className="text-red-700">{result.eliminatedAt}本目脱落</span>;
                              } else {
                                return <span className="text-blue-700 font-bold">射詰{result.rank}位</span>;
                              }
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
                            <span className="text-green-700">
                              {result.hitCount}本的中
                            </span>
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
    const tpl = state.registeredTournaments.find(t => t.id === selectedTournamentId);
    const tplData = tpl?.data || {};
    const attachments = getStoredAttachments(selectedTournamentId);
    const programSource = programTableMode === 'all_applicants' ? allApplicants : archers;
    const totalPagesProgram = Math.max(1, Math.ceil(programSource.length / programArchersPerPage));
    const indexOfFirstProgram = (currentPageProgram - 1) * programArchersPerPage;
    const indexOfLastProgram = indexOfFirstProgram + programArchersPerPage;
    const currentArchersProgram = programSource.slice(indexOfFirstProgram, indexOfLastProgram);

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
            <h1>プログラム表</h1>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={printProgram} className="btn-primary">印刷</button>
              <button onClick={downloadProgramPdf} className="btn-secondary">PDF</button>
              <button onClick={downloadProgramExcel} className="btn-secondary">Excel</button>
            </div>
          </div>
        </div>

        <div className="view-content">
          {!selectedTournamentId ? (
            <div className="card">大会を選択してください</div>
          ) : (
            <>
              <div className="card" style={{ marginBottom: '1rem' }}>
                <h2 className="card-title">大会概要</h2>
                <p><strong>大会名:</strong> {tplData?.name || '未設定'}</p>
                <p><strong>日時:</strong> {tplData?.datetime || '未設定'}</p>
                <p><strong>場所:</strong> {tplData?.location || '未設定'}</p>
                <p><strong>目的:</strong> {tplData?.purpose || '-'}</p>
                <p><strong>主催:</strong> {tplData?.organizer || '-'}</p>
                <p><strong>後援:</strong> {tplData?.coOrganizer || '-'}</p>
                <p><strong>主管:</strong> {tplData?.administrator || '-'}</p>
                <p><strong>種目:</strong> {tplData?.event || '-'}</p>
                <p><strong>種類:</strong> {tplData?.type || '-'}</p>
                <p><strong>種別:</strong> {tplData?.category || '-'}</p>
                <p><strong>内容:</strong> {tplData?.description || '-'}</p>
                <p><strong>競技方法:</strong> {tplData?.competitionMethod || '-'}</p>
                <p><strong>表彰:</strong> {tplData?.award || '-'}</p>
                <p><strong>参加資格:</strong> {tplData?.qualifications || '-'}</p>
                <p><strong>適用規則:</strong> {tplData?.applicableRules || '-'}</p>
                <p><strong>申込方法:</strong> {tplData?.applicationMethod || '-'}</p>
                <p><strong>その他:</strong> {tplData?.remarks || '-'}</p>
              </div>

              <div className="card" style={{ marginBottom: '1rem' }}>
                <h2 className="card-title">添付資料</h2>
                {attachments.length === 0 ? (
                  <p className="text-sm text-gray-500">添付資料はありません</p>
                ) : (
                  <div className="space-y-2">
                    {attachments.map((att, idx) => (
                      <div key={`${att?.name || 'file'}_${idx}`} className="flex items-center justify-between">
                        <a className="text-sm text-blue-600 hover:underline" href={att?.dataUrl || ''} target="_blank" rel="noopener noreferrer">
                          {att?.name || `file_${idx+1}`}
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card">
                <div className="flex items-center justify-between">
                  <h2 className="card-title">立ち順表</h2>
                  <div className="flex items-center gap-2">
                    <button
                      className={`btn ${programTableMode === 'checked_in' ? 'btn-active' : ''}`}
                      onClick={() => { setProgramTableMode('checked_in'); setCurrentPageProgram(1); }}
                    >
                      チェックイン済み
                    </button>
                    <button
                      className={`btn ${programTableMode === 'all_applicants' ? 'btn-active' : ''}`}
                      onClick={() => { setProgramTableMode('all_applicants'); setCurrentPageProgram(1); }}
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
                        currentArchersProgram.map(a => (
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

                {programSource.length > programArchersPerPage && (
                  <div className="flex items-center justify-between mt-4">
                    <div>
                      <p className="text-sm">{indexOfFirstProgram + 1} ? {Math.min(indexOfLastProgram, programSource.length)} / {programSource.length} 名</p>
                    </div>
                    <div className="flex space-x-1">
                      <button onClick={() => paginateProgram(Math.max(1, currentPageProgram-1))} disabled={currentPageProgram === 1} className="btn">前へ</button>
                      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                        {Array.from({ length: totalPagesProgram }, (_, i) => (
                          <button key={i} onClick={() => paginateProgram(i+1)} className={`btn ${currentPageProgram === i+1 ? 'btn-active' : ''}`}>{i+1}</button>
                        ))}
                      </div>
                      <button onClick={() => paginateProgram(Math.min(totalPagesProgram, currentPageProgram+1))} disabled={currentPageProgram === totalPagesProgram} className="btn">次へ</button>
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
            <h1>大会進行 (リアルタイム)</h1>
            <div style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <div className="input w-full" style={{ display: 'flex', alignItems: 'center', padding: '0.5rem' }}>
                  <span style={{ fontWeight: 600 }}>{(state.registeredTournaments.find(t => t.id === selectedTournamentId)?.data?.name) || (selectedTournamentId ? selectedTournamentId : '-- 大会が選択されていません --')}</span>
                </div>
                <button
                  onClick={printProgram}
                  className="btn-secondary"
                  style={{ padding: '0 1rem' }}
                  title="プログラムを表示/印刷"
                >
                  <Maximize2 size={18} />
                </button>
              </div>
            </div>
          </div>
          <div className="view-content">
            {selectedTournamentId && (
              <>
                <div className="settings-grid">
                  <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                    <p className="text-xs text-gray-500 font-medium mb-1">受付済み</p>
                    <p className="text-lg font-semibold">{archers.length}<span className="text-sm text-gray-500 ml-1">人</span></p>
                  </div>
                  <div 
                    className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setView('qualifiers')}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs text-gray-500 font-medium mb-1">通過者</p>
                        <p className="text-lg font-semibold">
                          {passedArchers.length}<span className="text-sm text-gray-500 ml-1">人</span>
                        </p>
                      </div>
                      <Users className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                  <div 
                    className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setView('program')}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs text-gray-500 font-medium mb-1">プログラム</p>
                        <p className="text-sm font-medium">表示/印刷</p>
                      </div>
                      <Maximize2 className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                  <div 
                    className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setView('shichuma')}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs text-gray-500 font-medium mb-1">競射結果</p>
                        <p className="text-sm font-medium">結果表示</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                    <p className="text-xs text-gray-500 font-medium mb-1">通過ルール</p>
                    <p className="text-sm font-medium">
                      {tournament.passRule === 'all_four' ? '全て的中' :
                       tournament.passRule === 'four_or_more' ? '4本以上的中' :
                       tournament.passRule === 'three_or_more' ? '3本以上的中' :
                       tournament.passRule === 'two_or_more' ? '2本以上的中' : '未設定'}
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                    <p className="text-xs text-gray-500 font-medium mb-1">1立ち目矢数</p>
                    <p className="text-lg font-semibold">{tournament.arrowsRound1 || 0}<span className="text-sm text-gray-500 ml-1">本</span></p>
                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                    <p className="text-xs text-gray-500 font-medium mb-1">2立ち目矢数</p>
                    <p className="text-lg font-semibold">{tournament.arrowsRound2 || 0}<span className="text-sm text-gray-500 ml-1">本</span></p>
                  </div>
                </div>

                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p className="card-title">立ち順表</p>
                    {autoRefresh && (
                        <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span style={{ display: 'inline-block', width: '0.5rem', height: '0.5rem', backgroundColor: '#10b981', borderRadius: '50%', animation: 'pulse 1.5s ease-in-out infinite' }}></span>
                          Live
                        </span>
                      )}
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
                                          const stand1Result = archer.results?.stand1?.slice(0, tournament.arrowsRound1) || Array(tournament.arrowsRound1).fill(null);
                                          const stand2Result = archer.results?.stand1?.slice(tournament.arrowsRound1, tournament.arrowsRound1 + tournament.arrowsRound2) || Array(tournament.arrowsRound2).fill(null);
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
                                          const stand1Result = archer.results?.stand1?.slice(0, tournament.arrowsRound1) || Array(tournament.arrowsRound1).fill(null);
                                          const stand2Result = archer.results?.stand1?.slice(tournament.arrowsRound1, tournament.arrowsRound1 + tournament.arrowsRound2) || Array(tournament.arrowsRound2).fill(null);
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
                            const stand1Result = archer.results?.stand1?.slice(0, tournament.arrowsRound1) || Array(tournament.arrowsRound1).fill(null);
                            const stand2Result = archer.results?.stand1?.slice(tournament.arrowsRound1, tournament.arrowsRound1 + tournament.arrowsRound2) || Array(tournament.arrowsRound2).fill(null);
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