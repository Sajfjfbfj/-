import React, { useState } from 'react';
import { LogOut } from 'lucide-react';

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


export default AdminView;