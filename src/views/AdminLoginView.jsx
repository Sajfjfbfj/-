import React, { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';
import { getLocalDateKey, distanceKm } from '../utils/tournament';

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
      setGeoStatus('📍 この端末は位置情報に対応していません');
      return;
    }
    setGeoStatus('🔍 位置情報を取得中...');
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

export default AdminLoginView;
