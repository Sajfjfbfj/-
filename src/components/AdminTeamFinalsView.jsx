import React, { useState, useEffect } from 'react';
import { API_URL } from '../utils/api';
import { groupByTeam, calculateTeamHitCount } from '../utils/teamCompetition';

const AdminTeamFinalsView = ({ state, selectedTournamentId }) => {
  const [archers, setArchers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [shootOffScores, setShootOffScores] = useState({});
  const [isShootOffActive, setIsShootOffActive] = useState(false);
  const [tiedTeams, setTiedTeams] = useState([]);
  const [shootOffRound, setShootOffRound] = useState(1); // 競射ラウンド
  const [shootOffResults, setShootOffResults] = useState({}); // 各選手の競射結果
  const [determinedTeams, setDeterminedTeams] = useState([]); // 決定済みチーム

  const tournament = state.registeredTournaments.find(t => t.id === selectedTournamentId);
  const teamFinalsLimit = tournament?.data?.teamFinalsLimit || 8;

  // サーバーから競射結果を読み込み
  const loadShootOffResults = async () => {
    if (!selectedTournamentId) return;
    
    try {
      const response = await fetch(`${API_URL}/team/shootoff/${selectedTournamentId}`);
      if (response.ok) {
        const result = await response.json();
        if (result.data) {
          const data = result.data;
          setShootOffRound(data.shootOffRound || 1);
          setShootOffResults(data.shootOffResults || {});
          setShootOffScores(data.shootOffScores || {});
          setDeterminedTeams(data.determinedTeams || []);
          setTiedTeams(data.tiedTeams || []);
          setIsShootOffActive(data.isShootOffActive || false);
          console.log('競射結果を読み込みました:', data);
        }
      }
    } catch (error) {
      console.error('競射結果の読み込みに失敗しました:', error);
    }
  };

  // サーバーに競射結果を保存
  const saveShootOffResults = async () => {
    if (!selectedTournamentId) return;
    
    try {
      const shootOffData = {
        shootOffRound,
        shootOffResults,
        shootOffScores,
        determinedTeams,
        tiedTeams,
        isShootOffActive
      };

      console.log('競射結果を保存します:', shootOffData);

      const response = await fetch(`${API_URL}/team/shootoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: selectedTournamentId, shootOffData })
      });

      if (response.ok) {
        console.log('競射結果を保存しました');
      }
    } catch (error) {
      console.error('競射結果の保存に失敗しました:', error);
    }
  };

  useEffect(() => {
    if (selectedTournamentId) {
      fetchArchers();
      loadShootOffResults();
    }
  }, [selectedTournamentId]);

  // 競射関連の状態変更時に自動保存
  useEffect(() => {
    if (isShootOffActive || determinedTeams.length > 0) {
      saveShootOffResults();
    }
  }, [shootOffRound, shootOffResults, shootOffScores, determinedTeams, tiedTeams, isShootOffActive]);

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
    let borderRank = null;

    if (rankings.length === 0) {
      return { finalists, needsShootOff: false, tiedTeams: [], borderRank: null };
    }

    const limitIndex = teamFinalsLimit - 1;
    const limitHits = rankings[limitIndex]?.totalHits;
    if (limitHits === undefined) {
      // 出場チームが制限未満の場合、そのまま全員進出
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

    // 境界ランク（表示用）を取得
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

    // shootoff不要なら全borderlineを決勝進出に含める
    finalists.push(...borderlineTeams);
    return { finalists, needsShootOff: false, tiedTeams: [], borderRank };
  };

  const handleShootOffScore = (teamKey, archerId, result) => {
    setShootOffResults(prev => ({
      ...prev,
      [`${teamKey}_${archerId}`]: result
    }));
    
    // チーム全体の競射的中数を再計算
    const team = tiedTeams.find(t => t.teamKey === teamKey);
    if (team) {
      const teamShootOffHits = team.members.reduce((total, member) => {
        const key = `${teamKey}_${member.archerId}`;
        return total + (shootOffResults[key] === 'o' ? 1 : 0) + (result === 'o' && member.archerId === archerId ? 1 : 0);
      }, 0);
      setShootOffScores(prev => ({ ...prev, [teamKey]: teamShootOffHits }));
    }
  };

  const startShootOff = () => {
    const result = getFinalists();
    if (result.needsShootOff) {
      setTiedTeams(result.tiedTeams);
      setIsShootOffActive(true);
      setShootOffRound(1);
      setShootOffResults({});
      setShootOffScores({});
      setDeterminedTeams([]);
    }
  };

  const determineShootOffWinners = () => {
    // 現在の競射結果でスコアを計算
    const currentScores = tiedTeams.map(team => ({
      ...team,
      shootOffScore: shootOffScores[team.teamKey] || 0,
      finalScore: team.totalHits + (shootOffScores[team.teamKey] || 0)
    })).sort((a, b) => b.finalScore - a.finalScore);

    const spotsAvailable = teamFinalsLimit - confirmedCount - determinedTeams.length;
    
    // スコア順に枠を埋めていく
    let newDeterminedTeams = [];
    let remainingTeams = [];
    
    for (let i = 0; i < currentScores.length; i++) {
      const currentTeam = currentScores[i];
      const nextTeam = currentScores[i + 1];
      
      if (newDeterminedTeams.length < spotsAvailable) {
        // 次のチームと同点で、枠が足りない場合は次ラウンドへ
        if (nextTeam && currentTeam.finalScore === nextTeam.finalScore) {
          // 同点グループを集める
          let tiedGroup = [currentTeam];
          let j = i + 1;
          while (j < currentScores.length && currentScores[j].finalScore === currentTeam.finalScore) {
            tiedGroup.push(currentScores[j]);
            j++;
          }
          
          // 同点グループ全員が枠に入るかチェック
          if (newDeterminedTeams.length + tiedGroup.length <= spotsAvailable) {
            newDeterminedTeams.push(...tiedGroup);
            i = j - 1; // 同点グループ分スキップ
          } else {
            // 枠が足りない場合は全員次ラウンドへ
            remainingTeams.push(...tiedGroup);
            break;
          }
        } else {
          // 異点の場合は確定
          newDeterminedTeams.push(currentTeam);
        }
      } else {
        // 枠が埋まったら残りは次ラウンドへ
        remainingTeams.push(...currentScores.slice(i));
        break;
      }
    }
    
    // 確定チームにshootOffScoreとfinalScoreを設定
    const finalDeterminedTeams = newDeterminedTeams.map(team => ({
      ...team,
      shootOffScore: shootOffScores[team.teamKey] || 0,
      finalScore: team.totalHits + (shootOffScores[team.teamKey] || 0)
    }));
    
    setDeterminedTeams(prev => [...prev, ...finalDeterminedTeams]);
    setTiedTeams(remainingTeams);
    
    // 残りチームがいる場合は次ラウンドへ
    if (remainingTeams.length > 0) {
      const remainingSpots = teamFinalsLimit - confirmedCount - determinedTeams.length - finalDeterminedTeams.length;
      
      if (remainingSpots > 0 && remainingTeams.length > remainingSpots) {
        // 残り枠を争う必要がある場合は次ラウンドへ
        setShootOffRound(prev => prev + 1);
        setShootOffResults({});
        setShootOffScores({});
      } else if (remainingSpots > 0 && remainingTeams.length <= remainingSpots) {
        // 残りチームが残り枠以内なら全員確定
        const finalTeams = remainingTeams.map(team => ({
          ...team,
          shootOffScore: shootOffScores[team.teamKey] || 0,
          finalScore: team.totalHits + (shootOffScores[team.teamKey] || 0)
        }));
        setDeterminedTeams(prev => [...prev, ...finalTeams]);
        setTiedTeams([]);
        setIsShootOffActive(false);
      } else {
        // 全ての枠が埋まったら終了
        setIsShootOffActive(false);
      }
    } else {
      // 全ての枠が埋まったら終了
      setIsShootOffActive(false);
    }
    
    // 状態更新後にサーバーに保存
    setTimeout(() => {
      saveShootOffResults();
    }, 100);
  };

  const rankings = getTeamRankings();
  const finalistsResult = getFinalists();
  // ボーダーライン前までの確定チーム
  const confirmedFinalists = finalistsResult.finalists;
  const confirmedCount = confirmedFinalists.length;
  const borderlineTeams = finalistsResult.needsShootOff ? finalistsResult.tiedTeams : [];
  const needsShootOff = finalistsResult.needsShootOff || false;

  return (
    <div className="view-container">
      <div className="view-header">
        <h1>🏆 団体戦決勝進出チーム（運営画面）</h1>
      </div>
      <div className="view-content">
        {isLoading ? (
          <div className="card">読み込み中...</div>
        ) : (
          <>
            <div className="card">
              <h2 className="card-title">決勝進出ルール</h2>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                • 上位{teamFinalsLimit}位までが決勝進出（8位と同じ的中数のチームは全て進出とみなし、ボーダーラインの対象となります）
              </p>
              <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                • ボーダーラインに該当するチームが複数ある場合は、該当全チームで1人1射の競射を行い、その的中合計を基に進出チームを決定
              </p>
            </div>

            {needsShootOff && !isShootOffActive && confirmedFinalists.length + determinedTeams.length < teamFinalsLimit && (
              <div className="card" style={{ background: '#fef3c7', border: '2px solid #f59e0b' }}>
                <h2 className="card-title" style={{ color: '#d97706' }}>⚠️ トーナメント進出決定戦が必要です</h2>
                <p style={{ fontSize: '0.875rem', color: '#92400e', marginBottom: '0.5rem' }}>
                  現在{confirmedCount}チームが決勝進出確定。{finalistsResult.borderRank}位と同じ的中数の{borderlineTeams.length}チームがボーダーラインとなっているため、これらのチーム全員で1人1射の競射を行い、上位{teamFinalsLimit - confirmedCount}チームを決定します。
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <button 
                    onClick={startShootOff} 
                    className="btn-primary"
                  >
                    競射を開始
                  </button>
                </div>
              </div>
            )}

            {isShootOffActive && (
              <div className="card" style={{ background: '#dbeafe', border: '2px solid #3b82f6' }}>
                <h2 className="card-title" style={{ color: '#1e40af' }}>🎯 トーナメント進出決定競射（第{shootOffRound}ラウンド）</h2>
                <p style={{ fontSize: '0.875rem', color: '#1e3a8a', marginBottom: '1rem' }}>
                  残り{teamFinalsLimit - confirmedCount - determinedTeams.length}枠を争う{tiedTeams.length}チームが競射中です。各選手1射ずつ入力してください。
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1rem' }}>
                  {tiedTeams.map(team => {
                    const teamScore = shootOffScores[team.teamKey] || 0;
                    return (
                      <div key={team.teamKey} style={{ padding: '1rem', background: 'white', borderRadius: '0.5rem', border: '2px solid #3b82f6' }}>
                        <div style={{ marginBottom: '0.75rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <div>
                              <span style={{ fontSize: '1rem', fontWeight: 700, color: '#1e40af' }}>{team.teamName}</span>
                              <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.5rem' }}>({team.affiliation})</span>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>予選: {team.totalHits}本</span>
                          </div>
                        </div>
                        
                        <div style={{ background: '#f0f9ff', padding: '0.75rem', borderRadius: '0.375rem', marginBottom: '0.75rem' }}>
                          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 600, color: '#1e40af' }}>第{shootOffRound}ラウンド競射</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${team.members.length}, 1fr)`, gap: '0.5rem' }}>
                            {team.members.map(member => {
                              const key = `${team.teamKey}_${member.archerId}`;
                              const result = shootOffResults[key] || '';
                              return (
                                <div key={member.archerId} style={{ textAlign: 'center' }}>
                                  <div style={{ fontSize: '0.75rem', marginBottom: '0.25rem', color: '#6b7280' }}>{member.name}</div>
                                  <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                                    <button
                                      onClick={() => handleShootOffScore(team.teamKey, member.archerId, 'o')}
                                      className={`btn-sm ${result === 'o' ? 'btn-success' : 'btn-secondary'}`}
                                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', minWidth: '40px' }}
                                    >
                                      ○
                                    </button>
                                    <button
                                      onClick={() => handleShootOffScore(team.teamKey, member.archerId, 'x')}
                                      className={`btn-sm ${result === 'x' ? 'btn-danger' : 'btn-secondary'}`}
                                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', minWidth: '40px' }}
                                    >
                                      ×
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: '#d1fae5', borderRadius: '0.375rem', border: '2px solid #10b981' }}>
                          <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>ラウンド的中:</span>
                          <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#059669' }}>
                            {teamScore}本
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <button 
                    onClick={determineShootOffWinners} 
                    className="btn-primary" 
                    disabled={!tiedTeams.every(t => 
                      t.members.every(m => shootOffResults[`${t.teamKey}_${m.archerId}`])
                    )}
                  >
                    ✅ 第{shootOffRound}ラウンド結果を確定
                  </button>
                  <button 
                    onClick={() => {
                      setShootOffResults({});
                      setShootOffScores({});
                    }} 
                    className="btn-secondary"
                  >
                    🔄 ラウンドをやり直し
                  </button>
                  <button 
                    onClick={() => {
                      setShootOffResults({});
                      setShootOffScores({});
                      setIsShootOffActive(false);
                      setDeterminedTeams([]);
                    }} 
                    className="btn-secondary"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}

            {determinedTeams.length > 0 && (
              <div className="card" style={{ background: '#d1fae5', border: '2px solid #10b981' }}>
                <h2 className="card-title" style={{ color: '#059669' }}>✅ 競射で決定済みのチーム</h2>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-green-300">
                    <thead>
                      <tr className="bg-green-100">
                        <th className="border border-green-300 px-4 py-2">チーム名</th>
                        <th className="border border-green-300 px-4 py-2">所属</th>
                      </tr>
                    </thead>
                    <tbody>
                      {determinedTeams.map(team => (
                        <tr key={team.teamKey} className="hover:bg-green-50">
                          <td className="border border-green-300 px-4 py-2 font-semibold">{team.teamName}</td>
                          <td className="border border-green-300 px-4 py-2">{team.affiliation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

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
                {/* 全枠が確定した場合の完了メッセージ */}
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

            {/* 競射が完了して全枠が確定した場合は、ボーダーラインチームを表示しない */}
            {borderlineTeams.length > 0 && confirmedFinalists.length + determinedTeams.length < teamFinalsLimit && (
              <div className="card">
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

            <div className="card">
              <h2 className="card-title">全チーム順位表</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-4 py-2">チーム名</th>
                      <th className="border border-gray-300 px-4 py-2">所属</th>
                      <th className="border border-gray-300 px-4 py-2">合計的中</th>
                      <th className="border border-gray-300 px-4 py-2">状態</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankings.map(team => {
                      const isConfirmed = confirmedFinalists.some(f => f.teamKey === team.teamKey);
                      const isBorderline = borderlineTeams.some(f => f.teamKey === team.teamKey);
                      return (
                        <tr key={team.teamKey} className={isConfirmed ? 'bg-green-50' : isBorderline ? 'bg-orange-50' : ''}>
                          <td className="border border-gray-300 px-4 py-2">{team.teamName}</td>
                          <td className="border border-gray-300 px-4 py-2">{team.affiliation}</td>
                          <td className="border border-gray-300 px-4 py-2 text-center font-bold">{team.totalHits}本</td>
                          <td className="border border-gray-300 px-4 py-2 text-center">
                            {isConfirmed ? (
                              <span className="text-green-700 font-semibold">✅ 決勝進出確定</span>
                            ) : isBorderline ? (
                              <span className="text-orange-700 font-semibold">🎯 進出戦</span>
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

export default AdminTeamFinalsView;
