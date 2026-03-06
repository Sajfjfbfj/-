import React, { useState } from 'react';
import { LogOut } from 'lucide-react';
import RecordingView from './RecordingView';
import SettingsView from './SettingsView';
import AwardsView from './AwardsView';
import ProgramView from './ProgramView';
import RankingView from './RankingView';
import StatsView from './StatsView';
import AdminTeamFinalsView from './AdminTeamFinalsView';

const AdminView = ({ state, dispatch, adminView, setAdminView, stands, selectedTournamentId, setSelectedTournamentId, onLogout }) => {
  // 選択された大会の競技タイプを取得
  const selectedTournament = state.registeredTournaments.find(t => t.id === selectedTournamentId);
  const competitionType = selectedTournament?.data?.competitionType || 'individual';
  const isTeamCompetition = competitionType === 'team';

  const renderHeader = () => (
    <div className="admin-header" style={{ padding: '1rem', background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
      <div className="button-group" style={{ marginBottom: '1rem' }}>
        <button onClick={() => setAdminView('recording')} className={`btn ${adminView === 'recording' ? 'btn-active' : ''}`}>記録入力</button>
        {!isTeamCompetition && <button onClick={() => setAdminView('ranking')} className={`btn ${adminView === 'ranking' ? 'btn-active' : ''}`}>順位決定戦</button>}
        {isTeamCompetition && <button onClick={() => setAdminView('team-finals')} className={`btn ${adminView === 'team-finals' ? 'btn-active' : ''}`}>決勝</button>}
        <button onClick={() => setAdminView('awards')} className={`btn ${adminView === 'awards' ? 'btn-active' : ''}`}>表彰</button>
        <button onClick={() => setAdminView('program')} className={`btn ${adminView === 'program' ? 'btn-active' : ''}`}>プログラム</button>
        <button onClick={() => setAdminView('stats')} className={`btn ${adminView === 'stats' ? 'btn-active' : ''}`}>支部別集計</button>
        <button onClick={() => setAdminView('settings')} className={`btn ${adminView === 'settings' ? 'btn-active' : ''}`}>設定</button>
      </div>
      <button onClick={onLogout} style={{ width: '100%', padding: '0.875rem 1.5rem', fontSize: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: 'white', border: 'none', borderRadius: '0.75rem', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.3)', transition: 'all 0.2s' }}>
        <LogOut size={18} />ログアウト
      </button>
    </div>
  );

  if (adminView === 'recording') {
    return (
      <div>
        {renderHeader()}
        <RecordingView state={state} dispatch={dispatch} stands={stands} />
      </div>
    );
  }
  if (adminView === 'settings') {
    return (
      <div>
        {renderHeader()}
        <SettingsView state={state} dispatch={dispatch} selectedTournamentId={selectedTournamentId} setSelectedTournamentId={setSelectedTournamentId} />
      </div>
    );
  }
  if (adminView === 'awards') {
    return (
      <div>
        {renderHeader()}
        <AwardsView state={state} dispatch={dispatch} selectedTournamentId={selectedTournamentId} setSelectedTournamentId={setSelectedTournamentId} />
      </div>
    );
  }
  if (adminView === 'program') {
    return (
      <div>
        {renderHeader()}
        <ProgramView state={state} />
      </div>
    );
  }
  if (adminView === 'ranking') {
    return (
      <div>
        {renderHeader()}
        <RankingView state={state} dispatch={dispatch} selectedTournamentId={selectedTournamentId} />
      </div>
    );
  }
  if (adminView === 'stats') {
    return (
      <div>
        {renderHeader()}
        <StatsView state={state} selectedTournamentId={selectedTournamentId} />
      </div>
    );
  }
  if (adminView === 'team-finals') {
    return (
      <div>
        {renderHeader()}
        <AdminTeamFinalsView state={state} selectedTournamentId={selectedTournamentId} />
      </div>
    );
  }
};


export default AdminView;