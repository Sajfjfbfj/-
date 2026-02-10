import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LogOut, RotateCcw, Copy, Check, Filter, X, Maximize2, ChevronLeft, ChevronRight, Users, User } from 'lucide-react';
import { applicantsApi, rankingApi, API_URL } from '../utils/api';
import { judgeNearFarCompetition, calculateRanksWithTies } from '../utils/competition';

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

  const fetchAndSortArchers = async () => {
    if (!selectedTournamentId) return;

    // ローディング表示は初回のみ、または手動更新時のみにする
    // setIsLoading(true); 
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

        const archersWithOrder = sortedArchers.map((archer, index) => ({
          ...archer,
          standOrder: index + 1
        }));

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
        if (error.message?.includes('404') || error.status === 404) {
          setShichumaData(null);
        } else {
          console.error('射詰競射結果の取得エラー:', error);
          setShichumaData(null);
        }
      } finally {
        setIsLoadingShichuma(false);
      }
    };

      fetchShichumaResults();
  }, [selectedTournamentId]);

  const tournament = state.tournament;
  const currentRound = tournament.currentRound || 1;
  const arrowsPerStand = currentRound === 1 ? tournament.arrowsRound1 : tournament.arrowsRound2;

  const printProgram = () => {
    if (!selectedTournamentId) { alert('大会を選択してください'); return; }
    // get selected tournament data
    const tpl = state.registeredTournaments.find(t => t.id === selectedTournamentId);
    const tplData = tpl?.data || {};
    const perPage = programArchersPerPage;
    const pages = Math.max(1, Math.ceil(archers.length / perPage));
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

    // Page 2..: standings table only
    for (let p = 0; p < pages; p++) {
      html += `<div class="page">`;
      html += `<h2 style="margin:0 0 8px">立ち順表</h2>`;

      const arrows1 = tplData?.arrowsRound1 || 0;
      const arrows2 = tplData?.arrowsRound2 || 0;
      html += `<table><thead><tr><th>#</th><th>氏名</th><th>所属</th><th>段位</th><th>性別</th><th>1立ち目</th><th>2立ち目</th></tr></thead><tbody>`;

      const start = p * perPage;
      const end = Math.min(start + perPage, archers.length);
      for (let i = start; i < end; i++) {
        const a = archers[i];
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
          <h1>射詰競射結果</h1>
        </div>
        <div className="view-content">
          {isLoadingShichuma ? (
            <div className="card">
              <p className="text-gray-500">読み込み中...</p>
            </div>
          ) : !shichumaData ? (
            <div className="card">
              <p className="text-gray-500">射詰競射の記録がありません</p>
            </div>
          ) : (
            <div className="card">
              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  完了日時: {new Date(shichumaData.completedAt).toLocaleString('ja-JP')}
                </p>
              </div>
              
              <div className="space-y-3">
                {shichumaData.results
                  .sort((a, b) => a.rank - b.rank)
                  .map(result => {
                    const archer = archers.find(a => a.archerId === result.archerId);
                    if (!archer) return null;
                    
                    return (
                      <div key={result.archerId} className="border rounded p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="font-bold text-lg">{result.rank}位</span>
                            <span className="font-semibold ml-3">{archer.name}</span>
                          </div>
                          <span className="text-sm text-gray-600">
                            {result.isWinner 
                              ? `優勝 (継続的中: ${result.consecutiveHits}本)` 
                              : `${result.eliminatedAt}本目で脱落 (継続的中: ${result.consecutiveHits}本)`}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{archer.affiliation}</p>
                        
                        <div className="mt-2 flex gap-1 items-center">
                          <span className="text-xs font-semibold text-gray-500 w-12">記録:</span>
                          <div className="flex gap-1">
                            {result.results.map((r, idx) => (
                              <div key={idx} className="text-center">
                                <span className="text-xs text-gray-500">{idx + 1}本</span>
                                <div className={`w-6 h-6 rounded flex items-center justify-center text-sm font-bold ${
                                  r === 'o' ? 'bg-gray-900 text-white' : 
                                  r === 'x' ? 'bg-red-200 text-red-700' : 'bg-gray-100 text-gray-400'
                                }`}>
                                  {r === 'o' ? '○' : r === 'x' ? '×' : '?'}
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
        </div>
      </div>
    );
  }

  if (view === 'program') {
    const tpl = state.registeredTournaments.find(t => t.id === selectedTournamentId);
    const tplData = tpl?.data || {};
    const attachments = getStoredAttachments(selectedTournamentId);
    const totalPagesProgram = Math.max(1, Math.ceil(archers.length / programArchersPerPage));
    const indexOfFirstProgram = (currentPageProgram - 1) * programArchersPerPage;
    const indexOfLastProgram = indexOfFirstProgram + programArchersPerPage;
    const currentArchersProgram = archers.slice(indexOfFirstProgram, indexOfLastProgram);

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
            <button onClick={printProgram} className="btn-primary">印刷</button>
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
                <h2 className="card-title">立ち順表</h2>
                <div className="table-responsive">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">氏名</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">所属</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">段位</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">性別</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">1立ち目</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">2立ち目</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {isLoading && archers.length === 0 ? (
                        <tr><td colSpan="7" className="px-4 py-4 text-center">読み込み中...</td></tr>
                      ) : archers.length === 0 ? (
                        <tr><td colSpan="7" className="px-4 py-4 text-center">選手が登録されていません</td></tr>
                      ) : (
                        currentArchersProgram.map(a => (
                          <tr key={a.archerId}>
                            <td className="px-4 py-3 text-sm font-medium">{a.standOrder}</td>
                            <td className="px-4 py-3">{a.name}</td>
                            <td className="px-4 py-3">{a.affiliation}</td>
                            <td className="px-4 py-3 text-center">{a.rank}</td>
                            <td className="px-4 py-3 text-center">{a.gender === 'female' ? '女' : '男'}</td>
                            <td className="px-4 py-3">
                              <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                                {Array.from({ length: (tplData?.arrowsRound1 || 0) }).map((_, idx) => (
                                  <span key={idx} className="inline-flex items-center justify-center w-6 h-4 text-xs text-gray-600">&nbsp;</span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                                {Array.from({ length: (tplData?.arrowsRound2 || 0) }).map((_, idx) => (
                                  <span key={idx} className="inline-flex items-center justify-center w-6 h-4 text-xs text-gray-600">&nbsp;</span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {archers.length > programArchersPerPage && (
                  <div className="flex items-center justify-between mt-4">
                    <div>
                      <p className="text-sm">{indexOfFirstProgram + 1} ? {Math.min(indexOfLastProgram, archers.length)} / {archers.length} 名</p>
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
                        <p className="text-xs text-gray-500 font-medium mb-1">射詰競射</p>
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