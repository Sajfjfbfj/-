import React, { useState, useEffect } from 'react';
import { API_URL } from '../utils/api';
import { groupByTeam, calculateTeamHitCount } from '../utils/teamCompetition';

const TeamFinalsView = ({ state, selectedTournamentId }) => {
  const [archers, setArchers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [shootOffScores, setShootOffScores] = useState({});
  const [isShootOffActive, setIsShootOffActive] = useState(false);
  const [tiedTeams, setTiedTeams] = useState([]);

  const tournament = state.registeredTournaments.find(t => t.id === selectedTournamentId);
  const teamFinalsLimit = tournament?.data?.teamFinalsLimit || 8;

  useEffect(() => {
    if (selectedTournamentId) {
      fetchArchers();
    }
  }, [selectedTournamentId]);

  const fetchArchers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/applicants/${selectedTournamentId}`);
      const result = await response.json();
      if (result.success) {
        setArchers(result.data.filter(a => a.isCheckedIn));
      }
    } catch (error) {
      console.error('選手データ取得エラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTeamRankings = () => {
    const teams = groupByTeam(archers);
    const teamScores = teams.map(team => ({
      ...team,
      totalHits: calculateTeamHitCount(team.members, tournament?.data || {})
    }));

    teamScores.sort((a, b) => b.totalHits - a.totalHits);

    const rankings = [];
    let currentRank = 1;
    let prevScore = null;

    teamScores.forEach((team, index) => {
      if (prevScore !== null && team.totalHits !== prevScore) {
        currentRank = index + 1;
      }
      rankings.push({ ...team, rank: currentRank });
      prevScore = team.totalHits;
    });

    return rankings;
  };

  const getFinalists = () => {
    const rankings = getTeamRankings();
    const finalists = [];
    const cutoffTeams = [];
    
    for (let i = 0; i < rankings.length; i++) {
      const team = rankings[i];
      
      if (team.rank < teamFinalsLimit) {
        finalists.push(team);
      } else if (team.rank === teamFinalsLimit) {
        cutoffTeams.push(team);
      } else {
        break;
      }
    }
    
    if (cutoffTeams.length > 1) {
      const withShootOff = cutoffTeams.map(team => ({
        ...team,
        shootOffScore: shootOffScores[team.teamKey] || 0,
        finalScore: team.totalHits + (shootOffScores[team.teamKey] || 0)
      }));
      
      withShootOff.sort((a, b) => b.finalScore - a.finalScore);
      
      const spotsLeft = teamFinalsLimit - finalists.length;
      finalists.push(...withShootOff.slice(0, spotsLeft));
      
      return { finalists, needsShootOff: cutoffTeams.length > 1, tiedTeams: cutoffTeams };
    }
    
    finalists.push(...cutoffTeams);
    return { finalists, needsShootOff: false, tiedTeams: [] };
  };

  const handleShootOffScore = (teamKey, score) => {
    setShootOffScores(prev => ({ ...prev, [teamKey]: parseInt(score) || 0 }));
  };

  const startShootOff = () => {
    const result = getFinalists();
    if (result.needsShootOff) {
      setTiedTeams(result.tiedTeams);
      setIsShootOffActive(true);
    }
  };

  const rankings = getTeamRankings();
  const finalistsResult = getFinalists();
  const finalists = finalistsResult.finalists || [];
  const needsShootOff = finalistsResult.needsShootOff || false;

  return (
    <div className="view-container">
      <div className="view-header">
        <h1>🏆 団体戦決勝進出チーム</h1>
      </div>
      <div className="view-content">
        {isLoading ? (
          <div className="card">読み込み中...</div>
        ) : (
          <>
            <div className="card">
              <h2 className="card-title">決勝進出ルール</h2>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                • 上位{teamFinalsLimit}位までが決勝進出
              </p>
              <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                • {teamFinalsLimit}位で同率の場合、1人1射の競射を行い、その的中合計を基に上位{teamFinalsLimit}位を決定
              </p>
            </div>

            {needsShootOff && !isShootOffActive && (
              <div className="card" style={{ background: '#fef3c7', border: '2px solid #f59e0b' }}>
                <h2 className="card-title" style={{ color: '#92400e' }}>⚠️ {teamFinalsLimit}位同率 - 競射が必要です</h2>
                <p style={{ fontSize: '0.875rem', color: '#78350f', marginBottom: '1rem' }}>
                  {teamFinalsLimit}位に{tiedTeams.length}チームが同率です。1人1射の競射を行ってください。
                </p>
                <button onClick={startShootOff} className="btn-primary">
                  競射を開始
                </button>
              </div>
            )}

            {isShootOffActive && (
              <div className="card" style={{ background: '#dbeafe', border: '2px solid #3b82f6' }}>
                <h2 className="card-title" style={{ color: '#1e40af' }}>🎯 {teamFinalsLimit}位決定競射（1人1射）</h2>
                <p style={{ fontSize: '0.875rem', color: '#1e3a8a', marginBottom: '1rem' }}>
                  各チームメンバー全員が1射ずつ行い、その的中合計を入力してください
                </p>
                <div className="space-y-4">
                  {tiedTeams.map(team => (
                    <div key={team.teamKey} style={{ padding: '1rem', background: 'white', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <div>
                          <span style={{ fontWeight: 600 }}>{team.teamName}</span>
                          <span style={{ fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.5rem' }}>({team.affiliation})</span>
                        </div>
                        <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>元の的中: {team.totalHits}本</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>競射的中数:</label>
                        <input
                          type="number"
                          min="0"
                          max={team.members.length}
                          value={shootOffScores[team.teamKey] || ''}
                          onChange={(e) => handleShootOffScore(team.teamKey, e.target.value)}
                          className="input"
                          style={{ width: '100px' }}
                          placeholder="0"
                        />
                        <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>/ {team.members.length}本</span>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#10b981', marginLeft: 'auto' }}>
                          合計: {team.totalHits + (shootOffScores[team.teamKey] || 0)}本
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => setIsShootOffActive(false)} 
                  className="btn-primary" 
                  style={{ marginTop: '1rem' }}
                  disabled={tiedTeams.some(t => !shootOffScores[t.teamKey])}
                >
                  競射結果を確定
                </button>
              </div>
            )}

            <div className="card">
              <h2 className="card-title text-green-700">✅ 決勝進出チーム（{finalists.length}チーム）</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-green-300">
                  <thead>
                    <tr className="bg-green-100">
                      <th className="border border-green-300 px-4 py-2">順位</th>
                      <th className="border border-green-300 px-4 py-2">チーム名</th>
                      <th className="border border-green-300 px-4 py-2">所属</th>
                      <th className="border border-green-300 px-4 py-2">合計的中</th>
                      <th className="border border-green-300 px-4 py-2">メンバー</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finalists.map(team => (
                      <tr key={team.teamKey} className="hover:bg-green-50">
                        <td className="border border-green-300 px-4 py-2 text-center font-bold">{team.rank}位</td>
                        <td className="border border-green-300 px-4 py-2 font-semibold">{team.teamName}</td>
                        <td className="border border-green-300 px-4 py-2">{team.affiliation}</td>
                        <td className="border border-green-300 px-4 py-2 text-center font-bold text-green-700">{team.totalHits}本</td>
                        <td className="border border-green-300 px-4 py-2 text-sm">{team.members.map(m => m.name).join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <h2 className="card-title">全チーム順位表</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-4 py-2">順位</th>
                      <th className="border border-gray-300 px-4 py-2">チーム名</th>
                      <th className="border border-gray-300 px-4 py-2">所属</th>
                      <th className="border border-gray-300 px-4 py-2">合計的中</th>
                      <th className="border border-gray-300 px-4 py-2">状態</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankings.map(team => {
                      const isFinalist = finalists.some(f => f.teamKey === team.teamKey);
                      return (
                        <tr key={team.teamKey} className={isFinalist ? 'bg-green-50' : ''}>
                          <td className="border border-gray-300 px-4 py-2 text-center font-bold">{team.rank}位</td>
                          <td className="border border-gray-300 px-4 py-2">{team.teamName}</td>
                          <td className="border border-gray-300 px-4 py-2">{team.affiliation}</td>
                          <td className="border border-gray-300 px-4 py-2 text-center font-bold">{team.totalHits}本</td>
                          <td className="border border-gray-300 px-4 py-2 text-center">
                            {isFinalist ? (
                              <span className="text-green-700 font-semibold">✅ 決勝進出</span>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TeamFinalsView;
