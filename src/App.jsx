import React, { useState, useReducer, useEffect, useRef, useCallback, useMemo } from 'react';
import { Lock, LogOut, RotateCcw, Copy, Check, QrCode, Maximize2, Filter, X, User, Camera, RefreshCw, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import QRCodeScanner from './components/QRCodeScanner';
import QualifiersView from './QualifiersView';
import AwardsView from './components/AwardsView';
import { tournamentsApi, applicantsApi, resultsApi, rankingApi, API_URL } from './utils/api';
import { 
  getLocalDateKey, 
  distanceKm, 
  normalizeTournamentFormData, 
  getStoredAttachments, 
  setStoredAttachments 
} from './utils/tournament';
import { 
  judgeNearFarCompetition, 
  calculateRanksWithTies,
  normalizeRank,
  getRankOrder,
  getRankIndex,
  getDivisionIdForArcher
} from './utils/competition';
import './index.css';

// Ensure API URL is always absolute
// const API_BASE_URL = 'https://alluring-perfection-production-f96d.up.railway.app/api';
// const API_URL = API_BASE_URL.startsWith('http') 
//   ? API_BASE_URL 
//   : `${window.location.origin}${API_BASE_URL.startsWith('/') ? '' : '/'}${API_BASE_URL}`;

// 射詰競射判定ロジック
// const judgeNearFarCompetition = (results) => {
//   if (results.length === 0) return results;

//   // 的中数でソート（降順）
//   const sorted = [...results].sort((a, b) => b.hitCount - a.hitCount);

//   // 全員の的中数を確認
//   const maxHits = sorted[0].hitCount;
//   const minHits = sorted[sorted.length - 1].hitCount;

//   // ケース1: 1位のみ全中（4本）、他が全て外れ（0本）
//   if (maxHits === 4 && minHits === 0 && sorted.some(r => r.hitCount === 4) && sorted.filter(r => r.hitCount === 0).length === sorted.length - 1) {
//     return results.map(r => ({
//       ...r,
//       isNearFarTarget: r.hitCount === 0,
//       reason: r.hitCount === 0 ? '全て外れたため遠近競射対象' : '全中のため遠近競射対象外',
//     }));
//   }

//   // ケース2: 複数人が全中または部分的中で、最後の矢で分かれた場合
//   // 最後の矢で外れた人のみ対象（全中した人は対象外）
//   const hasFullHit = results.some(r => r.hitCount === 4);
//   const hasLastArrowMiss = results.some(r => {
//     const archer = r.archer || r;
//     const results_arr = archer.results || [];
//     return !results_arr[3];
//   });

//   if (hasFullHit && hasLastArrowMiss) {
//     return results.map(r => {
//       const archer = r.archer || r;
//       const results_arr = archer.results || [];
//       return {
//         ...r,
//         isNearFarTarget: !results_arr[3] && r.hitCount < 4,
//         reason: 
//           r.hitCount === 4 ? '全中のため遠近競射対象外' :
//           !results_arr[3] ? '最後の矢で外れたため遠近競射対象' :
//           '遠近競射対象外',
//       };
//     });
//   }

//   // ケース3: 複数人が部分的中で順位が確定 → 遠近競射なし
//   return results.map(r => ({
//     ...r,
//     isNearFarTarget: false,
//     reason: '遠近競射なし',
//   }));
// };

// const getLocalDateKey = () => {
//   // local date like 2026-01-09
//   try {
//     return new Date().toLocaleDateString('sv-SE');
//   } catch {
//     const d = new Date();
//     const y = d.getFullYear();
//     const m = String(d.getMonth() + 1).padStart(2, '0');
//     const day = String(d.getDate()).padStart(2, '0');
//     return `${y}-${m}-${day}`;
//   }
// };

// const distanceKm = (lat1, lng1, lat2, lng2) => {
//   const toRad = (d) => (d * Math.PI) / 180;
//   const R = 6371;
//   const dLat = toRad(lat2 - lat1);
//   const dLng = toRad(lng2 - lng1);
//   const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
//   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
//   return R * c;
// };

// const normalizeTournamentFormData = (data, defaultDivisions, attachments) => {
//   const d = data || {};

//   return {
//     name: d.name ?? '',
//     datetime: d.datetime ?? '',
//     location: d.location ?? '',
//     venueAddress: d.venueAddress ?? '',
//     venueLat: d.venueLat ?? '',
//     venueLng: d.venueLng ?? '',
//     organizer: d.organizer ?? '',
//     coOrganizer: d.coOrganizer ?? '',
//     administrator: d.administrator ?? '',
//     purpose: d.purpose ?? '',
//     event: d.event ?? '',
//     type: d.type ?? '',
//     category: d.category ?? '',
//     description: d.description ?? '',
//     competitionMethod: d.competitionMethod ?? '',
//     award: d.award ?? '',
//     qualifications: d.qualifications ?? '',
//     applicableRules: d.applicableRules ?? '',
//     applicationMethod: d.applicationMethod ?? '',
//     remarks: d.remarks ?? '',
//     attachments: Array.isArray(attachments) ? attachments : [],
//     divisions: Array.isArray(d.divisions) ? d.divisions : (Array.isArray(defaultDivisions) ? defaultDivisions : []),
//     enableGenderSeparation: d.enableGenderSeparation ?? false,
//   };
// };

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
      const result = await tournamentsApi.getAll();
      
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
      setGeoStatus('? この端末は位置情報に対応していません');
      return;
    }
    setGeoStatus('?? 位置情報を取得中...');
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
            setGeoStatus('?? 会場の緯度/経度が登録されている大会がありません');
            return;
          }

          const nearest = candidates[0];
          setInputValue(nearest.t.id);
          setError('');
          setGeoStatus(`? 近い大会を自動選択しました（約${nearest.dist.toFixed(1)}km）`);
        } catch (e) {
          console.error(e);
          setGeoStatus('? 位置情報から大会の自動選択に失敗しました');
        }
      },
      (err) => {
        const msg = err?.message ? `? 位置情報の取得に失敗しました: ${err.message}` : '? 位置情報の取得に失敗しました';
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
              ?? 現在地から大会を自動選択
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

const RecordingView = ({ state, dispatch, stands }) => {
  const [selectedTournamentId, setSelectedTournamentId] = useState(() => localStorage.getItem('selectedTournamentId') || '');
  const [selectedDivision, setSelectedDivision] = useState(() => localStorage.getItem('recording_selectedDivision') || '');
  const [selectedStand, setSelectedStand] = useState(() => parseInt(localStorage.getItem('recording_selectedStand')) || 1);
  const [selectedRound, setSelectedRound] = useState(() => parseInt(localStorage.getItem('recording_selectedRound')) || 1); // 1: 1立ち目, 2: 2立ち目
  const [selectedGender, setSelectedGender] = useState(() => localStorage.getItem('recording_selectedGender') || 'all'); // 'all' | 'male' | 'female'
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
  useEffect(() => { localStorage.setItem('recording_selectedGender', selectedGender || 'all'); }, [selectedGender]);

  const tournament = state.tournament;
  const rankOrder = ['無指定', '五級', '四級', '三級', '弐級', '壱級', '初段', '弐段', '参段', '四段', '五段', '錬士五段', '錬士六段', '教士七段', '教士八段', '範士八段', '範士九段'];

  const normalizeRank = (rank) => {
    if (!rank) return '';
    return rank
      .replace('二段', '弐段')
      .replace('三段', '参段')
      .replace('二級', '弐級')
      .replace('一級', '壱級');
  };

  const getDivisionIdsForArcher = (archer, divisions) => {
    const rIdx = rankOrder.indexOf(normalizeRank(archer?.rank));
    const matchingDivisions = [];
    for (const d of (divisions || [])) {
      const minIdx = d?.minRank ? rankOrder.indexOf(normalizeRank(d.minRank)) : 0;
      const maxIdx = d?.maxRank ? rankOrder.indexOf(normalizeRank(d.maxRank)) : rankOrder.length - 1;
      if (rIdx >= minIdx && rIdx <= maxIdx) {
        matchingDivisions.push(d.id);
      }
    }
    return matchingDivisions.length > 0 ? matchingDivisions : ['unassigned'];
  };

  const getDivisionIdForArcher = (archer, divisions) => {
    const divisionIds = getDivisionIdsForArcher(archer, divisions);
    return divisionIds[0] || 'unassigned';
  };
  
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

        // 立ち順番号を付与
        const totalNeeded = tournament.arrowsRound1 + tournament.arrowsRound2;
        const defaultResults = {};
        for (let i = 1; i <= 6; i++) defaultResults[`stand${i}`] = Array(totalNeeded).fill(null);

        const archersWithOrder = sortedArchers.map((archer, index) => ({
          ...archer,
          standOrder: index + 1,
          division: getDivisionIdForArcher(archer, divisions),
          results: Object.assign({}, defaultResults, archer.results || {})
        }));

        setArchers(archersWithOrder);
        
        if (!selectedDivision && archersWithOrder.length > 0) {
          const firstArcherDivision = getDivisionIdForArcher(archersWithOrder[0], divisions);
          setSelectedDivision(firstArcherDivision);
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

  // 部門設定が変更されたら選手を再割り当て
  useEffect(() => {
    if (selectedTournamentId && archers.length > 0) {
      fetchAndSortArchers(true);
    }
  }, [divisions]);

  // リアルタイム同期(3秒ごとに他の端末の入力を反映)
  useEffect(() => {
    if (!selectedTournamentId) return;
    const interval = setInterval(() => {
      fetchAndSortArchers(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedTournamentId]);

  const filteredTournaments = state.registeredTournaments;
  const enableGenderSeparation = selectedTournament?.data?.enableGenderSeparation || false;

  const divisionArchers = archers.filter(a => {
    const archerDivisions = getDivisionIdsForArcher(a, divisions);
    if (!archerDivisions.includes(selectedDivision)) return false;
    if (!enableGenderSeparation) return true;
    if (selectedGender === 'all') return true;
    const g = (a.gender || 'male');
    if (selectedGender === 'male') return g === 'male';
    if (selectedGender === 'female') return g === 'female';
    return true;
  });

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
              {enableGenderSeparation && (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button onClick={() => setSelectedGender('all')} className={`btn ${selectedGender === 'all' ? 'btn-active' : ''}`} style={{ flex: 1 }}>全員</button>
                  <button onClick={() => setSelectedGender('male')} className={`btn ${selectedGender === 'male' ? 'btn-active' : ''}`} style={{ flex: 1 }}>男子</button>
                  <button onClick={() => setSelectedGender('female')} className={`btn ${selectedGender === 'female' ? 'btn-active' : ''}`} style={{ flex: 1 }}>女子</button>
                </div>
              )}
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
      setGeoStatus('? この端末は位置情報に対応していません');
      return;
    }
    setGeoStatus('?? 位置情報を取得中...');
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
            setGeoStatus('?? 会場の緯度/経度が登録されている大会がありません');
            return;
          }

          const nearest = candidates[0];
          setSelectedTournamentId(nearest.t.id);
          setGeoStatus(`? 近い大会を自動選択しました（約${nearest.dist.toFixed(1)}km）`);
        } catch (e) {
          console.error(e);
          setGeoStatus('? 位置情報から大会の自動選択に失敗しました');
        }
      },
      (err) => {
        const msg = err?.message ? `? 位置情報の取得に失敗しました: ${err.message}` : '? 位置情報の取得に失敗しました';
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
      setMessage('? データの取得に失敗しました');
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
      setMessage('? QRコードの読み込みに失敗しました');
    }
  };

  const openQRScanner = () => {
    if (!selectedTournamentId) {
      setMessage('? 大会を選択してください');
      return;
    }
    setShowQRScanner(true);
  };

  const handleCheckIn = async (scannedArcherId = null) => {
    if (!selectedTournamentId) {
      setMessage('? 大会を選択してください');
      return;
    }

    const archerId = (scannedArcherId || scannedQR).trim();
    if (!archerId) {
      setMessage('? 選手IDを入力するか、QRコードをスキャンしてください');
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
        setMessage('? 該当する選手が見つかりません');
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
          ? `? ${checkInResult.data.name}さんは既に受付済みです`
          : `? ${checkInResult.data.name}さんの受付が完了しました`;
        
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
        setMessage(`? ${checkInResult.message || '受付に失敗しました'}`);
      }
    } catch (error) {
      setMessage(`? エラーが発生しました: ${error.message}`);
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
            <p>? {selectedTournament.data?.name || '大会名不明'}</p>
            <p>? {formatTournamentDate(selectedTournament)}</p>
            {myApplicantData && (
              <p>? {Array.isArray(myApplicantData) ? '複数登録あり' : 
                `${myApplicantData.isStaff ? '役員' : '選手'}ID: ${myApplicantData.archerId}`}</p>
            )}
          </div>
        ) : (
          <div className="tournament-info">
            <p>? 大会を選択してください</p>
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
              ?? 現在地から大会を自動選択
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
                        ?? 自分のQRコードを表示
                      </button>
                    </>
                  )}
                  
                  {!showManualInput ? (
                    <button 
                      onClick={() => setShowManualInput(true)}
                      style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline', marginTop: '0.5rem' }}
                    >
                      ?? ID手動入力・スキャン(係員用)
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
                <div className={`message ${message.startsWith('?') ? 'message-success' : message.startsWith('?') ? 'message-error' : 'message-warning'}`} style={{ marginTop: '1rem' }}>
                  {message}
                </div>
              )}

              {showQRScanner && (
                <QRCodeScanner
                  onScanSuccess={handleQRCodeScanned}
                  onError={(msg) => setMessage('? ' + msg)}
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
                        
                        {/* 性別選択・更新機能 */}
                        <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#f8f9fa', borderRadius: '0.5rem' }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                            性別情報の設定・更新
                          </label>
                          <select 
                            value={currentQRCodeData.gender || 'male'} 
                            onChange={async (e) => {
                              const newGender = e.target.value;
                              try {
                                const response = await fetch(`${API_URL}/applicants/${currentQRCodeData.id}/gender`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ gender: newGender })
                                });
                                
                                if (response.ok) {
                                  setCurrentQRCodeData(prev => ({ ...prev, gender: newGender }));
                                  alert('性別情報を更新しました');
                                } else {
                                  alert('更新に失敗しました');
                                }
                              } catch (error) {
                                console.error('性別情報更新エラー:', error);
                                alert('更新中にエラーが発生しました');
                              }
                            }}
                            className="input"
                            style={{ width: '100%', marginBottom: '0.5rem' }}
                          >
                            <option value="male">男</option>
                            <option value="female">女</option>
                          </select>
                          <p className="text-sm text-gray-600">
                            現在の設定: {currentQRCodeData.gender === 'female' ? '女' : '男'}
                          </p>
                        </div>
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [shootOffType, setShootOffType] = useState(''); // 'shichuma' or 'enkin'
  const [selectedDivision, setSelectedDivision] = useState(''); // 部門選択用
  const [selectedGender, setSelectedGender] = useState(() => localStorage.getItem('ranking_selectedGender') || 'all'); // 'all' | 'male' | 'female'
  const [currentShichumaRound, setCurrentShichumaRound] = useState(1); // 現在の射数（1～4）
  const [shichumaResults, setShichumaResults] = useState({}); // {archerId: ['o', 'x', null, null]}
  const [eliminatedArchers, setEliminatedArchers] = useState(new Set()); // 脱落者ID
  const [eliminationRound, setEliminationRound] = useState({}); // {archerId: 脱落した射数}
  const [currentShootOffArchers, setCurrentShootOffArchers] = useState([]);
  const [eliminationOrder, setEliminationOrder] = useState([]);
  const [simultaneousEliminations, setSimultaneousEliminations] = useState([]);
  const [isShootOffActive, setIsShootOffActive] = useState(false);
  const [isSavingShichuma, setIsSavingShichuma] = useState(false); // 追加
  const [enkinResults, setEnkinResults] = useState({});
  const [enkinTargetRank, setEnkinTargetRank] = useState(null);
  const [showEnkinOption, setShowEnkinOption] = useState(false);
  const [remainingAfterFourArrows, setRemainingAfterFourArrows] = useState([]);
  const [enkinDefeated, setEnkinDefeated] = useState(new Set()); // 敗退した選手ID
  const [originalEnkinArchers, setOriginalEnkinArchers] = useState(new Set());
  const [enkinStartRank, setEnkinStartRank] = useState(2); // 運営側で選択可能な開始順位
  const [editingArrow, setEditingArrow] = useState(null); // {archerId, arrowIndex}
  const [shichumaFinalResults, setShichumaFinalResults] = useState(null); // 射詰競射の最終結果
  const [enkinFinalResults, setEnkinFinalResults] = useState(null); // 遠近競射の最終結果
  const [isLoadingResults, setIsLoadingResults] = useState(false); // 結果読み込み状態
  const [savedEnkinRanks, setSavedEnkinRanks] = useState(new Set()); // 保存済みの遠近競射枠
  const [skipShootOffFetchUntil, setSkipShootOffFetchUntil] = useState(0);
  const [ignoreServerFinalsUntil, setIgnoreServerFinalsUntil] = useState(0);
  const [suppressMergedDisplayUntil, setSuppressMergedDisplayUntil] = useState(0);
  const [useLocalOnlyFinals, setUseLocalOnlyFinals] = useState(false);

  const tournaments = state.registeredTournaments || [];
  const tournament = tournaments.find(t => t.id === selectedTournamentId) || null;

  // 部門設定
  const selectedTournament = state.registeredTournaments.find(t => t.id === selectedTournamentId);
  const localDefaultDivisions = [
    { id: 'lower', label: '級位~三段以下の部' },
    { id: 'middle', label: '四・五段の部' },
    { id: 'title', label: '称号者の部' }
  ];
  const divisions = (selectedTournament && selectedTournament.data && selectedTournament.data.divisions) ? selectedTournament.data.divisions : localDefaultDivisions;

  const enableGenderSeparation = selectedTournament?.data?.enableGenderSeparation || false;

  // 順位の正規化
  const normalizeRank = (rank) => {
    if (!rank) return '';
    return rank
      .replace('二段', '弐段')
      .replace('三段', '参段')
      .replace('二級', '弐級')
      .replace('一級', '壱級');
  };

  const rankOrder = ['無指定', '五級', '四級', '三級', '弐級', '壱級', '初段', '弐段', '参段', '四段', '五段', '錬士五段', '錬士六段', '教士七段', '教士八段', '範士八段', '範士九段'];

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

  // 部門ごとに選手を分類
  const getArchersByDivision = useCallback((archers) => {
    const groups = {};
    for (const d of divisions) groups[d.id] = { division: d, archers: [] };
    if (!groups.unassigned) groups.unassigned = { division: { id: 'unassigned', label: '未分類' }, archers: [] };

    for (const archer of archers) {
      const divId = getDivisionIdForArcher(archer, divisions);
      if (!groups[divId]) groups[divId] = { division: { id: divId, label: divId }, archers: [] };
      groups[divId].archers.push(archer);
    }

    const result = [];
    for (const key in groups) {
      const g = groups[key];
      if (g.archers.length > 0) {
        result.push({
          division: g.division,
          archers: g.archers
        });
      }
    }
    
    result.sort((a, b) => {
      const ai = divisions.findIndex(d => d.id === a.division.id);
      const bi = divisions.findIndex(d => d.id === b.division.id);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
    
    return result;
  }, [divisions, getDivisionIdForArcher]);

  // getTotalHitCountAllStands関数を定義
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

  // リアルタイム同期(3秒ごとに他の端末の入力を反映)
  useEffect(() => {
    if (!selectedTournamentId || isShootOffActive) return; // 射詰中は同期しない
    const interval = setInterval(() => {
      fetchArchers(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedTournamentId, isShootOffActive]); // 依存配列に追加

  const fetchArchers = async (background = false) => {
    if (!selectedTournamentId) {
      setArchers([]);
      return;
    }
    if (!background) setIsLoading(true);
    else setIsSyncing(true);
    
    try {
      const response = await fetch(`${API_URL}/applicants/${selectedTournamentId}`);
      const result = await response.json();
      if (result.success) {
        // 通過者ページを基準にして通過判定ルールを適用した選手のみを対象にする
        const checkedIn = (result.data || []).filter(a => a.isCheckedIn);
        
        // 通過判定ルールを適用
        const passRule = tournament?.data?.passRule || state.tournament.passRule || 'four_or_more';
        const passedArchers = checkedIn.filter(archer => {
          const hitCount = getTotalHitCountAllStands(archer);
          const totalArrows = (tournament?.data?.arrowsRound1 || state.tournament.arrowsRound1 || 0) + 
                           (tournament?.data?.arrowsRound2 || state.tournament.arrowsRound2 || 0);
          
          switch (passRule) {
            case 'all_four':
              return hitCount === totalArrows; // 全て的中（全矢的中）
            case 'four_or_more':
              return hitCount >= 4; // 4本以上的中
            case 'three_or_more':
              return hitCount >= 3; // 3本以上的中
            case 'two_or_more':
              return hitCount >= 2; // 2本以上的中
            default:
              return hitCount >= 3; // デフォルトは3本以上
          }
        });
        
        setArchers(passedArchers);
      } else {
        setArchers([]);
      }
    } catch (e) {
      console.error('RankingView fetch error', e);
      setArchers([]);
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (!useLocalOnlyFinals) {
      fetchArchers();
      fetchShootOffResults();
    } else {
      console.log('Server sync disabled: skipping initial fetch of shoot-off results');
    }
  }, [selectedTournamentId]);

  useEffect(() => { localStorage.setItem('ranking_selectedGender', selectedGender || 'all'); }, [selectedGender]);

  // 順位決定戦結果を取得
  // 全ての順位決定戦の結果を取得
  const fetchShootOffResults = async () => {
    if (!selectedTournamentId) return;
    if (useLocalOnlyFinals) {
      console.log('fetchShootOffResults skipped because useLocalOnlyFinals is enabled');
      return;
    }
    if (Date.now() < (skipShootOffFetchUntil || 0)) {
      console.log('fetchShootOffResults skipped due to recent reset');
      return;
    }
    
    setIsLoadingResults(true);
    try {
      const response = await fetch(`${API_URL}/ranking/shootoff/${selectedTournamentId}`);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          console.log('?? fetchShootOffResults - サーバーから取得したデータ:', {
            shichuma: result.data.shichuma,
            enkin: result.data.enkin?.results?.map(r => ({
              archerId: r.archerId,
              rank: r.rank,
              targetRank: r.targetRank
            }))
          });
          
          // 射詰結果のshootOffTypeを確認・補完
          if (result.data.shichuma && result.data.shichuma.results) {
            // サーバーから取得した射詰結果にshootOffTypeがない場合は補完
            const shichumaResultsWithShootOffType = {
              ...result.data.shichuma,
              results: result.data.shichuma.results.map(r => ({
                ...r,
                shootOffType: r.shootOffType || 'shichuma' // shootOffTypeがない場合は'shichuma'を設定
              }))
            };
            
            console.log('?? 射詰結果の詳細（補完後）:', shichumaResultsWithShootOffType.results.map(r => ({
              archerId: r.archerId,
              rank: r.rank,
              shootOffType: r.shootOffType,
              isWinner: r.isWinner
            })));
            
            setShichumaFinalResults(shichumaResultsWithShootOffType);
          } else {
            setShichumaFinalResults(result.data.shichuma);
          }
          setEnkinFinalResults(result.data.enkin);
          
          // 保存済みの遠近競射枠を取得
          const savedRanks = new Set();
          if (result.data.enkin && result.data.enkin.results) {
            result.data.enkin.results.forEach(r => {
              if (r.targetRank) {
                savedRanks.add(r.targetRank);
              }
            });
          }
          setSavedEnkinRanks(savedRanks);
        }
      } else {
        setShichumaFinalResults(null);
        setEnkinFinalResults(null);
        setSavedEnkinRanks(new Set());
      }
    } catch (error) {
      console.error('順位決定戦結果の取得エラー:', error);
      setShichumaFinalResults(null);
      setEnkinFinalResults(null);
      setSavedEnkinRanks(new Set());
    } finally {
      setIsLoadingResults(false);
    }
  };
  const fetchEnkinResults = async () => {
    if (!selectedTournamentId) return;
    if (useLocalOnlyFinals) {
      console.log('fetchEnkinResults skipped because useLocalOnlyFinals is enabled');
      return;
    }

    setIsLoadingResults(true);
    try {
      const response = await fetch(`${API_URL}/ranking/enkin/${selectedTournamentId}`);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setEnkinFinalResults(result.data);
        }
      } else {
        setEnkinFinalResults(null);
      }
    } catch (error) {
      console.error('遠近競射結果の取得エラー:', error);
      setEnkinFinalResults(null);
    } finally {
      setIsLoadingResults(false);
    }
  };

  // 結果取得を実行
  useEffect(() => {
    if (selectedTournamentId) {
      // fetchShichumaResults();  // fetchShootOffResultsで一括取得するためコメントアウト
      // fetchEnkinResults();      // fetchShootOffResultsで一括取得するためコメントアウト
      fetchShootOffResults();     // 射詰・遠近の両方を一括取得
    }
  }, [selectedTournamentId]);

  // デバッグ情報
  useEffect(() => {
    console.log('Debug info:', {
      selectedTournamentId,
      shichumaFinalResults,
      enkinFinalResults,
      isLoadingResults
    });
  }, [selectedTournamentId, shichumaFinalResults, enkinFinalResults, isLoadingResults]);

  const getTiedArchers = useCallback(() => {
    const rankGroups = {};
    archers.forEach(archer => {
      const hitCount = getTotalHitCountAllStands(archer);
      if (!rankGroups[hitCount]) {
        rankGroups[hitCount] = [];
      }
      rankGroups[hitCount].push(archer);
    });

    const awardRankLimit = tournament?.data?.awardRankLimit || 3;
    
    // 的中数の降順でソート
    const sortedGroups = Object.entries(rankGroups)
      .map(([hitCount, group]) => [parseInt(hitCount), group])
      .sort(([a], [b]) => b - a);
    
    const displayGroups = [];
    let currentRank = 1;
    
    for (const [hitCount, group] of sortedGroups) {
      // このグループの開始順位が表彰範囲内なら、グループ全体を対象にする
      if (currentRank <= awardRankLimit && group.length > 1) {
        displayGroups.push([hitCount, group]);
      } else if (currentRank > awardRankLimit && group.length > 1) {
        // 表彰範囲外だが同率の場合、そのグループは順位確定として扱う
        // ここではdisplayGroupsには追加しないが、categorizedGroupsで処理される
      } else if (currentRank > awardRankLimit && group.length === 1) {
        // 表彰範囲外で同率でない場合、順位確定として扱う
      }
      
      // 次のグループの開始順位を計算
      currentRank += group.length;
    }

    return displayGroups;
  }, [archers, tournament]);

  const saveShichumaResultToApi = async (archerId, arrowIndex, result) => {
    try {
      const response = await fetch(`${API_URL}/ranking/shichuma`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: selectedTournamentId,
          archerId,
          arrowIndex,
          result
        })
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn('射詰競射APIエンドポイントが未実装です');
          return; // ローカルのみで処理を続行
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // 更新後にデータを再取得(同期)
      fetchArchers(true);
    } catch (error) {
      console.error('射詰競射結果保存エラー:', error);
      if (error.message.includes('404')) {
        // 404エラーは通知しない（バックエンド未実装）
        return;
      }
      alert('射詰競射結果の保存に失敗しました: ' + error.message);
    }
  };

  // API経由で遠近競射結果を保存
  const saveEnkinResultToApi = async (archerId, distance, arrowType = 'normal') => {
    try {
      const response = await fetch(`${API_URL}/ranking/enkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: selectedTournamentId,
          archerId,
          rank: distance, // 的表面からの距離（mm）をrankとして送信
          arrowType // 'normal', 'saki', 'miss' など
        })
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn('遠近競射APIエンドポイントが未実装です');
          return; // ローカルのみで処理を続行
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // 更新後にデータを再取得(同期)
      fetchArchers(true);
    } catch (error) {
      console.error('遠近競射結果保存エラー:', error);
      if (error.message.includes('404')) {
        // 404エラーは通知しない（バックエンド未実装）
        return;
      }
      alert('遠近競射結果の保存に失敗しました: ' + error.message);
    }
  };

  const startShichumaShootOff = (tiedArchers) => {
    setShootOffType('shichuma');
    setIsShootOffActive(true);
    setCurrentShichumaRound(1);
    setShichumaResults({});
    setEliminatedArchers(new Set());
    setCurrentShootOffArchers(tiedArchers);
    setEliminationOrder([]);
    setSimultaneousEliminations([]);
    setOriginalEnkinArchers(new Set());
    setEliminationRound({});
  };

  const startEnkinShootOff = (tiedArchers, fromShichuma = false, targetRank = null, isNewFromShichuma = false) => {
    setShootOffType('enkin');
    setIsShootOffActive(true);
    setEnkinResults({});
    setCurrentShootOffArchers(tiedArchers);
    
    // 開始順位を設定
    if (targetRank !== null) {
      setEnkinTargetRank(targetRank);
    } else if (fromShichuma) {
      // 射詰競射からの遠近競射の場合、脱落順から次の順位を計算
      const nextRank = getNextEnkinTargetRank();
      setEnkinTargetRank(nextRank);
    } else {
      // 通常の遠近競射の場合
      setEnkinTargetRank(null);
    }
    
    if (fromShichuma && isNewFromShichuma) {
      // 射詰競射からの新規遠近競射選手
      setOriginalEnkinArchers(new Set());
    } else if (!fromShichuma) {
      // 元々の遠近競射選手
      setOriginalEnkinArchers(new Set(tiedArchers.map(a => a.archerId)));
    }
  };

  const handleShichumaShot = async (archerId, arrowIdx, result) => {
  // 1. 最新の結果を含めた状態を作成
  const updatedResults = { ...shichumaResults };
  const currentResults = updatedResults[archerId] || [];
  const newResults = [...currentResults];
  newResults[arrowIdx] = result;
  updatedResults[archerId] = newResults;
  
  // 2. ×になった場合は記録
  const updatedEliminated = new Set(eliminatedArchers);
  const updatedEliminationOrder = [...eliminationOrder];
  
  if (result === 'x') {
    updatedEliminated.add(archerId);
    
    const consecutiveHits = newResults.slice(0, arrowIdx).filter(r => r === 'o').length;
    
    updatedEliminationOrder.push({
      archerId: archerId,
      arrowIndex: arrowIdx + 1,
      consecutiveHits: consecutiveHits
    });
  }
  
  // 3. 状態を一括で更新
  setShichumaResults(updatedResults);
  setEliminatedArchers(updatedEliminated);
  setEliminationOrder(updatedEliminationOrder);
  
  if (result === 'x') {
    setEliminationRound(prev => ({
      ...prev,
      [archerId]: arrowIdx + 1
    }));
  }
  
  // APIに保存
  saveShichumaResultToApi(archerId, arrowIdx, result).catch(error => {
    console.error('射詰競射結果保存エラー:', error);
  });

  // 4. 全員の結果が入力されたかチェック
  const allInputComplete = currentShootOffArchers.every(archer => {
    const archerResults = updatedResults[archer.archerId] || [];
    
    if (updatedEliminated.has(archer.archerId)) {
      const elimInfo = updatedEliminationOrder.find(e => e.archerId === archer.archerId);
      if (!elimInfo) return false;
      // 脱落した本数までの結果が全て入力されているか
      for (let i = 0; i < elimInfo.arrowIndex; i++) {
        if (archerResults[i] === undefined) return false;
      }
      return true;
    } else {
      // 生存者は現在のラウンドまでの結果が必要
      return archerResults[arrowIdx] !== undefined;
    }
  });

  if (!allInputComplete) {
    return;
  }

  // 5. 1位候補（全○で脱落していない者）を探す
  const undefeatedArchers = currentShootOffArchers.filter(archer => {
    return !updatedEliminated.has(archer.archerId);
  });

  console.log('入力状況:', {
    round: arrowIdx + 1,
    total: currentShootOffArchers.length,
    eliminated: updatedEliminated.size,
    undefeated: undefeatedArchers.length
  });

  // === 射詰競射の進行状況をチェック ===
  const remainingCount = undefeatedArchers.length;
  const eliminatedCount = updatedEliminated.size;
  const totalCount = currentShootOffArchers.length;
  
  console.log('射詰進行状況:', {
    total: totalCount,
    remaining: remainingCount,
    eliminated: eliminatedCount,
    round: arrowIdx + 1
  });

  // === 順位決定のロジック ===
  if (remainingCount === 1) {
    // === 1位が決定した場合 ===
    const winner = undefeatedArchers[0];
    const winnerResults = updatedResults[winner.archerId] || [];
    const winnerConsecutiveHits = winnerResults.filter(r => r === 'o').length;
    
    console.log('1位決定:', winner.name);

    // 脱落者たちを脱落本数でグループ分け
    const eliminationGroups = {};
    updatedEliminationOrder.forEach(elimInfo => {
      const arrowNum = elimInfo.arrowIndex;
      if (!eliminationGroups[arrowNum]) {
        eliminationGroups[arrowNum] = [];
      }
      eliminationGroups[arrowNum].push(elimInfo.archerId);
    });

    console.log('脱落グループ:', eliminationGroups);

    // 同じ本数で脱落した者が複数いるかチェック（シンプルなロジック）
    const needsEnkin = [];
    Object.values(eliminationGroups).forEach(group => {
      if (group.length > 1) {
        // このグループは同点なので遠近競射で順位決定
        needsEnkin.push(...group);
      }
    });

    console.log('?? 遠近競射対象者ID:', needsEnkin);
    console.log('?? 遠近競射対象者:', needsEnkin.map(id => {
      const a = currentShootOffArchers.find(ar => ar.archerId === id);
      return a?.name || '不明';
    }));

    // === バックアップのシンプルなロジックを適用 ===
    // 最終順位を構築
    const finalEliminationOrder = [...updatedEliminationOrder];
    let currentRank = 2; // 1位は1なので2位から開始
    
    // 脱落順（本数が多い順）でグループを処理
    const sortedArrowNumbers = Object.keys(eliminationGroups)
      .map(Number)
      .sort((a, b) => b - a); // 降順（後に脱落した方が上位）

    sortedArrowNumbers.forEach(arrowNum => {
      const group = eliminationGroups[arrowNum];
      const groupSize = group.length;
      
      // このグループのメンバーに順位を割り当て
      group.forEach(memberId => {
        const elimInfo = finalEliminationOrder.find(e => e.archerId === memberId);
        if (elimInfo) {
          if (groupSize === 1) {
            // グループのメンバーが1人なら順位確定
            elimInfo.rank = currentRank;
          } else {
            // 複数人なら遠近で決定（仮の同順位）
            elimInfo.rank = currentRank;
          }
        }
      });
      currentRank += groupSize;
    });

    // 1位を追加
    finalEliminationOrder.push({ 
      archerId: winner.archerId, 
      rank: 1, 
      isWinner: true,
      consecutiveHits: winnerConsecutiveHits
    });

    setEliminationOrder(finalEliminationOrder);

    // === ここから修正：遠近不要ならすぐに保存、遠近必要なら表示のみ ===
    if (needsEnkin.length > 0) {
      // 遠近競射が必要：UI表示のみで、まだ保存しない
      const enkinArchers = currentShootOffArchers.filter(a => needsEnkin.includes(a.archerId));
      setRemainingAfterFourArrows(enkinArchers);
      setShowEnkinOption(true);
      setIsShootOffActive(true);
    } else {
      // 遠近不要：ここで最終結果を保存（一度だけ）
      console.log('?? 遠近競射なし - 射詰競射結果を保存');
      await saveFinalShichumaResults(finalEliminationOrder, updatedResults);
      setIsShootOffActive(false);
    }
    
    return;
  }
  
  // === 部分的順位決定のロジック（3人以上の場合） ===
  if (totalCount >= 3 && eliminatedCount >= 2) {
    // 3人以上で2人以上脱落した場合、残り1人になるまで続けるか、
    // または残り2人になった時点で新しい射詰ラウンドを開始
    if (remainingCount === 2) {
      console.log('残り2人 - 新しい射詰ラウンドへ');
      // 残り2人で新しい射詰を開始
      setCurrentShichumaRound(prev => prev + 1);
      return;
    }
  }

  // 7. まだ1位が決定していない場合
  // 次のラウンドへ進む
  if (undefeatedArchers.length >= 2 && arrowIdx < 3) {
    console.log('次のラウンドへ:', undefeatedArchers.length, '名が生存');
    setCurrentShichumaRound(prev => prev + 1);
  } else if (undefeatedArchers.length === 0) {
    // 全員脱落（ありえないが念のため）
    setIsShootOffActive(false);
  }
};

const handleStartEnkinFromShichuma = async () => {
  // 射詰競射の最終順位を構築
  const finalEliminationOrder = [...eliminationOrder];
  
  // 優勝者を追加
  const undefeatedArchers = currentShootOffArchers.filter(
    archer => !eliminatedArchers.has(archer.archerId)
  );
  
  if (undefeatedArchers.length === 1) {
    const winner = undefeatedArchers[0];
    const winnerResults = shichumaResults[winner.archerId] || [];
    const winnerConsecutiveHits = winnerResults.filter(r => r === 'o').length;
    
    finalEliminationOrder.push({
      archerId: winner.archerId,
      rank: 1,
      isWinner: true,
      consecutiveHits: winnerConsecutiveHits
    });
  }

  // 射詰競射の結果をAPIに保存
  await saveFinalShichumaResults(finalEliminationOrder, shichumaResults);

  // 遠近競射を開始
  const nextRank = getNextEnkinTargetRank();
  startEnkinShootOff(remainingAfterFourArrows, true, nextRank, true);
  setShowEnkinOption(false);
};

const getShichumaWinner = () => {
  if (Object.keys(shichumaResults).length === 0) return null;
  
  const remainingArchers = currentShootOffArchers.filter(
    archer => !eliminatedArchers.has(archer.archerId)
  );
  
  if (remainingArchers.length === 1) {
    const lastArcher = remainingArchers[0];
    const archerResults = shichumaResults[lastArcher.archerId] || [];
    
    const allArrowsCompleted = [0, 1, 2, 3].every(arrowIndex => 
      archerResults[arrowIndex] !== undefined
    );
    
    if (allArrowsCompleted) {
      return lastArcher;
    }
  }
  return null;
};

  const getShichumaFinalRanking = () => {
    const ranking = [];
    
    // ×になった選手を順位順に並べる
    eliminationOrder.forEach((eliminated, index) => {
      const archer = currentShootOffArchers.find(a => a.archerId === eliminated.archerId);
      if (archer) {
        const archerResults = shichumaResults[archer.archerId] || [];
        const consecutiveHits = eliminated.consecutiveHits !== undefined 
          ? eliminated.consecutiveHits 
          : archerResults.filter(r => r === 'o').length;
        
        // rankが設定されている場合はそれを使用、なければindex+1を使用
        const rank = eliminated.rank !== undefined ? eliminated.rank : index + 1;
          
        ranking.push({
          archer,
          rank: rank,
          eliminatedAt: eliminated.arrowIndex,
          type: 'eliminated',
          consecutiveHits
        });
      }
    });
    
    // 最後まで残った選手を最上位に
    const remainingArchers = currentShootOffArchers.filter(
      archer => !eliminatedArchers.has(archer.archerId)
    );
    
    remainingArchers.forEach((archer, index) => {
      const archerResults = shichumaResults[archer.archerId] || [];
      const consecutiveHits = archerResults.filter(r => r === 'o').length;
      
      // eliminationOrderからwinnerのrankを取得
      const winnerInfo = eliminationOrder.find(e => e.archerId === archer.archerId && e.isWinner);
      const rank = winnerInfo ? winnerInfo.rank : 1; // デフォルトは1位
      
      ranking.push({
        archer,
        rank: rank,
        eliminatedAt: null,
        type: 'survivor',
        consecutiveHits
      });
    });
    
    return ranking.sort((a, b) => a.rank - b.rank);
  };

  // 修正モードに入る
  const handleEditShichumaShot = (archerId, arrowIdx) => {
    setEditingArrow({ archerId, arrowIndex: arrowIdx });
  };

  // 修正をキャンセル
  const handleCancelEditShichuma = () => {
    setEditingArrow(null);
  };

  // 修正を確定
  const handleConfirmEditShichuma = (archerId, arrowIdx, newResult) => {
    const updatedResults = { ...shichumaResults };
    const currentResults = updatedResults[archerId] || [];
    const newResults = [...currentResults];
    
    const oldResult = newResults[arrowIdx];
    newResults[arrowIdx] = newResult;
    updatedResults[archerId] = newResults;
    
    // 脱落者リストと脱落順の再計算
    const updatedEliminated = new Set();
    const updatedEliminationOrder = [];
    
    currentShootOffArchers.forEach(archer => {
      const archerResults = updatedResults[archer.archerId] || [];
      const firstMissIndex = archerResults.findIndex(r => r === 'x');
      
      if (firstMissIndex !== -1) {
        updatedEliminated.add(archer.archerId);
        const consecutiveHits = archerResults.slice(0, firstMissIndex).filter(r => r === 'o').length;
        updatedEliminationOrder.push({
          archerId: archer.archerId,
          arrowIndex: firstMissIndex + 1,
          consecutiveHits: consecutiveHits
        });
      }
    });
    
    setShichumaResults(updatedResults);
    setEliminatedArchers(updatedEliminated);
    setEliminationOrder(updatedEliminationOrder);
    setEditingArrow(null);
    
    saveShichumaResultToApi(archerId, arrowIdx, newResult).catch(error => {
      console.error('射詰競射結果修正エラー:', error);
    });
    
    console.log(`?? Shichuma Result Edited: ${archerId} arrow${arrowIdx} changed from ${oldResult} to ${newResult}`);
  };

  // 全員の記録入力が完了したかチェック
  const isAllResultsEntered = () => {
    return currentShootOffArchers.every(archer => {
      const archerResults = shichumaResults[archer.archerId] || [];
      // 退場した選手は退場した時点までの結果が入力されているかチェック
      if (eliminatedArchers.has(archer.archerId)) {
        const eliminatedInfo = eliminationOrder.find(e => e.archerId === archer.archerId);
        if (eliminatedInfo) {
          // 退場した本目までの結果がすべて入力されているかチェック
          for (let i = 0; i <= eliminatedInfo.arrowIndex - 1; i++) {
            if (archerResults[i] === undefined) return false;
          }
          return true;
        }
        return false;
      } else {
        // 生存者は現在のラウンドまでの結果が入力されているかチェック
        return Array.from({length: currentShichumaRound}, (_, i) => 
          archerResults[i] !== undefined
        ).every(result => result);
      }
    });
  };

  // 射詰競射が完了したかチェック
  const isShichumaCompleted = () => {
    // 全員の結果が入力されていない場合は完了しない
    if (!isAllResultsEntered()) return false;
    
    // 以下のいずれかの場合に完了とみなす
    return (
      eliminationOrder.length === currentShootOffArchers.length - 1 || // 全員退場済み（1名残り）
      currentShootOffArchers.every(archer => eliminatedArchers.has(archer.archerId)) || // 全員退場
      (isAllResultsEntered() && currentShootOffArchers.filter(archer => !eliminatedArchers.has(archer.archerId)).length > 0) // 4本終了で生存者あり
    );
  };

  const tiedGroups = getTiedArchers();

  // ===== getAllTiedGroups 関数を追加 =====
const getAllTiedGroups = useCallback(() => {
  const rankGroups = {};
  const awardRankLimit = tournament?.data?.awardRankLimit || 3; // サーバーから取得
  
  archers.forEach(archer => {
    if (enableGenderSeparation && selectedGender !== 'all') {
      const g = (archer.gender || 'male');
      if (selectedGender === 'male' && g !== 'male') return;
      if (selectedGender === 'female' && g !== 'female') return;
    }
    const hitCount = getTotalHitCountAllStands(archer);
    if (!rankGroups[hitCount]) {
      rankGroups[hitCount] = [];
    }
    rankGroups[hitCount].push(archer);
  });

  // 的中数の降順でソート
  const sortedGroups = Object.entries(rankGroups)
    .map(([hitCount, group]) => [parseInt(hitCount), group])
    .sort(([a], [b]) => b - a);
  
  // 表彰範囲内のグループのみをフィルタリング（同率は全員含む）
  const displayGroups = [];
  let currentRank = 1;
  let remainingSlots = awardRankLimit;
  
  for (const [hitCount, group] of sortedGroups) {
    const isTied = group.length > 1;
    
    if (isTied) {
      // 同率グループは表彰枠を超えても全員を表示
      displayGroups.push([hitCount, group]);
      remainingSlots -= group.length;
    } else {
      // 同率でない場合
      if (remainingSlots > 0) {
        displayGroups.push([hitCount, group]);
        remainingSlots -= group.length;
      } else {
        // 表彰枠がない場合は終了
        break;
      }
    }
    
    // 次のグループの開始順位を計算
    currentRank += group.length;
  }
  
  console.log('?? getAllTiedGroups:', {
    totalArchers: archers.length,
    awardRankLimit,
    filteredGroups: displayGroups.length,
    groups: displayGroups.map(([hits, group]) => ({
      hitCount: hits,
      count: group.length,
      isTied: group.length > 1
    }))
  });
  
  return displayGroups;
}, [archers, getTotalHitCountAllStands, tournament?.data?.awardRankLimit, selectedGender, enableGenderSeparation]);

  // ===== categorizedGroups を部門対応に修正 =====
const categorizedGroups = useMemo(() => {
  // 部門ごとの初期化
  const divisionsData = {};
  divisions.forEach(div => {
    divisionsData[div.id] = {
      division: div,
      izume: [],
      enkin: [],
      confirmed: []
    };
  });
  
  const allGroups = getAllTiedGroups();
  const awardRankLimit = tournament?.data?.awardRankLimit || 3;
  
  console.log('?? categorizedGroups processing (by division):', allGroups.length, 'groups', 'awardRankLimit:', awardRankLimit);
  
  // 各部門ごとに順位計算を行う
  divisions.forEach(div => {
    // この部門の選手のみを抽出
    const divisionArchers = archers.filter(archer => {
      if (getDivisionIdForArcher(archer, divisions) !== div.id) return false;
      if (!enableGenderSeparation) return true;
      if (selectedGender === 'all') return true;
      const g = (archer.gender || 'male');
      if (selectedGender === 'male') return g === 'male';
      if (selectedGender === 'female') return g === 'female';
      return true;
    });
    
    // 部門内での的中数でグループ化
    const divisionRankGroups = {};
    divisionArchers.forEach(archer => {
      const hitCount = getTotalHitCountAllStands(archer);
      if (!divisionRankGroups[hitCount]) {
        divisionRankGroups[hitCount] = [];
      }
      divisionRankGroups[hitCount].push(archer);
    });

    // 的中数でソートしてグループ化
    const sortedDivisionGroups = Object.entries(divisionRankGroups)
      .map(([hitCount, group]) => [parseInt(hitCount), group])
      .sort(([a], [b]) => b - a);

    // 部門内での順位計算
    let currentDivisionRank = 1;
    
    sortedDivisionGroups.forEach(([hitCount, group]) => {
      const isTied = group.length > 1;
      const isFirstPlace = currentDivisionRank === 1;
      const isInAwardRange = currentDivisionRank <= awardRankLimit;
      
      console.log(`  ${div.label} Group: ${hitCount}本, ${group.length}名, rank=${currentDivisionRank}, tied=${isTied}, inAwardRange=${isInAwardRange}`);
      
      if (isTied) {
        if (isFirstPlace) {
          console.log(`    → 射詰競射対象 (${div.label})`);
          divisionsData[div.id].izume.push({ hitCount, group, rank: currentDivisionRank });
        } else if (isInAwardRange) {
          console.log(`    → 遠近競射対象（入賞圏内） (${div.label})`);
          divisionsData[div.id].enkin.push({ hitCount, group, rank: currentDivisionRank });
        } else {
          // 表彰圏外の同率は遠近競射の対象外とし、順位確定として扱う
          console.log(`    → 表彰圏外の同率（順位確定扱い） (${div.label})`);
          divisionsData[div.id].confirmed.push({ hitCount, group, rank: currentDivisionRank });
        }
      } else {
        console.log(`    → 順位確定 (${div.label})`);
        divisionsData[div.id].confirmed.push({ hitCount, group, rank: currentDivisionRank });
      }
      
      currentDivisionRank += group.length;
    });
  });
  
  // 部門順を維持して配列に変換
  const result = [];
  divisions.forEach(div => {
    if (divisionsData[div.id] && (
      divisionsData[div.id].izume.length > 0 || 
      divisionsData[div.id].enkin.length > 0 || 
      divisionsData[div.id].confirmed.length > 0
    )) {
      result.push(divisionsData[div.id]);
    }
  });
  
  console.log('? Final result (by division):', result.map(d => ({
    division: d.division.label,
    izume: d.izume.length,
    enkin: d.enkin.length,
    confirmed: d.confirmed.length
  })));
  
  return result;
}, [archers, getTotalHitCountAllStands, tournament?.data?.awardRankLimit, divisions, getDivisionIdForArcher, selectedGender, enableGenderSeparation]);

  // 遠近競射の順位計算
  const calculateEnkinRanking = () => {
    // 開始順位を取得（射詰からの遠近競射か、手動で設定された順位か）
    const startRank = enkinTargetRank !== null ? enkinTargetRank : getNextEnkinTargetRank();
    // ... (以下は変更なし)
    
    return currentShootOffArchers.map(archer => {
      const result = enkinResults[archer.archerId] || {};
      return {
        archerId: archer.archerId,
        rank: parseInt(result.rank) || startRank + currentShootOffArchers.length - 1, // 入力された順位、なければ最下位
        arrowType: result.arrowType || 'normal',
        isTied: false
      };
    }).sort((a, b) => {
      // 順位の昇順でソート
      return a.rank - b.rank;
    });
  };

  // 遠近競射結果処理
  const handleEnkinResult = (archerId, rank, arrowType = 'normal') => {
    setEnkinResults(prev => ({
      ...prev,
      [archerId]: { rank, arrowType }
    }));
    
    // APIにはrankとして送信（distanceの代わり）
    saveEnkinResultToApi(archerId, rank, arrowType).catch(error => {
      console.error('遠近競射結果保存エラー:', error);
      alert('遠近競射結果の保存に失敗しました: ' + error.message);
    });
  };

  // 遠近競射タイトル取得
  const getEnkinTitle = () => {
    if (enkinTargetRank !== null) {
      // 射詰競射からの遠近競射の場合
      // 表彰範囲外かチェック
      const awardRankLimit = tournament?.data?.awardRankLimit || 3;
      const willHaveDefeated = (enkinTargetRank + currentShootOffArchers.length - 1) > awardRankLimit;
      
      if (willHaveDefeated) {
        // 敗退者を含む場合（表彰範囲外）→ 単一順位表示
        return `${enkinTargetRank}位決定戦（遠近競射）`;
      } else if (currentShootOffArchers.length > 1) {
        // 表彰範囲内で複数名の場合 → 範囲表示
        const endRank = enkinTargetRank + currentShootOffArchers.length - 1;
        return `${enkinTargetRank}位～${endRank}位決定戦（遠近競射）`;
      } else {
        // 1名の場合 → 単一順位表示
        return `${enkinTargetRank}位決定戦（遠近競射）`;
      }
    }
    return '遠近競射';
  };

  // 遠近競射の選択肢生成ロジック修正
  // 射詰競射からの遠近競射の場合、enkinStartRankを使う必要がある
  const getEnkinRankOptions = () => {
    const startRank = enkinTargetRank !== null ? enkinTargetRank : enkinStartRank;
    const awardRankLimit = tournament?.data?.awardRankLimit || 3;
    const options = [];
    
    console.log('?? getEnkinRankOptions:', {
      startRank,
      awardRankLimit,
      enkinTargetRank,
      currentShootOffArchers: currentShootOffArchers.length
    });
    
    // 射詰競射からの遠近競射の場合
    if (enkinTargetRank !== null) {
      const endRank = startRank + currentShootOffArchers.length - 1;
      
      if (endRank <= awardRankLimit) {
        // 全員が表彰範囲内の場合：連続した順位を生成
        for (let i = 0; i < currentShootOffArchers.length; i++) {
          options.push(startRank + i);
        }
      } else if (startRank <= awardRankLimit) {
        // 開始順位は表彰範囲内だが、終了順位は表彰範囲外の場合
        // 表彰範囲内の最後の順位まで生成し、残りは敗退
        for (let i = startRank; i <= awardRankLimit; i++) {
          options.push(i);
        }
        // 表彰範囲外の選手にも順位を生成（表彰枠外の同率グループ対応）
        for (let i = awardRankLimit + 1; i <= endRank; i++) {
          options.push(i);
        }
      } else {
        // 開始順位が表彰範囲外の場合：連続した順位を全員生成
        for (let i = 0; i < currentShootOffArchers.length; i++) {
          options.push(startRank + i);
        }
      }
    } else {
      // 通常の遠近競射の場合はその枠に合わせて連続した順位を生成
      const endRank = startRank + currentShootOffArchers.length - 1;
      if (endRank <= awardRankLimit) {
        // 全員が表彰範囲内：連続した順位を生成
        for (let i = 0; i < currentShootOffArchers.length; i++) {
          options.push(startRank + i);
        }
      } else {
        // 表彰範囲を超える場合：表彰範囲内まで生成
        for (let i = startRank; i <= awardRankLimit; i++) {
          options.push(i);
        }
        // 表彰範囲外の選手にも順位を生成
        for (let i = awardRankLimit + 1; i <= endRank; i++) {
          options.push(i);
        }
      }
    }
    
    console.log('?? Generated options:', options);
    return options;
  };

  // 敗退状態を切り替える関数
  const toggleEnkinDefeated = (archerId) => {
    setEnkinDefeated(prev => {
      const newSet = new Set(prev);
      if (newSet.has(archerId)) {
        newSet.delete(archerId);
      } else {
        newSet.add(archerId);
      }
      return newSet;
    });
  };

  // 次の遠近競射対象順位を取得
  const getNextEnkinTargetRank = () => {
    console.log('?? getNextEnkinTargetRank - eliminationOrder:', eliminationOrder.map(e => ({ name: e.name, rank: e.rank })));
    
    if (eliminationOrder.length > 0) {
      // 射詰競射で確定した順位を除いた、次の空き順位を計算
      const usedRanks = new Set();
      const enkinCandidates = new Set();
      
      // eliminationOrderから設定済みのrankを収集
      eliminationOrder.forEach(e => {
        if (e.rank !== undefined && e.rank !== null) {
          usedRanks.add(e.rank);
          
          // 同じrankを持つ選手が複数いる場合、そのrankは遠近競射対象
          const sameRankCount = eliminationOrder.filter(other => other.rank === e.rank).length;
          if (sameRankCount > 1) {
            enkinCandidates.add(e.rank);
          }
        }
      });
      
      console.log('?? usedRanks:', Array.from(usedRanks));
      console.log('?? enkinCandidates:', Array.from(enkinCandidates));
      
      // 遠近競射対象のrankがある場合、そのrankを返す
      if (enkinCandidates.size > 0) {
        const targetRank = Math.min(...Array.from(enkinCandidates));
        console.log('?? getNextEnkinTargetRank: 遠近競射対象のrankを返す:', targetRank);
        return targetRank;
      }
      
      // 1位から順に空き順位を探す
      let nextRank = 1;
      while (usedRanks.has(nextRank)) {
        nextRank++;
      }
      
      console.log('?? getNextEnkinTargetRank:', {
        eliminationOrder: eliminationOrder.map(e => ({ name: e.name, rank: e.rank })),
        usedRanks: Array.from(usedRanks),
        nextRank: nextRank
      });
      
      return nextRank;
    }
    console.log('?? getNextEnkinTargetRank: eliminationOrderが空なのでデフォルトの2を返す');
    return 2; // デフォルトは2位から
  };

  // 遠近競射オプションキャンセル
  const handleCancelEnkinOption = () => {
    setShowEnkinOption(false);
    setRemainingAfterFourArrows([]);
  };

  // 射詰競射の最終結果をAPIに保存する関数
  const saveFinalShichumaResults = async (finalRanking, allResults) => {
    if (isSavingShichuma) return; // 二重実行防止
    
    console.log('?? saveFinalShichumaResults called with:', {
      finalRanking: finalRanking,
      allResults: allResults
    });
    
    setIsSavingShichuma(true);
    try {
      const shichumaFinalData = finalRanking.map(rankInfo => {
        // 選手の部門IDを取得
        const archer = currentShootOffArchers.find(a => a.archerId === rankInfo.archerId);
        const divisionId = archer ? getDivisionIdForArcher(archer, divisions) : 'unassigned';
        
        return {
          archerId: rankInfo.archerId,
          rank: rankInfo.rank,
          eliminatedAt: rankInfo.eliminatedAt,
          consecutiveHits: rankInfo.consecutiveHits,
          results: allResults[rankInfo.archerId] || [],
          isWinner: rankInfo.isWinner || false,
          shootOffType: 'shichuma',
          divisionId: divisionId // ← 追加
        };
      });
      
      console.log('?? shichumaFinalData to save:', shichumaFinalData);
      console.log('?? 保存する各選手のshootOffType:', shichumaFinalData.map(d => ({
        archerId: d.archerId,
        rank: d.rank,
        shootOffType: d.shootOffType,
        isWinner: d.isWinner,
        divisionId: d.divisionId
      })));


      const response = await fetch(`${API_URL}/ranking/shichuma/final`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: selectedTournamentId,
          shootOffType: 'shichuma',
          results: shichumaFinalData
        })
      });
      
      if (!response.ok) {
        throw new Error('API保存に失敗しました');
      }
      
      const result = await response.json();
      console.log('射詰競射結果をサーバーに保存しました:', result);
      
      // 即座にローカル状態を更新（遠近競射と同じパターン）
      setShichumaFinalResults(prev => {
        // 既存の射詰競射結果を保持
        const existingShichumaResults = prev?.results || [];
        
        console.log('?? 既存射詰結果:', existingShichumaResults.map(r => ({ 
          archerId: r.archerId, 
          rank: r.rank,
          divisionId: r.divisionId
        })));
        console.log('?? 新規射詰結果:', shichumaFinalData.map(r => ({ 
          archerId: r.archerId, 
          rank: r.rank,
          divisionId: r.divisionId
        })));
        
        // 同じdivisionIdの結果を上書き（他部門は保持）
        const filteredResults = existingShichumaResults.filter(r => {
          // 今回保存する選手と同じdivisionIdかチェック
          const sameDivision = shichumaFinalData.some(s => s.divisionId === r.divisionId);
          
          // 同じ部門の場合は除外（上書き）
          if (sameDivision) {
            return false;
          }
          // 異なる部門の結果は保持
          return true;
        });
        
        // 新しい結果を追加
        const mergedResults = [...filteredResults, ...shichumaFinalData];
        
        console.log('?? 統合後射詰結果:', mergedResults.map(r => ({ 
          archerId: r.archerId, 
          rank: r.rank,
          divisionId: r.divisionId
        })));
        
        return {
          completedAt: new Date().toISOString(),
          results: mergedResults
        };
      });
      
      // ユーザーに通知
      alert('射詰競射の結果を保存しました');
      
    } catch (error) {
      console.error('射詰競射結果保存エラー:', error);
      alert('射詰競射結果の保存に失敗しました: ' + error.message);
    } finally {
      setIsSavingShichuma(false);
    }
  };

  // 遠近競射完了時に最終順位を保存する関数（各枠ごとに保存）
  const saveFinalEnkinResults = async (finalRanking, targetRank = null) => {
    try {
      const enkinFinalData = finalRanking.map(rankInfo => {
        // 選手の部門IDを取得
        const archer = currentShootOffArchers.find(a => a.archerId === rankInfo.archerId);
        const divisionId = archer ? getDivisionIdForArcher(archer, divisions) : 'unassigned';
        
        return {
          archerId: rankInfo.archerId,
          rank: rankInfo.rank,
          arrowType: rankInfo.arrowType || 'normal',
          isDefeated: enkinDefeated.has(rankInfo.archerId),
          targetRank: targetRank,
          divisionId: divisionId // ← 追加
        };
      });
      
      console.log('?? 保存する遠近競射データ:', {
        targetRank,
        enkinFinalData: enkinFinalData.map(d => ({
          archerId: d.archerId,
          name: currentShootOffArchers.find(a => a.archerId === d.archerId)?.name,
          rank: d.rank,
          targetRank: d.targetRank
        }))
      });

      const response = await fetch(`${API_URL}/ranking/enkin/final`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: selectedTournamentId,
          shootOffType: 'enkin',
          targetRank: targetRank,
          results: enkinFinalData
        })
      });
      
      if (!response.ok) {
        throw new Error('API保存に失敗しました');
      }
      
      const result = await response.json();
      console.log('? 遠近競射結果をサーバーに保存しました:', result);
      console.log('?? サーバーから返ってきたデータ:', result.data);
      
      // 保存成功後にその枠を保存済みとして記録
      if (targetRank) {
        setSavedEnkinRanks(prev => new Set([...prev, targetRank]));
      }
      
      // 即座にローカル状態を更新（射詰競射の結果を保持）
      setEnkinFinalResults(prev => {
        // 既存の遠近競射結果を保持
        const existingEnkinResults = prev?.results || [];
        
        // 射詰→遠近の選手を特定（過去に射詰→遠近として保存されたすべての選手）
        const shichumaToEnkinArcherIds = new Set();
        if (shichumaFinalResults?.results) {
          // 射詰結果に存在し、かつ遠近結果にも存在する選手を射詰→遠近と判定
          shichumaFinalResults.results.forEach(sr => {
            const existsInEnkin = existingEnkinResults.some(er => er.archerId === sr.archerId);
            if (existsInEnkin) {
              shichumaToEnkinArcherIds.add(sr.archerId);
            }
          });
        }
        
        console.log('?? 射詰→遠近選手ID:', Array.from(shichumaToEnkinArcherIds));
        console.log('?? 現在保存データ:', enkinFinalData.map(d => ({ id: d.archerId, rank: d.rank })));
        
        // 同じtargetRankとdivisionIdの組み合わせの結果を上書き（上書き保存を許可）
        // ただし、射詰→遠近の選手は保持する（他のtargetRankで保存されている可能性があるため）
        const filteredResults = existingEnkinResults.filter(r => {
          // 今回保存する選手と同じdivisionIdかチェック
          const sameDivision = enkinFinalData.some(e => e.divisionId === r.divisionId);
          
          // 射詰→遠近の選手でない場合は、同じdivisionIdかつ同じtargetRankなら除外（上書き）
          if (!shichumaToEnkinArcherIds.has(r.archerId) && sameDivision) {
            return r.targetRank !== targetRank;
          }
          // 射詰→遠近の選手の場合は、今回保存する選手以外は保持
          return !enkinFinalData.some(e => e.archerId === r.archerId);
        });
        
        console.log('?? filteredResults (targetRankで除外後):', filteredResults.map(r => ({
          archerId: r.archerId,
          rank: r.rank,
          targetRank: r.targetRank
        })));
        
        // 新しい結果を追加
        const mergedResults = [...filteredResults, ...enkinFinalData];
        
        console.log('? mergedResults (新しい結果追加後):', mergedResults.map(r => ({
          archerId: r.archerId,
          rank: r.rank,
          targetRank: r.targetRank
        })));
        
        return {
          completedAt: prev?.completedAt || new Date().toISOString(),
          results: mergedResults
        };
      });
      
      // ユーザーに通知
      alert(`${targetRank ? `${targetRank}位決定戦` : '遠近競射'}の結果を保存しました`);
      
      // 即時反映：他端末でもすぐ見れるように
      await fetchShootOffResults();
      console.log('? ローカル状態更新完了 - fetchShootOffResultsは実行');
      
    } catch (error) {
      console.error('遠近競射結果保存エラー:', error);
      alert('遠近競射結果の保存に失敗しました: ' + error.message);
    }
  };

  // === 統合結果を作成する関数（射詰のすべてのシナリオに対応） ===
  const getMergedFinalResults = useCallback(() => {
    const mergedResults = [];
    // processedArchersを削除 - 部門ごとに独立して管理するため

    console.log('?? 統合結果作成開始（射詰全対応）');
    console.log('?? 入力データ:', {
      shichumaResults: shichumaFinalResults?.results?.length || 0,
      enkinResults: enkinFinalResults?.results?.length || 0,
      archersCount: archers.length
    });

    // 射詰結果の詳細をログ
    if (shichumaFinalResults?.results) {
      console.log('?? 射詰結果詳細:');
      shichumaFinalResults.results.forEach(result => {
        const archer = archers.find(a => a.archerId === result.archerId);
        const divisionId = archer ? getDivisionIdForArcher(archer, divisions) : '不明';
        console.log(`  ${result.archerId}: ${archer?.name || '不明'} -> 部門: ${divisionId}, 順位: ${result.rank}`);
      });
    }

    // 選手を部門ごとにグループ化
    const archersByDivision = {};
    archers.forEach(archer => {
      const divisionId = getDivisionIdForArcher(archer, divisions);
      if (!archersByDivision[divisionId]) {
        archersByDivision[divisionId] = [];
      }
      archersByDivision[divisionId].push(archer);
    });

    // 部門ごとに結果を処理
    Object.keys(archersByDivision).forEach(divisionId => {
      const divisionArchers = archersByDivision[divisionId];
      const divisionUsedRanks = new Set(); // 部門ごとの順位管理
      const divisionProcessedArchers = new Set(); // 部門ごとの選手管理
      
      console.log(`??? 部門 ${divisionId} の結果処理開始 (${divisionArchers.length}名)`);
      console.log(`?? 部門 ${divisionId} の選手:`, divisionArchers.map(a => ({ name: a.name, id: a.archerId })));

      // 遠近競射の結果を後から処理（射詰で決定していない選手のみ）
      if (enkinFinalResults && enkinFinalResults.results) {
        const divisionEnkinResults = enkinFinalResults.results.filter(result => {
          // 部門IDが保存されている場合はそれを優先
          if (result.divisionId) {
            return result.divisionId === divisionId;
          }
          // 部門IDがない場合は従来通りarcherIdで照合（後方互換性）
          return divisionArchers.some(archer => archer.archerId === result.archerId);
        });
        
        console.log(`  遠近競射結果: ${divisionEnkinResults.length}件`);
        console.log(`  ?? 部門 ${divisionId} の遠近競射選手:`, divisionEnkinResults.map(r => ({ 
          name: divisionArchers.find(a => a.archerId === r.archerId)?.name, 
          rank: r.rank 
        })));
        
        // 射詰競射の結果を先に処理（この部門の選手のみ）
        if (shichumaFinalResults && shichumaFinalResults.results) {
          const divisionShichumaResults = shichumaFinalResults.results.filter(result => {
            // 部門IDが保存されている場合はそれを優先
            if (result.divisionId) {
              return result.divisionId === divisionId;
            }
            // 部門IDがない場合は従来通りarcherIdで照合（後方互換性）
            return divisionArchers.some(archer => archer.archerId === result.archerId);
          });
          
          console.log(`  ?? 射詰競射結果: ${divisionShichumaResults.length}件`);
          console.log(`  ?? 部門 ${divisionId} の射詰競射選手:`, divisionShichumaResults.map(r => ({ 
            name: divisionArchers.find(a => a.archerId === r.archerId)?.name, 
            rank: r.rank 
          })));
          console.log(`  ?? 射詰結果詳細:`, divisionShichumaResults.map(r => ({
            name: divisionArchers.find(a => a.archerId === r.archerId)?.name,
            rank: r.rank,
            shootOffType: r.shootOffType,
            isWinner: r.isWinner
          })));
          
          divisionShichumaResults
            .sort((a, b) => a.rank - b.rank)
            .forEach(result => {
              const archer = divisionArchers.find(a => a.archerId === result.archerId);
              if (!archer) return;

              const finalRank = result.rank;
              
              // 射詰→遠近の選手かチェック（この部門内でのみチェック）
              const isFromShichumaToEnkin = divisionEnkinResults.some(e => e.archerId === result.archerId);
              console.log(`    ?? 射詰→遠近チェック: ${archer.name} -> ${isFromShichumaToEnkin ? '遠近あり' : '遠近なし'}`);
              
              // 射詰→遠近の選手はスキップ（遠近の結果を優先）
              if (isFromShichumaToEnkin) {
                console.log(`    スキップ: ${archer.name} (射詰→遠近で遠近の結果を優先)`);
                return;
              }
              
              // 重複チェック（選手IDと順位の両方をチェック）
              if (divisionProcessedArchers.has(result.archerId)) {
                console.warn(`    選手重複: ${archer.name} (ID: ${result.archerId}) - 射詰競射`);
                return; // 同じ選手はスキップ
              }
              
              // 射詰で確定した順位（1位など）は遠近競射の結果があっても射詰を優先
              if (divisionUsedRanks.has(finalRank)) {
                console.warn(`    ?? 順位重複: ${finalRank}位 (${archer.name}) - 射詰競射`);
                // 1位など射詰で確定した重要な順位は射詰を優先
                if (finalRank === 1 || result.isWinner) {
                  console.log(`    優先: ${archer.name} (射詰で${finalRank}位を確定)`);
                } else {
                  // 射詰で同順位の場合は両方とも表示（例：2人が2位）
                  console.log(`    同順位許可: ${archer.name} (射詰で${finalRank}位)`);
                }
              }

              console.log(`    射詰結果追加: ${archer.name} → ${finalRank}位`);

              mergedResults.push({
                archerId: result.archerId,
                name: archer.name,
                affiliation: archer.affiliation,
                rank: finalRank,
                rank_source: 'shichuma',
                shootOffType: 'shichuma',
                isWinner: result.isWinner,
                consecutiveHits: result.consecutiveHits,
                eliminatedAt: result.eliminatedAt,
                results: result.results || [],
                divisionId: divisionId
              });
              
              divisionUsedRanks.add(finalRank);
              divisionProcessedArchers.add(result.archerId);
            });
        }
        
        divisionEnkinResults
          .sort((a, b) => {
            const aTarget = a.targetRank !== null ? a.targetRank : 9999;
            const bTarget = b.targetRank !== null ? b.targetRank : 9999;
            if (aTarget !== bTarget) return aTarget - bTarget;
            const aRank = parseInt(a.rank) || 9999;
            const bRank = parseInt(b.rank) || 9999;
            return aRank - bRank;
          })
          .forEach(enkinResult => {
            // すでに射詰で決定済みの選手はスキップ
            if (divisionProcessedArchers.has(enkinResult.archerId)) {
              console.log(`    スキップ: ${enkinResult.archerId} (射詰で決定済み)`);
              return;
            }
            
            const archer = divisionArchers.find(a => a.archerId === enkinResult.archerId);
            if (!archer) return;

            // 敗退者はスキップ
            if (enkinResult.rank === '敗退' || enkinResult.isDefeated) {
              console.log(`    スキップ: ${archer.name} (敗退)`);
              return;
            }

            const finalRank = parseInt(enkinResult.rank);
            
            // 重複チェック
            if (divisionUsedRanks.has(finalRank)) {
              console.warn(`    ?? 順位重複: ${finalRank}位 (${archer.name}) - 遠近競射`);
              return;
            }

            console.log(`    遠近結果追加: ${archer.name} → ${finalRank}位`);

            // 射詰→遠近の選手かチェック
            const isFromShichuma = shichumaFinalResults?.results?.some(s => s.archerId === enkinResult.archerId);
            
            mergedResults.push({
              archerId: enkinResult.archerId,
              name: archer.name,
              affiliation: archer.affiliation,
              rank: finalRank,
              rank_source: 'enkin',
              shootOffType: 'enkin',
              isDefeated: enkinResult.isDefeated,
              arrowType: enkinResult.arrowType,
              targetRank: enkinResult.targetRank,
              isFromEnkin: isFromShichuma,
              divisionId: divisionId
            });
            
            divisionUsedRanks.add(finalRank);
            divisionProcessedArchers.add(enkinResult.archerId);
          });
      }
    });

    // 的中数で順位が確定している選手を追加
    if (categorizedGroups && categorizedGroups.length > 0) {
      categorizedGroups.forEach(divisionData => {
        if (divisionData.confirmed && divisionData.confirmed.length > 0) {
          divisionData.confirmed.forEach(({ hitCount, group, rank }) => {
            group.forEach(archer => {
              // 部門ごとの順位管理のため、グローバルなprocessedArchersチェックは削除
              // 的中数で確定した順位はそのまま使用（調整なし）
              mergedResults.push({
                archerId: archer.archerId,
                name: archer.name,
                affiliation: archer.affiliation,
                rank: rank,
                rank_source: 'confirmed',
                shootOffType: null,
                hitCount: hitCount
              });
            });
          });
        }
      });
    }

    // 4. 最終ソート
    const sorted = mergedResults.sort((a, b) => {
      const aRank = typeof a.rank === 'number' ? a.rank : 9999;
      const bRank = typeof b.rank === 'number' ? b.rank : 9999;
      return aRank - bRank;
    });
    
    console.log('? 統合結果完成:', sorted.length, '件');
    sorted.forEach(result => {
      console.log(`  ${result.rank}位: ${result.name} (${result.rank_source})`);
    });
    
    return sorted.length > 0 ? sorted : null;
  }, [shichumaFinalResults, enkinFinalResults, archers, categorizedGroups]);

  // === 性別ごとの統合結果を作成する関数 ===
  const getMergedFinalResultsForGender = useCallback((gender) => {
    const mergedResults = [];
    const filteredArchers = archers.filter(a => (a.gender || 'male') === gender);

    // 選手を部門ごとにグループ化（性別でフィルタ済み）
    const archersByDivision = {};
    filteredArchers.forEach(archer => {
      const divisionId = getDivisionIdForArcher(archer, divisions);
      if (!archersByDivision[divisionId]) archersByDivision[divisionId] = [];
      archersByDivision[divisionId].push(archer);
    });

    Object.keys(archersByDivision).forEach(divisionId => {
      const divisionArchers = archersByDivision[divisionId];
      const divisionUsedRanks = new Set();
      const divisionProcessedArchers = new Set();

      // 遠近競射の結果（この性別の選手のみ）
      if (enkinFinalResults && enkinFinalResults.results) {
        const divisionEnkinResults = enkinFinalResults.results.filter(result => {
          if (result.divisionId) return result.divisionId === divisionId;
          return divisionArchers.some(a => a.archerId === result.archerId);
        }).filter(r => {
          const ar = archers.find(a => a.archerId === r.archerId);
          return ar && (ar.gender || 'male') === gender;
        });

        if (shichumaFinalResults && shichumaFinalResults.results) {
          const divisionShichumaResults = shichumaFinalResults.results.filter(result => {
            if (result.divisionId) return result.divisionId === divisionId;
            return divisionArchers.some(a => a.archerId === result.archerId);
          }).filter(r => {
            const ar = archers.find(a => a.archerId === r.archerId);
            return ar && (ar.gender || 'male') === gender;
          });

          divisionShichumaResults
            .sort((a, b) => a.rank - b.rank)
            .forEach(result => {
              const archer = divisionArchers.find(a => a.archerId === result.archerId);
              if (!archer) return;
              const finalRank = result.rank;
              const isFromShichumaToEnkin = divisionEnkinResults.some(e => e.archerId === result.archerId);
              if (isFromShichumaToEnkin) return;
              if (divisionProcessedArchers.has(result.archerId)) return;

              mergedResults.push({
                archerId: result.archerId,
                name: archer.name,
                affiliation: archer.affiliation,
                rank: finalRank,
                rank_source: 'shichuma',
                shootOffType: 'shichuma',
                isWinner: result.isWinner,
                consecutiveHits: result.consecutiveHits,
                eliminatedAt: result.eliminatedAt,
                results: result.results || [],
                divisionId: divisionId
              });

              divisionUsedRanks.add(finalRank);
              divisionProcessedArchers.add(result.archerId);
            });
        }

        divisionEnkinResults
          .sort((a, b) => {
            const aTarget = a.targetRank !== null ? a.targetRank : 9999;
            const bTarget = b.targetRank !== null ? b.targetRank : 9999;
            if (aTarget !== bTarget) return aTarget - bTarget;
            const aRank = parseInt(a.rank) || 9999;
            const bRank = parseInt(b.rank) || 9999;
            return aRank - bRank;
          })
          .forEach(enkinResult => {
            if (divisionProcessedArchers.has(enkinResult.archerId)) return;
            const archer = divisionArchers.find(a => a.archerId === enkinResult.archerId);
            if (!archer) return;
            if (enkinResult.rank === '敗退' || enkinResult.isDefeated) return;
            const finalRank = parseInt(enkinResult.rank);
            if (divisionUsedRanks.has(finalRank)) return;

            const isFromShichuma = shichumaFinalResults?.results?.some(s => s.archerId === enkinResult.archerId);

            mergedResults.push({
              archerId: enkinResult.archerId,
              name: archer.name,
              affiliation: archer.affiliation,
              rank: finalRank,
              rank_source: 'enkin',
              shootOffType: 'enkin',
              isDefeated: enkinResult.isDefeated,
              arrowType: enkinResult.arrowType,
              targetRank: enkinResult.targetRank,
              isFromEnkin: isFromShichuma,
              divisionId: divisionId
            });

            divisionUsedRanks.add(finalRank);
            divisionProcessedArchers.add(enkinResult.archerId);
          });
      }
    });

    // 的中数で順位が確定している選手を追加（categorizedGroups内の該当性別選手のみ）
    if (categorizedGroups && categorizedGroups.length > 0) {
      categorizedGroups.forEach(divisionData => {
        if (divisionData.confirmed && divisionData.confirmed.length > 0) {
          divisionData.confirmed.forEach(({ hitCount, group, rank }) => {
            group.filter(a => (a.gender || 'male') === gender).forEach(archer => {
              mergedResults.push({
                archerId: archer.archerId,
                name: archer.name,
                affiliation: archer.affiliation,
                rank: rank,
                rank_source: 'confirmed',
                shootOffType: null,
                hitCount: hitCount
              });
            });
          });
        }
      });
    }

    const sorted = mergedResults.sort((a, b) => {
      const aRank = typeof a.rank === 'number' ? a.rank : 9999;
      const bRank = typeof b.rank === 'number' ? b.rank : 9999;
      return aRank - bRank;
    });

    return sorted.length > 0 ? sorted : null;
  }, [shichumaFinalResults, enkinFinalResults, archers, categorizedGroups]);

  // 最終順位表を完全削除（射詰・遠近の全結果をサーバーから削除 + ローカルストレージ削除）
  const deleteFinalResults = async () => {
    if (!selectedTournamentId) {
      alert('大会が選択されていません');
      return;
    }
    const confirmed = window.confirm('🗑️ 最終順位表のすべての記録を完全削除しますか？\n\nこの操作は以下をすべて削除します：\n• 射詰の結果\n• 遠近競射の結果\n• 選手の記録フィールド\n\n元に戻すことはできません。本当に実行しますか？');
    if (!confirmed) return;

    try {
      console.log('\n🗑️🗑️🗑️ 最終順位表削除開始 🗑️🗑️🗑️');
      console.log(`  対象大会: ${selectedTournamentId}`);
      console.log(`\n【削除前の詳細データ確認】`);
      console.log(`  shichumaFinalResults:`, shichumaFinalResults);
      console.log(`  enkinFinalResults:`, enkinFinalResults);
      
      // archers から該当者の results フィールドを確認
      console.log(`\n【Archers の results フィールド確認】`);
      archers.forEach(archer => {
        const hitCount = archer.results ? Object.values(archer.results).flat().filter(r => r === 'o').length : 0;
        if (hitCount > 0) {
          console.log(`  ${archer.name}: ${hitCount}本的中`, archer.results);
        }
      });

      // サーバー側データ削除
      const urls = [
        { url: `${API_URL}/ranking/shichuma/${selectedTournamentId}`, method: 'DELETE', name: 'Shichuma' },
        { url: `${API_URL}/ranking/enkin/${selectedTournamentId}`, method: 'DELETE', name: 'Enkin' },
        { url: `${API_URL}/ranking/clear/${selectedTournamentId}`, method: 'POST', name: 'Clear' } // 選手フィールドクリア
      ];

      console.log(`  実行するエンドポイント:`);
      urls.forEach(u => console.log(`    - ${u.name}: ${u.method} ${u.url}`));

      const responses = await Promise.all(
        urls.map(req => 
          fetch(req.url, { method: req.method, headers: { 'Content-Type': 'application/json' } })
            .then(r => r.json().then(data => ({ 
              name: req.name,
              url: req.url, 
              ok: r.ok, 
              status: r.status,
              data: data
            })))
            .catch(err => ({ 
              name: req.name,
              url: req.url, 
              ok: false, 
              err,
              status: 0
            }))
        )
      );

      // 結果をログ出力
      console.log(`\n  📋 サーバーレスポンス:`);
      responses.forEach(r => {
        const status = r.status === 404 ? '✅ 404(データなし)' : (r.ok ? '✅ OK' : `❌ Error(${r.status})`);
        console.log(`    ${r.name}: ${status}`);
        if (r.data && r.data.stats) {
          console.log(`      ${JSON.stringify(r.data.stats)}`);
        }
      });

      const allOk = responses.every(r => r.ok || r.status === 404); // 404はデータなしで成功扱い

      if (allOk) {
        console.log(`\n  ✅ サーバー側削除成功！React状態をクリア中...`);
        
        // React 状態をクリア
        setShichumaFinalResults(null);
        setEnkinFinalResults(null);
        setShichumaResults({});
        setEnkinResults({});
        setEliminatedArchers(new Set());
        setEliminationOrder([]);
        setEliminationRound({});
        setSimultaneousEliminations([]);
        setCurrentShootOffArchers([]);
        setOriginalEnkinArchers(new Set());
        setSavedEnkinRanks(new Set());
        setEnkinTargetRank(null);
        setShootOffType('');
        setCurrentShichumaRound(1);
        setShowEnkinOption(false);
        setEnkinStartRank(2);
        setIsShootOffActive(false);
        setIsSavingShichuma(false);
        setIsLoadingResults(false);
        setEnkinDefeated(new Set());
        setRemainingAfterFourArrows([]);
        setEditingArrow(null);

        // ローカルストレージもクリア
        localStorage.removeItem('ranking_selectedGender');
        console.log(`  ✅ localStorage をクリア`);

        // 削除後の詳細確認ログ
        console.log(`\n【削除直後の状態確認】`);
        console.log(`  setShichumaFinalResults -> null (クリア予定)`);
        console.log(`  setEnkinFinalResults -> null (クリア予定)`);


        // 削除完了を確認するため少し待機してから再取得
        console.log(`  ⏳ 1秒待機中...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 最新データを再取得（削除後のサーバーデータを確実に反映）
        console.log(`  🔄 最新データを再取得中...`);
        await fetchArchers(true);
        await fetchShootOffResults();
        
        // 再取得後の状態確認
        console.log(`\n【再取得後のデータ状態確認】`);
        console.log(`  再取得後の shichumaFinalResults:`, shichumaFinalResults);
        console.log(`  再取得後の enkinFinalResults:`, enkinFinalResults);
        console.log(`\n【Archers の results フィールド再確認】`);
        archers.forEach(archer => {
          const hitCount = archer.results ? Object.values(archer.results).flat().filter(r => r === 'o').length : 0;
          if (hitCount > 0) {
            console.log(`  ${archer.name}: ${hitCount}本的中 (残存状態!)`, archer.results);
          }
        });
        

        console.log(`✅✅✅ 最終順位表完全削除完了 ✅✅✅\n`);
        alert('✅ 最終順位表をすべて削除しました。\n\nページをリロードして確認します。');
        
        // ページをリロードして確実に反映
        setTimeout(() => window.location.reload(), 500);
      } else {
        const failed = responses.filter(r => !r.ok && r.status !== 404);
        console.error('❌ 削除に失敗しました', failed);
        alert('❌ サーバー削除に失敗しました。コンソールを確認してください。');
      }
    } catch (e) {
      console.error('❌ 最終順位表削除エラー', e);
      alert('削除処理中にエラーが発生しました。');
    }
  };

  // === 統合結果の表示 ===
  const renderMergedResults = () => {
    if (Date.now() < (suppressMergedDisplayUntil || 0)) {
      return (
        <div className="card">
          <p className="text-gray-500 text-center py-4">最終順位表はリセットされています（再表示までしばらくお待ちください）</p>
        </div>
      );
    }
    let mergedResults = null;

    if (enableGenderSeparation) {
      const gendersToCompute = selectedGender === 'all' ? ['male', 'female'] : [selectedGender];
      const mergedLists = gendersToCompute.map(g => getMergedFinalResultsForGender(g)).filter(Boolean);
      mergedResults = [].concat(...mergedLists);
    } else {
      mergedResults = getMergedFinalResults();
    }

    if (!mergedResults || mergedResults.length === 0) {
      return (
        <div className="card">
          <p className="text-gray-500 text-center py-4">順位決定戦の結果がありません</p>
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

    // 部門順を維持して配列に変換
    const divisionResults = [];
    divisions.forEach(div => {
      if (enableGenderSeparation) {
        if (resultsByDivision[`${div.id}_male`] && resultsByDivision[`${div.id}_male`].results.length > 0) {
          divisionResults.push(resultsByDivision[`${div.id}_male`]);
        }
        if (resultsByDivision[`${div.id}_female`] && resultsByDivision[`${div.id}_female`].results.length > 0) {
          divisionResults.push(resultsByDivision[`${div.id}_female`]);
        }
      } else {
        if (resultsByDivision[div.id] && resultsByDivision[div.id].results.length > 0) {
          divisionResults.push(resultsByDivision[div.id]);
        }
      }
    });

    // 選択した部門でフィルタリング（部門＋性別を考慮）
    let displayResults;
    if (selectedDivision === '') {
      // 全部門表示：性別フィルタが有効なら該当性別のみ表示
      if (enableGenderSeparation && selectedGender !== 'all') {
        displayResults = divisionResults.filter(d => d.division.id.endsWith(`_${selectedGender}`));
      } else {
        displayResults = divisionResults;
      }
    } else {
      if (enableGenderSeparation) {
        if (selectedGender === 'all') {
          displayResults = divisionResults.filter(d => d.division.id.replace(/_male$|_female$/, '') === selectedDivision);
        } else {
          displayResults = divisionResults.filter(d => d.division.id === `${selectedDivision}_${selectedGender}`);
        }
      } else {
        displayResults = divisionResults.filter(d => d.division.id === selectedDivision);
      }
    }

    if (displayResults.length === 0) {
      return (
        <div className="card">
          <p className="text-gray-500 text-center py-4">
            {selectedDivision === '' ? '順位決定戦の結果がありません' : 'この部門の順位決定戦の結果がありません'}
          </p>
        </div>
      );
    }

    return (
      <>
        {displayResults.map(divisionData => (
          <div key={divisionData.division.id} className="card border-l-4 border-green-500">
            <h3 className="card-title text-green-700 mb-4">? 最終順位表 - {divisionData.division.label}</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-green-300">
                <thead>
                  <tr className="bg-green-100">
                    <th className="border border-green-300 px-4 py-2 text-left">順位</th>
                    <th className="border border-green-300 px-4 py-2 text-left">氏名</th>
                    <th className="border border-green-300 px-4 py-2 text-left">所属</th>
                    <th className="border border-green-300 px-4 py-2 text-left">部門</th>
                    <th className="border border-green-300 px-4 py-2 text-center">決定方法</th>
                    <th className="border border-green-300 px-4 py-2 text-center">詳細</th>
                  </tr>
                </thead>
                <tbody>
                  {divisionData.results.map((result, index) => {
                    const archer = archers.find(a => a.archerId === result.archerId);
                    return (
                      <tr key={`${result.archerId}-${result.shootOffType || 'unknown'}`} className={`hover:bg-green-50 ${
                        result.isDefeated ? 'bg-red-50' : ''
                      }`}>
                        <td className="border border-green-300 px-4 py-2 font-bold">
                          {typeof result.rank === 'string' && result.rank === '敗退' ? (
                            <span className="text-red-700">敗退</span>
                          ) : (
                            <span className="text-green-900">{result.rank}位</span>
                          )}
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
                              // 個別の選手のshootOffTypeを優先して表示
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
                              // 射詰競射だけで全順位が決定したかチェック
                              //（遠近競射を使わずに射詰の結果のみで順位が確定した場合）
                              const hasEnkinResults = divisionData.results.some(r => r.shootOffType === 'enkin');
                              const hasShichumaResults = divisionData.results.some(r => r.shootOffType === 'shichuma');
                              const allDeterminedByShootOff = divisionData.results.every(r => 
                                r.shootOffType === 'shichuma' || r.shootOffType === 'enkin'
                              );
                              
                              if (hasShichumaResults && !hasEnkinResults && allDeterminedByShootOff) {
                                // 射詰だけで全順位が決定された場合の表記
                                if (result.isWinner) {
                                  return <span className="text-yellow-700 font-bold">?? 優勝</span>;
                                } else {
                                  return <span className="text-blue-700 font-bold">射詰{result.rank}位</span>;
                                }
                              } else {
                                // 通常の射詰表記
                                return (
                                  <>
                                    {result.isWinner && (
                                      <span className="text-yellow-700 font-bold">?? 優勝</span>
                                    )}
                                    {result.eliminatedAt && (
                                      <span className="text-red-700">{result.eliminatedAt}本目脱落</span>
                                    )}
                                    {!result.isWinner && !result.eliminatedAt && (
                                      <span>射詰{result.rank}位</span>
                                    )}
                                  </>
                                );
                              }
                            })()}
                            {result.isFromEnkin && (
                              <span className="text-blue-600 ml-2">→遠近で{result.rank}位確定</span>
                            )}
                          </div>
                        )}
                        {result.shootOffType === 'enkin' && (
                          <div>
                            <span className="text-orange-700">
                              {(() => {
                                // enkinFinalResultsから同じtargetRankの選手を取得
                                const sameTargetRankResults = enkinFinalResults?.results?.filter(r => r.targetRank === result.targetRank) || [];
                                const groupSize = sameTargetRankResults.length;
                                
                                // 表彰範囲外かチェック（タイトル表示と同じロジック）
                                const awardRankLimit = tournament?.data?.awardRankLimit || 3;
                                const willHaveDefeated = (result.targetRank + groupSize - 1) > awardRankLimit;
                                
                                // 射射詰→遠近の選手がいるかチェック
                                const hasShichumaToEnkin = sameTargetRankResults.some(r => 
                                  shichumaFinalResults?.results?.some(s => s.archerId === r.archerId)
                                );
                                
                                if (willHaveDefeated) {
                                  // 敗退者を含む場合（表彰範囲外）→ 単一順位表示
                                  return `${result.targetRank}位決定戦`;
                                } else if (hasShichumaToEnkin && groupSize > 1) {
                                  // 射射詰→遠近で複数名の場合（表彰範囲内）→ 範囲表示
                                  const endRank = result.targetRank + groupSize - 1;
                                  return `${result.targetRank}位～${endRank}位決定戦`;
                                } else if (groupSize > 1) {
                                  // 通常の複数名の場合（表彰範囲内）→ 範囲表示
                                  const endRank = result.targetRank + groupSize - 1;
                                  return `${result.targetRank}位～${endRank}位決定戦`;
                                } else {
                                  // 1名の場合 → 単一順位表示
                                  return `${result.targetRank}位決定戦`;
                                }
                               })()}
                            </span>
                            <span className="text-gray-600 ml-1">→{result.rank}位</span>
                          </div>
                        )}
                        {result.rank_source === 'confirmed' && (
                          <div>
                            <span className="text-green-700">{result.hitCount}本的中</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </>
    );
  };

  return (
    <div className="view-container">
      <div className="view-header">
        {/* ... */}
        <div className="flex items-center gap-2">
          <h1>順位決定戦</h1>
          {isSyncing && (
            <span className="text-sm text-blue-600 flex items-center gap-1">
              <RefreshCw size={14} className="animate-spin" />
              同期中
            </span>
          )}
          <button onClick={deleteFinalResults} className="btn" style={{ marginLeft: '0.5rem', backgroundColor: '#ef4444', color: '#fff' }}>
            最終順位表を完全削除
          </button>
        </div>
      </div>
      <div className="view-content">
        {!selectedTournamentId ? (
          <div className="card">大会を選択してください</div>
        ) : isLoading ? (
          <div className="card">読み込み中...</div>
        ) : (
          <>
            {/* === 部門選択 === */}
            <div className="card">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>部門を選択</label>
              <div className="button-group">
                <button 
                  onClick={() => setSelectedDivision('')}
                  className={`btn ${selectedDivision === '' ? 'btn-active' : ''}`}
                  style={{ flex: 1 }}
                >
                  全部門
                </button>
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
              {enableGenderSeparation && (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button onClick={() => setSelectedGender('all')} className={`btn ${selectedGender === 'all' ? 'btn-active' : ''}`} style={{ flex: 1 }}>全員</button>
                  <button onClick={() => setSelectedGender('male')} className={`btn ${selectedGender === 'male' ? 'btn-active' : ''}`} style={{ flex: 1 }}>男子</button>
                  <button onClick={() => setSelectedGender('female')} className={`btn ${selectedGender === 'female' ? 'btn-active' : ''}`} style={{ flex: 1 }}>女子</button>
                </div>
              )}

              <p className="hint" style={{ marginTop: '0.5rem' }}>
                {selectedDivision === '' 
                  ? `全部門の選手: ${enableGenderSeparation && selectedGender !== 'all' ? archers.filter(a => (a.gender || 'male') === selectedGender).length : archers.length}人`
                  : `${divisions.find(d => d.id === selectedDivision)?.label || selectedDivision}: ${archers.filter(a => getDivisionIdForArcher(a, divisions) === selectedDivision && ( !enableGenderSeparation || selectedGender === 'all' || (a.gender || 'male') === selectedGender )).length}人`
                }
              </p>
            </div>

            {/* === 部門ごとの順位決定戦表示 === */}
            {(selectedDivision === '' ? categorizedGroups : categorizedGroups.filter(d => d.division.id === selectedDivision)).map(divisionData => (
              <div key={divisionData.division.id} className="space-y-4">
                {/* 部門タイトル */}
                <div className="card border-l-4 border-purple-500">
                  <h2 className="card-title text-purple-700">?? {divisionData.division.label}</h2>
                </div>
                {/* === 1. 射詰競射（優勝決定戦）の表示エリア === */}
                {divisionData.izume.length > 0 && (
                  <div className="card border-l-4 border-blue-500">
                    <h3 className="card-title text-blue-700">?? 射詰競射 対象（優勝決定）</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      1位が同率のため、射詰競射を行います。
                    </p>
                    {divisionData.izume.map(({ hitCount, group, rank }) => (
                      <div key={`${divisionData.division.id}_${rank}_izume`} className="mb-4 bg-blue-50 p-3 rounded">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold">{hitCount}本的中 - {group.length}名</span>
                          <button 
                            onClick={() => startShichumaShootOff(group)}
                            className="btn-primary"
                          >
                            射詰競射を開始
                          </button>
                        </div>
                        <div className="space-y-1 bg-white p-2 rounded border">
                          {group.map(archer => (
                            <div key={archer.archerId} className="flex justify-between text-sm">
                              <span>{archer.name} ({archer.affiliation})</span>
                              <span>{archer.rank}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* === 2. 遠近競射（順位決定）の表示エリア === */}
                {divisionData.enkin.length > 0 && (
                  <div className="card border-l-4 border-orange-500">
                    <h3 className="card-title text-orange-700">?? 遠近競射 対象（順位決定）</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      入賞圏内で同順位がいるため、遠近競射を行います。
                    </p>
                    {divisionData.enkin.map(({ hitCount, group, rank }) => (
                      <div key={`${divisionData.division.id}_${rank}_enkin`} className="mb-4 bg-orange-50 p-3 rounded">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold">
                            {(() => {
                              // 敗退者がいるかチェック（group内に射詰から来た選手がいるか）
                              const hasShichumaToEnkin = group.some(archer => 
                                shichumaFinalResults?.results?.some(r => r.archerId === archer.archerId)
                              );
                              
                              // 敗退者を含むかチェック（表彰範囲外になる可能性）
                              const awardRankLimit = tournament?.data?.awardRankLimit || 3;
                              const willHaveDefeated = (rank + group.length - 1) > awardRankLimit;
                              
                              if (willHaveDefeated) {
                                // 敗退者を含む場合（表彰範囲外）→ 単一順位表示
                                return `${rank}位決定戦 - ${group.length}名`;
                              } else if (hasShichumaToEnkin && group.length > 1) {
                                // 射射詰→遠近で複数名の場合（表彰範囲内）→ 範囲表示
                                return `${rank}位～${rank + group.length - 1}位決定戦 - ${group.length}名`;
                              } else if (group.length > 1) {
                                // 通常の複数名の場合（表彰範囲内）→ 範囲表示
                                return `${rank}位～${rank + group.length - 1}位決定戦 - ${group.length}名`;
                              } else {
                                // 1名の場合 → 単一順位表示
                                return `${rank}位決定戦 - ${group.length}名`;
                              }
                            })()}
                          </span>
                          <button 
                            onClick={() => startEnkinShootOff(group, false, rank)}
                            className="btn-primary bg-orange-600 hover:bg-orange-700"
                          >
                            遠近競射を開始
                          </button>
                        </div>
                        <div className="space-y-1 bg-white p-2 rounded border">
                          {group.map(archer => (
                            <div key={archer.archerId} className="flex justify-between text-sm">
                              <span>{archer.name} ({archer.affiliation})</span>
                              <span>{archer.rank}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* === 3. 順位確定者の表示エリア === */}
                {divisionData.confirmed.length > 0 && (
                  <div className="card border-l-4 border-green-500">
                    <h3 className="card-title text-green-700">? 順位確定</h3>
                    <div className="space-y-3">
                      {divisionData.confirmed.map(({ hitCount, group, rank }) => (
                        <div key={`${divisionData.division.id}_${rank}_confirmed`} className="bg-green-50 p-2 rounded flex justify-between items-center">
                          <div>
                            <span className="font-bold text-green-900 mr-2">{rank}位</span>
                            <span>{group[0].name}</span>
                            <span className="text-xs text-gray-600 ml-2">({group[0].affiliation})</span>
                          </div>
                          <span className="font-bold text-green-800">{hitCount}本</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isShootOffActive && shootOffType === 'shichuma' && (
              <div className="card">
                <h2 className="card-title">射詰競射中</h2>
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">
                    射詰競射ルール：
                  </p>
                  <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                    <li>各競技者が1本ずつ矢を放ち、失中者を除いていく順位決定方法</li>
                    <li>継続的中数の多い方を上位とする</li>
                    <li>優勝者確定まで射詰競射を継続する（最後の1人が決定するまで）</li>
                    <li>同点（同じ本数で脱落）の場合のみ遠近競射で順位決定</li>
                  </ul>
                </div>

                {/* === 遠近競射が必要な場合 === */}
                {showEnkinOption && remainingAfterFourArrows.length > 0 && (
                  <div className="mt-4 p-4 bg-yellow-50 border rounded">
                    <h3 className="font-bold text-yellow-800">同点グループ発生 - 遠近競射で順位決定</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      同じ本数で脱落した複数名の順位を遠近競射で決定します
                    </p>
                    <div className="space-y-2">
                      <div className="text-sm">
                        <strong>遠近競射対象者:</strong>
                        <ul className="list-disc list-inside mt-1">
                          {remainingAfterFourArrows.map(archer => (
                            <li key={archer.archerId}>{archer.name} ({archer.affiliation})</li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={handleStartEnkinFromShichuma}
                          className="btn-primary"
                        >
                          遠近競射を開始
                        </button>
                        <button
                          onClick={handleCancelEnkinOption}
                          className="btn-secondary"
                        >
                          キャンセル
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* === 遠近不要で順位が確定した場合 === */}
                {!showEnkinOption && !isShootOffActive && eliminationOrder.length > 0 && (
                  <div className="mt-4 p-4 bg-green-50 border rounded">
                    <h3 className="font-bold text-green-800 mb-3">射詰競射終了 - 順位確定</h3>
                    <div className="space-y-2">
                      {getShichumaFinalRanking().map(({archer, rank, eliminatedAt, type, consecutiveHits}) => {
                        const archerResults = shichumaResults[archer.archerId] || [];
                        const shotRecords = Array.from({length: Math.max(4, archerResults.length)}, (_, i) => {
                          return archerResults[i] || (i < currentShichumaRound - 1 ? null : null);
                        });
                        
                        return (
                          <div key={archer.archerId} className="border rounded p-3 bg-white">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <span className="font-bold text-lg">{rank}位</span>
                                <span className="font-semibold ml-3">{archer.name}</span>
                              </div>
                              <span className="text-sm text-gray-600">
                                {type === 'eliminated' 
                                  ? `${eliminatedAt}本目で脱落 (継続的中: ${consecutiveHits}本)` 
                                  : `優勝 (継続的中: ${consecutiveHits}本)`}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{archer.affiliation}</p>
                            
                            {/* 記録表示 */}
                            <div className="mt-2 flex gap-1 items-center">
                              <span className="text-xs font-semibold text-gray-500 w-12">記録:</span>
                              <div className="flex gap-1">
                                {shotRecords.map((result, idx) => (
                                  <div key={idx} className="text-center">
                                    <span className="text-xs text-gray-500">{idx + 1}本</span>
                                    <div className={`w-6 h-6 rounded flex items-center justify-center text-sm font-bold ${
                                      result === 'o' ? 'bg-gray-900 text-white' : 
                                      result === 'x' ? 'bg-red-200 text-red-700' : 'bg-gray-100 text-gray-400'
                                    }`}>
                                      {result === 'o' ? '◯' : result === 'x' ? '×' : '―'}
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

                {/* === 入力フォーム（1位決定前のみ表示） === */}
                {isShootOffActive && !showEnkinOption && (
                  <div className="space-y-4 mt-4">
                    {currentShootOffArchers.map(archer => (
                      <div key={archer.archerId} className="border rounded p-4">
                        <h4 className="font-semibold mb-2">{archer.name}</h4>
                        <div className="flex gap-2">
                          {Array.from({length: Math.max(currentShichumaRound, 4)}, (_, arrowIndex) => {
                            const result = shichumaResults[archer.archerId]?.[arrowIndex];
                            const isCurrentRound = arrowIndex === currentShichumaRound - 1;
                            const isEditing = editingArrow?.archerId === archer.archerId && editingArrow?.arrowIndex === arrowIndex;
                            return (
                              <div key={arrowIndex} className="text-center">
                                <p className="text-sm mb-1">{arrowIndex + 1}本目</p>
                                {isEditing ? (
                                  <div className="flex flex-col gap-1">
                                    <button
                                      onClick={() => handleConfirmEditShichuma(archer.archerId, arrowIndex, 'o')}
                                      className="btn-circle btn-hit"
                                    >
                                      ◯
                                    </button>
                                    <button
                                      onClick={() => handleConfirmEditShichuma(archer.archerId, arrowIndex, 'x')}
                                      className="btn-circle btn-miss"
                                    >
                                      ×
                                    </button>
                                    <button
                                      onClick={handleCancelEditShichuma}
                                      className="btn-fix text-xs"
                                    >
                                      キャンセル
                                    </button>
                                  </div>
                                ) : result ? (
                                  <div className="flex flex-col gap-1">
                                    <span className={`text-2xl font-bold ${result === 'o' ? 'text-green-600' : 'text-red-600'}`}>
                                      {result === 'o' ? '◯' : '×'}
                                    </span>
                                    <button
                                      onClick={() => handleEditShichumaShot(archer.archerId, arrowIndex)}
                                      className="btn-fix text-xs"
                                    >
                                      修正
                                    </button>
                                  </div>
                                ) : isCurrentRound && !eliminatedArchers.has(archer.archerId) ? (
                                  <>
                                    <button
                                      onClick={() => handleShichumaShot(archer.archerId, arrowIndex, 'o')}
                                      className="btn-circle btn-hit"
                                    >
                                      ◯
                                    </button>
                                    <button
                                      onClick={() => handleShichumaShot(archer.archerId, arrowIndex, 'x')}
                                      className="btn-circle btn-miss ml-1"
                                    >
                                      ×
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-gray-400 text-2xl">―</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {isShootOffActive && shootOffType === 'enkin' && (
              <div className="card">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="card-title">{getEnkinTitle()}中</h2>
                  {enkinTargetRank === null && (
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">開始順位:</label>
                      <select 
                        value={enkinStartRank} 
                        onChange={(e) => setEnkinStartRank(parseInt(e.target.value))}
                        className="input"
                      >
                        {[2, 3, 4, 5, 6, 7, 8].map(rank => (
                          <option key={rank} value={rank}>{rank}位</option>
                        ))}
                      </select>
                    </div>
                  )
                }
                </div>
                <div className="mb-4">
                  <p className="text-sm text-gray-600">
                    ルール：順位を入力
                  </p>
                  {enkinTargetRank !== null && (
                    <div className="mt-2 p-2 bg-blue-50 border rounded">
                      <p className="text-sm text-blue-800">
                        <strong>射詰競射からの遠近競射決定戦</strong>
                      </p>
                      <p className="text-xs text-blue-600">
                        射詰競射で同時に×になった選手たちの順位を決定します
                      </p>
                    </div>
                  )}
                </div>
                
                {/* 選手をグループ分けして表示 */}
                <div className="space-y-6">
                  {/* 射詰競射からの選手 */}
                  {originalEnkinArchers.size === 0 && currentShootOffArchers.length > 0 && (
                    <div className="mb-4 p-3 bg-orange-50 border rounded">
                      <h4 className="font-semibold text-sm mb-2 text-orange-800">射詰競射からの選手</h4>
                      <div className="text-sm space-y-1">
                        {currentShootOffArchers.map(archer => {
                          const eliminatedInfo = eliminationOrder.find(e => e.archerId === archer.archerId);
                          return (
                            <div key={archer.archerId} className="flex justify-between items-center">
                              <span>{archer.name} ({archer.affiliation})</span>
                              <span className="text-xs text-gray-500">
                                {eliminatedInfo ? `${eliminatedInfo.arrowIndex}本目で×` : '4本完射'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* 元々の遠近競射選手 */}
                  {originalEnkinArchers.size > 0 && (
                    <div className="mb-4 p-3 bg-blue-50 border rounded">
                      <h4 className="font-semibold text-sm mb-2 text-blue-800">元々の遠近競射選手</h4>
                      <div className="text-sm space-y-1">
                        {currentShootOffArchers.filter(archer => originalEnkinArchers.has(archer.archerId)).map(archer => (
                          <div key={archer.archerId} className="flex justify-between items-center">
                            <span>{archer.name} ({archer.affiliation})</span>
                            <span className="text-xs text-gray-500">遠近競射対象</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    {currentShootOffArchers.map(archer => (
                      <div key={archer.archerId} className="border rounded p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold">{archer.name}</h4>
                          {originalEnkinArchers.size === 0 && (
                            <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                              射詰から
                            </span>
                          )}
                          {originalEnkinArchers.size > 0 && originalEnkinArchers.has(archer.archerId) && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              元々遠近
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{archer.affiliation}</p>
                        <div className="flex items-center gap-4">
                          <select
                            value={(enkinResults[archer.archerId]?.rank) || ''}
                            onChange={(e) => {
                              handleEnkinResult(archer.archerId, e.target.value, 'normal');
                            }}
                            className="input"
                          >
                            <option value="">順位を選択</option>
                            {getEnkinRankOptions().map(rank => (
                              <option key={rank} value={rank}>{rank}位</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {Object.keys(enkinResults).length === currentShootOffArchers.length && (
                  <div className="mt-4">
                    <h3 className="font-bold mb-2">遠近競射結果</h3>
                    <div className="space-y-2">
                      {calculateEnkinRanking().map(({archerId, rank}) => {
                        const archer = currentShootOffArchers.find(a => a.archerId === archerId);
                        if (!archer) return null;
                        
                        return (
                          <div key={archerId} className={`flex justify-between items-center p-2 border rounded ${
                            enkinDefeated.has(archerId) ? 'bg-red-50 border-red-200' : 'bg-white'
                          }`}>
                            <div className="flex items-center gap-3">
                              <span className="font-semibold">
                                {enkinResults[archerId]?.rank && !enkinDefeated.has(archerId) ? `${rank}位` : '敗退'}: {archer.name}
                              </span>
                              {enkinDefeated.has(archerId) && (
                                <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                  敗退
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <select
                                value={enkinResults[archerId]?.rank || ''}
                                onChange={(e) => {
                                  handleEnkinResult(archerId, e.target.value, 'normal');
                                  // 敗退状態をリセット
                                  if (enkinDefeated.has(archerId)) {
                                    setEnkinDefeated(prev => {
                                      const newSet = new Set(prev);
                                      newSet.delete(archerId);
                                      return newSet;
                                    });
                                  }
                                }}
                                className="input text-sm"
                                disabled={enkinDefeated.has(archerId)}
                              >
                                <option value="">順位を選択</option>
                                {getEnkinRankOptions().map(rank => (
                                  <option key={rank} value={rank}>{rank}位</option>
                                ))}
                              </select>
                              {currentShootOffArchers.length > 1 && !enkinResults[archerId]?.rank && (
                                <button
                                  onClick={() => toggleEnkinDefeated(archerId)}
                                  className={`btn-sm ${enkinDefeated.has(archerId) ? 'btn-secondary' : 'btn-danger'}`}
                                >
                                  {enkinDefeated.has(archerId) ? '復活' : '敗退'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => saveFinalEnkinResults(calculateEnkinRanking(), enkinTargetRank || getNextEnkinTargetRank())}
                        className="btn-primary"
                      >
                        {savedEnkinRanks.has(enkinTargetRank || getNextEnkinTargetRank()) ? 'この枠の順位を上書き保存' : 'この枠の順位を保存'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}            
            
            {/* === 最終統合結果のみ表示 === */}
            <div style={{ marginTop: '2rem' }}>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">?? 最終順位決定表</h2>
              {renderMergedResults()}
            </div>

            {!shichumaFinalResults && !enkinFinalResults && isLoadingResults && (
              <div className="card">
                <p className="text-gray-500">結果を読み込み中...</p>
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
      setGeocodeStatus('? 会場住所を入力してください');
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
          .replace(/[－ー―‐?????]/g, '-')
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
    setGeocodeStatus('?? 住所から座標を取得中...');
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
          setGeocodeStatus('?? 住所から座標を取得できませんでした（住所を短くする/市区町村までにする/時間をおく などを試してください）');
          return;
        }

        const [lng, lat] = gsiFound.geometry.coordinates;
        setFormData(prev => ({ ...prev, venueLat: String(lat), venueLng: String(lng) }));
        setGeocodeStatus('? 座標を取得しました（国土地理院）');
        return;
      }

      setFormData(prev => ({ ...prev, venueLat: String(found.lat), venueLng: String(found.lon) }));
      setGeocodeStatus('? 座標を取得しました（Nominatim）');
    } catch (e) {
      console.error('Nominatim geocode error:', e);
      setGeocodeStatus('? 座標取得に失敗しました（時間をおいて再試行してください）');
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
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={formData.enableGenderSeparation || false}
                  onChange={(e) => handleInputChange('enableGenderSeparation', e.target.checked)}
                  style={{ width: '1rem', height: '1rem' }}
                />
                <span className="label">各部門で男女を分ける</span>
              </label>
              {formData.enableGenderSeparation && (
                <p className="text-sm text-gray-600" style={{ marginTop: '0.25rem' }}>
                  有効にすると、各部門で男と女の順位を別々に表示します
                </p>
              )}
            </div>
            
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
    gender: 'male',
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
    '無指定',
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

  const showQRCode = (id, name, type, tournamentName = '', affiliation = '', rank = '', gender = 'male') => {
    setQrCodeData({ 
      id, 
      name, 
      type,
      tournamentName,
      affiliation,
      rank,
      gender,
      registrationDate: new Date().toISOString()
    });
    setShowQRModal(true);
  };

  const handleCloseQRModal = () => {
    setShowQRModal(false);
  };

  const handleApply = async () => {
    if (!selectedTournamentId || !formData.name || !formData.affiliation || (formData.rank !== '無指定' && !formData.rankAcquiredDate)) {
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
        gender: formData.gender,
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
          formData.rank,
          formData.gender
        );

        localStorage.setItem('kyudo_tournament_device_id', deviceId);
        localStorage.setItem('kyudo_tournament_user', JSON.stringify(applicantData));
        
        setFormData({
          name: '',
          affiliation: '',
          rank: '初段',
          rankAcquiredDate: '',
          gender: 'male',
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
          
                  </div>

        {selectedTournamentId && (
          <div className="card">
            <input type="text" value={formData.name} onChange={(e) => handleInputChange('name', e.target.value)} placeholder="氏名 *" className="input" />
            <input type="text" value={formData.affiliation} onChange={(e) => handleInputChange('affiliation', e.target.value)} placeholder="所属 *" className="input" />
            <select value={formData.rank} onChange={(e) => handleInputChange('rank', e.target.value)} className="input">
              {rankOrder.map(rank => (<option key={rank} value={rank}>{rank}</option>))}
            </select>
            <div>
              <label>性別 *</label>
              <select value={formData.gender} onChange={(e) => handleInputChange('gender', e.target.value)} className="input">
                <option value="male">男</option>
                <option value="female">女</option>
              </select>
            </div>
            {formData.rank !== '無指定' && (
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
            )}
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
                </div>
              </div>
              
              <div className="qr-info-box">
                <p className="qr-name">{qrCodeData.name} 様</p>
                <p className="qr-details">{qrCodeData.affiliation}</p>
                <p className="qr-details">{qrCodeData.rank}</p>
                
                <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#f8f9fa', borderRadius: '0.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                    性別情報の設定・更新
                  </label>
                  <select 
                    value={qrCodeData.gender || 'male'} 
                    onChange={async (e) => {
                      const newGender = e.target.value;
                      try {
                        const response = await fetch(`${API_URL}/applicants/${qrCodeData.id}/gender`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ gender: newGender })
                        });
                        
                        if (response.ok) {
                          setQrCodeData(prev => ({ ...prev, gender: newGender }));
                          alert('性別情報を更新しました');
                        } else {
                          alert('更新に失敗しました');
                        }
                      } catch (error) {
                        console.error('性別情報更新エラー:', error);
                        alert('更新中にエラーが発生しました');
                      }
                    }}
                    className="input"
                    style={{ width: '100%', marginBottom: '0.5rem' }}
                  >
                    <option value="male">男</option>
                    <option value="female">女</option>
                  </select>
                  <p className="text-sm text-gray-600">
                    現在の設定: {qrCodeData.gender === 'female' ? '女' : '男'}
                  </p>
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