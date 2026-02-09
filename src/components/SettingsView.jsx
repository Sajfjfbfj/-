import React, { useState, useEffect } from 'react';

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
          <p className="card-title">通過判定ルール</p>
          <div className="radio-group">
            {[
              { value: 'all_four', label: '全て的中' }, 
              { value: 'four_or_more', label: '4本以上的中' }, 
              { value: 'three_or_more', label: '3本以上的中' }, 
              { value: 'two_or_more', label: '2本以上的中' }
            ].map(rule => (
              <label key={rule.value} className="radio-label">
                <input 
                  type="radio" 
                  name="passRule" 
                  value={rule.value} 
                  checked={localSettings.passRule === rule.value} 
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, passRule: e.target.value }))} 
                />
                <span>{rule.label}</span>
              </label>
            ))}
          </div>
          <div className="divider"></div>
          <p className="label">予選1回戦の矢数</p>
          <select 
            value={localSettings.arrowsRound1} 
            onChange={(e) => setLocalSettings(prev => ({ ...prev, arrowsRound1: parseInt(e.target.value) }))} 
            className="input"
          >
            <option value={2}>2本</option>
            <option value={4}>4本</option>
          </select>
          <div className="divider"></div>
          <p className="label">予選2回戦の矢数</p>
          <select 
            value={localSettings.arrowsRound2} 
            onChange={(e) => setLocalSettings(prev => ({ ...prev, arrowsRound2: parseInt(e.target.value) }))} 
            className="input"
          >
            <option value={2}>2本</option>
            <option value={4}>4本</option>
          </select>
          <div className="divider"></div>
          <p className="label">道場に入る最大の人数</p>
          <select 
            value={localSettings.archersPerStand} 
            onChange={(e) => setLocalSettings(prev => ({ ...prev, archersPerStand: parseInt(e.target.value) }))} 
            className="input"
          >
            {[6, 8, 10, 12].map(n => (
              <option key={n} value={n}>{n}人</option>
            ))}
          </select>
          <div className="divider"></div>
          <p className="label">表彰は何位まで</p>
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
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
          <button onClick={handleSaveSettings} className="btn-primary">
            大会に設定を保存
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
