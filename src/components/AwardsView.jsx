import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { applicantsApi, API_URL } from '../utils/api';
import { 
  calculateRanksWithTies, 
  getRankOrder 
} from '../utils/competition';
import { getDivisionForArcher } from '../utils/tournament';
import { groupByTeam, calculateTeamHitCount } from '../utils/teamCompetition';

const AwardsView = ({ state, dispatch, selectedTournamentId, setSelectedTournamentId }) => {
  const [archers, setArchers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [shootoffResults, setShootoffResults] = useState(null);
  const [shichumaFinalResults, setShichumaFinalResults] = useState(() => {
    // ローカルストレージから読み込み
    try {
      const saved = localStorage.getItem(`shichumaResults_${selectedTournamentId}`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [enkinFinalResults, setEnkinFinalResults] = useState(() => {
    // ローカルストレージから読み込み
    try {
      const saved = localStorage.getItem(`enkinResults_${selectedTournamentId}`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [selectedTeams, setSelectedTeams] = useState({});
  const [matchScores, setMatchScores] = useState({});
  const [shootOffStarted, setShootOffStarted] = useState({});
  const [shootOffRounds, setShootOffRounds] = useState({});
  const [shootOffScores, setShootOffScores] = useState({});
  const [shootOffIndividualShots, setShootOffIndividualShots] = useState({});
  const tournaments = state.registeredTournaments || [];
  const tournament = tournaments.find(t => t.id === selectedTournamentId) || null;
  const competitionType = tournament?.data?.competitionType || 'individual';
  const isTeamCompetition = competitionType === 'team';

  const rankOrder = useMemo(() => getRankOrder(), []);

  const getTotalHitCountAllStands = useCallback((archer) => {
    const arrows1 = tournament?.data?.arrowsRound1 || state.tournament.arrowsRound1 || 0;
    const arrows2 = tournament?.data?.arrowsRound2 || state.tournament.arrowsRound2 || 0;
    const total = arrows1 + arrows2;
    const results = archer?.results || {};
    let count = 0;
    for (let s = 1; s <= 6; s++) {
      const arr = results[`stand${s}`] || [];
      for (let i = 0; i < Math.min(total, arr.length); i++) {
        if (arr[i] === 'o') count++;
      }
    }
    return count;
  }, [tournament, state.tournament]);

  const calculateRanksWithTiesCallback = useCallback((items) => {
    return calculateRanksWithTies(items);
  }, []);

  useEffect(() => {
    const fetchArchers = async () => {
      if (!selectedTournamentId) {
        setArchers([]);
        return;
      }
      setIsLoading(true);
      try {
        const result = await applicantsApi.getByTournament(selectedTournamentId);
        if (result.success) {
          const checkedIn = (result.data || []).filter(a => a.isCheckedIn);
          setArchers(checkedIn);
        } else {
          setArchers([]);
        }
      } catch (error) {
        console.error('Failed to fetch archers:', error);
        setArchers([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchArchers();
  }, [selectedTournamentId]);

  // ローカルストレージに保存
  useEffect(() => {
    if (selectedTournamentId && shichumaFinalResults) {
      localStorage.setItem(`shichumaResults_${selectedTournamentId}`, JSON.stringify(shichumaFinalResults));
    }
  }, [shichumaFinalResults, selectedTournamentId]);

  useEffect(() => {
    if (selectedTournamentId && enkinFinalResults) {
      localStorage.setItem(`enkinResults_${selectedTournamentId}`, JSON.stringify(enkinFinalResults));
    }
  }, [enkinFinalResults, selectedTournamentId]);

  // ★ 競射結果を取得・10秒ごとにポーリング（RankingViewと同じロジック）
  const fetchShootoffResults = useCallback(async () => {
    if (!selectedTournamentId) return;
    try {
      const response = await fetch(`${API_URL}/ranking/shootoff/${selectedTournamentId}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // サーバーから取得したデータでローカルを更新
          if (result.data.shichuma) {
            setShichumaFinalResults(result.data.shichuma);
          }
          if (result.data.enkin) {
            setEnkinFinalResults(result.data.enkin);
          }
          setShootoffResults(result.data);
        }
      }
    } catch (e) {
      console.warn('AwardsView shootoff fetch error:', e);
    }
  }, [selectedTournamentId]);

  useEffect(() => {
    fetchShootoffResults();
  }, [fetchShootoffResults]);

  useEffect(() => {
    if (!selectedTournamentId) return;
    const interval = setInterval(fetchShootoffResults, 10000);
    return () => clearInterval(interval);
  }, [selectedTournamentId, fetchShootoffResults]);

  // DBからトーナメント状態をロード（団体戦用）
  const loadTournamentState = useCallback(async () => {
    if (!selectedTournamentId || !isTeamCompetition) return;
    try {
      const response = await fetch(`${API_URL}/team-tournament-state/${selectedTournamentId}`);
      const result = await response.json();
      if (result.success && result.data) {
        const d = result.data;
        if (d.selectedTeams) setSelectedTeams(d.selectedTeams);
        if (d.matchScores) setMatchScores(d.matchScores);
        if (d.shootOffScores) setShootOffScores(d.shootOffScores);
        if (d.shootOffStarted) setShootOffStarted(d.shootOffStarted);
        if (d.shootOffRounds) setShootOffRounds(d.shootOffRounds);
        if (d.shootOffIndividualShots) setShootOffIndividualShots(d.shootOffIndividualShots);
      }
    } catch (error) {
      console.error('トーナメント状態ロードエラー:', error);
    }
  }, [selectedTournamentId, isTeamCompetition]);

  useEffect(() => {
    if (isTeamCompetition) {
      loadTournamentState();
    }
  }, [selectedTournamentId, isTeamCompetition, loadTournamentState]);

  const selectedTournament = state.registeredTournaments.find(t => t.id === selectedTournamentId);
  const localDefaultDivisions = [
    { id: 'lower', label: '級位~三段以下の部' },
    { id: 'middle', label: '四・五段の部' },
    { id: 'title', label: '称号者の部' }
  ];
  const divisions = (selectedTournament && selectedTournament.data && selectedTournament.data.divisions) 
    ? selectedTournament.data.divisions 
    : localDefaultDivisions;

  const awardRankLimit = tournament?.data?.awardRankLimit || 3;
  const enableGenderSeparation = selectedTournament?.data?.enableGenderSeparation || false;
  const femaleFirst = enableGenderSeparation && (selectedTournament?.data?.femaleFirst ?? false);

  // 団体戦向けの最終順位表を生成
  const getTeamFinalRankings = useMemo(() => {
    if (!isTeamCompetition || Object.keys(selectedTeams).length === 0) return null;

    // トーナメント完全性を確認（最大ラウンド数を取得）
    const roundNumbers = new Set();
    Object.keys(selectedTeams).forEach(key => {
      const round = parseInt(key.split('-')[0]);
      roundNumbers.add(round);
    });
    
    if (roundNumbers.size === 0) return null;
    
    const totalRounds = Math.max(...roundNumbers);
    if (totalRounds < 2) return null;

    const finalRound = totalRounds;           // 決勝
    const semiRound = totalRounds - 1;        // 準決勝

    // 決勝の勝者・敗者を取得するヘルパー関数
    const getFinalWinnerTeam = (round, matchNum) => {
      const matchKey = `${round}-${matchNum}`;
      const scores = matchScores[matchKey];
      
      if (!scores) return null;
      
      const teams = Object.keys(scores);
      if (teams.length !== 2) return null;
      
      const team1Score = scores[teams[0]];
      const team2Score = scores[teams[1]];
      
      // 12射終了後の的中数で比較
      if (team1Score.totalShots >= 12 && team2Score.totalShots >= 12) {
        if (team1Score.hits > team2Score.hits) {
          return teams[0];
        } else if (team2Score.hits > team1Score.hits) {
          return teams[1];
        } else {
          // 同中の場合は競射へ
          return 'shootoff';
        }
      }
      
      return null;
    };

    // 競射込みの最終勝者チームを返す
    const determineShootOffWinner = (team1Key, team2Key, explicitMatchKey) => {
      const matchKey = explicitMatchKey;
      const matchShootOffScores = shootOffScores[matchKey] || {};
      const score1 = matchShootOffScores[team1Key];
      const score2 = matchShootOffScores[team2Key];

      if (!score1 || !score2) return null;

      const selectedMatch = selectedTeams[matchKey] || {};
      const memberCount = selectedMatch.team1?.members?.length || 3;
      const shootOffRound = shootOffRounds[matchKey] || 1;

      // 両チームの全メンバーが射撃完了しているか（totalShotsでラウンドごとの完了数を確認）
      const team1RoundShots = score1.totalShots || 0;
      const team2RoundShots = score2.totalShots || 0;
      // 現ラウンドまでの累計射数がmemberCount * shootOffRound以上なら完了
      if (team1RoundShots < memberCount * shootOffRound || team2RoundShots < memberCount * shootOffRound) {
        return null;
      }

      const team1RoundHits = score1.rounds?.[shootOffRound] || 0;
      const team2RoundHits = score2.rounds?.[shootOffRound] || 0;

      if (team1RoundHits > team2RoundHits) {
        return team1Key;
      } else if (team2RoundHits > team1RoundHits) {
        return team2Key;
      } else {
        return 'next-round';
      }
    };

    const getWinnerTeamObj = (winnerKey) => {
      // selectedTeamsのすべての試合から該当するチームを探す
      for (const [, match] of Object.entries(selectedTeams)) {
        if (match.team1?.teamKey === winnerKey) return match.team1;
        if (match.team2?.teamKey === winnerKey) return match.team2;
      }
      return null;
    };

    // 決勝の勝者・敗者
    const finalMatchKey = `${finalRound}-1`;
    const finalMatch = selectedTeams[finalMatchKey] || {};
    
    const winner = getFinalWinnerTeam(finalRound, 1);
    let first = null;
    let second = null;

    if (winner && winner !== 'shootoff') {
      first = getWinnerTeamObj(winner);
      second = first && finalMatch.team1 && finalMatch.team2
        ? (first.teamKey === finalMatch.team1.teamKey ? finalMatch.team2 : finalMatch.team1)
        : null;
    } else if (winner === 'shootoff' || shootOffStarted[finalMatchKey]) {
      const shootOffWinner = determineShootOffWinner(finalMatch.team1?.teamKey, finalMatch.team2?.teamKey, finalMatchKey);
      if (shootOffWinner && shootOffWinner !== 'next-round') {
        first = shootOffWinner === finalMatch.team1?.teamKey ? finalMatch.team1 : finalMatch.team2;
        second = shootOffWinner === finalMatch.team1?.teamKey ? finalMatch.team2 : finalMatch.team1;
      }
    }

    // 準決勝の敗者 × 2（準決勝の試合数分）
    const thirdPlaceTeams = [];
    for (const [key, match] of Object.entries(selectedTeams)) {
      const round = parseInt(key.split('-')[0]);
      if (round === semiRound && match.team1 && match.team2) {
        const matchNum = parseInt(key.split('-')[1]);
        const winner = getFinalWinnerTeam(semiRound, matchNum);
        if (winner && winner !== 'shootoff') {
          const loser = winner === match.team1.teamKey ? match.team2 : match.team1;
          thirdPlaceTeams.push(loser);
        } else if ((winner === 'shootoff' || shootOffStarted[key]) && match.team1 && match.team2) {
          const shootOffWinner = determineShootOffWinner(match.team1.teamKey, match.team2.teamKey, key);
          if (shootOffWinner && shootOffWinner !== 'next-round') {
            const loser = shootOffWinner === match.team1.teamKey ? match.team2 : match.team1;
            thirdPlaceTeams.push(loser);
          }
        }
      }
    }

    const allDetermined = first && second && thirdPlaceTeams.length >= 2;

    if (!allDetermined) return null;

    return {
      first,
      second,
      thirdPlaceTeams: thirdPlaceTeams.slice(0, 2)
    };
  }, [selectedTeams, matchScores, shootOffScores, shootOffStarted, shootOffRounds]);

  const divisionRankings = useMemo(() => {
    // RankingViewのgetMergedFinalResultsと同じロジックで統合結果を構築
    const mergedResults = [];
    const processedArcherIds = new Set();

    // 部門ごとに処理
    divisions.forEach(div => {
      const divArchers = archers.filter(a => getDivisionForArcher(a, divisions) === div.id);
      const divisionUsedRanks = new Set();
      const divisionProcessedArchers = new Set();

      const divisionEnkinResults = (enkinFinalResults?.results || []).filter(result => {
        if (result.divisionId) return result.divisionId === div.id;
        return divArchers.some(a => a.archerId === result.archerId);
      });

      // 射詰競射の結果を処理
      if (shichumaFinalResults?.results) {
        const divShichumaResults = shichumaFinalResults.results.filter(result => {
          if (result.divisionId) return result.divisionId === div.id;
          return divArchers.some(a => a.archerId === result.archerId);
        });

        [...divShichumaResults]
          .sort((a, b) => a.rank - b.rank)
          .forEach(result => {
            const archer = divArchers.find(a => a.archerId === result.archerId);
            if (!archer) return;
            const isFromShichumaToEnkin = result.pendingEnkin || divisionEnkinResults.some(e => e.archerId === result.archerId);
            if (isFromShichumaToEnkin) return;
            if (divisionProcessedArchers.has(result.archerId)) return;

            mergedResults.push({
              archerId: result.archerId,
              name: archer.name,
              affiliation: archer.affiliation,
              rank: result.rank,
              rank_source: 'shichuma',
              shootOffType: 'shichuma',
              hitCount: getTotalHitCountAllStands(archer),
              divisionId: div.id,
              danRank: archer.rank
            });
            divisionUsedRanks.add(result.rank);
            divisionProcessedArchers.add(result.archerId);
            processedArcherIds.add(result.archerId);
          });
      }

      // 遠近競射の結果を処理
      if (divisionEnkinResults.length > 0) {
        [...divisionEnkinResults]
          .sort((a, b) => {
            const aT = a.targetRank != null ? a.targetRank : 9999;
            const bT = b.targetRank != null ? b.targetRank : 9999;
            if (aT !== bT) return aT - bT;
            return (parseInt(a.rank) || 9999) - (parseInt(b.rank) || 9999);
          })
          .forEach(result => {
            if (divisionProcessedArchers.has(result.archerId)) return;
            const archer = divArchers.find(a => a.archerId === result.archerId);
            if (!archer) return;
            if (result.rank === '敗退' || result.isDefeated) return;
            const finalRank = parseInt(result.rank);
            if (divisionUsedRanks.has(finalRank)) return;

            mergedResults.push({
              archerId: result.archerId,
              name: archer.name,
              affiliation: archer.affiliation,
              rank: finalRank,
              rank_source: 'enkin',
              shootOffType: 'enkin',
              hitCount: getTotalHitCountAllStands(archer),
              divisionId: div.id,
              danRank: archer.rank
            });
            divisionUsedRanks.add(finalRank);
            divisionProcessedArchers.add(result.archerId);
            processedArcherIds.add(result.archerId);
          });
      }
    });

    // 的中数確定結果を追加
    divisions.forEach(div => {
      const divArchers = archers.filter(a => getDivisionForArcher(a, divisions) === div.id);
      const rankGroups = {};
      divArchers.forEach(archer => {
        const hitCount = getTotalHitCountAllStands(archer);
        if (!rankGroups[hitCount]) rankGroups[hitCount] = [];
        rankGroups[hitCount].push(archer);
      });
      const sortedGroups = Object.entries(rankGroups)
        .map(([h, g]) => [parseInt(h), g])
        .sort(([a], [b]) => b - a);
      let currentRank = 1;
      sortedGroups.forEach(([hitCount, group]) => {
        const isTied = group.length > 1;
        const isInAwardRange = currentRank <= awardRankLimit;
        if (!isTied && isInAwardRange) {
          group.forEach(archer => {
            if (!processedArcherIds.has(archer.archerId)) {
              mergedResults.push({
                archerId: archer.archerId,
                name: archer.name,
                affiliation: archer.affiliation,
                rank: currentRank,
                rank_source: 'confirmed',
                shootOffType: null,
                hitCount: hitCount,
                divisionId: div.id,
                danRank: archer.rank
              });
              processedArcherIds.add(archer.archerId);
            }
          });
        }
        currentRank += group.length;
      });
    });

    // 部門ごとに分類
    const resultsByDivision = {};
    divisions.forEach(div => {
      const divGenderSeparation = div.enableGenderSeparation || enableGenderSeparation;
      if (divGenderSeparation) {
        resultsByDivision[`${div.id}_male`] = { division: { ...div, gender: 'male' }, ranked: [] };
        resultsByDivision[`${div.id}_female`] = { division: { ...div, gender: 'female' }, ranked: [] };
      } else {
        resultsByDivision[div.id] = { division: div, ranked: [] };
      }
    });

    mergedResults.forEach(result => {
      const archer = archers.find(a => a.archerId === result.archerId);
      if (archer) {
        const divId = result.divisionId;
        const gender = archer.gender || 'male';
        const divisionConfig = divisions.find(d => d.id === divId);
        const divGenderSeparation = divisionConfig?.enableGenderSeparation || enableGenderSeparation;
        const targetDivId = divGenderSeparation ? `${divId}_${gender}` : divId;
        if (!resultsByDivision[targetDivId]) {
          resultsByDivision[targetDivId] = { division: { id: targetDivId, label: targetDivId }, ranked: [] };
        }
        resultsByDivision[targetDivId].ranked.push({
          ...result,
          shootoffSource: result.shootOffType === 'shichuma' ? '射詰' : result.shootOffType === 'enkin' ? '遠近' : null
        });
      }
    });

    const result = [];
    divisions.forEach(div => {
      const divGenderSeparation = div.enableGenderSeparation || enableGenderSeparation;
      if (divGenderSeparation) {
        const firstG = femaleFirst ? 'female' : 'male';
        const secondG = femaleFirst ? 'male' : 'female';
        const firstL = femaleFirst ? '女' : '男';
        const secondL = femaleFirst ? '男' : '女';
        if (resultsByDivision[`${div.id}_${firstG}`]?.ranked.length > 0) {
          result.push(resultsByDivision[`${div.id}_${firstG}`]);
        }
        if (resultsByDivision[`${div.id}_${secondG}`]?.ranked.length > 0) {
          result.push(resultsByDivision[`${div.id}_${secondG}`]);
        }
      } else {
        if (resultsByDivision[div.id]?.ranked.length > 0) {
          result.push(resultsByDivision[div.id]);
        }
      }
    });

    return result;
  }, [archers, divisions, enableGenderSeparation, femaleFirst, getTotalHitCountAllStands, shichumaFinalResults, enkinFinalResults, awardRankLimit]);

  // 団体戦向けのチーム順位表
  const teamRankings = useMemo(() => {
    if (!isTeamCompetition) return [];
    
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
  }, [archers, tournament?.data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 団体戦向け最終順位表 */}
      {isTeamCompetition ? (
        <>
          {getTeamFinalRankings && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold mb-4">🏆 最終順位</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-4 py-2 w-20 text-center">順位</th>
                      <th className="border border-gray-300 px-4 py-2 text-center">チーム名</th>
                      <th className="border border-gray-300 px-4 py-2 text-center">所属</th>
                      <th className="border border-gray-300 px-4 py-2 text-center">メンバー</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* 1位 */}
                    {getTeamFinalRankings.first && (
                      <tr className="bg-yellow-50 hover:bg-yellow-100">
                        <td className="border border-gray-300 px-4 py-3 text-center">
                          <span className="text-2xl">🥇</span>
                          <div className="text-xs font-bold text-yellow-700">1位</div>
                        </td>
                        <td className="border border-gray-300 px-4 py-3 font-bold text-lg text-yellow-800">{getTeamFinalRankings.first.teamName}</td>
                        <td className="border border-gray-300 px-4 py-3 text-center text-gray-600">{getTeamFinalRankings.first.affiliation}</td>
                        <td className="border border-gray-300 px-4 py-3 text-sm text-gray-600">{getTeamFinalRankings.first.members?.map(m => m.name).join(', ')}</td>
                      </tr>
                    )}
                    {/* 2位 */}
                    {getTeamFinalRankings.second && (
                      <tr className="bg-gray-50 hover:bg-gray-100">
                        <td className="border border-gray-300 px-4 py-3 text-center">
                          <span className="text-2xl">🥈</span>
                          <div className="text-xs font-bold text-gray-500">2位</div>
                        </td>
                        <td className="border border-gray-300 px-4 py-3 font-bold text-gray-700">{getTeamFinalRankings.second.teamName}</td>
                        <td className="border border-gray-300 px-4 py-3 text-center text-gray-600">{getTeamFinalRankings.second.affiliation}</td>
                        <td className="border border-gray-300 px-4 py-3 text-sm text-gray-600">{getTeamFinalRankings.second.members?.map(m => m.name).join(', ')}</td>
                      </tr>
                    )}
                    {/* 3位（2チーム） */}
                    {getTeamFinalRankings.thirdPlaceTeams.map((team, idx) => (
                      <tr key={team.teamKey} className="bg-orange-50 hover:bg-orange-100">
                        <td className="border border-gray-300 px-4 py-3 text-center">
                          {idx === 0 && <span className="text-2xl">🥉</span>}
                          <div className="text-xs font-bold text-orange-600">3位</div>
                        </td>
                        <td className="border border-gray-300 px-4 py-3 font-bold text-orange-700">{team.teamName}</td>
                        <td className="border border-gray-300 px-4 py-3 text-center text-gray-600">{team.affiliation}</td>
                        <td className="border border-gray-300 px-4 py-3 text-sm text-gray-600">{team.members?.map(m => m.name).join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        /* 個人戦向け最終順位表 */
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4">🏆 最終順位表</h2>
        <p className="text-sm text-gray-600 mb-4">表彰範囲：{awardRankLimit}位まで</p>
        
        {divisionRankings.length === 0 ? (
          <p className="text-gray-500">最終順位表の記録がありません</p>
        ) : (
          <div className="space-y-6">
            {divisionRankings.map((group, groupIndex) => (
              <div key={groupIndex}>
                <h3 className="text-lg font-semibold text-green-600 mb-3">
                  {group.division.label}
                  {group.division.gender && (
                    <span className="ml-2 text-sm text-gray-500">
                      （{group.division.gender === 'male' ? '男' : '女'}）
                    </span>
                  )}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-green-300">
                    <thead>
                      <tr className="bg-green-100">
                        <th className="border border-green-300 px-4 py-2 text-left">順位</th>
                        <th className="border border-green-300 px-4 py-2 text-center">的中数</th>
                        <th className="border border-green-300 px-4 py-2 text-left">氏名</th>
                        <th className="border border-green-300 px-4 py-2 text-center">詳細</th>
                        <th className="border border-green-300 px-4 py-2 text-left">所属</th>
                        <th className="border border-green-300 px-4 py-2 text-left">段位</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.ranked.filter(archer => archer.rank <= awardRankLimit).length === 0 ? (
                        <tr>
                          <td colSpan="6" className="border border-green-300 px-4 py-8 text-center text-gray-500">
                            この部門の最終順位表の記録がありません<br />
                            <span className="text-xs">（表彰範囲：{awardRankLimit}位まで）</span>
                          </td>
                        </tr>
                      ) : (
                        group.ranked
                          .filter(archer => archer.rank <= awardRankLimit)
                          .map((archer, index) => (
                            <tr key={archer.id || archer.archerId || `archer-${index}`} className="hover:bg-green-50">
                              <td className="border border-green-300 px-4 py-2 font-bold">
                                <span className="text-green-900">{archer.rank}位</span>
                              </td>
                              <td className="border border-green-300 px-4 py-2 text-center font-semibold">
                                {archer.hitCount || '-'}
                              </td>
                              <td className="border border-green-300 px-4 py-2 font-semibold">
                                {archer.name}
                              </td>
                              <td className="border border-green-300 px-4 py-2 text-sm text-center">
                                {archer.shootoffSource ? (
                                  <span className={`text-sm px-2 py-1 rounded ${
                                    archer.shootoffSource === '射詰' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                                  }`}>
                                    {archer.shootoffSource}
                                  </span>
                                ) : (
                                  <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">的中数</span>
                                )}
                              </td>
                              <td className="border border-green-300 px-4 py-2 text-gray-600">
                                {archer.affiliation}
                              </td>
                              <td className="border border-green-300 px-4 py-2 text-gray-600">
                                {archer.danRank || archer.rank || '-'}
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
};

export default AwardsView;