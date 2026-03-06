import React, { useState, useEffect } from 'react';
import { API_URL } from '../utils/api';
import { groupByTeam, calculateTeamHitCount } from '../utils/teamCompetition';

const TeamFinalsView = ({ state, selectedTournamentId }) => {
  const [archers, setArchers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [shootOffScores, setShootOffScores] = useState({});   // 追加: 競射スコア
  const [isShootOffActive, setIsShootOffActive] = useState(false);
  const [determinedTeams, setDeterminedTeams] = useState([]);
  const [tiedTeams, setTiedTeams] = useState([]);

  const tournament = state.registeredTournaments.find(t => t.id === selectedTournamentId);
  const teamFinalsLimit = tournament?.data?.teamFinalsLimit || 8;

  // ── 運営用と完全に同じロジック ──────────────────────────────────────
  const getTeamRankings = () => {
    const teams = groupByTeam(archers);
    const teamScores = teams.map(team => ({
      ...team,
      totalHits: calculateTeamHitCount(team.members, tournament?.data || {})  // 修正: 運営用と同じ引数
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
    let borderRank = null;

    if (rankings.length === 0) {
      return { finalists, needsShootOff: false, tiedTeams: [], borderRank: null };
    }

    const limitIndex = teamFinalsLimit - 1;
    const limitHits = rankings[limitIndex]?.totalHits;
    if (limitHits === undefined) {
      // 出場チームが制限未満の場合、全員進出
      return { finalists: [...rankings], needsShootOff: false, tiedTeams: [], borderRank: null };
    }

    // limitHitsより多い的中数のチームは確定進出
    rankings.forEach(team => {
      if (team.totalHits > limitHits) {
        finalists.push(team);
      } else if (team.totalHits === limitHits) {
        borderlineTeams.push(team);
      }
    });

    // 境界ランク（表示用）
    if (borderlineTeams.length > 0) {
      borderRank = borderlineTeams[0].rank;
    }

    const spotsLeft = teamFinalsLimit - finalists.length;
    const needsShootOff = borderlineTeams.length > spotsLeft;

    if (needsShootOff) {
      const withShootOff = borderlineTeams.map(team => ({
        ...team,
        shootOffScore: shootOffScores[team.teamKey] || 0,
        finalScore: team.totalHits + (shootOffScores[team.teamKey] || 0)
      }));
      withShootOff.sort((a, b) => b.finalScore - a.finalScore);
      return { finalists, needsShootOff: true, tiedTeams: withShootOff, borderRank };
    }

    // 競射不要なら全borderlineを決勝進出に含める
    finalists.push(...borderlineTeams);
    return { finalists, needsShootOff: false, tiedTeams: [], borderRank };
  };
  // ───────────────────────────────────────────────────────────────────

  const rankings = getTeamRankings();
  const finalistsResult = getFinalists();
  const confirmedFinalists = finalistsResult.finalists;
  const borderlineTeams = finalistsResult.needsShootOff ? finalistsResult.tiedTeams : [];

  // サーバーから競射結果を読み込み（shootOffScores も取得）
  const loadShootOffResults = async () => {
    if (!selectedTournamentId) return;
    try {
      const response = await fetch(`${API_URL}/team/shootoff/${selectedTournamentId}`);
      if (response.ok) {
        const result = await response.json();
        if (result.data) {
          const data = result.data;
          setShootOffScores(data.shootOffScores || {});   // 追加
          setDeterminedTeams(data.determinedTeams || []);
          setTiedTeams(data.tiedTeams || []);
          setIsShootOffActive(data.isShootOffActive || false);
        }
      }
    } catch (error) {
      console.error('競射結果の読み込みに失敗しました:', error);
    }
  };

  useEffect(() => {
    if (selectedTournamentId) {
      fetchArchers();
      loadShootOffResults();
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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-center mb-6 text-blue-800">
          🏆 決勝進出チーム
        </h1>

        {archers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">チェックインした選手がいません</p>
          </div>
        ) : (
          <>
            {/* 決勝進出確定チーム表 */}
            {(confirmedFinalists.length > 0 || determinedTeams.length > 0) && (
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h2 className="card-title text-green-700">✅ 決勝進出確定チーム（{confirmedFinalists.length + determinedTeams.length}チーム）</h2>
                  <button
                    onClick={() => window.print()}
                    className="btn-primary"
                    style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                  >
                    🖨️ 印刷
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-green-300">
                    <thead>
                      <tr className="bg-green-100">
                        <th className="border border-green-300 px-4 py-2">チーム名</th>
                        <th className="border border-green-300 px-4 py-2">所属</th>
                        <th className="border border-green-300 px-4 py-2">予選的中</th>
                        <th className="border border-green-300 px-4 py-2">メンバー</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...confirmedFinalists, ...determinedTeams].map(team => (
                        <tr key={team.teamKey} className="hover:bg-green-50">
                          <td className="border border-green-300 px-4 py-2 font-semibold">{team.teamName}</td>
                          <td className="border border-green-300 px-4 py-2">{team.affiliation}</td>
                          <td className="border border-green-300 px-4 py-2 text-center font-bold">{team.totalHits}本</td>
                          <td className="border border-green-300 px-4 py-2 text-sm">{team.members.map(m => m.name).join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* 全枠確定時の完了メッセージ */}
                {confirmedFinalists.length + determinedTeams.length >= teamFinalsLimit && (
                  <div style={{ marginTop: '1rem', padding: '1rem', background: '#d1fae5', borderRadius: '0.5rem', border: '2px solid #10b981', textAlign: 'center' }}>
                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem', fontWeight: 700, color: '#059669' }}>
                      🎉 トーナメント進出チームが確定しました！
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#047857' }}>
                      上位{teamFinalsLimit}チームが決勝トーナメントに進出します
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 競射が完了して全枠が確定した場合はボーダーラインチームを表示しない（運営用と同じ条件） */}
            {borderlineTeams.length > 0 && confirmedFinalists.length + determinedTeams.length < teamFinalsLimit && (
              <div className="card" style={{ marginTop: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h2 className="card-title text-orange-700">🎯 決勝トーナメント進出戦一覧（{borderlineTeams.length}チーム）</h2>
                  <button
                    onClick={() => window.print()}
                    className="btn-primary"
                    style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                  >
                    🖨️ 印刷
                  </button>
                </div>
                <p style={{ fontSize: '0.875rem', color: '#92400e', marginBottom: '1rem' }}>
                  {finalistsResult.borderRank}位で同率のため、1人1射の競射を実施
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-orange-300">
                    <thead>
                      <tr className="bg-orange-100">
                        <th className="border border-orange-300 px-4 py-2">チーム名</th>
                        <th className="border border-orange-300 px-4 py-2">所属</th>
                        <th className="border border-orange-300 px-4 py-2">予選的中</th>
                        {isShootOffActive && <th className="border border-orange-300 px-4 py-2">競射的中</th>}
                        {isShootOffActive && <th className="border border-orange-300 px-4 py-2">合計</th>}
                        <th className="border border-orange-300 px-4 py-2">メンバー</th>
                      </tr>
                    </thead>
                    <tbody>
                      {borderlineTeams.map(team => (
                        <tr key={team.teamKey} className="hover:bg-orange-50">
                          <td className="border border-orange-300 px-4 py-2 font-semibold">{team.teamName}</td>
                          <td className="border border-orange-300 px-4 py-2">{team.affiliation}</td>
                          <td className="border border-orange-300 px-4 py-2 text-center font-bold">{team.totalHits}本</td>
                          {isShootOffActive && <td className="border border-orange-300 px-4 py-2 text-center font-bold text-blue-700">{team.shootOffScore || 0}本</td>}
                          {isShootOffActive && <td className="border border-orange-300 px-4 py-2 text-center font-bold text-green-700">{team.finalScore}本</td>}
                          <td className="border border-orange-300 px-4 py-2 text-sm">{team.members.map(m => m.name).join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TeamFinalsView;