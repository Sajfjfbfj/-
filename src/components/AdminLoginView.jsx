import React, { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';
import { getLocalDateKey } from '../utils/tournament';
import { autoSelectTournamentByGeolocationAndDate } from '../utils/tournamentSelection';

const AdminLoginView = ({ adminPassword, setAdminPassword, adminLoginStep, setAdminLoginStep, selectedTournamentId, setSelectedTournamentId, state, onLogin }) => {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [geoStatus, setGeoStatus] = useState('');

  useEffect(() => {
    if (adminLoginStep !== 'tournament_id') return;
    try {
      const storedDate = localStorage.getItem('adminLoginTournamentDate');
      const storedTournamentId = localStorage.getItem('adminLoginTournamentId');
      const today = getLocalDateKey();
      if (storedDate === today && storedTournamentId) {
        setInputValue(storedTournamentId);
      }
    } catch {
      // ignore
    }
  }, [adminLoginStep]);

  const autoSelectTournamentByGeolocation = () => {
    autoSelectTournamentByGeolocationAndDate(
      state.registeredTournaments,
      (message, tournamentId) => {
        setGeoStatus(message);
        if (tournamentId) {
          setInputValue(tournamentId);
          setError('');
        }
      },
      (errorMessage) => {
        setGeoStatus(errorMessage);
      }
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
      localStorage.setItem('adminLoginTournamentDate', getLocalDateKey());
      localStorage.setItem('adminLoginTournamentId', inputValue.trim());
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
            <p className="hint">本日の大会を自動選択あるいは手動選択してください</p>
            <button onClick={autoSelectTournamentByGeolocation} className="btn-secondary" style={{ width: '100%', marginBottom: '0.5rem' }}>
              📍 現在地＋日付から大会を自動選択
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

export default AdminLoginView;