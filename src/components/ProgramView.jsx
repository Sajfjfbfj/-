import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getStoredAttachments } from '../utils/tournament';
import { API_URL } from '../utils/api';

const ProgramView = ({ state }) => {
  const [selectedTournamentId, setSelectedTournamentId] = useState(() => localStorage.getItem('selectedTournamentId') || '');
  const [archers, setArchers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const archersPerPage = 36;

  useEffect(() => {
    if (selectedTournamentId) localStorage.setItem('selectedTournamentId', selectedTournamentId);
    else localStorage.removeItem('selectedTournamentId');
  }, [selectedTournamentId]);

  const fetchArchers = useCallback(async () => {
    if (!selectedTournamentId) {
      setArchers([]);
      return;
    }
    setIsLoading(true);
    try {
      const resp = await fetch(`${API_URL}/applicants/${selectedTournamentId}`);
      const json = await resp.json();
      if (json.success) {
        const applicants = json.data || [];
        const rankOrder = ['無指定','五級','四級','三級','弐級','壱級','初段','弐段','参段','四段','五段','錬士五段','錬士六段','教士七段','教士八段','範士八段','範士九段'];
        const normalize = (r) => (r||'').replace('二段','弐段').replace('三段','参段').replace('二級','弐級').replace('一級','壱級');

        // 表示用ソート（チェックイン済みの申込者のみ）: 段位順 → 取得日順
        const sorted = [...applicants]
          .filter(a => a.isCheckedIn) // チェックイン済み選手のみ表示
          .sort((a,b)=>{
          const ar = normalize(a.rank); const br = normalize(b.rank);
          const ai = rankOrder.indexOf(ar); const bi = rankOrder.indexOf(br);
          if (ai !== bi) {
            if (ai === -1) return 1;
            if (bi === -1) return -1;
            return ai - bi;
          }
          const ad = a.rankAcquiredDate ? new Date(a.rankAcquiredDate) : new Date(0);
          const bd = b.rankAcquiredDate ? new Date(b.rankAcquiredDate) : new Date(0);
          return ad.getTime() - bd.getTime();
        }).map((s, idx)=>({ ...s, standOrder: idx+1 }));

        setArchers(sorted);
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

  const tournaments = state.registeredTournaments || [];
  const tournament = tournaments.find(t => t.id === selectedTournamentId) || null;
  const attachments = useMemo(() => getStoredAttachments(selectedTournamentId), [selectedTournamentId]);

  // ---- 共通定義 ----
  const rankOrder = ['無指定','五級','四級','三級','弐級','壱級','初段','弐段','参段','四段','五段','錬士五段','錬士六段','教士七段','教士八段','範士八段','範士九段'];
  const normalizeRank = (r) => (r||'').replace('二段','弐段').replace('三段','参段').replace('二級','弐級').replace('一級','壱級');

  const localDefaultDivisions = [
    { id: 'lower', label: '級位~三段以下の部' },
    { id: 'middle', label: '四・五段の部' },
    { id: 'title', label: '称号者の部' }
  ];
  const divisions = (tournament?.data?.divisions) ? tournament.data.divisions : localDefaultDivisions;

  const getDivisionIdForArcher = (archer) => {
    const rIdx = rankOrder.indexOf(normalizeRank(archer?.rank));
    for (const d of divisions) {
      const minIdx = d?.minRank ? rankOrder.indexOf(normalizeRank(d.minRank)) : 0;
      const maxIdx = d?.maxRank ? rankOrder.indexOf(normalizeRank(d.maxRank)) : rankOrder.length - 1;
      if (rIdx >= minIdx && rIdx <= maxIdx) return d.id;
    }
    return 'unassigned';
  };

  /**
   * ★ 修正ポイント ★
   * RecordingView と同じロジックで「チェックイン済み選手のみ」を
   * 「enableGenderSeparation を考慮した順」でソートし、
   * その中での部門内インデックスから立ち番号を計算する。
   * これにより RecordingView で入力した stand{N} のキーと一致する。
   */
  const getStandNumForArcher = (archer, localArchers, localDivisions) => {
    const archersPerStand = tournament?.data?.archersPerStand ?? tournament?.archersPerStand ?? 6;
    const enableGenderSeparation = tournament?.data?.enableGenderSeparation ?? tournament?.enableGenderSeparation ?? false;

    const getDivId = (a) => {
      const rIdx = rankOrder.indexOf(normalizeRank(a?.rank));
      for (const d of (localDivisions || divisions)) {
        const minIdx = d?.minRank ? rankOrder.indexOf(normalizeRank(d.minRank)) : 0;
        const maxIdx = d?.maxRank ? rankOrder.indexOf(normalizeRank(d.maxRank)) : rankOrder.length - 1;
        if (rIdx >= minIdx && rIdx <= maxIdx) return d.id;
      }
      return 'unassigned';
    };

    // チェックイン済みのみ抽出 → RecordingView と同じソート
    const checkedIn = (localArchers || archers).filter(a => a.isCheckedIn);
    const sortedCheckedIn = [...checkedIn].sort((a, b) => {
      if (enableGenderSeparation) {
        const ag = a.gender || 'male', bg = b.gender || 'male';
        if (ag !== bg) return ag === 'male' ? -1 : 1;
      }
      const ai = rankOrder.indexOf(normalizeRank(a.rank));
      const bi = rankOrder.indexOf(normalizeRank(b.rank));
      if (ai !== bi) {
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      }
      const ad = a.rankAcquiredDate ? new Date(a.rankAcquiredDate) : new Date(0);
      const bd = b.rankAcquiredDate ? new Date(b.rankAcquiredDate) : new Date(0);
      return ad.getTime() - bd.getTime();
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
    const arrowsRound1 = state.tournament?.arrowsRound1 
                      ?? tournament?.data?.arrowsRound1 
                      ?? tournament?.arrowsRound1 
                      ?? 4; // デフォルト値
    const arrowsRound2 = state.tournament?.arrowsRound2 
                      ?? tournament?.data?.arrowsRound2 
                      ?? tournament?.arrowsRound2 
                      ?? 4;

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

  const printProgram = () => {
    if (!selectedTournamentId) { alert('大会を選択してください'); return; }
    const perPage = archersPerPage;
    const pages = Math.max(1, Math.ceil(archers.length / perPage));
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

    // Page 2..: standings table
    const arrows1 = tournament?.data?.arrowsRound1 
                   ?? tournament?.arrowsRound1 
                   ?? state.tournament?.arrowsRound1 
                   ?? 4;
    const arrows2 = tournament?.data?.arrowsRound2 
                   ?? tournament?.arrowsRound2 
                   ?? state.tournament?.arrowsRound2 
                   ?? 4;
    const archersPerStand = tournament?.data?.archersPerStand 
                           ?? tournament?.archersPerStand 
                           ?? state.tournament?.archersPerStand 
                           ?? 6;
    const enableGenderSeparation = tournament?.data?.enableGenderSeparation 
                                 ?? tournament?.enableGenderSeparation 
                                 ?? state.tournament?.enableGenderSeparation 
                                 ?? false;

    const localDivisions = (tournament?.data?.divisions) || [
      { id: 'lower' }, { id: 'middle' }, { id: 'title' }
    ];
    const normalizeRankLocal = (r) => (r||'').replace('二段','弐段').replace('三段','参段').replace('二級','弐級').replace('一級','壱級');
    const rankOrderLocal = ['無指定','五級','四級','三級','弐級','壱級','初段','弐段','参段','四段','五段','錬士五段','錬士六段','教士七段','教士八段','範士八段','範士九段'];

    const getDivLocal = (archer) => {
      const rIdx = rankOrderLocal.indexOf(normalizeRankLocal(archer?.rank));
      for (const d of localDivisions) {
        const minIdx = d?.minRank ? rankOrderLocal.indexOf(normalizeRankLocal(d.minRank)) : 0;
        const maxIdx = d?.maxRank ? rankOrderLocal.indexOf(normalizeRankLocal(d.maxRank)) : rankOrderLocal.length - 1;
        if (rIdx >= minIdx && rIdx <= maxIdx) return d.id;
      }
      return 'unassigned';
    };

    // ★ 印刷用: RecordingView と同じロジックで立ち番を計算
    const checkedInForPrint = archers.filter(a => a.isCheckedIn);
    const sortedCheckedInForPrint = [...checkedInForPrint].sort((a, b) => {
      if (enableGenderSeparation) {
        const ag = a.gender || 'male', bg = b.gender || 'male';
        if (ag !== bg) return ag === 'male' ? -1 : 1;
      }
      const ai = rankOrderLocal.indexOf(normalizeRankLocal(a.rank));
      const bi = rankOrderLocal.indexOf(normalizeRankLocal(b.rank));
      if (ai !== bi) {
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      }
      const ad = a.rankAcquiredDate ? new Date(a.rankAcquiredDate) : new Date(0);
      const bd = b.rankAcquiredDate ? new Date(b.rankAcquiredDate) : new Date(0);
      return ad.getTime() - bd.getTime();
    });

    const getStandNumForPrint = (archer) => {
      const divId = getDivLocal(archer);
      const sameDiv = sortedCheckedInForPrint.filter(a => getDivLocal(a) === divId);
      const idx = sameDiv.findIndex(a => a.archerId === archer.archerId);
      if (idx === -1) return null;
      return Math.floor(idx / archersPerStand) + 1;
    };

    const findActiveStandResultsForPrint = (archer) => {
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

    const getArcherRoundResultsForPrint = (archer, roundNum) => {
      // state.tournament を第一優先にする（最も信頼できるソース）
      const arrowsRound1 = state.tournament?.arrowsRound1 
                      ?? tournament?.data?.arrowsRound1 
                      ?? tournament?.arrowsRound1 
                      ?? 4; // デフォルト値
      const arrowsRound2 = state.tournament?.arrowsRound2 
                      ?? tournament?.data?.arrowsRound2 
                      ?? tournament?.arrowsRound2 
                      ?? 4;

      // 選手の立ち番号を取得
      const standNum = getStandNumForPrint(archer);
      if (standNum === null) return [];

      // 立ち番号に対応する結果を取得
      const standKey = `stand${standNum}`;
      const standResults = archer.results?.[standKey] || [];
      
      if (standResults.length === 0) return [];
      if (roundNum === 1) return standResults.slice(0, arrowsRound1);
      return standResults.slice(arrowsRound1, arrowsRound1 + arrowsRound2);
    };

    const sym = (r) => r === 'o' ? '◯' : r === 'x' ? '×' : r === '?' ? '?' : '　';

    for (let p = 0; p < pages; p++) {
      html += `<div class="page">`;
      html += `<h2 style="margin:0 0 8px">立ち順表</h2>`;
      html += `<table><thead><tr><th>#</th><th>氏名</th><th>所属</th><th>段位</th><th>性別</th><th>1立ち目</th><th>2立ち目</th></tr></thead><tbody>`;

      const start = p * perPage;
      const end = Math.min(start + perPage, archers.length);
      for (let i = start; i < end; i++) {
        const a = archers[i];
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
    }

    html += `</body></html>`;

    const win = window.open('', '_blank');
    if (!win) { alert('ポップアップがブロックされました。ポップアップを許可してください。'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 300);
  };

  const totalPages = Math.max(1, Math.ceil(archers.length / archersPerPage));
  const [currentPage, setCurrentPage] = useState(1);
  const indexOfFirst = (currentPage - 1) * archersPerPage;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn" onClick={printProgram}>🖨️ 印刷</button>
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
                      archers.map(a => (
                        <tr key={a.archerId}>
                          <td className="px-4 py-3 text-sm font-medium">{a.standOrder}</td>
                          <td className="px-4 py-3">{a.name}</td>
                          <td className="px-4 py-3">{a.affiliation}</td>
                          <td className="px-4 py-3 text-center">{a.rank}</td>
                          <td className="px-4 py-3 text-center">{a.gender === 'female' ? '女' : '男'}</td>
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
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {archers.length > archersPerPage && (
                <div className="flex items-center justify-between mt-4">
                  <div>
                    <p className="text-sm">{indexOfFirst + 1} 〜 {Math.min(indexOfLast, archers.length)} / {archers.length} 名</p>
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
          </>
        )}
      </div>
    </div>
  );
};

export default ProgramView;