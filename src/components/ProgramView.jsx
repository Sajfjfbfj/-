import React, { useState, useEffect, useMemo } from 'react';
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

  useEffect(() => {
    const fetchArchers = async () => {
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

          const sorted = [...applicants].sort((a,b)=>{
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
    };
    fetchArchers();
  }, [selectedTournamentId]);

  const tournaments = state.registeredTournaments || [];
  const tournament = tournaments.find(t => t.id === selectedTournamentId) || null;
  const attachments = useMemo(() => getStoredAttachments(selectedTournamentId), [selectedTournamentId]);

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
      // Image previews (only for image/*)
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

    // Page 2..: standings table only
    for (let p = 0; p < pages; p++) {
      html += `<div class="page">`;
      html += `<h2 style="margin:0 0 8px">立ち順表</h2>`;

      const arrows1 = tournament?.data?.arrowsRound1 || 0;
      const arrows2 = tournament?.data?.arrowsRound2 || 0;
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

  const totalPages = Math.max(1, Math.ceil(archers.length / archersPerPage));
  const [currentPage, setCurrentPage] = useState(1);
  const indexOfFirst = (currentPage - 1) * archersPerPage;
  const indexOfLast = indexOfFirst + archersPerPage;
  const currentArchers = archers.slice(indexOfFirst, indexOfLast);

  return (
    <div className="view-container">
      <div className="view-header">
        <h1>プログラム表</h1>
        <button onClick={printProgram} className="btn-primary">印刷</button>
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
                      currentArchers.map(a => (
                        <tr key={a.archerId}>
                          <td className="px-4 py-3 text-sm font-medium">{a.standOrder}</td>
                          <td className="px-4 py-3">{a.name}</td>
                          <td className="px-4 py-3">{a.affiliation}</td>
                          <td className="px-4 py-3 text-center">{a.rank}</td>
                          <td className="px-4 py-3 text-center">{a.gender === 'female' ? '女' : '男'}</td>
                          <td className="px-4 py-3">
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                              {Array.from({ length: (tournament?.data?.arrowsRound1 || 0) }).map((_, idx) => (
                                <span key={idx} className="inline-flex items-center justify-center w-6 h-4 text-xs text-gray-600">&nbsp;</span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                              {Array.from({ length: (tournament?.data?.arrowsRound2 || 0) }).map((_, idx) => (
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

              {archers.length > archersPerPage && (
                <div className="flex items-center justify-between mt-4">
                  <div>
                    <p className="text-sm">{indexOfFirst + 1} ? {Math.min(indexOfLast, archers.length)} / {archers.length} 名</p>
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