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
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginStep, setLoginStep] = useState('password_setup');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const archersPerPage = 36;

  useEffect(() => {
    try {
      const storedPassword = localStorage.getItem('applicantPassword');
      if (storedPassword) {
        setLoginStep('password_login');
      } else {
        setLoginStep('password_setup');
      }
    } catch {}
  }, []);

  const handleSetupPassword = () => {
    if (!password || password.length < 4) {
      setLoginError('パスワードは4文字以上で設定してください');
      return;
    }
    if (password !== confirmPassword) {
      setLoginError('パスワードが一致しません');
      return;
    }
    try {
      localStorage.setItem('applicantPassword', password);
      setIsLoggedIn(true);
      setLoginError('');
    } catch {
      setLoginError('パスワードの保存に失敗しました');
    }
  };

  const handleLogin = () => {
    try {
      const storedPassword = localStorage.getItem('applicantPassword');
      if (loginPassword === storedPassword) {
        setIsLoggedIn(true);
        setLoginError('');
      } else {
        setLoginError('パスワードが違います');
      }
    } catch {
      setLoginError('ログインに失敗しました');
    }
  };

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

  const tplData = tournamentTemplate?.data || {};

  const appliedTournamentOptions = useMemo(() => {
    const templates = state?.registeredTournaments || [];
    return appliedTournamentIds
      .map(id => {
        const tpl = templates.find(t => t.id === id);
        const label = tpl?.data?.name ? `${tpl.data.name} (${id})` : id;
        return { id, label };
      });
  }, [appliedTournamentIds, state]);

  const rankOrder = [
    '無指定',
    '五級', '四級', '三級', '弐級', '壱級',
    '初段', '弐段', '参段', '四段', '五段',
    '錬士五段', '錬士六段', '教士七段', '教士八段', '範士八段', '範士九段'
  ];

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
        const divisions = tplData?.divisions || [
          { id: 'lower', label: '級位~三段以下の部', minRank: '無指定', maxRank: '参段' },
          { id: 'middle', label: '四・五段の部', minRank: '四段', maxRank: '五段' },
          { id: 'title', label: '称号者の部', minRank: '錬士五段', maxRank: '範士九段' }
        ];

        const getDivisionIdForArcher = (archer) => {
          const rIdx = getRankIndex(archer?.rank);
          for (const d of divisions) {
            const minIdx = d?.minRank ? getRankIndex(d.minRank) : 0;
            const maxIdx = d?.maxRank ? getRankIndex(d.maxRank) : rankOrder.length - 1;
            if (rIdx >= minIdx && rIdx <= maxIdx) return d.id;
          }
          return 'unassigned';
        };

        const divisionOrder = [...divisions]
          .sort((a, b) => {
            const ai = a?.minRank ? getRankIndex(a.minRank) : 0;
            const bi = b?.minRank ? getRankIndex(b.minRank) : 0;
            return ai - bi;
          })
          .map(d => d?.id)
          .filter(Boolean);

        const sorted = data
          .slice()
          .sort((a, b) => {
            if (enableGenderSeparation) {
              // 部門ごとに性別を交互に表示
              const adiv = getDivisionIdForArcher(a);
              const bdiv = getDivisionIdForArcher(b);
              const adi = divisionOrder.indexOf(adiv);
              const bdi = divisionOrder.indexOf(bdiv);
              if (adi !== bdi) {
                if (adi === -1) return 1;
                if (bdi === -1) return -1;
                return adi - bdi;
              }

              // 同じ部門内では性別で分ける
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
  }, [selectedTournamentId]);

  if (!isLoggedIn) {
    return (
      <div className="view-container">
        <div className="login-container">
          <div className="login-box">
            <h2 className="login-title">🔒 出場大会詳細</h2>
            {loginStep === 'password_setup' ? (
              <>
                <p className="hint">初回設定：パスワードを設定してください</p>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="パスワード（4文字以上）"
                  className="input"
                  onKeyPress={(e) => e.key === 'Enter' && handleSetupPassword()}
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="パスワード（再入力）"
                  className="input"
                  onKeyPress={(e) => e.key === 'Enter' && handleSetupPassword()}
                />
                {loginError && <p className="error-message">{loginError}</p>}
                <button onClick={handleSetupPassword} className="btn-primary">設定</button>
              </>
            ) : (
              <>
                <p className="hint">パスワードを入力してください</p>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="パスワード"
                  className="input"
                  onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                />
                {loginError && <p className="error-message">{loginError}</p>}
                <button onClick={handleLogin} className="btn-primary">ログイン</button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

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

  const totalPages = Math.max(1, Math.ceil(allApplicants.length / archersPerPage));
  const indexOfFirst = (currentPage - 1) * archersPerPage;
  const indexOfLast = indexOfFirst + archersPerPage;
  const currentApplicants = allApplicants.slice(indexOfFirst, indexOfLast);

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
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <label className="block text-sm font-medium text-gray-700 mb-2">出場大会を選択</label>
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

        <div className="card" style={{ marginBottom: '1.5rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>{tplData?.name || selectedTournamentId}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.25rem' }}>📅 日時</div>
              <div style={{ fontSize: '1rem', fontWeight: '500' }}>{tplData?.datetime || tplData?.date || '未設定'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.25rem' }}>📍 場所</div>
              <div style={{ fontSize: '1rem', fontWeight: '500' }}>{tplData?.location || '未設定'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.25rem' }}>👥 申込者数</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{allApplicants.length} 名</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 className="card-title">申込者一覧</h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={downloadProgramPdf} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span>📄</span> PDF
              </button>
              <button onClick={downloadProgramExcel} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span>📊</span> Excel
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3" style={{ marginBottom: '1rem' }}>
              <span className="text-red-700">⚠️ {error}</span>
            </div>
          )}

          <div className="table-responsive">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '60px' }}>#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">氏名</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">所属</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '100px' }}>段位</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '80px' }}>性別</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading && allApplicants.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">読み込み中...</td></tr>
                ) : allApplicants.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">申込者がいません</td></tr>
                ) : (
                  currentApplicants.map((a, idx) => (
                    <tr key={a.archerId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{a.standOrder}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{a.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{a.affiliation}</td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded-md font-medium">{a.rank}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span className={`inline-block px-2 py-1 rounded-md font-medium ${
                          a.gender === 'female' ? 'bg-pink-100 text-pink-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {a.gender === 'female' ? '女' : '男'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {allApplicants.length > archersPerPage && (
            <div className="flex items-center justify-between mt-4">
              <div>
                <p className="text-sm">{indexOfFirst + 1} 〜 {Math.min(indexOfLast, allApplicants.length)} / {allApplicants.length} 名</p>
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
      </div>
    </div>
  );
};

export default ApplicantTournamentDetailView;