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
          <div><p className="label">受付済み</p><p className="value">{checkInCount}人</p></div>
          <div><p className="label">1立あたり</p><p className="value">{tournament.archersPerStand}人</p></div>
          <div><p className="label">立数</p><p className="value">{stands}立</p></div>
          <div><p className="label">矢数</p><p className="value">{arrowsPerStand}本</p></div>
        </div>
        <div className="progress-section">
          <div className="progress-header"><span>進行状態</span><span>{Math.round(progressPercent)}%</span></div>
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
  const [locationFilter, setLocationFilter] = useState('');
  const [formData, setFormData] = useState({
    name: '', datetime: '', location: '', organizer: '', coOrganizer: '', administrator: '', event: '', type: '', category: '', description: '', competitionMethod: '', award: '', qualifications: '', applicableRules: '', applicationMethod: '', remarks: '',
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
                  <button onClick={() => handleLoadTemplate(template)} className="tournament-button">
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

  const rankOrder = ['初段', '二段', '三段', '四段', '五段', '錬士五段', '錬士六段', '教士七段', '教士八段', '範士八段', '範士九段'];

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

      const archerId = `${selectedTournamentId}_${Date.now().toString(36).toUpperCase()}`;
      const deviceId = localStorage.getItem('kyudo_tournament_device_id') || `device_${Math.random().toString(36).substr(2, 9)}`;
      
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