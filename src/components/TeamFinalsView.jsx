import React, { useState, useEffect } from 'react';
import { API_URL } from '../utils/api';
import { groupByTeam, calculateTeamHitCount } from '../utils/teamCompetition';

const TeamFinalsView = ({ state, selectedTournamentId }) => {
  const [archers, setArchers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

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
    let borderlineTeams = [];

    if (rankings.length === 0) {
      return { finalists };
    }

    const limitIndex = teamFinalsLimit - 1;
    const limitHits = rankings[limitIndex]?.totalHits;
    if (limitHits === undefined) {
      return { finalists: [...rankings] };
    }

    rankings.forEach(team => {
      if (team.totalHits > limitHits) {
        finalists.push(team);
      } else if (team.totalHits === limitHits) {
        borderlineTeams.push(team);
      }
    });

    // In participant view we simply include all borderline teams in the finalist list
    finalists.push(...borderlineTeams);
    return { finalists };
  };


  const rankings = getTeamRankings();
  const finalistsResult = getFinalists();
  const finalists = finalistsResult.finalists || [];

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
                • 上位{teamFinalsLimit}位までが決勝進出（8位と同じ的中数のチームは全て進出とみなし、ボーダーラインの対象になります）
              </p>
              <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                • ボーダーラインに該当するチームが複数ある場合は、該当全チームで1人1射の競射を行い、その的中合計を基に進出チームを決定
              </p>
            </div>

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
