import React, { useState, useReducer, useEffect } from 'react';
import { Lock, LogOut, RotateCcw, Copy, Check, QrCode, Maximize2, Filter, X, User } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import './index.css';

const API_URL = 'http://localhost:3001/api';

const KyudoTournamentSystem = () => {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPassword, setAdminPassword] = useState(null);
  const [selectedTournamentId, setSelectedTournamentId] = useState(null);
  const [adminLoginStep, setAdminLoginStep] = useState('password_setup');
  const [adminView, setAdminView] = useState('recording');
  const [mainView, setMainView] = useState('tournament');
  const [tournamentState, dispatch] = useReducer(tournamentReducer, initialTournamentState);
  const [loading, setLoading] = useState(true);

  // 初期化：サーバーから大会データを取得
  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      const response = await fetch(`${API_URL}/tournaments`);
      const result = await response.json();
      if (result.success && result.data) {
        dispatch({
          type: 'LOAD_TOURNAMENTS',
          payload: result.data
        });
      }
    } catch (error) {
      console.error('Error fetching tournaments:', error);
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
    name: '第〇回〇〇弓道大会',
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
    { id: 1, qrCode: 'KYUDO_2024_0001_A001', name: '鈴木太郎', affiliation: '〇〇高校', segment: 1, checkIn: true, results: { stand1: ['o', 'o', 'x', 'o'], stand2: [null, null, null, null], stand3: [null, null, null, null], stand4: [null, null, null, null], stand5: [null, null, null, null], stand6: [null, null, null, null] } },
    { id: 2, qrCode: 'KYUDO_2024_0001_A002', name: '田中花子', affiliation: '△△大学', segment: 1, checkIn: true, results: { stand1: ['o', 'o', 'o', 'o'], stand2: [null, null, null, null], stand3: [null, null, null, null], stand4: [null, null, null, null], stand5: [null, null, null, null], stand6: [null, null, null, null] } },
    { id: 3, qrCode: 'KYUDO_2024_0001_A003', name: '佐藤次郎', affiliation: '□□弓道会', segment: 2, checkIn: true, results: { stand1: ['o', 'x', 'x', 'o'], stand2: [null, null, null, null], stand3: [null, null, null, null], stand4: [null, null, null, null], stand5: [null, null, null, null], stand6: [null, null, null, null] } },
    { id: 4, qrCode: 'KYUDO_2024_0001_A004', name: '小林美咲', affiliation: '〇〇高校', segment: 2, checkIn: true, results: { stand1: ['o', 'o', 'o', 'o'], stand2: [null, null, null, null], stand3: [null, null, null, null], stand4: [null, null, null, null], stand5: [null, null, null, null], stand6: [null, null, null, null] } },
    { id: 5, qrCode: 'KYUDO_2024_0001_A005', name: '石田健太', affiliation: '△△大学', segment: 3, checkIn: false, results: { stand1: [null, null, null, null], stand2: [null, null, null, null], stand3: [null, null, null, null], stand4: [null, null, null, null], stand5: [null, null, null, null], stand6: [null, null, null, null] } },
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
  const tournament = state.tournament;
  const archers = state.archers;
  const arrowsPerStand = tournament.currentRound === 1 ? tournament.arrowsRound1 : tournament.arrowsRound2;

  const isPassed = (archer) => {
    const stand1Results = archer.results.stand1;
    if (!stand1Results || stand1Results.slice(0, arrowsPerStand).includes(null)) return null;
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
  const totalShots = checkInCount * arrowsPerStand;
  const completedShots = archers.reduce((sum, a) => sum + Object.values(a.results).flat().filter(r => r !== null).length, 0);
  const progressPercent = totalShots > 0 ? (completedShots / totalShots) * 100 : 0;

  return (
    <div className="view-container">
      <div className="view-header">
        <h1>{tournament.name}</h1>
        <p>{tournament.date}</p>
      </div>
      <div className="view-content">
        <div className="settings-grid">
          <div><p className="label">受付済み</p><p className="value">{checkInCount}名</p></div>
          <div><p className="label">1立あたり</p><p className="value">{tournament.archersPerStand}人</p></div>
          <div><p className="label">立数</p><p className="value">{stands}立</p></div>
          <div><p className="label">矢数</p><p className="value">{arrowsPerStand}本</p></div>
        </div>
        <div className="progress-section">
          <div className="progress-header"><span>進行状況</span><span>{Math.round(progressPercent)}%</span></div>
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${progressPercent}%` }}></div></div>
        </div>
        <div className="card">
          <p className="card-title">予選通過者</p>
          <div className="card-content">
            {passedArchers.length > 0 ? passedArchers.map(a => (
              <div key={a.id} className="archer-item">
                <div><p>{a.name}</p><p className="text-sm">{a.affiliation}</p></div>
                <span>射順{a.segment}</span>
              </div>
            )) : <p className="empty-text">通過者はまだいません</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

const RecordingView = ({ state, dispatch, stands }) => {
  const [selectedStand, setSelectedStand] = useState(1);
  const tournament = state.tournament;
  const checkInArchers = state.archers.filter(a => a.checkIn);
  const arrowsPerStand = tournament.currentRound === 1 ? tournament.arrowsRound1 : tournament.arrowsRound2;

  const getArchersForStand = (standNumber) => {
    const archersPerStand = tournament.archersPerStand;
    const startIdx = (standNumber - 1) * archersPerStand;
    return checkInArchers.slice(startIdx, startIdx + archersPerStand);
  };

  const archers = getArchersForStand(selectedStand);

  const handleRecord = (archerId, arrowIndex, result) => {
    dispatch({ type: 'RECORD_RESULT', payload: { archerId, stand: selectedStand, arrowIndex, result } });
  };

  const handleUndo = (archerId, arrowIndex) => {
    dispatch({ type: 'UNDO_RESULT', payload: { archerId, stand: selectedStand, arrowIndex } });
  };

  return (
    <div className="view-container">
      <div className="view-header">
        <h1>記録入力</h1>
        <p>複数立からのリアルタイム入力に対応</p>
      </div>
      <div className="view-content">
        <div className="round-selector">
          <p>ラウンド選択</p>
          <div className="button-group">
            <button onClick={() => dispatch({ type: 'UPDATE_CURRENT_ROUND', payload: 1 })} className={`btn ${tournament.currentRound === 1 ? 'btn-active' : ''}`}>1回戦</button>
            <button onClick={() => dispatch({ type: 'UPDATE_CURRENT_ROUND', payload: 2 })} className={`btn ${tournament.currentRound === 2 ? 'btn-active' : ''}`}>2回戦</button>
          </div>
        </div>
        <div className="stand-tabs">
          {Array.from({ length: stands }, (_, i) => i + 1).map(stand => (
            <button key={stand} onClick={() => setSelectedStand(stand)} className={`stand-tab ${selectedStand === stand ? 'stand-tab-active' : ''}`}>立{stand}</button>
          ))}
        </div>
        <div className="archer-records">
          {archers.length === 0 ? (
            <p className="empty-text">受付済みの選手がいません</p>
          ) : (
            archers.map(archer => (
              <div key={archer.id} className="archer-record">
                <div className="archer-info">
                  <p>{archer.name}</p>
                  <p className="text-sm">{archer.affiliation} | 射順{archer.segment}</p>
                </div>
                <span className={`status ${archer.results[`stand${selectedStand}`].slice(0, arrowsPerStand).includes(null) ? 'status-input' : 'status-complete'}`}>
                  {archer.results[`stand${selectedStand}`].slice(0, arrowsPerStand).includes(null) ? '入力中' : '完了'}
                </span>
                <div className="arrows-grid" style={{ gridTemplateColumns: `repeat(${arrowsPerStand}, 1fr)` }}>
                  {archer.results[`stand${selectedStand}`].slice(0, arrowsPerStand).map((result, arrowIdx) => (
                    <div key={arrowIdx} className="arrow-input">
                      <p>{arrowIdx + 1}本</p>
                      {result === null ? (
                        <div className="arrow-buttons">
                          <button onClick={() => handleRecord(archer.id, arrowIdx, 'o')} className="btn-circle btn-hit">◯</button>
                          <button onClick={() => handleRecord(archer.id, arrowIdx, 'x')} className="btn-circle btn-miss">×</button>
                        </div>
                      ) : (
                        <div className="arrow-result">
                          <button disabled className={`btn-circle ${result === 'o' ? 'btn-hit' : 'btn-miss'}`}>{result === 'o' ? '◯' : '×'}</button>
                          <button onClick={() => handleUndo(archer.id, arrowIdx)} className="btn-fix">修正</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
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
  const [currentQRCodeData, setCurrentQRCodeData] = useState(null); // オブジェクトでデータを保持
  
  // 新機能用ステート
  const [currentUser, setCurrentUser] = useState(null);
  const [myApplicantData, setMyApplicantData] = useState(null);
  const [showManualInput, setShowManualInput] = useState(false);

  // 初期化：現在のユーザーを取得
  useEffect(() => {
    const savedUser = localStorage.getItem('kyudo_tournament_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  // 受付済み選手と自分自身の登録情報を取得
  const fetchTournamentData = async () => {
    if (!selectedTournamentId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/applicants/${selectedTournamentId}`);
      const result = await response.json();
      
      if (result.success) {
        // 受付済みリストの更新
        const checkedIn = result.data.filter(a => a.isCheckedIn);
        setCheckIns(checkedIn);
        
        // 自分の登録情報を検索（複数登録がある可能性があるため配列で保持）
        if (currentUser) {
          const myRegistrations = result.data.filter(a => 
            (a.archerId === currentUser.archerId) || 
            (a.deviceId && currentUser.deviceId && a.deviceId === currentUser.deviceId) ||
            (a.name === currentUser.name && a.affiliation === currentUser.affiliation)
          );
          
          if (myRegistrations.length > 0) {
            // 複数登録がある場合は最初の1件をデフォルトで表示
            setMyApplicantData(myRegistrations[0]);
            setShowManualInput(false);
            // 複数登録がある場合は配列で保持
            if (myRegistrations.length > 1) {
              setMyApplicantData(myRegistrations);
            }
          } else {
            setMyApplicantData(null);
            setShowManualInput(true);
          }
        } else {
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

  // 大会が変更されたらデータを取得
  useEffect(() => {
    if (selectedTournamentId) {
      fetchTournamentData();
    } else {
      setCheckIns([]);
      setMyApplicantData(null);
    }
  }, [selectedTournamentId]);

  // 複数登録から選択してQRコードを表示
  const showQRCodeFromMultiple = (applicant) => {
    setShowQRModal(true);
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

  // QRコードを表示（データをセット）
  const showMyQRCode = () => {
    if (!myApplicantData) return;
    
    // 複数登録がある場合の処理
    if (Array.isArray(myApplicantData)) {
      // 複数登録がある場合はモーダルを表示せず、リストを表示する
      return;
    }
    
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

  // 既存のQR表示機能（リストからの表示用）
  const showListQRCode = (archer) => {
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

  // スクリーンショット用のQRコードを表示
  const showScreenshotQRCode = (archer) => {
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

  // 受付処理（変更なし、ただし変数はscannedQRを使用）
  const handleCheckIn = async () => {
    if (!selectedTournamentId) {
      setMessage('❌ 大会を選択してください');
      return;
    }

    const archerId = scannedQR.trim();
    if (!archerId) {
      setMessage('❌ 選手IDを入力するか、QRコードをスキャンしてください');
      return;
    }

    setIsLoading(true);
    setMessage('処理中...');

    try {
      // 選手情報を取得
      const response = await fetch(`${API_URL}/applicants/${selectedTournamentId}`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error('選手情報の取得に失敗しました');
      }

      // 選手を検索
      const applicant = result.data.find(a => a.archerId === archerId);
      if (!applicant) {
        setMessage('❌ 該当する選手が見つかりません');
        return;
      }

      // チェックイン処理
      const checkInResponse = await fetch(`${API_URL}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: selectedTournamentId,
          archerId: archerId
        })
      });

      const checkInResult = await checkInResponse.json();
      
      if (checkInResult.success) {
        const successMessage = checkInResult.data.isCheckedIn 
          ? `✅ ${checkInResult.data.name}さんは既に受付済みです`
          : `✅ ${checkInResult.data.name}さんの受付が完了しました`;
        
        setMessage(successMessage);
        setScannedQR('');
        await fetchTournamentData(); // リストを更新
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

  // 選択された大会の情報を取得
  const selectedTournament = state.registeredTournaments.find(t => t.id === selectedTournamentId);
  
  // 日付フォーマットを整形する関数
  const formatTournamentDate = (tournament) => {
    if (!tournament?.data) return '日時未設定';
    
    const { datetime } = tournament.data;
    if (!datetime) return '日時未設定';
    
    try {
      // 日付文字列をDateオブジェクトに変換
      const date = new Date(datetime);
      if (isNaN(date.getTime())) return datetime; // 不正な日付の場合は元の文字列を返す
      
      // 曜日の日本語表記
      const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
      const weekday = weekdays[date.getDay()];
      
      // 年月日と時間を取得
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      return `${year}年${month}月${day}日（${weekday}） ${hours}:${minutes}`;
    } catch (error) {
      console.error('日付のフォーマットに失敗しました:', error);
      return datetime; // エラー時は元の文字列を返す
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
          <select 
            value={selectedTournamentId} 
            onChange={(e) => setSelectedTournamentId(e.target.value)}
            className="input"
          >
            <option value="">-- 大会を選択してください --</option>
            {state.registeredTournaments.map(tournament => (
              <option key={tournament.id} value={tournament.id}>
                {tournament.data.name} ({tournament.data.location})
              </option>
            ))}
          </select>
        </div>

        {selectedTournamentId && (
          <>
            <div className="checkin-counter">
              <p className="counter-value">{checkIns.length}</p>
              <p className="counter-label">受付済み</p>
            </div>

            {/* QR表示またはID入力エリア */}
            <div className="card">
              {myApplicantData ? (
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  {Array.isArray(myApplicantData) ? (
                    <>
                      <p className="text-sm text-gray-500" style={{ marginBottom: '1rem' }}>複数の登録が見つかりました</p>
                      <div className="archer-list" style={{ marginBottom: '1rem', maxHeight: '200px', overflowY: 'auto' }}>
                        {myApplicantData.map((applicant, index) => (
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
                      <p className="hint" style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>受付で表示したい選手の「表示」ボタンを押してQRコードを提示してください</p>
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
                      <p className="hint" style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>受付でこのボタンを押してQRコードを提示してください</p>
                    </>
                  )}
                  
                  {!showManualInput ? (
                    <button 
                      onClick={() => setShowManualInput(true)}
                      style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline' }}
                    >
                      📷 ID手動入力・スキャン（係員用）
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

              {/* 手動入力エリア（トグルまたは登録がない場合に表示） */}
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
                        onClick={handleCheckIn} 
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
                      onClick={() => {
                        const scannedId = prompt('QRコードをスキャンするか、手動でIDを入力してください:');
                        if (scannedId) {
                          setScannedQR(scannedId);
                          setTimeout(() => handleCheckIn(), 100);
                        }
                      }}
                      className="btn-secondary"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}
                    >
                      <QrCode size={18} style={{ marginRight: '0.5rem' }} />
                      カメラでスキャン
                    </button>
                  </div>
                </div>
              )}

              {message && (
                <div className={`message ${message.startsWith('✅') ? 'message-success' : message.startsWith('❌') ? 'message-error' : 'message-warning'}`} style={{ marginTop: '1rem' }}>
                  {message}
                </div>
              )}
            </div>

            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <p className="card-title">受付済み一覧</p>
                <button 
                  onClick={fetchTournamentData} 
                  style={{ fontSize: '0.875rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}
                  disabled={isLoading}
                >
                  更新
                </button>
              </div>
              <div className="archer-list">
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
                  <p className="text-gray-500 text-center py-4">受付データがありません</p>
                )}
              </div>
              
              {/* QRコードモーダル（共通化） */}
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
                        <p>この画面を受付担当者に提示してください</p>
                      </div>
                    </div>
                    
                    <div className="qr-modal-footer">
                      <button
                        onClick={() => setShowQRModal(false)}
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
            {[2, 3, 4].map(n => (<option key={n} value={n}>{n}本</option>))}
          </select>
          <div className="divider"></div>
          <p className="label">予選2回戦の矢数</p>
          <select value={state.tournament.arrowsRound2} onChange={(e) => dispatch({ type: 'UPDATE_ARROWS_ROUND2', payload: e.target.value })} className="input">
            {[2, 3, 4].map(n => (<option key={n} value={n}>{n}本</option>))}
          </select>
          <div className="divider"></div>
          <p className="label">1立あたりの人数</p>
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
  const [formData, setFormData] = useState({
    name: '', datetime: '', location: '', organizer: '', coOrganizer: '', administrator: '', event: '', type: '', category: '', description: '', competitionMethod: '', award: '', qualifications: '', applicableRules: '', applicationMethod: '', remarks: '',
  });

  const generateTournamentId = () => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `KYUDO_${dateStr}_${random}`;
  };

  const handleInputChange = (field, value) => { setFormData(prev => ({ ...prev, [field]: value })); };
  const handleLoadTemplate = (template) => { setFormData(template.data); setTournamentId(template.id); setIsEditing(true); };
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
    setFormData({ name: '', datetime: '', location: '', organizer: '', coOrganizer: '', administrator: '', event: '', type: '', category: '', description: '', competitionMethod: '', award: '', qualifications: '', applicableRules: '', applicationMethod: '', remarks: '' });
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
            <p className="card-title">登録済み大会</p>
            <div className="tournament-list">
              {state.registeredTournaments.map(template => (
                <div key={template.id} className="tournament-item">
                  <button onClick={() => handleLoadTemplate(template)} className="tournament-button">
                    <p>{template.data.name}</p>
                    <p className="text-sm">{template.data.location || '場所未設定'} | {template.data.datetime || '日時未設定'}</p>
                  </button>
                  <button onClick={() => handleDeleteTemplate(template.id)} className="btn-delete">削除</button>
                </div>
              ))}
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
              <button 
                onClick={() => {
                  const printWindow = window.open('', '_blank');
                  printWindow.document.write(`
                    <html>
                      <head>
                        <title>${formData.name} - 大会情報</title>
                        <style>
                          body { font-family: Arial, sans-serif; padding: 20px; }
                          .header { text-align: center; margin-bottom: 20px; }
                          .section { margin-bottom: 15px; }
                          .applicant-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  margin-bottom: 8px;
  background-color: white;
  transition: all 0.2s ease;
}

.applicant-item:hover {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}
                          .info-grid { display: grid; grid-template-columns: 120px 1fr; gap: 10px; margin-bottom: 10px; }
                          .info-label { font-weight: bold; color: #555; }
                          .text-right { text-align: right; }
                        </style>
                      </head>
                      <body>
                        <div class="header">
                          <h1>${formData.name}</h1>
                          <p>${formData.datetime || '日時未設定'} | ${formData.location || '会場未設定'}</p>
                        </div>
                        ${formData.organizer || formData.coOrganizer || formData.administrator ? `
                        <div class="section">
                          <div class="section-title">主催・後援・主管</div>
                          ${formData.organizer ? `<div class="info-grid"><div class="info-label">主催</div><div>${formData.organizer}</div></div>` : ''}
                          ${formData.coOrganizer ? `<div class="info-grid"><div class="info-label">後援</div><div>${formData.coOrganizer}</div></div>` : ''}
                          ${formData.administrator ? `<div class="info-grid"><div class="info-label">主管</div><div>${formData.administrator}</div></div>` : ''}
                        </div>` : ''}
                        ${formData.event || formData.type || formData.category ? `
                        <div class="section">
                          <div class="section-title">大会情報</div>
                          ${formData.event ? `<div class="info-grid"><div class="info-label">種目</div><div>${formData.event}</div></div>` : ''}
                          ${formData.type ? `<div class="info-grid"><div class="info-label">種類</div><div>${formData.type}</div></div>` : ''}
                          ${formData.category ? `<div class="info-grid"><div class="info-label">種別</div><div>${formData.category}</div></div>` : ''}
                        </div>` : ''}
                        ${formData.description ? `
                        <div class="section">
                          <div class="section-title">内容</div>
                          <div>${formData.description.replace(/\n/g, '<br>')}</div>
                        </div>` : ''}
                        ${formData.competitionMethod ? `
                        <div class="section">
                          <div class="section-title">競技方法</div>
                          <div>${formData.competitionMethod.replace(/\n/g, '<br>')}</div>
                        </div>` : ''}
                        ${formData.award ? `
                        <div class="section">
                          <div class="section-title">表彰</div>
                          <div>${formData.award.replace(/\n/g, '<br>')}</div>
                        </div>` : ''}
                        ${formData.qualifications ? `
                        <div class="section">
                          <div class="section-title">参加資格</div>
                          <div>${formData.qualifications.replace(/\n/g, '<br>')}</div>
                        </div>` : ''}
                        ${formData.applicableRules ? `
                        <div class="section">
                          <div class="section-title">適用規則</div>
                          <div>${formData.applicableRules.replace(/\n/g, '<br>')}</div>
                        </div>` : ''}
                        ${formData.applicationMethod ? `
                        <div class="section">
                          <div class="section-title">申込方法</div>
                          <div>${formData.applicationMethod.replace(/\n/g, '<br>')}</div>
                        </div>` : ''}
                        ${formData.remarks ? `
                        <div class="section">
                          <div class="section-title">その他</div>
                          <div>${formData.remarks.replace(/\n/g, '<br>')}</div>
                        </div>` : ''}
                        <div class="text-right" style="margin-top: 30px;">
                          <small>${new Date().toLocaleString()} 現在</small>
                        </div>
                      </body>
                    </html>
                  `);
                  printWindow.document.close();
                  printWindow.print();
                }}
                className="btn-secondary"
              >
                印刷 / PDF保存
              </button>
            </div>
            
            <div className="space-y-6 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium mb-2 text-gray-700">基本情報</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-500">大会名</p>
                      <p className="font-medium">{formData.name || '未設定'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">開催日時</p>
                      <p>{formData.datetime || '未設定'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">開催場所</p>
                      <p>{formData.location || '未設定'}</p>
                    </div>
                  </div>
                </div>

                {(formData.organizer || formData.coOrganizer || formData.administrator) && (
                  <div>
                    <h3 className="font-medium mb-2 text-gray-700">主催・後援・主管</h3>
                    <div className="space-y-3">
                      {formData.organizer && (
                        <div>
                          <p className="text-sm text-gray-500">主催</p>
                          <p>{formData.organizer}</p>
                        </div>
                      )}
                      {formData.coOrganizer && (
                        <div>
                          <p className="text-sm text-gray-500">後援</p>
                          <p>{formData.coOrganizer}</p>
                        </div>
                      )}
                      {formData.administrator && (
                        <div>
                          <p className="text-sm text-gray-500">主管</p>
                          <p>{formData.administrator}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {(formData.event || formData.type || formData.category) && (
                <div>
                  <h3 className="font-medium mb-2 text-gray-700">大会情報</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {formData.event && (
                      <div>
                        <p className="text-sm text-gray-500">種目</p>
                        <p>{formData.event}</p>
                      </div>
                    )}
                    {formData.type && (
                      <div>
                        <p className="text-sm text-gray-500">種類</p>
                        <p>{formData.type}</p>
                      </div>
                    )}
                    {formData.category && (
                      <div>
                        <p className="text-sm text-gray-500">種別</p>
                        <p>{formData.category}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {formData.description && (
                <div>
                  <h3 className="font-medium mb-2 text-gray-700">内容</h3>
                  <div className="whitespace-pre-line bg-gray-50 p-4 rounded">
                    {formData.description}
                  </div>
                </div>
              )}

              {formData.competitionMethod && (
                <div>
                  <h3 className="font-medium mb-2 text-gray-700">競技方法</h3>
                  <div className="whitespace-pre-line bg-gray-50 p-4 rounded">
                    {formData.competitionMethod}
                  </div>
                </div>
              )}

              {formData.award && (
                <div>
                  <h3 className="font-medium mb-2 text-gray-700">表彰</h3>
                  <div className="whitespace-pre-line bg-gray-50 p-4 rounded">
                    {formData.award}
                  </div>
                </div>
              )}

              {formData.qualifications && (
                <div>
                  <h3 className="font-medium mb-2 text-gray-700">参加資格</h3>
                  <div className="whitespace-pre-line bg-gray-50 p-4 rounded">
                    {formData.qualifications}
                  </div>
                </div>
              )}

              {formData.applicableRules && (
                <div>
                  <h3 className="font-medium mb-2 text-gray-700">適用規則</h3>
                  <div className="whitespace-pre-line bg-gray-50 p-4 rounded">
                    {formData.applicableRules}
                  </div>
                </div>
              )}

              {formData.applicationMethod && (
                <div>
                  <h3 className="font-medium mb-2 text-gray-700">申込方法</h3>
                  <div className="whitespace-pre-line bg-gray-50 p-4 rounded">
                    {formData.applicationMethod}
                  </div>
                </div>
              )}

              {formData.remarks && (
                <div>
                  <h3 className="font-medium mb-2 text-gray-700">その他</h3>
                  <div className="whitespace-pre-line bg-gray-50 p-4 rounded">
                    {formData.remarks}
                  </div>
                </div>
              )}
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
          <input type="text" value={formData.event} onChange={(e) => handleInputChange('event', e.target.value)} placeholder="種目" className="input" />
          <input type="text" value={formData.type} onChange={(e) => handleInputChange('type', e.target.value)} placeholder="種類" className="input" />
          <input type="text" value={formData.category} onChange={(e) => handleInputChange('category', e.target.value)} placeholder="種別" className="input" />
          <textarea value={formData.description} onChange={(e) => handleInputChange('description', e.target.value)} placeholder="内容" className="input textarea" rows="3" />
          <textarea value={formData.competitionMethod} onChange={(e) => handleInputChange('competitionMethod', e.target.value)} placeholder="競技方法" className="input textarea" rows="3" />
          <textarea value={formData.award} onChange={(e) => handleInputChange('award', e.target.value)} placeholder="表彰" className="input textarea" rows="3" />
          <textarea value={formData.qualifications} onChange={(e) => handleInputChange('qualifications', e.target.value)} placeholder="参加資格" className="input textarea" rows="3" />
          <textarea value={formData.applicableRules} onChange={(e) => handleInputChange('applicableRules', e.target.value)} placeholder="適用規則" className="input textarea" rows="3" />
          <textarea value={formData.applicationMethod} onChange={(e) => handleInputChange('applicationMethod', e.target.value)} placeholder="申込方法" className="input textarea" rows="3" />
          <textarea value={formData.remarks} onChange={(e) => handleInputChange('remarks', e.target.value)} placeholder="その他必要事項" className="input textarea" rows="3" />
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
    // Try to get user from localStorage on initial load
    const savedUser = localStorage.getItem('kyudo_tournament_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const rankOrder = ['初段', '二段', '三段', '四段', '五段', '錬士五段', '錬士六段', '教士七段', '教士八段', '範士八段', '範士九段'];

  // 申し込みデータをサーバーから取得
  const fetchApplicants = async () => {
    if (!selectedTournamentId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/applicants/${selectedTournamentId}`);
      const result = await response.json();
      
      if (result.success) {
        setApplicants(result.data || []);
      } else {
        console.error('申し込みデータの取得に失敗:', result.message);
      }
    } catch (error) {
      console.error('申し込みデータの取得エラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 大会が変更されたら申し込みデータを取得
  useEffect(() => {
    if (selectedTournamentId) {
      fetchApplicants();
    } else {
      setApplicants([]);
    }
  }, [selectedTournamentId]);

  const calculateStandNumber = () => {
    const sorted = [...applicants].sort((a, b) => {
      const rankDiff = rankOrder.indexOf(b.rank) - rankOrder.indexOf(a.rank);
      if (rankDiff !== 0) return rankDiff;
      return new Date(a.rankAcquiredDate) - new Date(b.rankAcquiredDate);
    });
    return sorted.length + 1;
  };

  const generateArcherId = () => {
    const standNumber = String(calculateStandNumber()).padStart(3, '0');
    return `${selectedTournamentId}_${standNumber}`;
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
      
      // Check if this is a new application or an update to an existing one
      const existingApplicantIndex = applicants.findIndex(a => 
        a.deviceId === getOrCreateDeviceId() && 
        a.tournamentId === selectedTournamentId &&
        a.name === formData.name
      );
      
      const isUpdating = existingApplicantIndex !== -1;

      const isStaffOnly = isStaff && formData.isOfficialOnly;
      const archerId = isStaffOnly 
        ? `STAFF_${Date.now().toString(36).toUpperCase()}`
        : generateArcherId();

      const deviceId = getOrCreateDeviceId();
      const applicantData = {
        name: formData.name,
        affiliation: formData.affiliation,
        rank: formData.rank,
        rankAcquiredDate: formData.rankAcquiredDate,
        isStaff: isStaff,
        isOfficialOnly: formData.isOfficialOnly,
        archerId: archerId,
        appliedAt: new Date().toISOString(),
        deviceId: deviceId
      };

      console.log('Sending request to server:', {
        tournamentId: selectedTournamentId,
        archerId,
        applicantData
      });

      const url = isUpdating 
        ? `${API_URL}/applicants/${selectedTournamentId}/${applicants[existingApplicantIndex].archerId}`
        : `${API_URL}/applicants`;
        
      const method = isUpdating ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method: method,
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          tournamentId: selectedTournamentId,
          archerId: isUpdating ? applicants[existingApplicantIndex].archerId : archerId,
          applicantData: applicantData
        })
      });

      const responseText = await response.text();
      console.log('Raw response:', responseText);

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse response as JSON:', e);
        throw new Error('サーバーからの応答の解析に失敗しました');
      }

      if (response.ok && result.success) {
        if (isUpdating) {
          dispatch({
            type: 'UPDATE_ARCHER_APPLICANT',
            payload: {
              index: existingApplicantIndex,
              updates: {
                ...applicantData,
                tournamentId: selectedTournamentId,
                ...(result.data || {})
              }
            }
          });
        } else {
          dispatch({
            type: 'ADD_ARCHER_APPLICANT',
            payload: { 
              ...applicantData, 
              tournamentId: selectedTournamentId,
              ...(result.data || {})
            }
          });
        }
        
        // Only fetch applicants if not updating (to prevent UI flicker)
        if (!isUpdating) {
          await fetchApplicants();
        }
        
        showQRCode(
          isUpdating ? applicants[existingApplicantIndex].archerId : archerId,
          formData.name,
          isStaffOnly ? '役員' : '選手',
          state.registeredTournaments.find(t => t.id === selectedTournamentId)?.data?.name || '不明な大会',
          formData.affiliation,
          formData.rank
        );
        
        // Don't clear form if updating
        if (!isUpdating) {
          setFormData({
            name: '',
            affiliation: '',
            rank: '初段',
            rankAcquiredDate: '',
            isOfficialOnly: false
          });
          setIsStaff(false);
        }
      } else {
        throw new Error(result.message || '申し込みに失敗しました');
      }
    } catch (error) {
      console.error('申し込みエラー:', error);
      alert(`申し込み処理中にエラーが発生しました: ${error.message}`);
    }
  };

  const handleDeleteApplicant = async (archerId) => {
    if (!window.confirm('本当に削除しますか?')) return;
    
    try {
      const response = await fetch(`${API_URL}/applicants/${selectedTournamentId}/${archerId}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        dispatch({ type: 'DELETE_ARCHER_APPLICANT', payload: archerId });
        await fetchApplicants();
      } else {
        throw new Error(result.message || '削除に失敗しました');
      }
    } catch (error) {
      console.error('削除エラー:', error);
      alert(`削除処理中にエラーが発生しました: ${error.message}`);
    }
  };

  // Filter to show all applications from the current device
  const filteredApplicants = applicants.filter(applicant => {
    return currentUser && 
           (applicant.archerId === currentUser.archerId || 
            (applicant.deviceId && currentUser.deviceId && applicant.deviceId === currentUser.deviceId));
  });

  const sortedApplicants = [...filteredApplicants].sort((a, b) => {
    if (a.isStaff && !b.isStaff) return -1;
    if (!a.isStaff && b.isStaff) return 1;
    
    if (!a.isStaff && !b.isStaff) {
      const rankDiff = rankOrder.indexOf(b.rank) - rankOrder.indexOf(a.rank);
      if (rankDiff !== 0) return rankDiff;
      return new Date(a.rankAcquiredDate) - new Date(b.rankAcquiredDate);
    }
    
    return a.name.localeCompare(b.name);
  });

  // Generate or get device ID
  const getOrCreateDeviceId = () => {
    let deviceId = localStorage.getItem('kyudo_tournament_device_id');
    if (!deviceId) {
      deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('kyudo_tournament_device_id', deviceId);
    }
    return deviceId;
  };

  // Save user data to localStorage when a new user registers
  useEffect(() => {
    if (qrCodeData.id && qrCodeData.name) {
      const deviceId = getOrCreateDeviceId();
      const userData = {
        archerId: qrCodeData.id,
        name: qrCodeData.name,
        affiliation: qrCodeData.affiliation,
        rank: qrCodeData.rank,
        type: qrCodeData.type,
        deviceId: deviceId
      };
      setCurrentUser(userData);
      localStorage.setItem('kyudo_tournament_user', JSON.stringify(userData));
    }
  }, [qrCodeData]);

  return (
    <div className="view-container">
      <div className="view-header">
        <h1>選手申し込み</h1>
      </div>
      <div className="view-content">
        <div className="card">
          <label>大会を選択 *</label>
          <select 
            value={selectedTournamentId} 
            onChange={(e) => { 
              setSelectedTournamentId(e.target.value); 
              setShowForm(e.target.value !== ''); 
            }} 
            className="input"
          >
            <option value="">-- 大会を選択してください --</option>
            {state.registeredTournaments.map(t => (
              <option key={t.id} value={t.id}>
                {t.data.name} ({t.data.location}) - {new Date(t.data.datetime).toLocaleDateString()}
              </option>
            ))}
          </select>
          
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
            {isStaff && (
              <div className="mt-2">
                <label className="flex items-center space-x-2">
                  <input 
                    type="checkbox" 
                    checked={formData.isOfficialOnly}
                    onChange={(e) => handleInputChange('isOfficialOnly', e.target.checked)}
                    className="form-checkbox"
                  />
                  <span>役員のみ(選手としての参加はしない)</span>
                </label>
              </div>
            )}
            <button onClick={handleApply} className="btn-primary">申し込む</button>
          </div>
        )}

        {selectedTournamentId && (
          <div className="card">
            <div className="flex justify-between items-center mb-2">
              <p className="card-title">あなたの申し込み一覧（{filteredApplicants.length}件）</p>
              <button 
                onClick={fetchApplicants} 
                className="text-sm text-blue-600 hover:text-blue-800"
                disabled={isLoading}
              >
                {isLoading ? '読み込み中...' : '更新'}
              </button>
            </div>
            {isLoading ? (
              <p className="text-gray-500 text-center py-4">データ読み込み中...</p>
            ) : sortedApplicants.length > 0 ? (
              <div className="applicant-list">
                {sortedApplicants.map((applicant, idx) => (
                  <div key={applicant.archerId} className="applicant-item">
                    <div>
                      {applicant.isStaff && applicant.isOfficialOnly ? (
                        <p><span className="applicant-number">役員</span> {applicant.name}</p>
                      ) : (
                        <p><span className="applicant-number">#{idx + 1}</span> {applicant.name}</p>
                      )}
                      <p className="text-sm">{applicant.affiliation}</p>
                      {applicant.rank && (
                        <p className="text-xs text-gray-600">
                          {applicant.rank} (取得: {new Date(applicant.rankAcquiredDate).toLocaleDateString()})
                        </p>
                      )}
                      {applicant.isStaff && applicant.isOfficialOnly && (
                        <p className="text-xs text-blue-600">役員のみ</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      <span className="text-xs font-mono">
                        {applicant.isStaff && applicant.isOfficialOnly ? '役員ID: ' : '選手ID: '}
                        {applicant.archerId}
                      </span>
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => showQRCode(
                            applicant.archerId,
                            applicant.name,
                            applicant.isStaff && applicant.isOfficialOnly ? '役員' : '選手',
                            state.registeredTournaments.find(t => t.id === selectedTournamentId)?.data?.name || '不明な大会',
                            applicant.affiliation,
                            applicant.rank
                          )}
                          className="text-blue-600 hover:text-blue-800 text-xs flex items-center"
                          title="QRコードを表示"
                        >
                          <QrCode size={16} className="mr-1" /> QR
                        </button>
                        <button 
                          onClick={() => handleDeleteApplicant(applicant.archerId)}
                          className="text-red-600 hover:text-red-800 text-xs"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">
                {currentUser 
                  ? '申し込みデータがありません。新しい申し込みを行ってください。' 
                  : 'ログインしていません。申し込みを行うと、ここに表示されます。'}
              </p>
            )}
          </div>
        )}

        {/* QRコードモーダル */}
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
                  <div className="qr-id-section">
                    <p className="qr-id-label">選手ID</p>
                    <p className="qr-id-value">{qrCodeData.id}</p>
                  </div>
                  <p className="qr-timestamp">
                    登録日時: {new Date(qrCodeData.registrationDate).toLocaleString('ja-JP')}
                  </p>
                </div>
                
                <div className="qr-instruction">
                  <p>このQRコードを大会受付でご提示ください</p>
                  <p className="qr-instruction-sub">スクリーンショットを保存することをお勧めします</p>
                </div>
              </div>
              
              <div className="qr-modal-footer">
                <button
                  onClick={() => {
                    window.print();
                  }}
                  className="btn-secondary"
                >
                  印刷
                </button>
                <button
                  onClick={() => setShowQRModal(false)}
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