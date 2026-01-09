import React, { useState, useReducer, useEffect, useRef, useCallback, useMemo } from 'react';
import { Lock, LogOut, RotateCcw, Copy, Check, QrCode, Maximize2, Filter, X, User, Camera, RefreshCw, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import QRCodeScanner from './components/QRCodeScanner';
import QualifiersView from './QualifiersView';
import './index.css';

// Ensure API URL is always absolute
const API_BASE_URL = 'https://alluring-perfection-production-f96d.up.railway.app/api';
const API_URL = API_BASE_URL.startsWith('http') 
  ? API_BASE_URL 
  : `${window.location.origin}${API_BASE_URL.startsWith('/') ? '' : '/'}${API_BASE_URL}`;

const getLocalDateKey = () => {
  // local date like 2026-01-09
  try {
    return new Date().toLocaleDateString('sv-SE');
  } catch {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
};

const distanceKm = (lat1, lng1, lat2, lng2) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const normalizeTournamentFormData = (data, defaultDivisions, attachments) => {
  const d = data || {};
  return {
    name: d.name ?? '',
    datetime: d.datetime ?? '',
    location: d.location ?? '',
    venueAddress: d.venueAddress ?? '',
    venueLat: d.venueLat ?? '',
    venueLng: d.venueLng ?? '',
    organizer: d.organizer ?? '',
    coOrganizer: d.coOrganizer ?? '',
    administrator: d.administrator ?? '',
    purpose: d.purpose ?? '',
    event: d.event ?? '',
    type: d.type ?? '',
    category: d.category ?? '',
    description: d.description ?? '',
    competitionMethod: d.competitionMethod ?? '',
    award: d.award ?? '',
    qualifications: d.qualifications ?? '',
    applicableRules: d.applicableRules ?? '',
    applicationMethod: d.applicationMethod ?? '',
    remarks: d.remarks ?? '',
    attachments: Array.isArray(attachments) ? attachments : [],
    divisions: Array.isArray(d.divisions) ? d.divisions : (Array.isArray(defaultDivisions) ? defaultDivisions : []),
  };
};

const getStoredAttachments = (tournamentId) => {
  if (!tournamentId) return [];
  try {
    const raw = localStorage.getItem(`tournamentAttachments:${tournamentId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const AwardsView = ({ state, dispatch, selectedTournamentId, setSelectedTournamentId }) => {
  const [archers, setArchers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const tournaments = state.registeredTournaments || [];
  const tournament = tournaments.find(t => t.id === selectedTournamentId) || null;

  const rankOrder = useMemo(() => (['五級', '四級', '三級', '弐級', '壱級', '初段', '弐段', '参段', '四段', '五段', '錬士五段', '錬士六段', '教士七段', '教士八段', '範士八段', '範士九段']), []);
  const normalizeRank = useCallback((rank) => {
    if (!rank) return '';
    return rank
      .replace('二段', '弐段')
      .replace('三段', '参段')
      .replace('二級', '弐級')
      .replace('一級', '壱級');
  }, []);


  // tournament selection is locked at admin login
  const rankIndex = useCallback((rank) => {
    const r = normalizeRank(rank);
    const idx = rankOrder.indexOf(r);
    return idx === -1 ? 9999 : idx;
  }, [normalizeRank, rankOrder]);

  const getDivisionIdForArcher = useCallback((archer, divisions) => {
    const rIdx = rankIndex(archer?.rank);
    for (const d of (divisions || [])) {
      const minIdx = d?.minRank ? rankIndex(d.minRank) : 0;
      const maxIdx = d?.maxRank ? rankIndex(d.maxRank) : 9999;
      if (rIdx >= minIdx && rIdx <= maxIdx) return d.id;
    }
    return 'unassigned';
  }, [rankIndex]);

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

  const calculateRanksWithTies = useCallback((items) => {
    const sorted = [...items].sort((a, b) => b.hitCount - a.hitCount);
    let currentRank = 1;
    let prevHitCount = null;
    return sorted.map((item, index) => {
      if (prevHitCount !== null && item.hitCount !== prevHitCount) currentRank = index + 1;
      prevHitCount = item.hitCount;
      return { ...item, rank: currentRank };
    });
  }, []);

  useEffect(() => {
    const fetchArchers = async () => {
      if (!selectedTournamentId) {
        setArchers([]);
        return;
      }
      setIsLoading(true);
      try {
        const response = await fetch(`${API_URL}/applicants/${selectedTournamentId}`);
        const result = await response.json();
        if (result.success) {
          const checkedIn = (result.data || []).filter(a => a.isCheckedIn);
          setArchers(checkedIn);
        } else {
          setArchers([]);
        }
      } catch (e) {
        console.error('AwardsView fetch error', e);
        setArchers([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchArchers();
  }, [selectedTournamentId]);

  const divisions = useMemo(() => {
    const ds = tournament?.data?.divisions;
    return Array.isArray(ds) ? ds : [];
  }, [tournament]);

  const awardRankLimit = tournament?.data?.awardRankLimit || 3;

  const divisionRankings = useMemo(() => {
    const groups = {};
    for (const d of divisions) groups[d.id] = { division: d, rows: [] };
    if (!groups.unassigned) groups.unassigned = { division: { id: 'unassigned', label: '未分類' }, rows: [] };

    for (const a of archers) {
      const divId = getDivisionIdForArcher(a, divisions);
      const hitCount = getTotalHitCountAllStands(a);
      if (!groups[divId]) groups[divId] = { division: { id: divId, label: divId }, rows: [] };
      groups[divId].rows.push({
        archer: a,
        hitCount,
      });
    }

    const result = [];
    for (const key of Object.keys(groups)) {
      const g = groups[key];
      const ranked = calculateRanksWithTies(g.rows.map(r => ({ ...r })));
      result.push({
        division: g.division,
        ranked,
      });
    }
    // keep the original division order first
    result.sort((a, b) => {
      const ai = divisions.findIndex(d => d.id === a.division.id);
      const bi = divisions.findIndex(d => d.id === b.division.id);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
    return result;
  }, [archers, divisions, getDivisionIdForArcher, getTotalHitCountAllStands, calculateRanksWithTies]);

  return (
    <div className="view-container">
      <div className="view-content">
        <p className="hint" style={{ marginBottom: '1rem' }}>表彰は {awardRankLimit}位まで（同率あり）</p>
        
        {!selectedTournamentId ? (
          <div className="card">大会を選択してください</div>
        ) : isLoading ? (
          <div className="card">読み込み中...</div>
        ) : (
          divisionRankings.map(block => (
            <div key={block.division.id} className="card" style={{ marginBottom: '1rem' }}>
              <div className="flex justify-between items-center">
                <h2 className="card-title">{block.division.label || block.division.id}</h2>
                <span className="text-sm text-gray-600">{block.ranked.length}名</span>
              </div>

              <div className="table-responsive">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">順位</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">氏名</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">所属</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">段位</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">的中</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">表彰</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {block.ranked.length === 0 ? (
                      <tr><td colSpan="6" className="px-4 py-4 text-center text-sm text-gray-500">該当者なし</td></tr>
                    ) : (
                      block.ranked.map((row, idx) => (
                        <tr key={`${row.archer?.archerId || idx}`}> 
                          <td className="px-4 py-3 text-sm font-medium">{row.rank}位</td>
                          <td className="px-4 py-3">{row.archer?.name || ''}</td>
                          <td className="px-4 py-3">{row.archer?.affiliation || ''}</td>
                          <td className="px-4 py-3 text-center">{row.archer?.rank || ''}</td>
                          <td className="px-4 py-3 text-center">{row.hitCount}</td>
                          <td className="px-4 py-3 text-center">{row.rank <= awardRankLimit ? '○' : ''}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const setStoredAttachments = (tournamentId, attachments) => {
  if (!tournamentId) return;
  try {
    localStorage.setItem(`tournamentAttachments:${tournamentId}`, JSON.stringify(Array.isArray(attachments) ? attachments : []));
  } catch (e) {
    console.error('Failed to store attachments', e);
  }
};

const KyudoTournamentSystem = () => {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPassword, setAdminPassword] = useState(null);
  const [selectedTournamentId, setSelectedTournamentId] = useState(() => {
    return localStorage.getItem('selectedTournamentId') || null;
  });
  const [adminLoginStep, setAdminLoginStep] = useState('password_setup');
  const [adminView, setAdminView] = useState('recording');
  const [mainView, setMainView] = useState('tournament');

  useEffect(() => {
    if (selectedTournamentId) {
      localStorage.setItem('selectedTournamentId', selectedTournamentId);
    } else {
      localStorage.removeItem('selectedTournamentId');
    }
  }, [selectedTournamentId]);
  const [tournamentState, dispatch] = useReducer(tournamentReducer, initialTournamentState);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTournaments();
  }, []);

  // selectedTournamentId が変わったら、登録済み大会テンプレートの設定を tournamentState.tournament に反映する
  useEffect(() => {
    if (!selectedTournamentId) return;
    const tpl = tournamentState.registeredTournaments.find(t => t.id === selectedTournamentId);
    if (tpl && tpl.data) {
      const allowedKeys = ['passRule', 'arrowsRound1', 'arrowsRound2', 'archersPerStand', 'name', 'date', 'id'];
      const payload = {};
      allowedKeys.forEach(k => { if (typeof tpl.data[k] !== 'undefined') payload[k] = tpl.data[k]; });
      if (Object.keys(payload).length > 0) {
        dispatch({ type: 'UPDATE_TOURNAMENT_INFO', payload });
      }
    }
  }, [selectedTournamentId, tournamentState.registeredTournaments]);

  const fetchTournaments = async () => {
    try {
      const response = await fetch(`${API_URL}/tournaments`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        dispatch({
          type: 'LOAD_TOURNAMENTS',
          payload: result.data
        });
      }
    } catch (error) {
      console.error('大会データの取得中にエラーが発生しました:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkInCount = tournamentState.archers.filter(a => a.checkIn).length;
  const dynamicStands = Math.max(1, Math.ceil(checkInCount / tournamentState.tournament.archersPerStand));

  return (
    <div className="app-container">
      {loading ? (
        <div className="login-container">
          <div className="login-box">
            <p className="hint">データを読み込み中...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="nav-tabs">
            <button onClick={() => setMainView('tournament')} className={`nav-tab ${mainView === 'tournament' ? 'nav-tab-active' : ''}`}>大会進行</button>
            <button onClick={() => setMainView('checkin')} className={`nav-tab ${mainView === 'checkin' ? 'nav-tab-active' : ''}`}>受付</button>
            <button onClick={() => setMainView('admin')} className={`nav-tab ${mainView === 'admin' ? 'nav-tab-active' : ''}`}><Lock size={14} />運営</button>
            <button onClick={() => setMainView('tournament-setup')} className={`nav-tab ${mainView === 'tournament-setup' ? 'nav-tab-active' : ''}`}>大会登録</button>
            <button onClick={() => setMainView('archer-signup')} className={`nav-tab ${mainView === 'archer-signup' ? 'nav-tab-active' : ''}`}>選手申し込み</button>
          </div>

          {mainView === 'tournament' && <TournamentView state={tournamentState} stands={dynamicStands} checkInCount={checkInCount} />}
          {mainView === 'checkin' && <CheckInView state={tournamentState} dispatch={dispatch} />}
          {mainView === 'admin' && !isAdminLoggedIn && <AdminLoginView adminPassword={adminPassword} setAdminPassword={setAdminPassword} adminLoginStep={adminLoginStep} setAdminLoginStep={setAdminLoginStep} selectedTournamentId={selectedTournamentId} setSelectedTournamentId={setSelectedTournamentId} state={tournamentState} onLogin={() => setIsAdminLoggedIn(true)} />}
          {mainView === 'admin' && isAdminLoggedIn && <AdminView state={tournamentState} dispatch={dispatch} adminView={adminView} setAdminView={setAdminView} stands={dynamicStands} selectedTournamentId={selectedTournamentId} setSelectedTournamentId={setSelectedTournamentId} onLogout={() => { 
            setIsAdminLoggedIn(false); 
            setAdminLoginStep('password_setup'); 
            setSelectedTournamentId(null); 
            try {
              localStorage.removeItem('adminSelectedTournamentDate');
              localStorage.removeItem('adminSelectedTournamentId');
              localStorage.removeItem('selectedTournamentId');
            } catch {}
          }} />}
          {mainView === 'tournament-setup' && <TournamentSetupView state={tournamentState} dispatch={dispatch} />}
          {mainView === 'archer-signup' && <ArcherSignupView state={tournamentState} dispatch={dispatch} />}
        </>
      )}
    </div>
  );
};

// Reducer State (Local fallback)
const initialTournamentState = {
  tournament: {
    id: 'KYUDO_2024_0001',
    name: '第◯回◯◯弓道大会',
    date: '2024年12月29日',
    stage: 'qualifiers',
    passRule: 'all_four',
    arrowsRound1: 2,
    arrowsRound2: 4,
    currentRound: 1,
    archersPerStand: 12,
  },
  registeredTournaments: [],
  applicants: [],
  archers: [], // Now managed via API mainly
};

function tournamentReducer(state, action) {
  switch (action.type) {
    case 'LOAD_TOURNAMENTS': {
      return { ...state, registeredTournaments: action.payload.map(t => ({ id: t.id, data: t.data })) };
    }
    case 'UPDATE_TOURNAMENT_INFO': return { ...state, tournament: { ...state.tournament, ...action.payload } };
    case 'SAVE_TOURNAMENT_TEMPLATE': {
      const updated = state.registeredTournaments.filter(t => t.id !== action.payload.id);
      return { ...state, registeredTournaments: [...updated, action.payload] };
    }
    case 'DELETE_TOURNAMENT_TEMPLATE': return { ...state, registeredTournaments: state.registeredTournaments.filter(t => t.id !== action.payload) };
    case 'RESET_ALL': return initialTournamentState;
    default: return state;
  }
}

const AdminLoginView = ({ adminPassword, setAdminPassword, adminLoginStep, setAdminLoginStep, selectedTournamentId, setSelectedTournamentId, state, onLogin }) => {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [geoStatus, setGeoStatus] = useState('');

  useEffect(() => {
    if (adminLoginStep !== 'tournament_id') return;
    try {
      const storedDate = localStorage.getItem('adminSelectedTournamentDate');
      const storedTournamentId = localStorage.getItem('adminSelectedTournamentId');
      const today = getLocalDateKey();
      if (storedDate === today && storedTournamentId) {
        setSelectedTournamentId(storedTournamentId);
        setInputValue('');
        setError('');
        onLogin();
      }
    } catch {
      // ignore
    }
  }, [adminLoginStep, onLogin, setSelectedTournamentId]);

  const autoSelectTournamentByGeolocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('❌ この端末は位置情報に対応していません');
      return;
    }
    setGeoStatus('📍 位置情報を取得中...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const candidates = (state.registeredTournaments || [])
            .map(t => {
              const tLat = Number(t?.data?.venueLat);
              const tLng = Number(t?.data?.venueLng);
              if (!Number.isFinite(tLat) || !Number.isFinite(tLng)) return null;
              return { t, dist: distanceKm(lat, lng, tLat, tLng) };
            })
            .filter(Boolean)
            .sort((a, b) => a.dist - b.dist);

          if (candidates.length === 0) {
            setGeoStatus('⚠️ 会場の緯度/経度が登録されている大会がありません');
            return;
          }

          const nearest = candidates[0];
          setInputValue(nearest.t.id);
          setError('');
          setGeoStatus(`✅ 近い大会を自動選択しました（約${nearest.dist.toFixed(1)}km）`);
        } catch (e) {
          console.error(e);
          setGeoStatus('❌ 位置情報から大会の自動選択に失敗しました');
        }
      },
      (err) => {
        const msg = err?.message ? `❌ 位置情報の取得に失敗しました: ${err.message}` : '❌ 位置情報の取得に失敗しました';
        setGeoStatus(msg);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
  };

  const handlePasswordSetup = () => {
    if (!inputValue || !confirmPassword) {
      setError('パスワードを入力してください');
      return;
    }
    if (inputValue !== confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }
    setAdminPassword(inputValue);
    setAdminLoginStep('password_login');
    setInputValue('');
    setConfirmPassword('');
    setError('');
  };

  const handlePasswordLogin = () => {
    if (inputValue !== adminPassword) {
      setError('パスワードが正しくありません');
      setInputValue('');
      return;
    }
    setAdminLoginStep('tournament_id');
    setInputValue('');
    setError('');
  };

  const handleTournamentIdInput = () => {
    const tournament = state.registeredTournaments.find(t => t.id === inputValue.trim());
    if (!tournament) {
      setError('大会IDが見つかりません');
      return;
    }
    setSelectedTournamentId(inputValue.trim());
    try {
      localStorage.setItem('adminSelectedTournamentDate', getLocalDateKey());
      localStorage.setItem('adminSelectedTournamentId', inputValue.trim());
    } catch {}
    setInputValue('');
    setError('');
    onLogin();
  };

  return (
    <div className="login-container">
      <div className="login-box">
        {adminLoginStep === 'password_setup' && (
          <>
            <div className="login-header">
              <Lock size={32} />
              <h1>運営者初期設定</h1>
            </div>
            <p className="hint">パスワードを設定してください</p>
            <input type="password" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="パスワード" className="input" />
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handlePasswordSetup()} placeholder="パスワード(確認)" className="input" />
            {error && <p className="error-text">{error}</p>}
            <button onClick={handlePasswordSetup} className="btn-primary">設定する</button>
          </>
        )}

        {adminLoginStep === 'password_login' && (
          <>
            <div className="login-header">
              <Lock size={32} />
              <h1>運営ログイン</h1>
            </div>
            <input type="password" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handlePasswordLogin()} placeholder="パスワード" className="input" />
            {error && <p className="error-text">{error}</p>}
            <button onClick={handlePasswordLogin} className="btn-primary">ログイン</button>
          </>
        )}

        {adminLoginStep === 'tournament_id' && (
          <>
            <div className="login-header">
              <Lock size={32} />
              <h1>大会を選択</h1>
            </div>
            <p className="hint">本日の大会IDを入力してください</p>
            <button onClick={autoSelectTournamentByGeolocation} className="btn-secondary" style={{ width: '100%', marginBottom: '0.5rem' }}>
              📍 現在地から大会を自動選択
            </button>
            {geoStatus && <p className="text-sm text-gray-600" style={{ marginBottom: '0.5rem' }}>{geoStatus}</p>}
            <select value={inputValue} onChange={(e) => setInputValue(e.target.value)} className="input">
              <option value="">-- 大会を選択 --</option>
              {state.registeredTournaments.map(t => (
                <option key={t.id} value={t.id}>{t.data.name} ({t.id})</option>
              ))}
            </select>
            {error && <p className="error-text">{error}</p>}
            <button onClick={handleTournamentIdInput} className="btn-primary">進む</button>
          </>
        )}
      </div>
    </div>
  );
};

const getRankCategory = (rankStr) => {
  if (!rankStr) return { ceremony: '', rank: '' };
  
  const ceremonyRanks = ['錬士', '教士', '範士'];
  let ceremony = '';
  let rank = rankStr;

  for (const c of ceremonyRanks) {
    if (rankStr.includes(c)) {
      ceremony = c;
      rank = rankStr.replace(c, '');
      break;
    }
  }
  return { ceremony, rank };
};

const TournamentView = ({ state, stands, checkInCount }) => {
  const [view, setView] = useState('standings'); // 'standings' or 'qualifiers'
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

  const rankOrder = ['五級', '四級', '三級', '弐級', '壱級', '初段', '弐段', '参段', '四段', '五段', '錬士五段', '錬士六段', '教士七段', '教士八段', '範士八段', '範士九段'];

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
      html += `<table><thead><tr><th>#</th><th>氏名</th><th>所属</th><th>段位</th><th>1立ち目</th><th>2立ち目</th></tr></thead><tbody>`;

      const start = p * perPage;
      const end = Math.min(start + perPage, archers.length);
      for (let i = start; i < end; i++) {
        const a = archers[i];
        html += `<tr><td style="width:60px">${a.standOrder || i+1}</td><td>${a.name || ''}</td><td>${a.affiliation || ''}</td><td>${a.rank || ''}</td>`;
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
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">1立ち目</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">2立ち目</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {isLoading && archers.length === 0 ? (
                        <tr><td colSpan="6" className="px-4 py-4 text-center">読み込み中...</td></tr>
                      ) : archers.length === 0 ? (
                        <tr><td colSpan="6" className="px-4 py-4 text-center">選手が登録されていません</td></tr>
                      ) : (
                        currentArchersProgram.map(a => (
                          <tr key={a.archerId}>
                            <td className="px-4 py-3 text-sm font-medium">{a.standOrder}</td>
                            <td className="px-4 py-3">{a.name}</td>
                            <td className="px-4 py-3">{a.affiliation}</td>
                            <td className="px-4 py-3 text-center">{a.rank}</td>
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
                      <p className="text-sm">{indexOfFirstProgram + 1} 〜 {Math.min(indexOfLastProgram, archers.length)} / {archers.length} 名</p>
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
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">1立ち目</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">2立ち目</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">結果</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {isLoading && archers.length === 0 ? (
                          <tr>
                            <td colSpan="7" className="px-4 py-4 text-center text-sm text-gray-500">
                              読み込み中...
                            </td>
                          </tr>
                        ) : archers.length === 0 ? (
                          <tr>
                            <td colSpan="7" className="px-4 py-4 text-center text-sm text-gray-500">
                              受付済みの選手がいません
                            </td>
                          </tr>
                        ) : (
                          currentArchers.map((archer) => {
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
                                        {result === 'o' ? '◯' : result === 'x' ? '×' : '—'}
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
                                        {result === 'o' ? '◯' : result === 'x' ? '×' : '—'}
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
                                      —
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
                          })
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
                        <span className="font-medium">{indexOfFirstArcher + 1}</span> 〜 <span className="font-medium">
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

const RecordingView = ({ state, dispatch, stands }) => {
  const [selectedTournamentId, setSelectedTournamentId] = useState(() => localStorage.getItem('selectedTournamentId') || '');
  const [selectedDivision, setSelectedDivision] = useState(() => localStorage.getItem('recording_selectedDivision') || '');
  const [selectedStand, setSelectedStand] = useState(() => parseInt(localStorage.getItem('recording_selectedStand')) || 1);
  const [selectedRound, setSelectedRound] = useState(() => parseInt(localStorage.getItem('recording_selectedRound')) || 1); // 1: 1立ち目, 2: 2立ち目
  const [archers, setArchers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (selectedTournamentId) localStorage.setItem('selectedTournamentId', selectedTournamentId);
    else localStorage.removeItem('selectedTournamentId');
  }, [selectedTournamentId]);

  useEffect(() => { localStorage.setItem('recording_selectedDivision', selectedDivision || ''); }, [selectedDivision]);
  useEffect(() => { localStorage.setItem('recording_selectedStand', selectedStand); }, [selectedStand]);
  useEffect(() => { localStorage.setItem('recording_selectedRound', selectedRound); }, [selectedRound]);

  const tournament = state.tournament;
  const rankOrder = ['五級', '四級', '三級', '弐級', '壱級', '初段', '弐段', '参段', '四段', '五段', '錬士五段', '錬士六段', '教士七段', '教士八段', '範士八段', '範士九段'];
  
  const getCurrentArrowsPerStand = () => {
    return selectedRound === 1 ? tournament.arrowsRound1 : tournament.arrowsRound2;
  };
  
  const getCurrentStandResults = (archer) => {
    const standKey = `stand${selectedStand}`;
    const currentArrows = getCurrentArrowsPerStand();
    
    const arrowsNeeded = selectedRound === 1 ? tournament.arrowsRound1 : tournament.arrowsRound2;
    const existing = (archer.results && archer.results[standKey]) 
      ? [...archer.results[standKey]] 
      : [];
    
    const startIndex = selectedRound === 1 ? 0 : tournament.arrowsRound1;
    const roundResults = [];
    for (let i = 0; i < arrowsNeeded; i++) {
      roundResults.push(i + startIndex < existing.length ? existing[i + startIndex] : null);
    }
    
    return roundResults;
  };

  const isRoundComplete = (archer) => {
    const results = getCurrentStandResults(archer);
    return results.every(result => result !== null);
  };

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

  const getDivision = (rank) => {
    const { ceremony } = getRankCategory(rank);
    if (ceremony) return 'title';
    const levelIndex = rankOrder.indexOf(rank);
    if (levelIndex <= rankOrder.indexOf('参段')) return 'lower';
    if (levelIndex <= rankOrder.indexOf('五段')) return 'middle';
    return 'lower';
  };

  const selectedTournament = state.registeredTournaments.find(t => t.id === selectedTournamentId);
  const localDefaultDivisions = [
    { id: 'lower', label: '級位~三段以下の部' },
    { id: 'middle', label: '四・五段の部' },
    { id: 'title', label: '称号者の部' }
  ];
  const divisions = (selectedTournament && selectedTournament.data && selectedTournament.data.divisions) ? selectedTournament.data.divisions : localDefaultDivisions;

  const fetchAndSortArchers = async (background = false) => {
    if (!selectedTournamentId) return;

    if (!background) setIsLoading(true);
    else setIsSyncing(true);

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

          const aDate = a.rankAcquiredDate ? new Date(a.rankAcquiredDate) : new Date(0);
          const bDate = b.rankAcquiredDate ? new Date(b.rankAcquiredDate) : new Date(0);
          return aDate.getTime() - bDate.getTime();
        });

        // 立ち順番号を付与
        const totalNeeded = tournament.arrowsRound1 + tournament.arrowsRound2;
        const defaultResults = {};
        for (let i = 1; i <= 6; i++) defaultResults[`stand${i}`] = Array(totalNeeded).fill(null);

        const archersWithOrder = sortedArchers.map((archer, index) => ({
          ...archer,
          standOrder: index + 1,
          division: archer.division || getDivision(archer.rank),
          results: Object.assign({}, defaultResults, archer.results || {})
        }));

        setArchers(archersWithOrder);
        
        if (!selectedDivision && archersWithOrder.length > 0) {
          setSelectedDivision(archersWithOrder[0].division);
        }
      }
    } catch (error) {
      console.error('選手データの取得に失敗しました:', error);
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (selectedTournamentId) {
      fetchAndSortArchers();
    }
  }, [selectedTournamentId]);

  // リアルタイム同期(3秒ごとに他の端末の入力を反映)
  useEffect(() => {
    if (!selectedTournamentId) return;
    const interval = setInterval(() => {
      fetchAndSortArchers(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedTournamentId]);

  const filteredTournaments = state.registeredTournaments;
  const divisionArchers = archers.filter(a => a.division === selectedDivision);

  const getArchersForStand = (standNumber) => {
    const archersPerStand = tournament.archersPerStand;
    const startIdx = (standNumber - 1) * archersPerStand;
    return divisionArchers.slice(startIdx, startIdx + archersPerStand);
  };

  const standArchers = getArchersForStand(selectedStand);

  // API経由で記録を保存
  const saveResultToApi = async (archerId, standNum, arrowIndex, result) => {
    try {
      await fetch(`${API_URL}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: selectedTournamentId,
          archerId,
          stand: standNum,
          arrowIndex: arrowIndex,
          result,
          round: selectedRound // ラウンド情報を追加
        })
      });
      // 更新後にデータを再取得(同期)
      fetchAndSortArchers(true);
    } catch (error) {
      console.error('記録保存エラー:', error);
      alert('ネットワークエラーにより保存できませんでした');
    }
  };

  const handleRecord = (archerId, standNum, arrowIndex, result) => {
    // 楽観的UI更新(即時反映)
    const archer = archers.find(a => a.archerId === archerId);
    if (!archer) return;

    const standKey = `stand${standNum}`;
    const currentArrows = getCurrentArrowsPerStand();
    
    // 現在のラウンドの結果のみを扱う
    const existing = (archer.results && archer.results[standKey]) 
      ? [...archer.results[standKey]] 
      : [];
      
    // 現在のラウンドの結果を更新
    const roundResults = [];
    for (let i = 0; i < currentArrows; i++) {
      if (i === arrowIndex) {
        roundResults.push(result);
      } else if (i < existing.length) {
        roundResults.push(existing[i]);
      } else {
        roundResults.push(null);
      }
    }

    // ラウンド1と2の結果を結合
    let finalResults = [];
    if (selectedRound === 1) {
      const round2Results = (archer.results?.[standKey]?.slice(tournament.arrowsRound1) || []);
      finalResults = [...roundResults, ...round2Results];
    } else {
      const round1Results = (archer.results?.[standKey]?.slice(0, tournament.arrowsRound1) || Array(tournament.arrowsRound1).fill(null));
      finalResults = [...round1Results, ...roundResults];
    }

    const updatedArchers = archers.map(a => 
      a.archerId === archerId 
        ? { ...a, results: { ...a.results, [standKey]: finalResults } } 
        : a
    );
    
    setArchers(updatedArchers);

    // APIへ送信
    const adjustedArrowIndex = selectedRound === 2 
      ? tournament.arrowsRound1 + arrowIndex 
      : arrowIndex;
    saveResultToApi(archerId, standNum, adjustedArrowIndex, result);
  };

  const handleUndo = (archerId, standNum, arrowIndex) => {
    // 楽観的UI更新
    const archer = archers.find(a => a.archerId === archerId);
    if (!archer) return;

    const standKey = `stand${standNum}`;
    const currentArrows = getCurrentArrowsPerStand();
    
    // 現在のラウンドの結果を取得
    const existing = (archer.results && archer.results[standKey]) 
      ? [...archer.results[standKey]] 
      : [];
    
    // 現在のラウンドの結果を更新
    const roundResults = [];
    for (let i = 0; i < currentArrows; i++) {
      if (i === arrowIndex) {
        roundResults.push(null);
      } else if (i < existing.length) {
        roundResults.push(existing[i]);
      } else {
        roundResults.push(null);
      }
    }

    // ラウンド1と2の結果を結合
    let finalResults = [];
    if (selectedRound === 1) {
      const round2Results = (archer.results?.[standKey]?.slice(tournament.arrowsRound1) || []);
      finalResults = [...roundResults, ...round2Results];
    } else {
      const round1Results = (archer.results?.[standKey]?.slice(0, tournament.arrowsRound1) || Array(tournament.arrowsRound1).fill(null));
      finalResults = [...round1Results, ...roundResults];
    }

    const updatedArchers = archers.map(a => 
      a.archerId === archerId 
        ? { ...a, results: { ...a.results, [standKey]: finalResults } } 
        : a
    );
    
    setArchers(updatedArchers);

    // APIへ送信 (nullを送る)
    const adjustedArrowIndex = selectedRound === 2 
      ? tournament.arrowsRound1 + arrowIndex 
      : arrowIndex;
    saveResultToApi(archerId, standNum, adjustedArrowIndex, null);
  };

  const getHitCount = (archer, standNum, roundNum = null) => {
    const results = archer.results?.[`stand${standNum}`] || [];
    const start = roundNum === 2 ? tournament.arrowsRound1 : 0;
    const length = roundNum === 2 ? tournament.arrowsRound2 : tournament.arrowsRound1;
    return (results.slice(start, start + length) || []).filter(r => r === 'o').length;
  };
  
  const getCurrentRoundHitCount = (archer) => {
    const results = getCurrentStandResults(archer);
    return results.filter(r => r === 'o').length;
  };
  
  const getTotalHitCount = (archer) => {
    const stand1Hits = getHitCount(archer, selectedStand, 1);
    const stand2Hits = getHitCount(archer, selectedStand, 2);
    return stand1Hits + stand2Hits;
  };

  const calculateRanks = () => {
    const hitCounts = divisionArchers.map(archer => ({
      archerId: archer.archerId,
      hitCount: getHitCount(archer, selectedStand, 1) + getHitCount(archer, selectedStand, 2)
    }));
    const sorted = hitCounts.sort((a, b) => b.hitCount - a.hitCount);
    const ranks = {};
    let currentRank = 1;
    let prevHitCount = null;
    sorted.forEach((item, index) => {
      if (prevHitCount !== null && item.hitCount !== prevHitCount) {
        currentRank = index + 1;
      }
      ranks[item.archerId] = currentRank;
      prevHitCount = item.hitCount;
    });
    return ranks;
  };

  const ranks = calculateRanks();

  return (
    <div className="view-container">
      <div className="view-header">
        <div style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>
          <h1>記録入力</h1>
          {isSyncing && <RefreshCw size={16} className="animate-spin text-blue-500" />}
        </div>
        <p>部門ごとに立ち順を管理 (自動保存)</p>
      </div>
      <div className="view-content">
        
        {selectedTournamentId && (
          <>
            <div className="card">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>部門を選択</label>
              <div className="button-group">
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
              <p className="hint" style={{ marginTop: '0.5rem' }}>この部門の選手数: {divisionArchers.length}人</p>
            </div>

            <div className="card">
              <div className="round-selector">
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>ラウンド選択</label>
                <div className="button-group" style={{ marginBottom: '1rem' }}>
                  <button 
                    onClick={() => setSelectedRound(1)}
                    className={`btn ${selectedRound === 1 ? 'btn-active' : ''}`}
                    style={{ flex: 1 }}
                  >
                    1立ち目 ({tournament.arrowsRound1}本)
                  </button>
                  <button 
                    onClick={() => setSelectedRound(2)}
                    className={`btn ${selectedRound === 2 ? 'btn-active' : ''}`}
                    style={{ flex: 1 }}
                  >
                    2立ち目 ({tournament.arrowsRound2}本)
                  </button>
                </div>
                <div style={{ fontSize: '0.875rem', color: '#4b5563', textAlign: 'center' }}>
                  <p>現在のラウンド: {selectedRound}立ち目 ({getCurrentArrowsPerStand()}本)</p>
                </div>
              </div>
            </div>

            <div className="archer-records">
              {standArchers.length === 0 ? (
                <p className="empty-text">この立に割り当てられた選手がいません</p>
              ) : (
                standArchers.map(archer => {
                  const currentArrows = getCurrentArrowsPerStand();
                  const { ceremony, rank } = getRankCategory(archer.rank);
                  const archerRank = ranks[archer.archerId];
                  const roundComplete = isRoundComplete(archer);

                  return (
                    <div key={archer.archerId} className="archer-record">
                      <div className="archer-info">
                        <p><strong>{archer.standOrder}. {archer.name}</strong></p>
                        <p className="text-sm">{archer.affiliation} | {ceremony}{rank}</p>
                        <p className="text-sm" style={{ color: '#2563eb', fontWeight: 500, marginTop: '0.25rem' }}>
                          的中: {getTotalHitCount(archer)}本 / 順位: {archerRank}位
                        </p>
                      </div>
                      <span className={`status ${roundComplete ? 'status-complete' : 'status-input'}`}>
                        {roundComplete ? '完了' : '入力中'}
                      </span>
                      <div className="arrows-grid" style={{ gridTemplateColumns: `repeat(${currentArrows}, 1fr)` }}>
                        {getCurrentStandResults(archer).map((result, arrowIdx) => (
                          <div key={arrowIdx} className="arrow-input">
                            <p>{arrowIdx + 1}</p>
                            {result === null ? (
                              <div className="arrow-buttons">
                                <button onClick={() => handleRecord(archer.archerId, selectedStand, arrowIdx, 'o')} className="btn-circle btn-hit" disabled={roundComplete}>◯</button>
                                <button onClick={() => handleRecord(archer.archerId, selectedStand, arrowIdx, 'x')} className="btn-circle btn-miss" disabled={roundComplete}>×</button>
                              </div>
                            ) : (
                              <div className="arrow-result">
                                <button disabled className={`btn-circle ${result === 'o' ? 'btn-hit' : 'btn-miss'}`}>{result === 'o' ? '◯' : '×'}</button>
                                <button onClick={() => handleUndo(archer.archerId, selectedStand, arrowIdx)} className="btn-fix">修正</button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const CheckInView = ({ state, dispatch }) => {
  const [scannedQR, setScannedQR] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [checkIns, setCheckIns] = useState([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState(() => localStorage.getItem('selectedTournamentId') || '');
  const [showQRModal, setShowQRModal] = useState(false);

  useEffect(() => {
    if (selectedTournamentId) {
      localStorage.setItem('selectedTournamentId', selectedTournamentId);
    } else {
      localStorage.removeItem('selectedTournamentId');
    }
  }, [selectedTournamentId]);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [locationFilter, setLocationFilter] = useState('');
  const [geoStatus, setGeoStatus] = useState('');
  const [currentQRCodeData, setCurrentQRCodeData] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const checkinListRef = React.useRef(null);
  
  const filteredTournaments = state.registeredTournaments.filter(tournament => {
    if (locationFilter === '') return true;
    const q = locationFilter.toLowerCase();
    const loc = (tournament.data.location || '').toLowerCase();
    const addr = (tournament.data.venueAddress || '').toLowerCase();
    return loc.includes(q) || addr.includes(q);
  });

  const autoSelectTournamentByGeolocation = async () => {
    if (!navigator.geolocation) {
      setGeoStatus('❌ この端末は位置情報に対応していません');
      return;
    }
    setGeoStatus('📍 位置情報を取得中...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const candidates = (state.registeredTournaments || [])
            .map(t => {
              const tLat = Number(t?.data?.venueLat);
              const tLng = Number(t?.data?.venueLng);
              if (!Number.isFinite(tLat) || !Number.isFinite(tLng)) return null;
              return { t, dist: distanceKm(lat, lng, tLat, tLng) };
            })
            .filter(Boolean)
            .sort((a, b) => a.dist - b.dist);

          if (candidates.length === 0) {
            setGeoStatus('⚠️ 会場の緯度/経度が登録されている大会がありません');
            return;
          }

          const nearest = candidates[0];
          setSelectedTournamentId(nearest.t.id);
          setGeoStatus(`✅ 近い大会を自動選択しました（約${nearest.dist.toFixed(1)}km）`);
        } catch (e) {
          console.error(e);
          setGeoStatus('❌ 位置情報から大会の自動選択に失敗しました');
        }
      },
      (err) => {
        const msg = err?.message ? `❌ 位置情報の取得に失敗しました: ${err.message}` : '❌ 位置情報の取得に失敗しました';
        setGeoStatus(msg);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
  };
  
  const [currentUser, setCurrentUser] = useState(null);
  const [myApplicantData, setMyApplicantData] = useState(null);
  const [showManualInput, setShowManualInput] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('kyudo_tournament_user');
    const savedDeviceId = localStorage.getItem('kyudo_tournament_device_id');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  const fetchTournamentData = async () => {
    if (!selectedTournamentId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/applicants/${selectedTournamentId}`);
      const result = await response.json();
      
      if (result.success) {
        const checkedIn = result.data.filter(a => a.isCheckedIn);
        setCheckIns(checkedIn);
        
        const savedDeviceId = localStorage.getItem('kyudo_tournament_device_id');
        
        if (savedDeviceId) {
          const myRegistrations = result.data.filter(a => 
            a.deviceId === savedDeviceId
          );
          
          if (myRegistrations.length > 0) {
            setMyApplicantData(myRegistrations[0]);
            setShowManualInput(false);
            if (myRegistrations.length > 1) {
              setMyApplicantData(myRegistrations);
            }
          } else {
            setMyApplicantData(null);
            setShowManualInput(true);
          }
        } else {
          setMyApplicantData(null);
          setShowManualInput(true);
        }
      }
    } catch (error) {
      console.error('データの取得に失敗しました:', error);
      setMessage('❌ データの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!autoRefresh || !selectedTournamentId) return;
    const interval = setInterval(() => {
      fetchTournamentData();
    }, 2000); 
    return () => clearInterval(interval);
  }, [autoRefresh, selectedTournamentId]);

  useEffect(() => {
    if (selectedTournamentId) {
      setAutoRefresh(false); 
      fetchTournamentData();
    } else {
      setCheckIns([]);
      setMyApplicantData(null);
      setAutoRefresh(false);
    }
  }, [selectedTournamentId]);

  const showQRCodeFromMultiple = (applicant) => {
    setShowQRModal(true);
    setAutoRefresh(true); 
    const tournament = state.registeredTournaments.find(t => t.id === selectedTournamentId);
    setCurrentQRCodeData({
      id: applicant.archerId,
      name: applicant.name,
      type: applicant.isStaff && applicant.isOfficialOnly ? '役員' : '選手',
      tournamentName: tournament?.data?.name || '不明な大会',
      affiliation: applicant.affiliation,
      rank: applicant.rank,
      registrationDate: applicant.appliedAt
    });
  };

  const showMyQRCode = () => {
    if (!myApplicantData) return;
    if (Array.isArray(myApplicantData)) {
      return;
    }
    setAutoRefresh(true);
    const tournament = state.registeredTournaments.find(t => t.id === selectedTournamentId);
    setCurrentQRCodeData({
      id: myApplicantData.archerId,
      name: myApplicantData.name,
      type: myApplicantData.isStaff && myApplicantData.isOfficialOnly ? '役員' : '選手',
      tournamentName: tournament?.data?.name || '不明な大会',
      affiliation: myApplicantData.affiliation,
      rank: myApplicantData.rank,
      registrationDate: myApplicantData.appliedAt
    });
    setShowQRModal(true);
  };

  const showListQRCode = (archer) => {
    setAutoRefresh(true);
    const tournament = state.registeredTournaments.find(t => t.id === selectedTournamentId);
    setCurrentQRCodeData({
      id: archer.archerId,
      name: archer.name,
      type: archer.isStaff && archer.isOfficialOnly ? '役員' : '選手',
      tournamentName: tournament?.data?.name || '',
      affiliation: archer.affiliation,
      rank: archer.rank,
      registrationDate: archer.appliedAt,
      isCheckedIn: archer.isCheckedIn
    });
    setShowQRModal(true);
  };

  const showScreenshotQRCode = (archer) => {
    setAutoRefresh(true);
    const tournament = state.registeredTournaments.find(t => t.id === selectedTournamentId);
    setCurrentQRCodeData({
      id: archer.archerId,
      name: archer.name,
      type: archer.isStaff && archer.isOfficialOnly ? '役員' : '選手',
      tournamentName: tournament?.data?.name || '',
      affiliation: archer.affiliation,
      rank: archer.rank,
      registrationDate: archer.appliedAt,
      isCheckedIn: true,
      isScreenshot: true
    });
    setShowQRModal(true);
  };

  const handleQRCodeScanned = (qrCode) => {
    try {
      let archerId = qrCode.trim();
      try {
        const qrData = JSON.parse(qrCode);
        if (qrData.id) {
          archerId = qrData.id;
        }
      } catch (parseError) {}
      
      setScannedQR(archerId);
      setShowQRScanner(false);
      
      setTimeout(() => {
        handleCheckIn(archerId);
      }, 100);
    } catch (error) {
      setMessage('❌ QRコードの読み込みに失敗しました');
    }
  };

  const openQRScanner = () => {
    if (!selectedTournamentId) {
      setMessage('❌ 大会を選択してください');
      return;
    }
    setShowQRScanner(true);
  };

  const handleCheckIn = async (scannedArcherId = null) => {
    if (!selectedTournamentId) {
      setMessage('❌ 大会を選択してください');
      return;
    }

    const archerId = (scannedArcherId || scannedQR).trim();
    if (!archerId) {
      setMessage('❌ 選手IDを入力するか、QRコードをスキャンしてください');
      return;
    }

    setIsLoading(true);
    setMessage('処理中...');

    try {
      const response = await fetch(`${API_URL}/applicants/${selectedTournamentId}`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error('選手情報の取得に失敗しました');
      }

      const applicant = result.data.find(a => a.archerId === archerId);
      if (!applicant) {
        setMessage('❌ 該当する選手が見つかりません');
        return;
      }

      const checkInResponse = await fetch(`${API_URL}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: selectedTournamentId, archerId: archerId })
      });

      const checkInResult = await checkInResponse.json();
      
      if (checkInResult.success) {
        const successMessage = checkInResult.data.isCheckedIn 
          ? `✅ ${checkInResult.data.name}さんは既に受付済みです`
          : `✅ ${checkInResult.data.name}さんの受付が完了しました`;
        
        setMessage(successMessage);
        setScannedQR('');
        setAutoRefresh(true);
        await fetchTournamentData();
        
        setTimeout(() => {
          if (checkinListRef.current) {
            checkinListRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 300);
      } else {
        setMessage(`❌ ${checkInResult.message || '受付に失敗しました'}`);
      }
    } catch (error) {
      setMessage(`❌ エラーが発生しました: ${error.message}`);
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const selectedTournament = state.registeredTournaments.find(t => t.id === selectedTournamentId);
  
  const formatTournamentDate = (tournament) => {
    if (!tournament?.data) return '日時未設定';
    const { datetime } = tournament.data;
    if (!datetime) return '日時未設定';
    try {
      const date = new Date(datetime);
      if (isNaN(date.getTime())) return datetime;
      const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
      const weekday = weekdays[date.getDay()];
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}年${month}月${day}日(${weekday}) ${hours}:${minutes}`;
    } catch (error) {
      return datetime;
    }
  };
  
  return (
    <div className="view-container">
      <div className="view-header">
        <h1>受付</h1>
        {selectedTournament ? (
          <div className="tournament-info">
            <p>• {selectedTournament.data?.name || '大会名不明'}</p>
            <p>• {formatTournamentDate(selectedTournament)}</p>
            {myApplicantData && (
              <p>• {Array.isArray(myApplicantData) ? '複数登録あり' : 
                `${myApplicantData.isStaff ? '役員' : '選手'}ID: ${myApplicantData.archerId}`}</p>
            )}
          </div>
        ) : (
          <div className="tournament-info">
            <p>• 大会を選択してください</p>
          </div>
        )}
      </div>
      <div className="view-content">
        <div className="card">
          <label>大会を選択 *</label>
          <div className="mb-2">
            <input 
              type="text" 
              value={locationFilter} 
              onChange={(e) => setLocationFilter(e.target.value)} 
              placeholder="開催地/住所でフィルター" 
              className="input w-full mb-2"
            />
            <button onClick={autoSelectTournamentByGeolocation} className="btn-secondary" style={{ width: '100%', marginBottom: '0.5rem' }}>
              📍 現在地から大会を自動選択
            </button>
            {geoStatus && (
              <p className="text-sm text-gray-600" style={{ marginBottom: '0.5rem' }}>{geoStatus}</p>
            )}
            <select 
              value={selectedTournamentId} 
              onChange={(e) => setSelectedTournamentId(e.target.value)}
              className="input w-full"
            >
              <option value="">-- 大会を選択してください --</option>
              {filteredTournaments.length === 0 ? (
                <option disabled>該当する大会が見つかりません</option>
              ) : (
                filteredTournaments.map(tournament => (
                  <option key={tournament.id} value={tournament.id}>
                    {tournament.data.name} ({tournament.data.location}{tournament.data.venueAddress ? ` / ${tournament.data.venueAddress}` : ''})
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {selectedTournamentId && (
          <>
            <div className="checkin-counter">
              <p className="counter-value">{checkIns.length}</p>
              <p className="counter-label">受付済み</p>
            </div>

            <div className="card">
              {myApplicantData ? (
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  {Array.isArray(myApplicantData) ? (
                    <>
                      <p className="text-sm text-gray-500" style={{ marginBottom: '1rem' }}>複数の登録が見つかりました</p>
                      <div className="archer-list" style={{ marginBottom: '1rem', maxHeight: '200px', overflowY: 'auto' }}>
                        {myApplicantData.map((applicant) => (
                          <div key={applicant.archerId} className="archer-list-item" style={{ marginBottom: '0.5rem', padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <p style={{ fontWeight: '500', margin: 0 }}>{applicant.name} 様</p>
                                <p style={{ fontSize: '0.875rem', color: '#4b5563', margin: '0.25rem 0 0 0' }}>
                                  {applicant.affiliation} | {applicant.rank}
                                </p>
                              </div>
                              <button 
                                onClick={() => showQRCodeFromMultiple(applicant)}
                                className="btn-secondary"
                                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                              >
                                <QrCode size={16} style={{ marginRight: '0.25rem' }} />
                                表示
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-gray-500" style={{ marginBottom: '0.5rem' }}>ログイン中: {myApplicantData.name} 様</p>
                      <button 
                        onClick={showMyQRCode}
                        className="btn-primary"
                        style={{ 
                          marginTop: 0, 
                          padding: '1.5rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.125rem'
                        }}
                      >
                        <QrCode size={24} style={{ marginRight: '0.5rem' }} />
                        🎫 自分のQRコードを表示
                      </button>
                    </>
                  )}
                  
                  {!showManualInput ? (
                    <button 
                      onClick={() => setShowManualInput(true)}
                      style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline', marginTop: '0.5rem' }}
                    >
                      📝 ID手動入力・スキャン(係員用)
                    </button>
                  ) : (
                    <button 
                      onClick={() => setShowManualInput(false)}
                      style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.875rem', marginTop: '0.5rem' }}
                    >
                      ▲ 入力欄を隠す
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ marginBottom: '0.5rem' }}>
                  <p className="text-sm text-gray-500" style={{ marginBottom: '0.5rem' }}>
                    {currentUser ? '※この大会へのエントリーが見つかりません' : '※選手としてログインしていません'}
                  </p>
                </div>
              )}

              {(showManualInput || !myApplicantData) && (
                <div style={{ marginTop: myApplicantData ? '1rem' : '0', paddingTop: myApplicantData ? '1rem' : '0', borderTop: myApplicantData ? '1px solid #e5e7eb' : 'none' }}>
                  <label>選手IDを入力 (係員用)</label>
                  <input 
                    type="text" 
                    value={scannedQR} 
                    onChange={(e) => setScannedQR(e.target.value)} 
                    onKeyPress={(e) => e.key === 'Enter' && handleCheckIn()} 
                    placeholder="選手IDを入力してEnter" 
                    className="input" 
                    disabled={isLoading}
                  />
                  <div className="space-y-2" style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div className="flex space-x-2" style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        onClick={() => handleCheckIn()} 
                        className="btn-secondary"
                        style={{ flex: 1 }}
                        disabled={isLoading || !scannedQR.trim()}
                      >
                        {isLoading ? '処理中...' : 'IDで受付実行'}
                      </button>
                    </div>
                    
                    <button
                      onClick={openQRScanner}
                      className="btn-secondary"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}
                    >
                      <Camera size={18} style={{ marginRight: '0.5rem' }} />
                      QRコードをスキャン
                    </button>
                  </div>
                </div>
              )}

              {message && (
                <div className={`message ${message.startsWith('✅') ? 'message-success' : message.startsWith('❌') ? 'message-error' : 'message-warning'}`} style={{ marginTop: '1rem' }}>
                  {message}
                </div>
              )}

              {showQRScanner && (
                <QRCodeScanner
                  onScanSuccess={handleQRCodeScanned}
                  onError={(msg) => setMessage('❌ ' + msg)}
                  onClose={() => setShowQRScanner(false)}
                />
              )}
            </div>

            <div className="card" ref={checkinListRef}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <p className="card-title">受付済み一覧</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {autoRefresh && (
                    <div style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ display: 'inline-block', width: '0.5rem', height: '0.5rem', backgroundColor: '#10b981', borderRadius: '50%', animation: 'pulse 1.5s ease-in-out infinite' }}></span>
                      自動更新中
                    </div>
                  )}
                  <button 
                    onClick={fetchTournamentData} 
                    style={{ fontSize: '0.875rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}
                    disabled={isLoading}
                  >
                    {isLoading ? '更新中...' : '更新'}
                  </button>
                </div>
              </div>
              <div className="table-responsive">
                <table className="archer-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>氏名</th>
                      <th>所属</th>
                      <th>段位</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checkIns.length > 0 ? (
                      checkIns.map(archer => (
                        <tr key={archer.archerId} className={archer.isCheckedIn ? 'checked-in' : ''}>
                          <td>
                            {archer.archerId}
                            {archer.isCheckedIn && (
                              <span className="check-in-badge">受付済</span>
                            )}
                          </td>
                          <td>{archer.name}</td>
                          <td>{archer.affiliation}</td>
                          <td>{archer.rank}</td>
                          <td className="action-buttons">
                            <button 
                              onClick={() => showListQRCode(archer)}
                              className="btn-secondary"
                            >
                              <QrCode size={16} /> QR
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="text-center py-4">
                          <p className="text-gray-500">受付データがありません</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {showQRModal && currentQRCodeData && (
                <div className="qr-modal-overlay">
                  <div className="qr-modal-container">
                    <div className="qr-modal-header">
                      <h2>{currentQRCodeData.type}登録完了</h2>
                      <p className="qr-tournament-name">{currentQRCodeData.tournamentName}</p>
                    </div>
                    
                    <div className="qr-modal-body">
                      <div className="qr-code-wrapper" style={{ textAlign: 'center' }}>
                        <QRCodeSVG 
                          value={JSON.stringify({
                            id: currentQRCodeData.id,
                            name: currentQRCodeData.name,
                            type: currentQRCodeData.type,
                            tournament: currentQRCodeData.tournamentName,
                            affiliation: currentQRCodeData.affiliation,
                            rank: currentQRCodeData.rank,
                            timestamp: currentQRCodeData.registrationDate
                          })}
                          size={280}
                          level="H"
                          includeMargin={true}
                        />
                        <div style={{ marginTop: '1rem', fontWeight: 'bold', wordBreak: 'break-all' }}>
                          ID: {currentQRCodeData.id}
                        </div>
                      </div>
                      
                      <div className="qr-info-box">
                        <p className="qr-name">{currentQRCodeData.name} 様</p>
                        <p className="qr-details">{currentQRCodeData.affiliation}</p>
                        <p className="qr-details">{currentQRCodeData.rank}</p>
                      </div>
                    </div>
                    
                    <div className="qr-modal-footer">
                      <button
                        onClick={() => {
                          setShowQRModal(false);
                          setAutoRefresh(false);
                        }}
                        className="btn-primary"
                      >
                        閉じる
                      </button>
                    </div>
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

const AdminView = ({ state, dispatch, adminView, setAdminView, stands, selectedTournamentId, setSelectedTournamentId, onLogout }) => {
  if (adminView === 'recording') {
    return (
      <div>
        <div className="admin-header">
          <div className="button-group">
            <button onClick={() => setAdminView('recording')} className={`btn ${adminView === 'recording' ? 'btn-active' : ''}`}>記録入力</button>
            <button onClick={() => setAdminView('settings')} className={`btn ${adminView === 'settings' ? 'btn-active' : ''}`}>設定</button>
            <button onClick={() => setAdminView('awards')} className={`btn ${adminView === 'awards' ? 'btn-active' : ''}`}>表彰</button>
            <button onClick={() => setAdminView('ranking')} className={`btn ${adminView === 'ranking' ? 'btn-active' : ''}`}>順位決定戦</button>
            <button onClick={() => setAdminView('program')} className={`btn ${adminView === 'program' ? 'btn-active' : ''}`}>プログラム</button>
          </div>
          <button onClick={onLogout} className="btn-logout"><LogOut size={14} />ログアウト</button>
        </div>
        <RecordingView state={state} dispatch={dispatch} stands={stands} />
      </div>
    );
  }
  if (adminView === 'settings') {
    return (
      <div>
        <div className="admin-header">
          <div className="button-group">
            <button onClick={() => setAdminView('recording')} className={`btn ${adminView === 'recording' ? 'btn-active' : ''}`}>記録入力</button>
            <button onClick={() => setAdminView('settings')} className={`btn ${adminView === 'settings' ? 'btn-active' : ''}`}>設定</button>
            <button onClick={() => setAdminView('awards')} className={`btn ${adminView === 'awards' ? 'btn-active' : ''}`}>表彰</button>
            <button onClick={() => setAdminView('ranking')} className={`btn ${adminView === 'ranking' ? 'btn-active' : ''}`}>順位決定戦</button>
            <button onClick={() => setAdminView('program')} className={`btn ${adminView === 'program' ? 'btn-active' : ''}`}>プログラム</button>
          </div>
          <button onClick={onLogout} className="btn-logout"><LogOut size={14} />ログアウト</button>
        </div>
        <SettingsView state={state} dispatch={dispatch} selectedTournamentId={selectedTournamentId} setSelectedTournamentId={setSelectedTournamentId} />
      </div>
    );
  }
  if (adminView === 'awards') {
    return (
      <div>
        <div className="admin-header">
          <div className="button-group">
            <button onClick={() => setAdminView('recording')} className={`btn ${adminView === 'recording' ? 'btn-active' : ''}`}>記録入力</button>
            <button onClick={() => setAdminView('settings')} className={`btn ${adminView === 'settings' ? 'btn-active' : ''}`}>設定</button>
            <button onClick={() => setAdminView('awards')} className={`btn ${adminView === 'awards' ? 'btn-active' : ''}`}>表彰</button>
            <button onClick={() => setAdminView('ranking')} className={`btn ${adminView === 'ranking' ? 'btn-active' : ''}`}>順位決定戦</button>
            <button onClick={() => setAdminView('program')} className={`btn ${adminView === 'program' ? 'btn-active' : ''}`}>プログラム</button>
          </div>
          <button onClick={onLogout} className="btn-logout"><LogOut size={14} />ログアウト</button>
        </div>
        <AwardsView state={state} dispatch={dispatch} selectedTournamentId={selectedTournamentId} setSelectedTournamentId={setSelectedTournamentId} />
      </div>
    );
  }
  if (adminView === 'program') {
    return (
      <div>
        <div className="admin-header">
          <div className="button-group">
            <button onClick={() => setAdminView('recording')} className={`btn ${adminView === 'recording' ? 'btn-active' : ''}`}>記録入力</button>
            <button onClick={() => setAdminView('settings')} className={`btn ${adminView === 'settings' ? 'btn-active' : ''}`}>設定</button>
            <button onClick={() => setAdminView('awards')} className={`btn ${adminView === 'awards' ? 'btn-active' : ''}`}>表彰</button>
            <button onClick={() => setAdminView('ranking')} className={`btn ${adminView === 'ranking' ? 'btn-active' : ''}`}>順位決定戦</button>
            <button onClick={() => setAdminView('program')} className={`btn ${adminView === 'program' ? 'btn-active' : ''}`}>プログラム</button>
          </div>
          <button onClick={onLogout} className="btn-logout"><LogOut size={14} />ログアウト</button>
        </div>
        <ProgramView state={state} />
      </div>
    );
  }
  if (adminView === 'ranking') {
    return (
      <div>
        <div className="admin-header">
          <div className="button-group">
            <button onClick={() => setAdminView('recording')} className={`btn ${adminView === 'recording' ? 'btn-active' : ''}`}>記録入力</button>
            <button onClick={() => setAdminView('settings')} className={`btn ${adminView === 'settings' ? 'btn-active' : ''}`}>設定</button>
            <button onClick={() => setAdminView('awards')} className={`btn ${adminView === 'awards' ? 'btn-active' : ''}`}>表彰</button>
            <button onClick={() => setAdminView('ranking')} className={`btn ${adminView === 'ranking' ? 'btn-active' : ''}`}>順位決定戦</button>
            <button onClick={() => setAdminView('program')} className={`btn ${adminView === 'program' ? 'btn-active' : ''}`}>プログラム</button>
          </div>
          <button onClick={onLogout} className="btn-logout"><LogOut size={14} />ログアウト</button>
        </div>
        <RankingView state={state} dispatch={dispatch} selectedTournamentId={selectedTournamentId} />
      </div>
    );
  }
};

const RankingView = ({ state, dispatch, selectedTournamentId }) => {
  const [archers, setArchers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [shootOffType, setShootOffType] = useState(''); // 'shichuma' or 'enkin'
  const [shichumaResults, setShichumaResults] = useState({});
  const [enkinResults, setEnkinResults] = useState({});
  const [currentRound, setCurrentRound] = useState(1);
  const [isShootOffActive, setIsShootOffActive] = useState(false);
  const [eliminatedArchers, setEliminatedArchers] = useState(new Set());

  const tournaments = state.registeredTournaments || [];
  const tournament = tournaments.find(t => t.id === selectedTournamentId) || null;

  useEffect(() => {
    const fetchArchers = async () => {
      if (!selectedTournamentId) {
        setArchers([]);
        return;
      }
      setIsLoading(true);
      try {
        const response = await fetch(`${API_URL}/applicants/${selectedTournamentId}`);
        const result = await response.json();
        if (result.success) {
          const checkedIn = (result.data || []).filter(a => a.isCheckedIn);
          setArchers(checkedIn);
        } else {
          setArchers([]);
        }
      } catch (e) {
        console.error('RankingView fetch error', e);
        setArchers([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchArchers();
  }, [selectedTournamentId]);

  const getTiedArchers = useCallback(() => {
    const rankGroups = {};
    archers.forEach(archer => {
      const hitCount = getTotalHitCountAllStands(archer);
      if (!rankGroups[hitCount]) {
        rankGroups[hitCount] = [];
      }
      rankGroups[hitCount].push(archer);
    });

    const tiedGroups = Object.entries(rankGroups)
      .filter(([_, group]) => group.length > 1)
      .sort(([a], [b]) => parseInt(b) - parseInt(a));

    return tiedGroups;
  }, [archers]);

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

  const startShichumaShootOff = (tiedArchers) => {
    setShootOffType('shichuma');
    setIsShootOffActive(true);
    setCurrentRound(1);
    setShichumaResults({});
    setEliminatedArchers(new Set());
  };

  const startEnkinShootOff = (tiedArchers) => {
    setShootOffType('enkin');
    setIsShootOffActive(true);
    setEnkinResults({});
  };

  const handleShichumaShot = (archerId, arrowIndex, result) => {
    if (result === 'x') {
      setEliminatedArchers(prev => new Set([...prev, archerId]));
    }
    
    setShichumaResults(prev => ({
      ...prev,
      [archerId]: {
        ...prev[archerId],
        [`arrow${arrowIndex}`]: result
      }
    }));
  };

  const handleEnkinResult = (archerId, distance) => {
    setEnkinResults(prev => ({
      ...prev,
      [archerId]: distance
    }));
  };

  const getShichumaWinner = () => {
    const remainingArchers = archers.filter(archer => !eliminatedArchers.has(archer.archerId));
    if (remainingArchers.length === 1) {
      return remainingArchers[0];
    }
    return null;
  };

  const getEnkinRanking = () => {
    return Object.entries(enkinResults)
      .sort(([,a], [,b]) => parseFloat(a) - parseFloat(b))
      .map(([archerId, distance], index) => ({
        archer: archers.find(a => a.archerId === archerId),
        distance,
        rank: index + 1
      }));
  };

  const tiedGroups = getTiedArchers();

  return (
    <div className="view-container">
      <div className="view-header">
        <h1>順位決定戦</h1>
      </div>
      <div className="view-content">
        {!selectedTournamentId ? (
          <div className="card">大会を選択してください</div>
        ) : isLoading ? (
          <div className="card">読み込み中...</div>
        ) : tiedGroups.length === 0 ? (
          <div className="card">
            <h2 className="card-title">同率の選手はいません</h2>
            <p>すべての順位が確定しています</p>
          </div>
        ) : (
          <>
            <div className="card">
              <h2 className="card-title">同率選手一覧</h2>
              {tiedGroups.map(([hitCount, tiedArchers], index) => (
                <div key={hitCount} className="mb-4">
                  <h3 className="font-semibold mb-2">{hitCount}本的中 - {tiedArchers.length}名</h3>
                  <div className="space-y-2">
                    {tiedArchers.map(archer => (
                      <div key={archer.archerId} className="flex justify-between items-center p-2 border rounded">
                        <span>{archer.name} ({archer.affiliation})</span>
                        <span>{archer.rank}</span>
                      </div>
                    ))}
                  </div>
                  {index === 0 ? (
                    <div className="mt-3">
                      <p className="text-sm text-gray-600 mb-2">
                        1位決定戦：射詰競射（4本の矢、×で即退場）
                      </p>
                      <button 
                        onClick={() => startShichumaShootOff(tiedArchers)}
                        className="btn-primary"
                      >
                        射詰競射を開始
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <p className="text-sm text-gray-600 mb-2">
                        {index + 1}位決定戦：遠近競射（的の中心からの距離で順位決定）
                      </p>
                      <button 
                        onClick={() => startEnkinShootOff(tiedArchers)}
                        className="btn-primary"
                      >
                        遠近競射を開始
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {isShootOffActive && shootOffType === 'shichuma' && (
              <div className="card">
                <h2 className="card-title">射詰競射中</h2>
                <div className="mb-4">
                  <p className="text-sm text-gray-600">
                    ルール：4本の矢、×を出した時点で退場。最後まで的中し続けた選手が優勝
                  </p>
                </div>
                {getShichumaWinner() ? (
                  <div className="bg-green-100 p-4 rounded mb-4">
                    <h3 className="font-bold text-green-800">優勝者決定！</h3>
                    <p>{getShichumaWinner().name} ({getShichumaWinner().affiliation})</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {archers.filter(archer => !eliminatedArchers.has(archer.archerId)).map(archer => (
                      <div key={archer.archerId} className="border rounded p-4">
                        <h4 className="font-semibold mb-2">{archer.name}</h4>
                        <div className="grid grid-cols-4 gap-2">
                          {[0, 1, 2, 3].map(arrowIndex => {
                            const result = shichumaResults[archer.archerId]?.[`arrow${arrowIndex}`];
                            return (
                              <div key={arrowIndex} className="text-center">
                                <p className="text-sm mb-1">{arrowIndex + 1}本目</p>
                                {result ? (
                                  <span className={`text-2xl font-bold ${result === 'o' ? 'text-green-600' : 'text-red-600'}`}>
                                    {result === 'o' ? '◯' : '×'}
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleShichumaShot(archer.archerId, arrowIndex, 'o')}
                                    className="btn-circle btn-hit"
                                    disabled={eliminatedArchers.has(archer.archerId)}
                                  >
                                    ◯
                                  </button>
                                )}
                                {!result && !eliminatedArchers.has(archer.archerId) && (
                                  <button
                                    onClick={() => handleShichumaShot(archer.archerId, arrowIndex, 'x')}
                                    className="btn-circle btn-miss ml-1"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {eliminatedArchers.has(archer.archerId) && (
                          <p className="text-red-600 font-semibold mt-2">退場</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {isShootOffActive && shootOffType === 'enkin' && (
              <div className="card">
                <h2 className="card-title">遠近競射中</h2>
                <div className="mb-4">
                  <p className="text-sm text-gray-600">
                    ルール：的の中心からの距離を測定し、近い順に順位を決定
                  </p>
                </div>
                <div className="space-y-4">
                  {archers.map(archer => (
                    <div key={archer.archerId} className="border rounded p-4">
                      <h4 className="font-semibold mb-2">{archer.name}</h4>
                      <div className="flex items-center gap-4">
                        <input
                          type="number"
                          step="0.1"
                          placeholder="距離 (cm)"
                          value={enkinResults[archer.archerId] || ''}
                          onChange={(e) => handleEnkinResult(archer.archerId, e.target.value)}
                          className="input"
                        />
                        <span className="text-sm text-gray-600">cm</span>
                      </div>
                    </div>
                  ))}
                </div>
                {Object.keys(enkinResults).length === archers.length && (
                  <div className="mt-4">
                    <h3 className="font-bold mb-2">遠近競射結果</h3>
                    <div className="space-y-2">
                      {getEnkinRanking().map(({archer, distance, rank}) => (
                        <div key={archer.archerId} className="flex justify-between items-center p-2 border rounded">
                          <span>{rank}位: {archer.name}</span>
                          <span>{distance}cm</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const SettingsView = ({ state, dispatch, selectedTournamentId, setSelectedTournamentId }) => {
  const [localSettings, setLocalSettings] = useState({
    passRule: state.tournament.passRule,
    arrowsRound1: state.tournament.arrowsRound1,
    arrowsRound2: state.tournament.arrowsRound2,
    archersPerStand: state.tournament.archersPerStand,
    awardRankLimit: 3,
  });

  const tournaments = state.registeredTournaments || [];

  useEffect(() => {
    if (!selectedTournamentId) return;
    const t = tournaments.find(x => x.id === selectedTournamentId);
    if (t && t.data) {
      setLocalSettings(prev => ({
        ...prev,
        passRule: t.data.passRule || prev.passRule,
        arrowsRound1: t.data.arrowsRound1 || prev.arrowsRound1,
        arrowsRound2: t.data.arrowsRound2 || prev.arrowsRound2,
        archersPerStand: t.data.archersPerStand || prev.archersPerStand,
        awardRankLimit: t.data.awardRankLimit || prev.awardRankLimit,
      }));
    }
  }, [selectedTournamentId, tournaments]);

  const handleSaveSettings = async () => {
    if (!selectedTournamentId) {
      alert('設定する大会を選択してください');
      return;
    }

    const existing = tournaments.find(t => t.id === selectedTournamentId);
    const newData = Object.assign({}, existing ? existing.data : {}, localSettings);

    try {
      const resp = await fetch(`${API_URL}/tournaments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedTournamentId, data: newData })
      });
      const json = await resp.json();
      if (json.success) {
        dispatch({ type: 'SAVE_TOURNAMENT_TEMPLATE', payload: { id: selectedTournamentId, data: newData } });
        alert('大会ごとの設定を保存しました');
      } else {
        throw new Error(json.message || '保存失敗');
      }
    } catch (err) {
      console.error('save settings error:', err);
      alert('設定の保存に失敗しました');
    }
  };

  return (
    <div className="view-container pb-6">
      <div className="view-content">
        <div className="card">
          <p className="card-title">通過判定ルール</p>
          <div className="radio-group">
            {[{ value: 'all_four', label: '全て的中' }, { value: 'four_or_more', label: '4本以上的中' }, { value: 'three_or_more', label: '3本以上的中' }, { value: 'two_or_more', label: '2本以上的中' }].map(rule => (
              <label key={rule.value} className="radio-label">
                <input type="radio" name="passRule" value={rule.value} checked={localSettings.passRule === rule.value} onChange={(e) => setLocalSettings(prev => ({ ...prev, passRule: e.target.value }))} />
                <span>{rule.label}</span>
              </label>
            ))}
          </div>
          <div className="divider"></div>
          <p className="label">予選1回戦の矢数</p>
          <select value={localSettings.arrowsRound1} onChange={(e) => setLocalSettings(prev => ({ ...prev, arrowsRound1: parseInt(e.target.value) }))} className="input">
            <option value={2}>2本</option>
            <option value={4}>4本</option>
          </select>
          <div className="divider"></div>
          <p className="label">予選2回戦の矢数</p>
          <select value={localSettings.arrowsRound2} onChange={(e) => setLocalSettings(prev => ({ ...prev, arrowsRound2: parseInt(e.target.value) }))} className="input">
            <option value={2}>2本</option>
            <option value={4}>4本</option>
          </select>
          <div className="divider"></div>
          <p className="label">道場に入る最大の人数</p>
          <select value={localSettings.archersPerStand} onChange={(e) => setLocalSettings(prev => ({ ...prev, archersPerStand: parseInt(e.target.value) }))} className="input">
            {[6, 8, 10, 12].map(n => (<option key={n} value={n}>{n}人</option>))}
          </select>
          <div className="divider"></div>
          <p className="label">表彰は何位まで</p>
          <input
            type="number"
            min="1"
            max="999"
            value={localSettings.awardRankLimit}
            onChange={(e) => setLocalSettings(prev => ({ ...prev, awardRankLimit: Math.max(1, parseInt(e.target.value || '1')) }))}
            className="input"
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
          <button onClick={handleSaveSettings} className="btn-primary">大会に設定を保存</button>
        </div>
      </div>
    </div>
  );
};

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
          const rankOrder = ['五級','四級','三級','弐級','壱級','初段','弐段','参段','四段','五段','錬士五段','錬士六段','教士七段','教士八段','範士八段','範士九段'];
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
      html += `<table><thead><tr><th>#</th><th>氏名</th><th>所属</th><th>段位</th><th>1立ち目</th><th>2立ち目</th></tr></thead><tbody>`;

      const start = p * perPage;
      const end = Math.min(start + perPage, archers.length);
      for (let i = start; i < end; i++) {
        const a = archers[i];
        html += `<tr><td style="width:60px">${a.standOrder || i+1}</td><td>${a.name || ''}</td><td>${a.affiliation || ''}</td><td>${a.rank || ''}</td>`;
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
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">1立ち目</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">2立ち目</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {isLoading && archers.length === 0 ? (
                      <tr><td colSpan="4" className="px-4 py-4 text-center">読み込み中...</td></tr>
                    ) : archers.length === 0 ? (
                      <tr><td colSpan="4" className="px-4 py-4 text-center">選手が登録されていません</td></tr>
                    ) : (
                      currentArchers.map(a => (
                        <tr key={a.archerId}>
                          <td className="px-4 py-3 text-sm font-medium">{a.standOrder}</td>
                          <td className="px-4 py-3">{a.name}</td>
                          <td className="px-4 py-3">{a.affiliation}</td>
                          <td className="px-4 py-3 text-center">{a.rank}</td>
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

const TournamentSetupView = ({ state, dispatch }) => {
  const [copied, setCopied] = useState(false);
  const [tournamentId, setTournamentId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [locationFilter, setLocationFilter] = useState('');
  const [geocodeStatus, setGeocodeStatus] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [formData, setFormData] = useState({
    name: '', datetime: '', location: '', venueAddress: '', venueLat: '', venueLng: '', organizer: '', coOrganizer: '', administrator: '', purpose: '', event: '', type: '', category: '', description: '', competitionMethod: '', award: '', qualifications: '', applicableRules: '', applicationMethod: '', remarks: '',
    attachments: [],
    divisions: [
      { id: 'lower', label: '級位~三段以下の部' },
      { id: 'middle', label: '四・五段の部' },
      { id: 'title', label: '称号者の部' }
    ]
  });

  const filteredTournaments = state.registeredTournaments.filter(tournament => 
    locationFilter === '' || 
    (tournament.data.location && tournament.data.location.toLowerCase().includes(locationFilter.toLowerCase()))
  );

  const generateTournamentId = () => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `KYUDO_${dateStr}_${random}`;
  };

  const handleInputChange = (field, value) => { setFormData(prev => ({ ...prev, [field]: value })); };
  const defaultDivisions = [
    { id: 'lower', label: '級位~三段以下の部', minRank: '五級', maxRank: '参段' },
    { id: 'middle', label: '四・五段の部', minRank: '四段', maxRank: '五段' },
    { id: 'title', label: '称号者の部', minRank: '錬士五段', maxRank: '範士九段' }
  ];

  const handleGeocodeAddress = async () => {
    const addrRaw = (formData.venueAddress || '').trim();
    if (!addrRaw) {
      setGeocodeStatus('❌ 会場住所を入力してください');
      return;
    }
    const postalMatch = addrRaw.match(/\b\d{3}-?\d{4}\b/);
    const postal = postalMatch ? postalMatch[0].replace('-', '') : '';
    const normalizeQuery = (s) => {
      if (!s) return '';
      const toHalfWidth = (str) => {
        // Numbers and some symbols to half-width
        return String(str)
          .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
          .replace(/[Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
          .replace(/[，、]/g, ',')
          .replace(/[．。]/g, '.')
          .replace(/[：]/g, ':')
          .replace(/[（]/g, '(')
          .replace(/[）]/g, ')')
          .replace(/[－ー―‐‑‒–—−]/g, '-')
          .replace(/[　]/g, ' ');
      };

      return toHalfWidth(s)
        .replace(/\(.*?\)/g, ' ')
        .replace(/（.*?）/g, ' ')
        .replace(/〒\s*\d{3}-?\d{4}/g, ' ')
        .replace(/〒/g, ' ')
        .replace(/\bJapan\b/gi, ' ')
        .replace(/\b日本\b/g, ' ')
        .replace(/TEL[:：]?\s*\d{2,4}-\d{2,4}-\d{3,4}/gi, ' ')
        .replace(/\d{2,4}-\d{2,4}-\d{3,4}/g, ' ')
        // try to normalize Japanese block numbers
        .replace(/(\d+)丁目/g, '$1-')
        .replace(/(\d+)番地?/g, '$1-')
        .replace(/(\d+)号/g, '$1')
        .replace(/[\s,]+/g, ' ')
        .trim();
    };
    const addr = normalizeQuery(addrRaw);

    const tryQueries = [];
    if (addr) tryQueries.push(addr);

    // If postal code exists, also try with it (Nominatim sometimes matches better)
    if (postal) {
      const formattedPostal = postal.length === 7 ? `${postal.slice(0, 3)}-${postal.slice(3)}` : postal;
      const withPostal = normalizeQuery(`${formattedPostal} ${addr}`);
      if (withPostal && !tryQueries.includes(withPostal)) tryQueries.push(withPostal);
    }

    // Remove common building keywords (keep the rest)
    const noBuilding = normalizeQuery(addr.replace(/(武道館|体育館|道場|弓道場|会館|ホール|センター|公民館|市民会館|県立|市立)/g, ''));
    if (noBuilding && noBuilding !== addr) tryQueries.push(noBuilding);
    // Remove trailing block names after comma-like spaces
    const noLastToken = normalizeQuery(addr.split(' ').slice(0, -1).join(' '));
    if (noLastToken && noLastToken !== addr && noLastToken !== noBuilding) tryQueries.push(noLastToken);

    // Remove number-heavy tail (often helps with Japanese addresses)
    const coarse = normalizeQuery(addr.replace(/\d[\d-]*/g, ' '));
    if (coarse && coarse !== addr && coarse !== noBuilding && !tryQueries.includes(coarse)) tryQueries.push(coarse);

    setIsGeocoding(true);
    setGeocodeStatus('📍 住所から座標を取得中...');
    try {
      let found = null;
      for (const q of tryQueries) {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=jp&addressdetails=1&q=${encodeURIComponent(q)}`;
        const resp = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'Accept-Language': 'ja'
          }
        });
        if (!resp.ok) {
          continue;
        }
        const data = await resp.json();
        const first = Array.isArray(data) ? data.find(x => x?.lat && x?.lon) : null;
        if (first) {
          found = first;
          break;
        }
      }

      if (!found) {
        // Fallback: GSI (Geospatial Information Authority of Japan) address search
        // https://msearch.gsi.go.jp/address-search/AddressSearch?q=...
        let gsiFound = null;
        for (const q of tryQueries) {
          const gsiUrl = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(q)}`;
          const resp = await fetch(gsiUrl, { headers: { 'Accept': 'application/json' } });
          if (!resp.ok) continue;
          const data = await resp.json();
          const first = Array.isArray(data) ? data.find(x => Array.isArray(x?.geometry?.coordinates) && x.geometry.coordinates.length >= 2) : null;
          if (first) {
            gsiFound = first;
            break;
          }
        }

        if (!gsiFound) {
          setGeocodeStatus('⚠️ 住所から座標を取得できませんでした（住所を短くする/市区町村までにする/時間をおく などを試してください）');
          return;
        }

        const [lng, lat] = gsiFound.geometry.coordinates;
        setFormData(prev => ({ ...prev, venueLat: String(lat), venueLng: String(lng) }));
        setGeocodeStatus('✅ 座標を取得しました（国土地理院）');
        return;
      }

      setFormData(prev => ({ ...prev, venueLat: String(found.lat), venueLng: String(found.lon) }));
      setGeocodeStatus('✅ 座標を取得しました（Nominatim）');
    } catch (e) {
      console.error('Nominatim geocode error:', e);
      setGeocodeStatus('❌ 座標取得に失敗しました（時間をおいて再試行してください）');
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleLoadTemplateSafe = (template) => {
    const data = template.data || {};
    const storedAttachments = getStoredAttachments(template.id);
    setFormData(normalizeTournamentFormData(data, defaultDivisions, storedAttachments));
    setTournamentId(template.id);
    setIsEditing(true);
  };

  const handleAttachmentsChange = async (files) => {
    const list = Array.from(files || []);
    if (list.length === 0) return;
    try {
      const readAsDataUrl = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: typeof reader.result === 'string' ? reader.result : ''
        });
        reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
        reader.readAsDataURL(file);
      });

      const newAttachments = await Promise.all(list.map(readAsDataUrl));
      setFormData(prev => ({
        ...prev,
        attachments: [
          ...(Array.isArray(prev.attachments) ? prev.attachments : []),
          ...newAttachments
        ]
      }));
    } catch (e) {
      console.error(e);
      alert('添付ファイルの読み込みに失敗しました');
    }
  };

  const handleRemoveAttachment = (index) => {
    setFormData(prev => {
      const next = Array.isArray(prev.attachments) ? prev.attachments.slice() : [];
      next.splice(index, 1);
      return { ...prev, attachments: next };
    });
  };
  
  const handleAddDivision = () => {
    const newId = `div_${Date.now().toString(36).toUpperCase()}`;
    const newDiv = { id: newId, label: '新しい部門', minRank: '', maxRank: '' };
    setFormData(prev => ({ ...prev, divisions: [...(prev.divisions || []), newDiv] }));
  };

  const handleRemoveDivision = (index) => {
    setFormData(prev => {
      const ds = (prev.divisions || []).slice();
      ds.splice(index, 1);
      return { ...prev, divisions: ds };
    });
  };

  const handleDivisionChange = (index, field, value) => {
    setFormData(prev => {
      const ds = (prev.divisions || []).map((d, i) => i === index ? { ...d, [field]: value } : d);
      return { ...prev, divisions: ds };
    });
  };
  const handleSaveTournament = async () => {
    if (!formData.name || !formData.datetime || !formData.location || !formData.purpose || !formData.organizer || !formData.coOrganizer || !formData.administrator || !formData.event || !formData.type || !formData.category || !formData.description || !formData.competitionMethod || !formData.award || !formData.qualifications || !formData.applicableRules || !formData.applicationMethod || !formData.remarks) { 
      alert('大会名、目的、主催、後援、主管、期日、会場、種目、種類、種別、内容、競技方法、表彰、参加資格、適用規則、申込方法、その他必要事項は必須です'); 
      return; 
    }
    
    try {
      const newId = isEditing && tournamentId ? tournamentId : generateTournamentId();

      setStoredAttachments(newId, formData.attachments);

      const { attachments, ...dataWithoutAttachments } = formData;
      
      const response = await fetch(`${API_URL}/tournaments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newId,
          data: dataWithoutAttachments
        })
      });

      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch {
        throw new Error(`サーバー応答が不正です (status: ${response.status})`);
      }
      
      if (result.success) {
        setTournamentId(newId);
        setIsEditing(true);
        dispatch({ type: 'SAVE_TOURNAMENT_TEMPLATE', payload: { id: newId, data: dataWithoutAttachments } });
        dispatch({ type: 'UPDATE_TOURNAMENT_INFO', payload: { id: newId, name: dataWithoutAttachments.name } });
        alert(isEditing ? '大会情報を更新しました' : '大会を登録しました');
      } else {
        throw new Error(result.message || '保存に失敗しました');
      }
    } catch (error) {
      console.error('大会保存エラー:', error);
      alert(`大会の保存に失敗しました: ${error.message}`);
    }
  };
  
  const handleResetForm = () => {
    setFormData(normalizeTournamentFormData({}, defaultDivisions, []));
    setTournamentId(null);
    setIsEditing(false);
    setCopied(false);
    setGeocodeStatus('');
  };
  
  const handleDeleteTemplate = async (id) => {
    if (window.confirm('この大会情報を削除してもよろしいですか?')) {
      try {
        const response = await fetch(`${API_URL}/tournaments/${id}`, {
          method: 'DELETE'
        });
        const result = await response.json();
        if (result.success) {
          dispatch({ type: 'DELETE_TOURNAMENT_TEMPLATE', payload: id });
          if (tournamentId === id) handleResetForm();
        }
      } catch (error) {
        console.error('Error deleting tournament:', error);
        alert('削除に失敗しました');
      }
    }
  };
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(tournamentId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="view-container">
      <div className="admin-header">
        <h1>大会登録</h1>
      </div>
      <div className="view-content">
        {state.registeredTournaments.length > 0 && (
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <p className="card-title">登録済み大会</p>
              <input 
                type="text" 
                value={locationFilter} 
                onChange={(e) => setLocationFilter(e.target.value)} 
                placeholder="開催地でフィルター" 
                className="input input-sm w-48"
              />
            </div>
            <div className="tournament-list">
              {filteredTournaments.length === 0 ? (
                <p className="text-gray-500 text-center py-4">該当する大会が見つかりません</p>
              ) : (
                filteredTournaments.map(template => (
                <div key={template.id} className="tournament-item">
                  <button onClick={() => handleLoadTemplateSafe(template)} className="tournament-button">
                    <p>{template.data.name}</p>
                    <p className="text-sm">{template.data.location || '場所未設定'} | {template.data.datetime || '日時未設定'}</p>
                  </button>
                  <button onClick={() => handleDeleteTemplate(template.id)} className="btn-delete">削除</button>
                </div>
              )))}
            </div>
            <button onClick={handleResetForm} className="btn-secondary">新規大会登録</button>
          </div>
        )}

        {tournamentId && (
          <div className="card">
            <div className="tournament-header">
              <div>
                <p className="text-sm text-gray-500">大会ID</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono">{tournamentId}</p>
                  <button 
                    onClick={copyToClipboard} 
                    className="p-1 hover:bg-gray-100 rounded"
                    title="コピー"
                  >
                    {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <input type="text" value={formData.name} onChange={(e) => handleInputChange('name', e.target.value)} placeholder="大会名 *" className="input" />
          <input type="datetime-local" value={formData.datetime} onChange={(e) => handleInputChange('datetime', e.target.value)} className="input" />
          <input type="text" value={formData.location} onChange={(e) => handleInputChange('location', e.target.value)} placeholder="開催場所 *" className="input" />
          <input type="text" value={formData.venueAddress} onChange={(e) => handleInputChange('venueAddress', e.target.value)} placeholder="会場住所（プログラム表には表示されません）" className="input" />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={handleGeocodeAddress} className="btn-secondary" disabled={isGeocoding} style={{ whiteSpace: 'nowrap' }}>
              {isGeocoding ? '取得中...' : '住所から座標取得'}
            </button>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
              {geocodeStatus && <p className="text-sm text-gray-600" style={{ margin: 0 }}>{geocodeStatus}</p>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input type="text" value={formData.venueLat} onChange={(e) => handleInputChange('venueLat', e.target.value)} placeholder="緯度（自動受付用）" className="input" />
            <input type="text" value={formData.venueLng} onChange={(e) => handleInputChange('venueLng', e.target.value)} placeholder="経度（自動受付用）" className="input" />
          </div>
          <input type="text" value={formData.purpose} onChange={(e) => handleInputChange('purpose', e.target.value)} placeholder="目的 *" className="input" />
          <input type="text" value={formData.organizer} onChange={(e) => handleInputChange('organizer', e.target.value)} placeholder="主催 *" className="input" />
          <input type="text" value={formData.coOrganizer} onChange={(e) => handleInputChange('coOrganizer', e.target.value)} placeholder="後援 *" className="input" />
          <input type="text" value={formData.administrator} onChange={(e) => handleInputChange('administrator', e.target.value)} placeholder="主管 *" className="input" />
          <div style={{ marginTop: '0.5rem' }}>
            <p className="label">添付資料（PDF/Excel/Word等・複数可）</p>
            <input
              type="file"
              multiple
              onChange={(e) => handleAttachmentsChange(e.target.files)}
              className="input"
            />
            {Array.isArray(formData.attachments) && formData.attachments.length > 0 && (
              <div style={{ marginTop: '0.5rem' }}>
                {formData.attachments.map((att, idx) => (
                  <div key={`${att?.name || 'file'}_${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <a href={att?.dataUrl || ''} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                      {att?.name || `file_${idx+1}`}
                    </a>
                    <button type="button" className="btn-fix" onClick={() => handleRemoveAttachment(idx)}>削除</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <p className="label">大会要項</p>
            <input type="text" value={formData.event} onChange={(e) => handleInputChange('event', e.target.value)} placeholder="種目 *" className="input" />
            <input type="text" value={formData.type} onChange={(e) => handleInputChange('type', e.target.value)} placeholder="種類 *" className="input" />
            <input type="text" value={formData.category} onChange={(e) => handleInputChange('category', e.target.value)} placeholder="種別 *" className="input" />
            <input type="text" value={formData.description} onChange={(e) => handleInputChange('description', e.target.value)} placeholder="内容 *" className="input" />
            <input type="text" value={formData.competitionMethod} onChange={(e) => handleInputChange('competitionMethod', e.target.value)} placeholder="競技方法 *" className="input" />
            <input type="text" value={formData.award} onChange={(e) => handleInputChange('award', e.target.value)} placeholder="表彰 *" className="input" />
            <input type="text" value={formData.qualifications} onChange={(e) => handleInputChange('qualifications', e.target.value)} placeholder="参加資格 *" className="input" />
            <input type="text" value={formData.applicableRules} onChange={(e) => handleInputChange('applicableRules', e.target.value)} placeholder="適用規則 *" className="input" />
            <input type="text" value={formData.applicationMethod} onChange={(e) => handleInputChange('applicationMethod', e.target.value)} placeholder="申込方法 *" className="input" />
            <input type="text" value={formData.remarks} onChange={(e) => handleInputChange('remarks', e.target.value)} placeholder="その他必要事項 *" className="input" />
            
            <div style={{ marginTop: '0.75rem' }}>
              <p className="label">部門設定</p>
              {formData.divisions && (() => {
                const rankOptions = ['五級', '四級', '三級', '弐級', '壱級', '初段', '弐段', '参段', '四段', '五段', '錬士五段', '錬士六段', '教士七段', '教士八段', '範士八段', '範士九段'];
                return (
                  <>
                    {(formData.divisions || []).length === 0 && (
                      <p className="text-sm text-gray-500" style={{ marginBottom: '0.5rem' }}>部門がありません。「部門を追加」から追加してください。</p>
                    )}
                    {formData.divisions.map((d, idx) => (
                      <div key={d.id} className="division-row" style={{ marginBottom: '0.5rem', alignItems: 'center' }}>
                        <input
                          type="text"
                          value={d.label}
                          onChange={(e) => handleDivisionChange(idx, 'label', e.target.value)}
                          className="input"
                          style={{ flex: 1 }}
                        />
                        <select
                          value={d.minRank || ''}
                          onChange={(e) => handleDivisionChange(idx, 'minRank', e.target.value)}
                          className="input"
                          style={{ width: '10rem' }}
                        >
                          <option value="">from</option>
                          {rankOptions.map(r => (<option key={r} value={r}>{r}</option>))}
                        </select>
                        <select
                          value={d.maxRank || ''}
                          onChange={(e) => handleDivisionChange(idx, 'maxRank', e.target.value)}
                          className="input"
                          style={{ width: '10rem' }}
                        >
                          <option value="">to</option>
                          {rankOptions.map(r => (<option key={r} value={r}>{r}</option>))}
                        </select>
                        <div className="division-actions" style={{ display: 'flex', gap: '0.5rem', marginLeft: '0.5rem' }}>
                          <button type="button" className="btn-fix" onClick={() => handleRemoveDivision(idx)}>削除</button>
                        </div>
                      </div>
                    ))}
                    <div style={{ display: 'flex', marginTop: '0.5rem', gap: '0.5rem' }}>
                      <button type="button" className="btn-secondary" onClick={handleAddDivision}>部門を追加</button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        <button onClick={handleSaveTournament} className="btn-primary">{isEditing ? '大会情報を更新' : '大会登録を保存'}</button>
      </div>
    </div>
  );
};

const ArcherSignupView = ({ state, dispatch }) => {
  const [selectedTournamentId, setSelectedTournamentId] = useState(() => localStorage.getItem('selectedTournamentId') || '');
  const [isStaff, setIsStaff] = useState(false);
  const [locationFilter, setLocationFilter] = useState('');

  useEffect(() => {
    if (selectedTournamentId) {
      localStorage.setItem('selectedTournamentId', selectedTournamentId);
    } else {
      localStorage.removeItem('selectedTournamentId');
    }
  }, [selectedTournamentId]);
  const [formData, setFormData] = useState({
    name: '', 
    affiliation: '', 
    rank: '初段', 
    rankAcquiredDate: '',
    isOfficialOnly: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  
  const filteredTournaments = state.registeredTournaments.filter(tournament => 
    locationFilter === '' || 
    (tournament.data.location && tournament.data.location.toLowerCase().includes(locationFilter.toLowerCase()))
  );
  
  const [qrCodeData, setQrCodeData] = useState({ 
    id: '', 
    name: '', 
    type: '',
    tournamentName: '',
    affiliation: '',
    rank: '',
    registrationDate: ''
  });

  const rankOrder = [
    '五級', '四級', '三級', '弐級', '壱級',
    '初段', '弐段', '参段', '四段', '五段',
    '錬士五段', '錬士六段', '教士七段', '教士八段', '範士八段', '範士九段'
  ];

  const normalizeRank = (rank) => {
    if (!rank) return '';
    return rank
      .replace('二段', '弐段')
      .replace('三段', '参段')
      .replace('二級', '弐級')
      .replace('一級', '壱級');
  };

  const getDivisionFromRank = (rank, tournamentDivisions) => {
    const { ceremony } = (() => {
      const ceremonyRanks = ['錬士', '教士', '範士'];
      let ceremony = '';
      let r = rank || '';
      for (const c of ceremonyRanks) {
        if (r.includes(c)) {
          ceremony = c;
          r = r.replace(c, '');
          break;
        }
      }
      return { ceremony, rank: r };
    })();

    if (ceremony) return 'title';

    const normalized = normalizeRank(rank);
    const idx = rankOrder.indexOf(normalized);

    if (Array.isArray(tournamentDivisions) && tournamentDivisions.length > 0) {
      for (const d of tournamentDivisions) {
        if (!d) continue;
        const minR = d.minRank || '';
        const maxR = d.maxRank || '';
        const minIdx = rankOrder.indexOf(normalizeRank(minR));
        const maxIdx = rankOrder.indexOf(normalizeRank(maxR));
        const effectiveMin = minIdx === -1 ? 0 : Math.min(minIdx, rankOrder.length - 1);
        const effectiveMax = maxIdx === -1 ? rankOrder.length - 1 : Math.max(maxIdx, 0);
        if (idx !== -1 && idx >= effectiveMin && idx <= effectiveMax) return d.id;
      }
    }

    const idx3 = rankOrder.indexOf('参段');
    const idx5 = rankOrder.indexOf('五段');

    if (idx !== -1 && idx <= idx3) return 'lower';
    if (idx !== -1 && idx <= idx5) return 'middle';

    return 'lower';
  };

  const handleInputChange = (field, value) => { setFormData(prev => ({ ...prev, [field]: value })); };

  const showQRCode = (id, name, type, tournamentName = '', affiliation = '', rank = '') => {
    setQrCodeData({ 
      id, 
      name, 
      type,
      tournamentName,
      affiliation,
      rank,
      registrationDate: new Date().toISOString()
    });
    setShowQRModal(true);
  };

  const handleCloseQRModal = () => {
    setShowQRModal(false);
  };

  const handleApply = async () => {
    if (!selectedTournamentId || !formData.name || !formData.affiliation || !formData.rankAcquiredDate) {
      alert('すべての必須項目を入力してください');
      return;
    }

    try {
      const tournament = state.registeredTournaments.find(t => t.id === selectedTournamentId);
      if (!tournament) {
        alert('大会が見つかりません');
        return;
      }

      const archerId = `${selectedTournamentId}_${Date.now().toString(36).toUpperCase()}`;
      const deviceId = localStorage.getItem('kyudo_tournament_device_id') || `device_${Math.random().toString(36).substr(2, 9)}`;
      
      const divisionForApplicant = getDivisionFromRank(formData.rank, tournament?.data?.divisions);

      const applicantData = {
        name: formData.name,
        affiliation: formData.affiliation,
        rank: formData.rank,
        rankAcquiredDate: formData.rankAcquiredDate,
        isStaff: isStaff,
        isOfficialOnly: formData.isOfficialOnly,
        archerId: archerId,
        division: divisionForApplicant,
        appliedAt: new Date().toISOString(),
        deviceId: deviceId
      };

      const response = await fetch(`${API_URL}/applicants`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tournamentId: selectedTournamentId,
          archerId: archerId,
          applicantData: applicantData
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        showQRCode(
          archerId,
          formData.name,
          isStaff ? '役員' : '選手',
          tournament?.data?.name || '不明な大会',
          formData.affiliation,
          formData.rank
        );

        localStorage.setItem('kyudo_tournament_device_id', deviceId);
        localStorage.setItem('kyudo_tournament_user', JSON.stringify(applicantData));
        
        setFormData({
          name: '',
          affiliation: '',
          rank: '初段',
          rankAcquiredDate: '',
          isOfficialOnly: false
        });
        setIsStaff(false);
      } else {
        throw new Error(result.message || '申し込みに失敗しました');
      }
    } catch (error) {
      console.error('申し込みエラー:', error);
      alert(`申し込み処理中にエラーが発生しました: ${error.message}`);
    }
  };

  return (
    <div className="view-container">
      <div className="view-header">
        <h1>選手申し込み</h1>
      </div>
      <div className="view-content">
        <div className="card">
          <label>大会を選択 *</label>
          <div className="mb-2">
            <input 
              type="text" 
              value={locationFilter} 
              onChange={(e) => setLocationFilter(e.target.value)} 
              placeholder="開催地でフィルター" 
              className="input w-full mb-2"
            />
            <select 
              value={selectedTournamentId} 
              onChange={(e) => setSelectedTournamentId(e.target.value)} 
              className="input w-full"
            >
              <option value="">-- 大会を選択してください --</option>
              {filteredTournaments.length === 0 ? (
                <option disabled>該当する大会が見つかりません</option>
              ) : (
                filteredTournaments.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.data.name} ({t.data.location})
                  </option>
                ))
              )}
            </select>
          </div>
          
          <div className="mt-4">
            <label className="flex items-center space-x-2">
              <input 
                type="radio" 
                checked={!isStaff} 
                onChange={() => setIsStaff(false)} 
                className="form-radio"
              />
              <span>選手として申し込む</span>
            </label>
            <label className="flex items-center space-x-2 mt-2">
              <input 
                type="radio" 
                checked={isStaff} 
                onChange={() => setIsStaff(true)} 
                className="form-radio"
              />
              <span>役員として申し込む</span>
            </label>
          </div>
        </div>

        {selectedTournamentId && (
          <div className="card">
            <input type="text" value={formData.name} onChange={(e) => handleInputChange('name', e.target.value)} placeholder="氏名 *" className="input" />
            <input type="text" value={formData.affiliation} onChange={(e) => handleInputChange('affiliation', e.target.value)} placeholder="所属 *" className="input" />
            <select value={formData.rank} onChange={(e) => handleInputChange('rank', e.target.value)} className="input">
              {rankOrder.map(rank => (<option key={rank} value={rank}>{rank}</option>))}
            </select>
            <div>
              <label>段位取得日 *</label>
              <input 
                type="date" 
                value={formData.rankAcquiredDate} 
                onChange={(e) => handleInputChange('rankAcquiredDate', e.target.value)} 
                className="input w-full" 
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <button onClick={handleApply} className="btn-primary">申し込む</button>
          </div>
        )}

        {showQRModal && (
          <div className="qr-modal-overlay">
            <div className="qr-modal-container">
              <div className="qr-modal-header">
                <h2>{qrCodeData.type}登録完了</h2>
                <p className="qr-tournament-name">{qrCodeData.tournamentName}</p>
              </div>
              
              <div className="qr-modal-body">
                <div className="qr-code-wrapper" style={{ textAlign: 'center' }}>
                  <QRCodeSVG 
                    value={JSON.stringify({
                      id: qrCodeData.id,
                      name: qrCodeData.name,
                      type: qrCodeData.type,
                      tournament: qrCodeData.tournamentName,
                      affiliation: qrCodeData.affiliation,
                      rank: qrCodeData.rank,
                      timestamp: qrCodeData.registrationDate
                    })}
                    size={280}
                    level="H"
                    includeMargin={true}
                  />
                  <div style={{ marginTop: '1rem', fontWeight: 'bold', wordBreak: 'break-all' }}>
                    ID: {qrCodeData.id}
                  </div>
                </div>
                
                <div className="qr-info-box">
                  <p className="qr-name">{qrCodeData.name} 様</p>
                  <p className="qr-details">{qrCodeData.affiliation}</p>
                  <p className="qr-details">{qrCodeData.rank}</p>
                </div>
              </div>
              
              <div className="qr-modal-footer">
                <button
                  onClick={handleCloseQRModal}
                  className="btn-primary"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default KyudoTournamentSystem;