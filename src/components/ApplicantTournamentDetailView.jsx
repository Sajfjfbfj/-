import React, { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { applicantsApi } from '../utils/api';
import { ensureJapaneseFont } from '../utils/jspdfJapaneseFont';

const ApplicantTournamentDetailView = ({ state }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [allApplicants, setAllApplicants] = useState([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState('');

  const appliedUsers = useMemo(() => {
    try {
      const storedList = localStorage.getItem('kyudo_tournament_users');
      const list = storedList ? JSON.parse(storedList) : [];
      const safeList = Array.isArray(list) ? list : [];
      if (safeList.length > 0) return safeList;

      const single = localStorage.getItem('kyudo_tournament_user');
      const singleObj = single ? JSON.parse(single) : null;
      return singleObj ? [singleObj] : [];
    } catch {
      return [];
    }
  }, []);

  const appliedTournamentIds = useMemo(() => {
    const ids = [];
    const seen = new Set();

    for (const u of appliedUsers) {
      const id = u?.archerId;
      if (!id || typeof id !== 'string') continue;
      const idx = id.lastIndexOf('_');
      if (idx <= 0) continue;
      const tId = id.slice(0, idx);
      if (!tId) continue;
      if (seen.has(tId)) continue;
      seen.add(tId);
      ids.push(tId);
    }

    return ids;
  }, [appliedUsers]);

  useEffect(() => {
    if (selectedTournamentId) return;
    if (appliedTournamentIds.length === 0) return;
    setSelectedTournamentId(appliedTournamentIds[0]);
  }, [appliedTournamentIds, selectedTournamentId]);

  const tournamentTemplate = useMemo(() => {
    if (!selectedTournamentId) return null;
    return (state?.registeredTournaments || []).find(t => t.id === selectedTournamentId) || null;
  }, [state, selectedTournamentId]);

  const appliedTournamentOptions = useMemo(() => {
    const templates = state?.registeredTournaments || [];
    return appliedTournamentIds
      .map(id => {
        const tpl = templates.find(t => t.id === id);
        const label = tpl?.data?.name ? `${tpl.data.name} (${id})` : id;
        return { id, label };
      });
  }, [appliedTournamentIds, state]);

  const rankOrder = useMemo(() => (
    [
      '無指定',
      '五級', '四級', '三級', '弐級', '壱級',
      '初段', '弐段', '参段', '四段', '五段',
      '錬士五段', '錬士六段', '教士七段', '教士八段', '範士八段', '範士九段'
    ]
  ), []);

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

  const getRankIndex = (rank) => {
    const normalized = normalizeRank(rank);
    const idx = rankOrder.indexOf(normalized);
    return idx === -1 ? 9999 : idx;
  };

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!selectedTournamentId) return;
      setIsLoading(true);
      setError('');
      try {
        const result = await applicantsApi.getByTournament(selectedTournamentId);
        const data = Array.isArray(result?.data) ? result.data : [];

        const enableGenderSeparation = tplData?.enableGenderSeparation ?? false;
        const femaleFirst = enableGenderSeparation && (tplData?.femaleFirst ?? false);

        const sorted = data
          .slice()
          .sort((a, b) => {
            if (enableGenderSeparation) {
              const ag = a.gender || 'male';
              const bg = b.gender || 'male';
              if (ag !== bg) return femaleFirst
                ? (ag === 'female' ? -1 : 1)
                : (ag === 'male' ? -1 : 1);
            }

            const aRank = getRankIndex(a.rank);
            const bRank = getRankIndex(b.rank);
            if (aRank !== bRank) return aRank - bRank;

            const adRaw = a.rankAcquiredDate ? new Date(a.rankAcquiredDate).getTime() : Number.NEGATIVE_INFINITY;
            const bdRaw = b.rankAcquiredDate ? new Date(b.rankAcquiredDate).getTime() : Number.NEGATIVE_INFINITY;
            const ad = Number.isFinite(adRaw) ? adRaw : Number.NEGATIVE_INFINITY;
            const bd = Number.isFinite(bdRaw) ? bdRaw : Number.NEGATIVE_INFINITY;
            if (ad !== bd) return bd - ad;

            return String(a.name || '').localeCompare(String(b.name || ''), 'ja');
          })
          .map((a, idx) => ({ ...a, standOrder: idx + 1 }));

        if (!mounted) return;
        setAllApplicants(sorted);
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || 'データの取得に失敗しました');
        setAllApplicants([]);
      } finally {
        if (!mounted) return;
        setIsLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [selectedTournamentId, rankOrder]);

  if (appliedTournamentIds.length === 0) {
    return (
      <div className="view-container">
        <div className="view-header">
          <h1>出場大会詳細</h1>
        </div>
        <div className="view-content">
          <div className="card">
            <p className="text-sm text-gray-700">この端末に申込情報がありません。</p>
            <p className="text-sm text-gray-700" style={{ marginTop: '0.5rem' }}>「選手申し込み」から申し込みを行うと、この画面で大会詳細と申込者一覧を素早く確認できます。</p>
          </div>
        </div>
      </div>
    );
  }

  const tplData = tournamentTemplate?.data || {};

  const downloadProgramPdf = async () => {
    if (!selectedTournamentId) return;
    const title = tplData?.name || selectedTournamentId;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const fontInfo = await ensureJapaneseFont(doc);
    doc.setFontSize(14);
    doc.text(`${title} 申込者一覧`, 14, 16);
    doc.setFontSize(10);
    const datetime = tplData?.datetime || tplData?.date || '';
    const location = tplData?.location || '';
    if (datetime) doc.text(String(datetime), 14, 22);
    if (location) doc.text(String(location), 14, 27);

    const head = [['#', '氏名', '所属', '段位', '性別']];
    const body = allApplicants.map((a, idx) => ([
      String(a.standOrder || idx + 1),
      String(a.name || ''),
      String(a.affiliation || ''),
      String(a.rank || ''),
      a.gender === 'female' ? '女' : '男'
    ]));

    autoTable(doc, {
      head,
      body,
      startY: 32,
      styles: { fontSize: 9, cellPadding: 1.5, ...(fontInfo?.loaded ? { font: fontInfo.fontName } : {}) },
      headStyles: { fillColor: [245, 245, 245], textColor: 20 },
      margin: { left: 10, right: 10 }
    });

    const safeTitle = String(title).replace(/[\\/:*?"<>|]/g, '_');
    doc.save(`${safeTitle}_applicants.pdf`);
  };

  const downloadProgramExcel = () => {
    if (!selectedTournamentId) return;
    const title = tplData?.name || selectedTournamentId;

    const header = ['#', '氏名', '所属', '段位', '性別'];
    const rows = allApplicants.map((a, idx) => ([
      a.standOrder || idx + 1,
      a.name || '',
      a.affiliation || '',
      a.rank || '',
      a.gender === 'female' ? '女' : '男'
    ]));

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'applicants');
    const safeTitle = String(title).replace(/[\\/:*?"<>|]/g, '_');
    XLSX.writeFile(wb, `${safeTitle}_applicants.xlsx`);
  };

  return (
    <div className="view-container">
      <div className="view-header">
        <h1>出場大会詳細</h1>
      </div>

      <div className="view-content">
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h2 className="card-title">出場大会</h2>
          <select
            value={selectedTournamentId}
            onChange={(e) => setSelectedTournamentId(e.target.value)}
            className="input w-full"
          >
            {appliedTournamentOptions.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="card" style={{ marginBottom: '1rem' }}>
          <h2 className="card-title">大会概要</h2>
          <p><strong>大会名:</strong> {tplData?.name || selectedTournamentId}</p>
          <p><strong>日時:</strong> {tplData?.datetime || tplData?.date || '未設定'}</p>
          <p><strong>場所:</strong> {tplData?.location || '未設定'}</p>
        </div>

        <div className="card">
          <div className="flex justify-between items-center">
            <h2 className="card-title">申込者全員のプログラム表</h2>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="text-sm text-gray-600">{allApplicants.length} 名</span>
              <button onClick={downloadProgramPdf} className="btn-secondary">PDF</button>
              <button onClick={downloadProgramExcel} className="btn-secondary">Excel</button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3" style={{ marginTop: '0.75rem' }}>
              <span className="text-red-700">{error}</span>
            </div>
          )}

          <div className="table-responsive" style={{ marginTop: '0.75rem' }}>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">氏名</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">所属</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">段位</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">性別</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading && allApplicants.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-4 text-center">読み込み中...</td></tr>
                ) : allApplicants.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-4 text-center">申込者がいません</td></tr>
                ) : (
                  allApplicants.map(a => (
                    <tr key={a.archerId}>
                      <td className="px-4 py-3 text-sm font-medium">{a.standOrder}</td>
                      <td className="px-4 py-3">{a.name}</td>
                      <td className="px-4 py-3">{a.affiliation}</td>
                      <td className="px-4 py-3 text-center">{a.rank}</td>
                      <td className="px-4 py-3 text-center">{a.gender === 'female' ? '女' : '男'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApplicantTournamentDetailView;