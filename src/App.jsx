import React, { useState, useReducer, useEffect } from 'react';
import { Lock, LogOut, RotateCcw, Copy, Check, QrCode, Maximize2, Filter, X, User, Camera } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import QRCodeScanner from './components/QRCodeScanner';
import './index.css';

const API_BASE_URL = (() => {
  return 'https://alluring-perfection-production-f96d.up.railway.app/api';
})();

const API_URL = API_BASE_URL;

const KyudoTournamentSystem = () => {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPassword, setAdminPassword] = useState(null);
  const [selectedTournamentId, setSelectedTournamentId] = useState(null);
  const [adminLoginStep, setAdminLoginStep] = useState('password_setup');
  const [adminView, setAdminView] = useState('recording');
  const [mainView, setMainView] = useState('tournament');
  const [tournamentState, dispatch] = useReducer(tournamentReducer, initialTournamentState);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      const response = await fetch(`${API_URL}/tournaments`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        dispatch({
          type: 'LOAD_TOURNAMENTS',
          payload: result.data
        });
      } else {
        console.error('Unexpected API response:', result);
      }
    } catch (error) {
      console.error('大会データの取得中にエラーが発生しました:', error);
      alert(`大会データの取得に失敗しました: ${error.message}`);
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
          {mainView === 'admin' && isAdminLoggedIn && <AdminView state={tournamentState} dispatch={dispatch} adminView={adminView} setAdminView={setAdminView} stands={dynamicStands} onLogout={() => { setIsAdminLoggedIn(false); setAdminLoginStep('password_setup'); setSelectedTournamentId(null); }} />}
          {mainView === 'tournament-setup' && <TournamentSetupView state={tournamentState} dispatch={dispatch} />}
          {mainView === 'archer-signup' && <ArcherSignupView state={tournamentState} dispatch={dispatch} />}
        </>
      )}
    </div>
  );
};

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
  archers: [
    { id: 1, qrCode: 'KYUDO_2024_0001_A001', name: '鈴木太郎', affiliation: '◯◯高校', segment: 1, checkIn: true, results: { stand1: ['o', 'o', 'x', 'o'], stand2: [null, null, null, null], stand3: [null, null, null, null], stand4: [null, null, null, null], stand5: [null, null, null, null], stand6: [null, null, null, null] } },
    { id: 2, qrCode: 'KYUDO_2024_0001_A002', name: '田中花子', affiliation: '△△大学', segment: 1, checkIn: true, results: { stand1: ['o', 'o', 'o', 'o'], stand2: [null, null, null, null], stand3: [null, null, null, null], stand4: [null, null, null, null], stand5: [null, null, null, null], stand6: [null, null, null, null] } },
    { id: 3, qrCode: 'KYUDO_2024_0001_A003', name: '佐藤次郎', affiliation: '□□弓道会', segment: 2, checkIn: true, results: { stand1: ['o', 'x', 'x', 'o'], stand2: [null, null, null, null], stand3: [null, null, null, null], stand4: [null, null, null, null], stand5: [null, null, null, null], stand6: [null, null, null, null] } },
    { id: 4, qrCode: 'KYUDO_2024_0001_A004', name: '小林美咲', affiliation: '◯◯高校', segment: 2, checkIn: true, results: { stand1: ['o', 'o', 'o', 'o'], stand2: [null, null, null, null], stand3: [null, null, null, null], stand4: [null, null, null, null], stand5: [null, null, null, null], stand6: [null, null, null, null] } },
    { id: 5, qrCode: 'KYUDO_2024_0001_A005', name: '石田紅太', affiliation: '△△大学', segment: 3, checkIn: false, results: { stand1: [null, null, null, null], stand2: [null, null, null, null], stand3: [null, null, null, null], stand4: [null, null, null, null], stand5: [null, null, null, null], stand6: [null, null, null, null] } },
    { id: 6, qrCode: 'KYUDO_2024_0001_A006', name: '望月由美', affiliation: '□□弓道会', segment: 3, checkIn: true, results: { stand1: ['o', 'o', 'x', 'x'], stand2: [null, null, null, null], stand3: [null, null, null, null], stand4: [null, null, null, null], stand5: [null, null, null, null], stand6: [null, null, null, null] } },
  ],
};

function tournamentReducer(state, action) {
  switch (action.type) {
    case 'LOAD_TOURNAMENTS': {
      return { ...state, registeredTournaments: action.payload.map(t => ({ id: t.id, data: t.data })) };
    }
    case 'LOAD_APPLICANTS': {
      return { ...state, applicants: action.payload };
    }
    case 'UPDATE_ARCHER_APPLICANT': {
      const updatedApplicants = [...state.applicants];
      updatedApplicants[action.payload.index] = {
        ...updatedApplicants[action.payload.index],
        ...action.payload.updates
      };
      return { ...state, applicants: updatedApplicants };
    }
    case 'RECORD_RESULT': {
      const { archerId, stand, arrowIndex, result } = action.payload;
      return { ...state, archers: state.archers.map(a => a.id === archerId ? { ...a, results: { ...a.results, [`stand${stand}`]: a.results[`stand${stand}`].map((r, i) => i === arrowIndex ? result : r) } } : a) };
    }
    case 'UNDO_RESULT': {
      const { archerId, stand, arrowIndex } = action.payload;
      return { ...state, archers: state.archers.map(a => a.id === archerId ? { ...a, results: { ...a.results, [`stand${stand}`]: a.results[`stand${stand}`].map((r, i) => i === arrowIndex ? null : r) } } : a) };
    }
    case 'CHECK_IN_ARCHER': return { ...state, archers: state.archers.map(a => a.id === action.payload ? { ...a, checkIn: true } : a) };
    case 'UPDATE_PASS_RULE': return { ...state, tournament: { ...state.tournament, passRule: action.payload } };
    case 'UPDATE_ARROWS_ROUND1': return { ...state, tournament: { ...state.tournament, arrowsRound1: parseInt(action.payload) } };
    case 'UPDATE_ARROWS_ROUND2': return { ...state, tournament: { ...state.tournament, arrowsRound2: parseInt(action.payload) } };
    case 'UPDATE_CURRENT_ROUND': return { ...state, tournament: { ...state.tournament, currentRound: action.payload } };
    case 'UPDATE_ARCHERS_PER_STAND': return { ...state, tournament: { ...state.tournament, archersPerStand: parseInt(action.payload) } };
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

const TournamentView = ({ state, stands, checkInCount }) => {
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [archers, setArchers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const filteredTournaments = state.registeredTournaments.filter(tournament => 
    tournament.id
  );

  const rankOrder = ['五級', '四級', '三級', '弐級', '壱級', '初段', '弐段', '参段', '四段', '五段', '錬士五段', '錬士六段', '教士七段', '教士八段', '範士八段', '範士九段'];

  const getRankCategory = (rankStr) => {
    // 称号と段位に分離
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

  const fetchAndSortArchers = async () => {
    if (!selectedTournamentId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/applicants/${selectedTournamentId}`);
      const result = await response.json();

      if (result.success) {
        const checkedIn = result.data.filter(a => a.isCheckedIn);
        
        // ソート処理
        const normalizeRank = (rank) => {
          if (!rank) return '';
          return rank
            .replace('二段', '弐段')
            .replace('三段', '参段')
            .replace('二級', '弐級')
            .replace('一級', '壱級');
        };

        const sortedArchers = [...checkedIn].sort((a, b) => {
          // ランクを正規化
          const aRank = normalizeRank(a.rank);
          const bRank = normalizeRank(b.rank);

          // インデックスを取得（見つからない場合は最後尾に配置）
          const aIndex = rankOrder.indexOf(aRank);
          const bIndex = rankOrder.indexOf(bRank);

          // ランクが異なる場合はランク順でソート
          if (aIndex !== bIndex) {
            if (aIndex === -1 && bIndex === -1) return 0;
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return aIndex - bIndex;
          }

          // ランクが同じ場合は取得日でソート（古い順）
          const aDate = a.rankAcquiredDate ? new Date(a.rankAcquiredDate) : new Date(0);
          const bDate = b.rankAcquiredDate ? new Date(b.rankAcquiredDate) : new Date(0);
          return aDate.getTime() - bDate.getTime();
        });

        // 立ち順番号を付与
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

  useEffect(() => {
    if (selectedTournamentId) {
      fetchAndSortArchers();
    }
  }, [selectedTournamentId]);

  const tournament = state.tournament;
  const arrowsPerStand = tournament.currentRound === 1 ? tournament.arrowsRound1 : tournament.arrowsRound2;

  const isPassed = (archer) => {
    const stand1Results = archer.results?.stand1 || [null, null, null, null];
    if (stand1Results.slice(0, arrowsPerStand).includes(null)) return null;
    const count = stand1Results.slice(0, arrowsPerStand).filter(r => r === 'o').length;
    switch (tournament.passRule) {
      case 'all_four': return count === arrowsPerStand;
      case 'four_or_more': return count >= 4;
      case 'three_or_more': return count >= Math.ceil(arrowsPerStand / 2);
      case 'two_or_more': return count >= 2;
      default: return false;
    }
  };

  const passedArchers = archers.filter(a => isPassed(a));

  const selectedTournament = state.registeredTournaments.find(t => t.id === selectedTournamentId);

  return (
    <div className="view-container">
      <div className="view-header">
        <h1>大会進行</h1>
        <div style={{ marginTop: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>大会を選択</label>
          <select 
            value={selectedTournamentId} 
            onChange={(e) => setSelectedTournamentId(e.target.value)}
            className="input w-full"
            style={{ marginBottom: '1rem' }}
          >
            <option value="">-- 大会を選択してください --</option>
            {filteredTournaments.map(t => (
              <option key={t.id} value={t.id}>{t.data?.name || t.id}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="view-content">
        {selectedTournamentId && (
          <>
            <div className="settings-grid">
              <div><p className="label">受付済み</p><p className="value">{archers.length}人</p></div>
              <div><p className="label">通過者</p><p className="value">{passedArchers.length}人</p></div>
              <div><p className="label">通過ルール</p><p className="value" style={{ fontSize: '0.75rem' }}>
                {tournament.passRule === 'all_four' ? '全て的中' :
                 tournament.passRule === 'four_or_more' ? '4本以上的中' :
                 tournament.passRule === 'three_or_more' ? '3本以上的中' :
                 tournament.passRule === 'two_or_more' ? '2本以上的中' : '未設定'}
              </p></div>
              <div><p className="label">矢数</p><p className="value">{arrowsPerStand}本</p></div>
            </div>

            <div className="card">
              <p className="card-title">立ち順表</p>
              <div className="table-responsive">
                <table className="archer-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.75rem' }}>立ち順</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.75rem' }}>氏名</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.75rem' }}>支部</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.75rem' }}>称号</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.75rem' }}>段位</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.75rem' }}>1立ち目</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.75rem' }}>2立ち目</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '1rem', color: '#9ca3af' }}>
                          読み込み中...
                        </td>
                      </tr>
                    ) : archers.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '1rem', color: '#9ca3af' }}>
                          受付済みの選手がいません
                        </td>
                      </tr>
                    ) : (
                      archers.map((archer) => {
                        const { ceremony, rank } = getRankCategory(archer.rank);
                        const stand1Result = archer.results?.stand1?.slice(0, arrowsPerStand) || [];
                        const stand2Result = archer.results?.stand2?.slice(0, arrowsPerStand) || [];
                        
                        return (
                          <tr key={archer.archerId} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 500 }}>{archer.standOrder}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'left' }}>{archer.name}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', color: '#4b5563' }}>{archer.affiliation}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem' }}>{ceremony || '—'}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem' }}>{rank}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                                {stand1Result.map((result, idx) => (
                                  <span key={idx} style={{
                                    display: 'inline-block',
                                    width: '1.5rem',
                                    height: '1.5rem',
                                    backgroundColor: result === 'o' ? '#111827' : result === 'x' ? '#9ca3af' : '#f3f4f6',
                                    color: result ? '#ffffff' : '#9ca3af',
                                    borderRadius: '0.25rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.75rem',
                                    fontWeight: 500
                                  }}>
                                    {result === 'o' ? '◯' : result === 'x' ? '×' : ''}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                                {stand2Result.map((result, idx) => (
                                  <span key={idx} style={{
                                    display: 'inline-block',
                                    width: '1.5rem',
                                    height: '1.5rem',
                                    backgroundColor: result === 'o' ? '#111827' : result === 'x' ? '#9ca3af' : '#f3f4f6',
                                    color: result ? '#ffffff' : '#9ca3af',
                                    borderRadius: '0.25rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.75rem',
                                    fontWeight: 500
                                  }}>
                                    {result === 'o' ? '◯' : result === 'x' ? '×' : ''}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {passedArchers.length > 0 && (
              <div className="card">
                <p className="card-title">予選通過者</p>
                <div className="card-content">
                  {passedArchers.map(a => {
                    const { ceremony, rank } = getRankCategory(a.rank);
                    return (
                      <div key={a.archerId} className="archer-item">
                        <div><p>{a.standOrder}. {a.name}</p><p className="text-sm">{a.affiliation}</p></div>
                        <span>{ceremony}{rank}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const RecordingView = ({ state, dispatch, stands }) => {
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('');
  const [selectedStand, setSelectedStand] = useState(1);
  const [selectedRound, setSelectedRound] = useState(1); // 1: 1立ち目, 2: 2立ち目
  const [archers, setArchers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const tournament = state.tournament;
  const rankOrder = ['五級', '四級', '三級', '弐級', '壱級', '初段', '弐段', '参段', '四段', '五段', '錬士五段', '錬士六段', '教士七段', '教士八段', '範士八段', '範士九段'];
  
  // 現在のラウンドに応じた矢数を取得
  const getCurrentArrowsPerStand = () => {
    return selectedRound === 1 ? tournament.arrowsRound1 : tournament.arrowsRound2;
  };
  
  // 現在のラウンドに応じたスタンドの結果を取得
  const getCurrentStandResults = (archer) => {
    const standKey = `stand${selectedStand}`;
    const currentArrows = getCurrentArrowsPerStand();
    
    // 結果が存在しないか、必要な長さに満たない場合は、現在のラウンドの矢数に合わせた配列を返す
    if (!archer.results || !archer.results[standKey] || archer.results[standKey].length < currentArrows) {
      return Array(currentArrows).fill(null);
    }
    
    // 現在のラウンドの結果を取得（現在の矢数に合わせてスライス）
    return archer.results[standKey].slice(0, currentArrows);
  };
  
  // 現在のラウンドの完了状態をチェック
  const isRoundComplete = (archer) => {
    const results = getCurrentStandResults(archer);
    return results.every(result => result !== null);
  };

  const getRankCategory = (rankStr) => {
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

  const getDivision = (rank) => {
    const { ceremony } = getRankCategory(rank);
    
    // 称号者の部
    if (ceremony) return 'title';
    
    // 段位で分類
    const levelIndex = rankOrder.indexOf(rank);
    
    // 級位～三段以下の部
    if (levelIndex <= rankOrder.indexOf('参段')) return 'lower';
    
    // 四・五段の部
    if (levelIndex <= rankOrder.indexOf('五段')) return 'middle';
    
    return 'lower';
  };

  // 選択中の大会に部門設定があればそれを使う。なければデフォルトを使用
  const selectedTournament = state.registeredTournaments.find(t => t.id === selectedTournamentId);
  const localDefaultDivisions = [
    { id: 'lower', label: '級位～三段以下の部' },
    { id: 'middle', label: '四・五段の部' },
    { id: 'title', label: '称号者の部' }
  ];
  const divisions = (selectedTournament && selectedTournament.data && selectedTournament.data.divisions) ? selectedTournament.data.divisions : localDefaultDivisions;

  const fetchAndSortArchers = async () => {
    if (!selectedTournamentId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/applicants/${selectedTournamentId}`);
      const result = await response.json();

      if (result.success) {
        const checkedIn = result.data.filter(a => a.isCheckedIn);
        
        // 漢数字の表記揺れを吸収する関数
        const normalizeRank = (rank) => {
          if (!rank) return '';
          return rank
            .replace('二段', '弐段')
            .replace('三段', '参段')
            .replace('二級', '弐級')
            .replace('一級', '壱級');
        };

        // ソート処理
        const sortedArchers = [...checkedIn].sort((a, b) => {
          // ランクを正規化
          const aRank = normalizeRank(a.rank);
          const bRank = normalizeRank(b.rank);
          
          // インデックスを取得（見つからない場合は最後尾に配置）
          const aIndex = rankOrder.indexOf(aRank);
          const bIndex = rankOrder.indexOf(bRank);
          
          // デバッグ用ログ
          console.log('Sorting:', {
            a: { name: a.name, originalRank: a.rank, normalizedRank: aRank, index: aIndex },
            b: { name: b.name, originalRank: b.rank, normalizedRank: bRank, index: bIndex },
            comparison: aIndex - bIndex
          });

          // ランクが異なる場合はランク順でソート
          if (aIndex !== bIndex) {
            // 両方見つからない場合は元の順序を保持
            if (aIndex === -1 && bIndex === -1) return 0;
            // aが見つからない場合は後ろに
            if (aIndex === -1) return 1;
            // bが見つからない場合は前に
            if (bIndex === -1) return -1;
            // 通常の比較
            return aIndex - bIndex;
          }

          // ランクが同じ場合は取得日でソート（古い順）
          const aDate = a.rankAcquiredDate ? new Date(a.rankAcquiredDate) : new Date(0);
          const bDate = b.rankAcquiredDate ? new Date(b.rankAcquiredDate) : new Date(0);
          return aDate.getTime() - bDate.getTime();
        });

        // 立ち順番号を付与
        const archersWithOrder = sortedArchers.map((archer, index) => ({
          ...archer,
          standOrder: index + 1,
          division: archer.division || getDivision(archer.rank),
          results: archer.results || { stand1: [null, null, null, null], stand2: [null, null, null, null], stand3: [null, null, null, null], stand4: [null, null, null, null], stand5: [null, null, null, null], stand6: [null, null, null, null] }
        }));

        setArchers(archersWithOrder);
        
        // 最初の部門を自動選択
        const firstDivision = archersWithOrder.length > 0 ? archersWithOrder[0].division : '';
        setSelectedDivision(firstDivision);
      }
    } catch (error) {
      console.error('選手データの取得に失敗しました:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTournamentId) {
      fetchAndSortArchers();
    }
  }, [selectedTournamentId]);

  const filteredTournaments = state.registeredTournaments;

  const arrowsPerStand = tournament.arrowsRound1; // 1立ち目の矢数
  const arrowsPerStand2 = tournament.arrowsRound2; // 2立ち目の矢数

  // 選択された部門の選手を取得
  const divisionArchers = archers.filter(a => a.division === selectedDivision);

  // 立てごとに選手を割り当て
  const getArchersForStand = (standNumber) => {
    const archersPerStand = tournament.archersPerStand;
    const startIdx = (standNumber - 1) * archersPerStand;
    return divisionArchers.slice(startIdx, startIdx + archersPerStand);
  };

  const standArchers = getArchersForStand(selectedStand);

  const handleRecord = (archerId, standNum, arrowIndex, result) => {
    // アーチャーを検索
    const archer = archers.find(a => a.archerId === archerId);
    if (!archer) return;
    
    const standKey = `stand${standNum}`;
    const currentArrows = getCurrentArrowsPerStand();
    
    // 現在の結果を取得（存在しない場合は空の配列）
    const currentResults = archer.results?.[standKey] || [];
    
    // 新しい結果配列を作成（現在の矢数に合わせて初期化）
    const newResults = Array(currentArrows).fill(null);
    
    // 既存の結果をコピー（現在の矢数を超えない範囲で）
    currentResults.slice(0, currentArrows).forEach((r, i) => {
      newResults[i] = r;
    });
    
    // 現在の矢の結果を更新
    if (arrowIndex < currentArrows) {
      newResults[arrowIndex] = result;
    }
    
    // アーチャーの状態を更新
    const updatedArchers = archers.map(a => 
      a.archerId === archerId 
        ? { 
            ...a, 
            results: { 
              ...a.results, 
              [standKey]: newResults 
            } 
          } 
        : a
    );
    
    // 状態を更新
    setArchers(updatedArchers);
  };

  const handleUndo = (archerId, standNum, arrowIndex) => {
    // アーチャーを検索
    const archer = archers.find(a => a.archerId === archerId);
    if (!archer) return;
    
    const standKey = `stand${standNum}`;
    const currentArrows = getCurrentArrowsPerStand();
    
    // 現在の結果を取得（存在しない場合は空の配列）
    const currentResults = archer.results?.[standKey] || [];
    
    // 新しい結果配列を作成（現在の矢数に合わせて初期化）
    const newResults = Array(currentArrows).fill(null);
    
    // 既存の結果をコピー（現在の矢数を超えない範囲で）
    currentResults.slice(0, currentArrows).forEach((r, i) => {
      newResults[i] = r;
    });
    
    // 指定されたインデックスの結果をnullに
    if (arrowIndex < currentArrows) {
      newResults[arrowIndex] = null;
    }
    
    // アーチャーの状態を更新
    const updatedArchers = archers.map(a => 
      a.archerId === archerId 
        ? { 
            ...a, 
            results: { 
              ...a.results, 
              [standKey]: newResults 
            } 
          } 
        : a
    );
    
    // 状態を更新
    setArchers(updatedArchers);
  };

  // 指定されたスタンドとラウンドの的中数を計算
  const getHitCount = (archer, standNum, roundNum = null) => {
    const results = archer.results?.[`stand${standNum}`] || [];
    const currentArrows = roundNum === 2 ? tournament.arrowsRound2 : tournament.arrowsRound1;
    return results.slice(0, currentArrows).filter(r => r === 'o').length;
  };
  
  // 現在のラウンドの的中数を取得
  const getCurrentRoundHitCount = (archer) => {
    const results = getCurrentStandResults(archer);
    return results.filter(r => r === 'o').length;
  };
  
  // 合計的中数を計算（1立ち目と2立ち目の合計）
  const getTotalHitCount = (archer) => {
    const stand1Hits = getHitCount(archer, selectedStand, 1);
    const stand2Hits = getHitCount(archer, selectedStand, 2);
    return stand1Hits + stand2Hits;
  };

  // 部門内での順位を計算（1立ち目と2立ち目の合計で計算）
  const calculateRanks = () => {
    const hitCounts = divisionArchers.map(archer => ({
      archerId: archer.archerId,
      // 1立ち目と2立ち目の合計的中数を使用
      hitCount: getHitCount(archer, selectedStand, 1) + getHitCount(archer, selectedStand, 2)
    }));

    // 的中数でソート（多い順）
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
        <h1>記録入力</h1>
        <p>部門ごとに立ち順を管理</p>
      </div>
      <div className="view-content">
        <div className="card">
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>大会を選択</label>
          <select 
            value={selectedTournamentId} 
            onChange={(e) => {
              setSelectedTournamentId(e.target.value);
              setSelectedStand(1);
            }}
            className="input w-full"
          >
            <option value="">-- 大会を選択してください --</option>
            {filteredTournaments.map(t => (
              <option key={t.id} value={t.id}>{t.data?.name || t.id}</option>
            ))}
          </select>
        </div>

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
                  const hitCount = getCurrentRoundHitCount(archer);
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
                                <button onClick={() => handleUndo(archer.archerId, selectedStand, arrowIdx)} className="btn-fix" disabled={roundComplete}>修正</button>
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
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [showQRModal, setShowQRModal] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [locationFilter, setLocationFilter] = useState('');
  const [currentQRCodeData, setCurrentQRCodeData] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const checkinListRef = React.useRef(null);
  
  const filteredTournaments = state.registeredTournaments.filter(tournament => 
    locationFilter === '' || 
    (tournament.data.location && tournament.data.location.toLowerCase().includes(locationFilter.toLowerCase()))
  );
  
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
        
        // deviceIdが一致した場合のみ「自分の申し込み」として表示
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
          // deviceIdがない場合（受付用端末など）は常に手動入力フォームを表示
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

  // 自動リロード機能
  useEffect(() => {
    if (!autoRefresh || !selectedTournamentId) return;

    const interval = setInterval(() => {
      fetchTournamentData();
    }, 2000); // 2秒ごとにリロード

    return () => clearInterval(interval);
  }, [autoRefresh, selectedTournamentId]);

  useEffect(() => {
    if (selectedTournamentId) {
      setAutoRefresh(false); // 大会を変更したら自動リロード停止
      fetchTournamentData();
    } else {
      setCheckIns([]);
      setMyApplicantData(null);
      setAutoRefresh(false);
    }
  }, [selectedTournamentId]);

  const showQRCodeFromMultiple = (applicant) => {
    setShowQRModal(true);
    setAutoRefresh(true); // QRコード表示時に自動リロード開始
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
    
    setAutoRefresh(true); // QRコード表示時に自動リロード開始
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
    setAutoRefresh(true); // QRコード表示時に自動リロード開始
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
    setAutoRefresh(true); // QRコード表示時に自動リロード開始
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

  // ★★★ 修正版：QRコード読込時のハンドラー ★★★
  const handleQRCodeScanned = (qrCode) => {
    console.log('🔱 QRコードをスキャンしました:', qrCode);
    
    try {
      let archerId = qrCode.trim();
      
      // QRコードがJSON形式の場合はパース
      try {
        const qrData = JSON.parse(qrCode);
        if (qrData.id) {
          archerId = qrData.id;  // JSONからIDを抽出
          console.log('✅ JSONからIDを抽出:', archerId);
        }
      } catch (parseError) {
        // JSON形式でない場合は、そのままの文字列を使用
        console.log('ℹ️ JSONではなく、直接IDとして処理します:', archerId);
      }
      
      setScannedQR(archerId);
      setShowQRScanner(false);
      
      setTimeout(() => {
        handleCheckIn(archerId);
      }, 100);
    } catch (error) {
      console.error('QRコード処理エラー:', error);
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

  // ★★★ 修正版：受付処理関数 ★★★
  const handleCheckIn = async (scannedArcherId = null) => {
    if (!selectedTournamentId) {
      setMessage('❌ 大会を選択してください');
      return;
    }

    // 引数があればそれを使用、なければstateから取得
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
        setAutoRefresh(true); // 自動リロード開始
        await fetchTournamentData();
        
        // 受付済み一覧にスクロール
        setTimeout(() => {
          if (checkinListRef.current) {
            checkinListRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 300);
      } else {
        setMessage(`❌ ${checkInResult.message || '受付に失敗しました'}`);
      }
    } catch (error) {
      console.error('受付処理でエラーが発生しました:', error);
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
      
      return `${year}年${month}月${day}日（${weekday}） ${hours}:${minutes}`;
    } catch (error) {
      console.error('日付のフォーマットに失敗しました:', error);
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
                filteredTournaments.map(tournament => (
                  <option key={tournament.id} value={tournament.id}>
                    {tournament.data.name} ({tournament.data.location})
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
                      <p className="hint" style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>受付で表示したい選手の「表示」ボタンを押してQRコードを表示してください</p>
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
                      <p className="hint" style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>受付でこのボタンを押してQRコードを表示してください</p>
                    </>
                  )}
                  
                  {!showManualInput ? (
                    <button 
                      onClick={() => setShowManualInput(true)}
                      style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline' }}
                    >
                      🔍 ID手動入力・スキャン（係員用）
                    </button>
                  ) : (
                    <button 
                      onClick={() => setShowManualInput(false)}
                      style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.875rem' }}
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
                  <p className="hint">例: KYUDO_2024_0001_001 または STAFF_XXXXXX</p>
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
                    
                    <div className="relative" style={{ position: 'relative', margin: '0.5rem 0' }}>
                      <div className="absolute inset-0 flex items-center" style={{ position: 'absolute', top: '50%', width: '100%', borderTop: '1px solid #e5e7eb' }}></div>
                      <div className="relative flex justify-center text-sm" style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                        <span style={{ padding: '0 0.5rem', backgroundColor: 'white', color: '#6b7280', fontSize: '0.875rem' }}>または</span>
                      </div>
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
                              <QrCode size={16} /> QRコード表示
                            </button>
                            {archer.isCheckedIn && (
                              <button 
                                onClick={() => showScreenshotQRCode(archer)}
                                className="btn-secondary"
                                style={{ marginLeft: '8px' }}
                                title="スクリーンショット用に表示"
                              >
                                <Maximize2 size={16} /> スクリーンショット
                              </button>
                            )}
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
                      <div className="qr-code-wrapper">
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
                      </div>
                      
                      <div className="qr-info-box">
                        <p className="qr-name">{currentQRCodeData.name} 様</p>
                        <p className="qr-details">{currentQRCodeData.affiliation}</p>
                        <p className="qr-details">{currentQRCodeData.rank}</p>
                        <div className="qr-id-section">
                          <p className="qr-id-label">選手ID</p>
                          <p className="qr-id-value">{currentQRCodeData.id}</p>
                        </div>
                      </div>
                      
                      <div className="qr-instruction">
                        <p>この画面を受付担当者に表示してください</p>
                      </div>
                    </div>
                    
                    <div className="qr-modal-footer">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingRight: '0' }}>
                        <div>
                          {autoRefresh && (
                            <div style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <span style={{ display: 'inline-block', width: '0.5rem', height: '0.5rem', backgroundColor: '#10b981', borderRadius: '50%', animation: 'pulse 1.5s ease-in-out infinite' }}></span>
                              自動更新中
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setShowQRModal(false);
                            setAutoRefresh(false);
                          }}
                          className="btn-primary"
                          style={{ marginTop: 0, width: 'auto' }}
                        >
                          閉じる
                        </button>
                      </div>
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

const AdminView = ({ state, dispatch, adminView, setAdminView, stands, onLogout }) => {
  if (adminView === 'recording') {
    return (
      <div>
        <div className="admin-header">
          <div className="button-group">
            <button onClick={() => setAdminView('recording')} className={`btn ${adminView === 'recording' ? 'btn-active' : ''}`}>記録入力</button>
            <button onClick={() => setAdminView('settings')} className={`btn ${adminView === 'settings' ? 'btn-active' : ''}`}>設定</button>
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
          </div>
          <button onClick={onLogout} className="btn-logout"><LogOut size={14} />ログアウト</button>
        </div>
        <SettingsView state={state} dispatch={dispatch} />
      </div>
    );
  }
};

const SettingsView = ({ state, dispatch }) => {
  return (
    <div className="view-container pb-6">
      <div className="view-content">
        <div className="card">
          <p className="card-title">通過判定ルール</p>
          <div className="radio-group">
            {[{ value: 'all_four', label: '全て的中' }, { value: 'four_or_more', label: '4本以上的中' }, { value: 'three_or_more', label: '3本以上的中' }, { value: 'two_or_more', label: '2本以上的中' }].map(rule => (
              <label key={rule.value} className="radio-label">
                <input type="radio" name="passRule" value={rule.value} checked={state.tournament.passRule === rule.value} onChange={(e) => dispatch({ type: 'UPDATE_PASS_RULE', payload: e.target.value })} />
                <span>{rule.label}</span>
              </label>
            ))}
          </div>
          <div className="divider"></div>
          <p className="label">予選1回戦の矢数</p>
          <select value={state.tournament.arrowsRound1} onChange={(e) => dispatch({ type: 'UPDATE_ARROWS_ROUND1', payload: e.target.value })} className="input">
            <option value={2}>2本</option>
            <option value={4}>4本</option>
          </select>
          <div className="divider"></div>
          <p className="label">予選2回戦の矢数</p>
          <select value={state.tournament.arrowsRound2} onChange={(e) => dispatch({ type: 'UPDATE_ARROWS_ROUND2', payload: e.target.value })} className="input">
            <option value={2}>2本</option>
            <option value={4}>4本</option>
          </select>
          <div className="divider"></div>
          <p className="label">道場に入る最大の人数</p>
          <select value={state.tournament.archersPerStand} onChange={(e) => dispatch({ type: 'UPDATE_ARCHERS_PER_STAND', payload: e.target.value })} className="input">
            {[6, 8, 10, 12].map(n => (<option key={n} value={n}>{n}人</option>))}
          </select>
          <p className="hint">場所に応じて設定してください</p>
        </div>
        <button onClick={() => dispatch({ type: 'RESET_ALL' })} className="btn-danger"><RotateCcw size={16} />すべてリセット</button>
      </div>
    </div>
  );
};

const TournamentSetupView = ({ state, dispatch }) => {
  const [copied, setCopied] = useState(false);
  const [tournamentId, setTournamentId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [locationFilter, setLocationFilter] = useState('');
  const [formData, setFormData] = useState({
    name: '', datetime: '', location: '', organizer: '', coOrganizer: '', administrator: '', purpose: '', event: '', type: '', category: '', description: '', competitionMethod: '', award: '', qualifications: '', applicableRules: '', applicationMethod: '', remarks: '',
    divisions: [
      { id: 'lower', label: '級位～三段以下の部' },
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
  const handleLoadTemplate = (template) => { setFormData(template.data); setTournamentId(template.id); setIsEditing(true); };
  
  const defaultDivisions = [
    { id: 'lower', label: '級位～三段以下の部', minRank: '五級', maxRank: '参段' },
    { id: 'middle', label: '四・五段の部', minRank: '四段', maxRank: '五段' },
    { id: 'title', label: '称号者の部', minRank: '錬士五段', maxRank: '範士九段' }
  ];

  const handleLoadTemplateSafe = (template) => {
    const data = template.data || {};
    setFormData({ ...defaultDivisions && { divisions: defaultDivisions }, ...data, divisions: data.divisions || defaultDivisions });
    setTournamentId(template.id);
    setIsEditing(true);
  };
  const handleSaveTournament = async () => {
    if (!formData.name || !formData.datetime || !formData.location) { 
      alert('大会名、開催日時、開催場所は必須です'); 
      return; 
    }
    
    try {
      const newId = isEditing && tournamentId ? tournamentId : generateTournamentId();
      
      const response = await fetch(`${API_URL}/tournaments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newId,
          data: formData
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setTournamentId(newId);
        setIsEditing(true);
        dispatch({ type: 'SAVE_TOURNAMENT_TEMPLATE', payload: { id: newId, data: formData } });
        dispatch({ type: 'UPDATE_TOURNAMENT_INFO', payload: { id: newId, name: formData.name } });
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
    setFormData({ name: '', datetime: '', location: '', organizer: '', coOrganizer: '', administrator: '', purpose: '', event: '', type: '', category: '', description: '', competitionMethod: '', award: '', qualifications: '', applicableRules: '', applicationMethod: '', remarks: '', divisions: defaultDivisions });
    setTournamentId(null);
    setIsEditing(false);
    setCopied(false);
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
          <input type="text" value={formData.organizer} onChange={(e) => handleInputChange('organizer', e.target.value)} placeholder="主催" className="input" />
          <input type="text" value={formData.coOrganizer} onChange={(e) => handleInputChange('coOrganizer', e.target.value)} placeholder="後援" className="input" />
          <input type="text" value={formData.administrator} onChange={(e) => handleInputChange('administrator', e.target.value)} placeholder="主管" className="input" />
          <div style={{ marginTop: '0.5rem' }}>
            <p className="label">大会要項</p>
            <input type="text" value={formData.purpose} onChange={(e) => handleInputChange('purpose', e.target.value)} placeholder="目的" className="input" />
            <input type="text" value={formData.event} onChange={(e) => handleInputChange('event', e.target.value)} placeholder="種目" className="input" />
            <input type="text" value={formData.type} onChange={(e) => handleInputChange('type', e.target.value)} placeholder="種類" className="input" />
            <input type="text" value={formData.category} onChange={(e) => handleInputChange('category', e.target.value)} placeholder="種別" className="input" />
            <textarea value={formData.description} onChange={(e) => handleInputChange('description', e.target.value)} placeholder="内容（大会の詳細）" className="input" style={{ minHeight: '4rem' }} />
            <input type="text" value={formData.competitionMethod} onChange={(e) => handleInputChange('competitionMethod', e.target.value)} placeholder="競技方法" className="input" />
            <input type="text" value={formData.award} onChange={(e) => handleInputChange('award', e.target.value)} placeholder="表彰" className="input" />
            <input type="text" value={formData.qualifications} onChange={(e) => handleInputChange('qualifications', e.target.value)} placeholder="参加資格" className="input" />
            <input type="text" value={formData.applicableRules} onChange={(e) => handleInputChange('applicableRules', e.target.value)} placeholder="適用規則" className="input" />
            <input type="text" value={formData.applicationMethod} onChange={(e) => handleInputChange('applicationMethod', e.target.value)} placeholder="申込方法" className="input" />
            <input type="text" value={formData.remarks} onChange={(e) => handleInputChange('remarks', e.target.value)} placeholder="その他必要事項（備考）" className="input" />

            <div style={{ marginTop: '0.75rem' }}>
              <p className="label">部門設定（最低3つ）</p>
              {formData.divisions && (() => {
                const rankOptions = ['五級', '四級', '三級', '弐級', '壱級', '初段', '弐段', '参段', '四段', '五段', '錬士五段', '錬士六段', '教士七段', '教士八段', '範士八段', '範士九段'];
                return formData.divisions.map((d, idx) => (
                  <div key={d.id} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={d.label}
                      onChange={(e) => {
                        const newDivs = (formData.divisions || []).map((dv, i) => i === idx ? { ...dv, label: e.target.value } : dv);
                        setFormData(prev => ({ ...prev, divisions: newDivs }));
                      }}
                      className="input"
                      style={{ flex: 1 }}
                    />
                    <select
                      value={d.minRank || ''}
                      onChange={(e) => {
                        const newDivs = (formData.divisions || []).map((dv, i) => i === idx ? { ...dv, minRank: e.target.value } : dv);
                        setFormData(prev => ({ ...prev, divisions: newDivs }));
                      }}
                      className="input"
                      style={{ width: '10rem' }}
                    >
                      {rankOptions.map(r => (<option key={r} value={r}>{`from ${r}`}</option>))}
                    </select>
                    <select
                      value={d.maxRank || ''}
                      onChange={(e) => {
                        const newDivs = (formData.divisions || []).map((dv, i) => i === idx ? { ...dv, maxRank: e.target.value } : dv);
                        setFormData(prev => ({ ...prev, divisions: newDivs }));
                      }}
                      className="input"
                      style={{ width: '10rem' }}
                    >
                      {rankOptions.map(r => (<option key={r} value={r}>{`to ${r}`}</option>))}
                    </select>
                    <span style={{ alignSelf: 'center', color: '#6b7280', width: '3rem' }}>{d.id}</span>
                  </div>
                ));
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
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [locationFilter, setLocationFilter] = useState('');
  const [formData, setFormData] = useState({
    name: '', 
    affiliation: '', 
    rank: '初段', 
    rankAcquiredDate: '',
    isOfficialOnly: false
  });
  const [applicants, setApplicants] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  
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
  
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem('kyudo_tournament_user');
    return savedUser ? JSON.parse(savedUser) : null;
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

    // 大会側に divisions 範囲指定がある場合はそれを優先して判定
    if (Array.isArray(tournamentDivisions) && tournamentDivisions.length > 0) {
      for (const d of tournamentDivisions) {
        // title は称号で判定済み
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

    // 大会側の指定がない場合は既存の閾値で分類
    const idx3 = rankOrder.indexOf('参段');
    const idx5 = rankOrder.indexOf('五段');

    if (idx !== -1 && idx <= idx3) return 'lower';
    if (idx !== -1 && idx <= idx5) return 'middle';

    return 'lower';
  };

  const fetchApplicants = async () => {
    if (!selectedTournamentId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/applicants/${selectedTournamentId}`);
      const result = await response.json();
      
      if (result.success) {
        setApplicants(result.data || []);
      }
    } catch (error) {
      console.error('申し込みデータの取得エラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTournamentId) {
      fetchApplicants();
    } else {
      setApplicants([]);
    }
  }, [selectedTournamentId]);

  // QRモーダル表示時の自動リロード機能
  useEffect(() => {
    if (!autoRefresh || !selectedTournamentId) return;

    const interval = setInterval(() => {
      fetchApplicants();
    }, 2000); // 2秒ごとにリロード

    return () => clearInterval(interval);
  }, [autoRefresh, selectedTournamentId]);

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
    setAutoRefresh(true); // QRコード表示時に自動リロード開始
  };

  const handleCloseQRModal = () => {
    setShowQRModal(false);
    setAutoRefresh(false); // QRコード閉じる時に自動リロード停止
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
        await fetchApplicants();
        
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
              onChange={(e) => { 
                setSelectedTournamentId(e.target.value); 
                setShowForm(e.target.value !== ''); 
              }} 
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

        {showForm && (
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
                <div className="qr-code-wrapper">
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
                
                <div className="qr-info-box">
                  <p className="qr-name">{qrCodeData.name} 様</p>
                  <p className="qr-details">{qrCodeData.affiliation}</p>
                  <p className="qr-details">{qrCodeData.rank}</p>
                </div>
              </div>
              
              <div className="qr-modal-footer">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingRight: '0' }}>
                  <div>
                    {autoRefresh && (
                      <div style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span style={{ display: 'inline-block', width: '0.5rem', height: '0.5rem', backgroundColor: '#10b981', borderRadius: '50%', animation: 'pulse 1.5s ease-in-out infinite' }}></span>
                        自動更新中
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleCloseQRModal}
                    className="btn-primary"
                    style={{ marginTop: 0, width: 'auto' }}
                  >
                    閉じる
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default KyudoTournamentSystem;