import React, { useState, useEffect } from 'react';

const SettingsView = ({ state, dispatch, selectedTournamentId, setSelectedTournamentId }) => {
  const [localSettings, setLocalSettings] = useState({
    arrowsRound1: state.tournament.arrowsRound1,
    arrowsRound2: state.tournament.arrowsRound2,
    archersPerStand: state.tournament.archersPerStand,
    awardRankLimit: 3,
    teamFinalsLimit: 8,
  });

  const tournaments = state.registeredTournaments || [];

  useEffect(() => {
    if (!selectedTournamentId) return;
    const t = tournaments.find(x => x.id === selectedTournamentId);
    if (t && t.data) {
      setLocalSettings(prev => ({
        ...prev,
        arrowsRound1: t.data.arrowsRound1 || prev.arrowsRound1,
        arrowsRound2: t.data.arrowsRound2 || prev.arrowsRound2,
        archersPerStand: t.data.archersPerStand || prev.archersPerStand,
        awardRankLimit: t.data.awardRankLimit || prev.awardRankLimit,
        teamFinalsLimit: t.data.teamFinalsLimit || prev.teamFinalsLimit,
      }));
    }
  }, [selectedTournamentId, tournaments]);

  const handleSaveSettings = async () => {
    if (!selectedTournamentId) {
      alert('設定する大会を選択してください');
      return;
    }

    const existing = tournaments.find(t => t.id === selectedTournamentId);
    const newData = { ...(existing ? existing.data : {}), ...localSettings };

    try {
      const resp = await fetch(`${process.env.REACT_APP_API_URL || ''}/api/tournaments`, {
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
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#1f2937' }}>⚙️ 大会設定</h2>
          
          <div style={{ marginBottom: '2rem' }}>
            <p style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem', color: '#374151' }}>🎯 1立ち目の矢数</p>
            <select 
              value={localSettings.arrowsRound1} 
              onChange={(e) => setLocalSettings(prev => ({ ...prev, arrowsRound1: parseInt(e.target.value) }))} 
              className="input"
              style={{ fontSize: '1rem', padding: '0.875rem' }}
            >
              <option value={2}>2本</option>
              <option value={4}>4本</option>
            </select>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <p style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem', color: '#374151' }}>🎯 2立ち目の矢数</p>
            <select 
              value={localSettings.arrowsRound2} 
              onChange={(e) => setLocalSettings(prev => ({ ...prev, arrowsRound2: parseInt(e.target.value) }))} 
              className="input"
              style={{ fontSize: '1rem', padding: '0.875rem' }}
            >
              <option value={2}>2本</option>
              <option value={4}>4本</option>
            </select>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <p style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem', color: '#374151' }}>👥 射場に入る最大の人数</p>
            <select 
              value={localSettings.archersPerStand} 
              onChange={(e) => setLocalSettings(prev => ({ ...prev, archersPerStand: parseInt(e.target.value) }))} 
              className="input"
              style={{ fontSize: '1rem', padding: '0.875rem' }}
            >
              {[5, 6, 12].map(n => (
                <option key={n} value={n}>{n}人</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <p style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem', color: '#374151' }}>🏆 表彰は何位まで</p>
            <input
              type="number"
              min="1"
              max="999"
              value={localSettings.awardRankLimit}
              onChange={(e) => setLocalSettings(prev => ({ 
                ...prev, 
                awardRankLimit: Math.max(1, parseInt(e.target.value || '1')) 
              }))}
              className="input"
              style={{ fontSize: '1rem', padding: '0.875rem' }}
            />
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <p style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem', color: '#374151' }}>🥇 団体戦：決勝進出は何位まで</p>
            <input
              type="number"
              min="1"
              max="999"
              value={localSettings.teamFinalsLimit}
              onChange={(e) => setLocalSettings(prev => ({ 
                ...prev, 
                teamFinalsLimit: Math.max(1, parseInt(e.target.value || '8')) 
              }))}
              className="input"
              style={{ fontSize: '1rem', padding: '0.875rem' }}
            />
          </div>
        </div>

        <button onClick={handleSaveSettings} className="btn-primary" style={{ width: '100%', fontSize: '1.125rem', padding: '1rem', marginTop: '1rem' }}>
          💾 大会に設定を保存
        </button>
      </div>
    </div>
  );
};

export default SettingsView;
