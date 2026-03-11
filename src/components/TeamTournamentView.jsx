import React, { useState, useEffect } from 'react';
import { API_URL } from '../utils/api';
import { groupByTeam, calculateTeamHitCount } from '../utils/teamCompetition';
import '../index.css'; // CSSをインポート

const TeamTournamentView = ({ state, selectedTournamentId }) => {
  const [archers, setArchers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTeams, setSelectedTeams] = useState({}); // トーナメント表で選択されたチーム
  const [showModal, setShowModal] = useState(false); // モーダル表示状態
  const [currentMatch, setCurrentMatch] = useState(null); // 現在選択中の試合
  const [matchScores, setMatchScores] = useState({}); // 試合の的中スコア
  const [currentRound, setCurrentRound] = useState(null); // 現在入力中のラウンド
  const [currentMatchNum, setCurrentMatchNum] = useState(null); // 現在入力中の試合番号
  const [shootOffScores, setShootOffScores] = useState({}); // 競射スコア
  const [individualShots, setIndividualShots] = useState({}); // 個別射数記録
  const [shootOffStarted, setShootOffStarted] = useState({}); // 競射開始状態
  const [shootOffRounds, setShootOffRounds] = useState({}); // 競射ラウンド管理
  const [shootOffIndividualShots, setShootOffIndividualShots] = useState({}); // 競射個別射数記録
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const saveTimerRef = React.useRef(null);

  const tournament = state.registeredTournaments.find(t => t.id === selectedTournamentId);
  const teamFinalsLimit = tournament?.data?.teamFinalsLimit || 8; // 設定ページから取得

  // 上位チームを取得
  const getTopTeams = () => {
    const teams = groupByTeam(archers);
    const teamScores = teams.map(team => ({
      ...team,
      totalHits: calculateTeamHitCount(team.members, tournament?.data || {})
    }));

    teamScores.sort((a, b) => b.totalHits - a.totalHits);

    // 設定ページのteamFinalsLimitを使用
    return teamScores.slice(0, teamFinalsLimit);
  };

  useEffect(() => {
    if (selectedTournamentId) {
      fetchArchers();
      loadTournamentState();
    }
  }, [selectedTournamentId]);

  // DBからトーナメント状態をロード
  const loadTournamentState = async () => {
    try {
      const response = await fetch(`${API_URL}/team-tournament-state/${selectedTournamentId}`);
      const result = await response.json();
      if (result.success && result.data) {
        const d = result.data;
        if (d.selectedTeams)          setSelectedTeams(d.selectedTeams);
        if (d.matchScores)            setMatchScores(d.matchScores);
        if (d.individualShots)        setIndividualShots(d.individualShots);
        if (d.shootOffScores)         setShootOffScores(d.shootOffScores);
        if (d.shootOffStarted)        setShootOffStarted(d.shootOffStarted);
        if (d.shootOffRounds)         setShootOffRounds(d.shootOffRounds);
        if (d.shootOffIndividualShots) setShootOffIndividualShots(d.shootOffIndividualShots);
      }
    } catch (error) {
      console.error('トーナメント状態ロードエラー:', error);
    }
  };

  // 状態変更時にデバウンスして自動保存（1秒後）
  useEffect(() => {
    if (!selectedTournamentId) return;
    // 初回ロード直後の空stateで上書きしないよう、何か入っているときだけ保存
    const hasData = Object.keys(selectedTeams).length > 0 || Object.keys(matchScores).length > 0;
    if (!hasData) return;

    setSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await fetch(`${API_URL}/team-tournament-state/${selectedTournamentId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            selectedTeams,
            matchScores,
            individualShots,
            shootOffScores,
            shootOffStarted,
            shootOffRounds,
            shootOffIndividualShots,
          }),
        });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (error) {
        console.error('トーナメント状態保存エラー:', error);
        setSaveStatus('error');
      }
    }, 1000);
  }, [selectedTeams, matchScores, individualShots, shootOffScores, shootOffStarted, shootOffRounds, shootOffIndividualShots]);

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

  const topTeams = getTopTeams();

  // トーナメント表のマッチングを生成（くじ方式）
  const generateTournamentMatches = (teams) => {
    if (teams.length === 0) return [];
    
    // 次の2のべき乗を取得
    const nextPowerOfTwo = Math.pow(2, Math.ceil(Math.log2(teams.length)));
    const totalSlots = nextPowerOfTwo;
    
    // トーナメントラウンドを生成
    const rounds = [];
    const numRounds = Math.log2(totalSlots);
    
    for (let round = 0; round < numRounds; round++) {
      const matches = [];
      const numMatches = Math.pow(2, numRounds - round - 1);
      
      for (let i = 0; i < numMatches; i++) {
        let team1 = null;
        let team2 = null;
        
        if (round === 0) {
          // 第1ラウンド：すべて空白（くじ用）
          team1 = null;
          team2 = null;
        } else {
          // 第2ラウンド以降：前のラウンドの勝者（今回は空白）
          // 実際の実装では前のラウンドの勝者を設定
        }
        
        matches.push({
          round,
          matchNumber: i + 1,
          team1,
          team2,
          winner: null // 勝者は未設定
        });
      }
      
      rounds.push({
        roundNumber: round + 1,
        roundName: round === 0 ? '1回戦' : 
                  round === 1 ? '準決勝' : '決勝',
        matches
      });
    }
    
    return rounds;
  };

  // チーム選択処理
  const handleTeamSelect = (matchKey, position, team) => {
    setSelectedTeams(prev => ({
      ...prev,
      [matchKey]: {
        ...prev[matchKey],
        [position]: team
      }
    }));
    setShowModal(false);
    setCurrentMatch(null);
  };

  // モーダルを開く（全ラウンド対応）
  const openTeamModal = (matchKey, position) => {
    setCurrentMatch({ matchKey, position });
    setShowModal(true);
  };

  // 利用可能なチーム一覧（1回戦は未配置のみ、それ以外は全チーム表示）
  const getAvailableTeams = () => {
    if (!currentMatch) return topTeams;
    const round = parseInt(currentMatch.matchKey.split('-')[0]);
    if (round === 1) {
      // 1回戦はすでに1回戦に配置済みのチームを除外
      const round1AssignedKeys = new Set();
      Object.entries(selectedTeams).forEach(([key, match]) => {
        const r = parseInt(key.split('-')[0]);
        if (r === 1) {
          if (match.team1) round1AssignedKeys.add(match.team1.teamKey);
          if (match.team2) round1AssignedKeys.add(match.team2.teamKey);
        }
      });
      return topTeams.filter(team => !round1AssignedKeys.has(team.teamKey));
    }
    // 2回戦以降は全チームを表示（手動設定のため）
    return topTeams;
  };

  // 的中入力処理
  const handleHitInput = (round, matchNum, team, memberIdx, hitCount) => {
    const matchKey = `${round}-${matchNum}`;
    const individualKey = `${matchKey}-${team.teamKey}-${memberIdx}`;

    // updater外で現在のshotsを取得して計算（updater内でsetMatchScoresを呼ぶとStrictModeで2回実行されてしまうため）
    const currentShots = individualShots[individualKey] || [];

    // 空きスロット（undefined）があればそこに入れる、なければ末尾に追加
    const firstEmpty = currentShots.findIndex(s => s === undefined);
    const updatedShots = [...currentShots];
    if (firstEmpty !== -1) {
      updatedShots[firstEmpty] = hitCount;
    } else {
      updatedShots.push(hitCount);
    }

    // チームスコアを再計算（undefinedを除いた値で計算）
    const previousHits = currentShots.filter(s => s === 1).length;
    const previousShots = currentShots.filter(s => s !== undefined).length;
    const newHits = updatedShots.filter(s => s === 1).length;
    const newShots = updatedShots.filter(s => s !== undefined).length;

    // individualShotsとmatchScoresを独立して更新（ネストを避ける）
    setIndividualShots(prev => ({
      ...prev,
      [individualKey]: updatedShots
    }));

    setMatchScores(scoresPrev => {
      const currentMatchScores = scoresPrev[matchKey] || {};
      const currentTeamScores = currentMatchScores[team.teamKey] || {};

      return {
        ...scoresPrev,
        [matchKey]: {
          ...currentMatchScores,
          [team.teamKey]: {
            ...currentTeamScores,
            hits: (currentTeamScores.hits || 0) - previousHits + newHits,
            totalShots: (currentTeamScores.totalShots || 0) - previousShots + newShots
          }
        }
      };
    });
  };

  // 個別射数の取得
  const getIndividualShots = (round, matchNum, team, memberIdx) => {
    const matchKey = `${round}-${matchNum}`;
    const individualKey = `${matchKey}-${team.teamKey}-${memberIdx}`;
    return individualShots[individualKey] || [];
  };

  // 個別射数完了判定
  const isIndividualComplete = (round, matchNum, team, memberIdx) => {
    const shots = getIndividualShots(round, matchNum, team, memberIdx);
    return shots.filter(s => s !== undefined).length >= 4;
  };

  // 修正機能（指定した射をundefinedに戻して再入力可能にする）
  const handleUndo = (round, matchNum, team, memberIdx, shotIdx) => {
    const matchKey = `${round}-${matchNum}`;
    const individualKey = `${matchKey}-${team.teamKey}-${memberIdx}`;

    const currentShots = individualShots[individualKey] || [];
    if (shotIdx >= currentShots.length) return;

    const removedShot = currentShots[shotIdx];
    const updatedShots = [...currentShots];
    updatedShots[shotIdx] = undefined;

    setIndividualShots(prev => ({
      ...prev,
      [individualKey]: updatedShots
    }));

    setMatchScores(scoresPrev => {
      const currentMatchScores = scoresPrev[matchKey] || {};
      const currentTeamScores = currentMatchScores[team.teamKey] || {};

      return {
        ...scoresPrev,
        [matchKey]: {
          ...currentMatchScores,
          [team.teamKey]: {
            ...currentTeamScores,
            hits: Math.max(0, (currentTeamScores.hits || 0) - (removedShot === 1 ? 1 : 0)),
            totalShots: Math.max(0, (currentTeamScores.totalShots || 0) - 1)
          }
        }
      };
    });
  };

  // 競射入力処理
  const handleShootOffInput = (team, memberIdx, hitCount) => {
    const matchKey = `${currentRound}-${currentMatchNum}`;
    const individualKey = `${matchKey}-${team.teamKey}-${memberIdx}`;
    const shootOffRound = shootOffRounds[matchKey] || 1;

    // updater外で現在のshotsを取得（updater内でsetShootOffScoresを呼ぶとStrictModeで2回実行されてしまうため）
    const currentShots = shootOffIndividualShots[individualKey] || [];
    const updatedShots = [...currentShots, hitCount];

    // 個別射数を更新
    setShootOffIndividualShots(prev => ({
      ...prev,
      [individualKey]: updatedShots
    }));

    // 1射完了の場合のみスコアを更新
    if (updatedShots.length === 1) {
      const memberHits = typeof hitCount === 'number' ? hitCount : 0;

      setShootOffScores(scoresPrev => {
        const matchScoresPrev = scoresPrev[matchKey] || {};
        const currentTeamScores = matchScoresPrev[team.teamKey] || { hits: 0, totalShots: 0, rounds: {} };
        const roundScores = currentTeamScores.rounds || {};

        return {
          ...scoresPrev,
          [matchKey]: {
            ...matchScoresPrev,
            [team.teamKey]: {
              ...currentTeamScores,
              hits: (currentTeamScores.hits || 0) + memberHits,
              totalShots: (currentTeamScores.totalShots || 0) + 1,
              rounds: {
                ...roundScores,
                [shootOffRound]: (roundScores[shootOffRound] || 0) + memberHits
              }
            }
          }
        };
      });
    }
  };

  // 競射個別射数の取得
  const getShootOffIndividualShots = (team, memberIdx) => {
    const matchKey = `${currentRound}-${currentMatchNum}`;
    const individualKey = `${matchKey}-${team.teamKey}-${memberIdx}`;
    return shootOffIndividualShots[individualKey] || [];
  };

  // 競射修正機能
  const handleShootOffUndo = (team, memberIdx) => {
    const matchKey = `${currentRound}-${currentMatchNum}`;
    const individualKey = `${matchKey}-${team.teamKey}-${memberIdx}`;
    const shootOffRound = shootOffRounds[matchKey] || 1;

    const currentShots = shootOffIndividualShots[individualKey] || [];
    if (currentShots.length === 0) return;

    const removedHit = currentShots[currentShots.length - 1];
    const updatedShots = currentShots.slice(0, -1);

    setShootOffIndividualShots(prev => ({
      ...prev,
      [individualKey]: updatedShots
    }));

    // スコアを1射分戻す
    const memberHits = typeof removedHit === 'number' ? removedHit : 0;
    setShootOffScores(scoresPrev => {
      const matchScoresPrev = scoresPrev[matchKey] || {};
      const currentTeamScores = matchScoresPrev[team.teamKey] || { hits: 0, totalShots: 0, rounds: {} };
      const roundScores = currentTeamScores.rounds || {};

      return {
        ...scoresPrev,
        [matchKey]: {
          ...matchScoresPrev,
          [team.teamKey]: {
            ...currentTeamScores,
            hits: Math.max(0, (currentTeamScores.hits || 0) - memberHits),
            totalShots: Math.max(0, (currentTeamScores.totalShots || 0) - 1),
            rounds: {
              ...roundScores,
              [shootOffRound]: Math.max(0, (roundScores[shootOffRound] || 0) - memberHits)
            }
          }
        }
      };
    });
  };

  // 競射ラウンド進行
  const advanceShootOffRound = () => {
    const matchKey = `${currentRound}-${currentMatchNum}`;
    
    // ラウンドを進行
    setShootOffRounds(prev => ({
      ...prev,
      [matchKey]: (prev[matchKey] || 1) + 1
    }));
    
    // 個別射数をリセット（新しいラウンドのため）
    const selectedMatch = selectedTeams[matchKey] || {};
    if (selectedMatch.team1 && selectedMatch.team2) {
      selectedMatch.team1.members.forEach((_, memberIdx) => {
        const individualKey = `${matchKey}-${selectedMatch.team1.teamKey}-${memberIdx}`;
        setShootOffIndividualShots(prev => ({
          ...prev,
          [individualKey]: []
        }));
      });
      
      selectedMatch.team2.members.forEach((_, memberIdx) => {
        const individualKey = `${matchKey}-${selectedMatch.team2.teamKey}-${memberIdx}`;
        setShootOffIndividualShots(prev => ({
          ...prev,
          [individualKey]: []
        }));
      });
    }
  };

  // 競射リセット
  const resetShootOffRound = () => {
    const matchKey = `${currentRound}-${currentMatchNum}`;
    setShootOffRounds(prev => ({
      ...prev,
      [matchKey]: 1
    }));
  };

  // 勝者判定
  const determineWinner = (round, matchNum) => {
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

  // 競射勝者判定
  const determineShootOffWinner = (team1Key, team2Key, explicitMatchKey) => {
    const matchKey = explicitMatchKey || `${currentRound}-${currentMatchNum}`;
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

  // 競射開始状態を監視
  useEffect(() => {
    const matchKey = `${currentRound}-${currentMatchNum}`;
    if (currentRound !== null && currentMatchNum !== null) {
      const scores = matchScores[matchKey];
      if (scores && scores[selectedTeams[matchKey]?.team1?.teamKey]?.totalShots >= 12 && 
          scores[selectedTeams[matchKey]?.team2?.teamKey]?.totalShots >= 12) {
        const winner = determineWinner(currentRound, currentMatchNum);
        if (winner === 'shootoff' && !shootOffStarted[matchKey]) {
          setShootOffStarted(prev => ({
            ...prev,
            [matchKey]: true
          }));
        }
      }
    }
  }, [matchScores, currentRound, currentMatchNum, selectedTeams, shootOffStarted]);

  // 試合の勝者チームオブジェクトを返す
  const getMatchWinnerTeam = (round, matchNum) => {
    const matchKey = `${round}-${matchNum}`;
    const selectedMatch = selectedTeams[matchKey] || {};
    if (!selectedMatch.team1 || !selectedMatch.team2) return null;

    const winner = determineWinner(round, matchNum);
    if (!winner || winner === 'shootoff') return null;

    if (winner === selectedMatch.team1.teamKey) return selectedMatch.team1;
    if (winner === selectedMatch.team2.teamKey) return selectedMatch.team2;
    return null;
  };

  // 競射込みの最終勝者チームオブジェクトを返す
  const getFinalWinnerTeam = (round, matchNum) => {
    const matchKey = `${round}-${matchNum}`;
    const selectedMatch = selectedTeams[matchKey] || {};
    if (!selectedMatch.team1 || !selectedMatch.team2) return null;

    const winner = determineWinner(round, matchNum);
    if (winner && winner !== 'shootoff') {
      return winner === selectedMatch.team1.teamKey ? selectedMatch.team1 : selectedMatch.team2;
    }

    // 競射が始まっている場合
    if (winner === 'shootoff' || shootOffStarted[matchKey]) {
      const shootOffWinnerKey = determineShootOffWinner(selectedMatch.team1.teamKey, selectedMatch.team2.teamKey, matchKey);
      if (shootOffWinnerKey && shootOffWinnerKey !== 'next-round') {
        return shootOffWinnerKey === selectedMatch.team1.teamKey ? selectedMatch.team1 : selectedMatch.team2;
      }
    }
    return null;
  };

  // 次のラウンドのスロット情報を返す（matchNum奇数→team1、偶数→team2）
  const getNextRoundInfo = (round, matchNum) => {
    const nextRound = round + 1;
    const nextMatchNum = Math.ceil(matchNum / 2);
    const position = matchNum % 2 === 1 ? 'team1' : 'team2';
    return { nextRound, nextMatchNum, position };
  };

  // 勝者を次のラウンドへ昇格させる
  const advanceWinnerToNextRound = (round, matchNum) => {
    const winnerTeam = getFinalWinnerTeam(round, matchNum);
    if (!winnerTeam) return;

    const { nextRound, nextMatchNum, position } = getNextRoundInfo(round, matchNum);
    const nextMatchKey = `${nextRound}-${nextMatchNum}`;

    setSelectedTeams(prev => ({
      ...prev,
      [nextMatchKey]: {
        ...prev[nextMatchKey],
        [position]: winnerTeam
      }
    }));
  };

  // モーダルを開く（全ラウンド対応・手動設定用） ※openTeamModalと同じだが明示的に残す
  const openTeamModalForAnyRound = (matchKey, position) => {
    setCurrentMatch({ matchKey, position });
    setShowModal(true);
  };

  const tournamentRounds = generateTournamentMatches(topTeams);

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
          🏆 団体戦トーナメント
          <span className="ml-3 text-sm font-normal">
            {saveStatus === 'saving' && <span className="text-yellow-500">⏳ 保存中...</span>}
            {saveStatus === 'saved'  && <span className="text-green-500">✅ 保存済み</span>}
            {saveStatus === 'error'  && <span className="text-red-500">❌ 保存失敗</span>}
          </span>
        </h1>
        
        {archers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">チェックインした選手がいません</p>
          </div>
        ) : (
          <>
            {/* トーナメント設定 */}
            <div className="card mb-6">
              <h2 className="card-title">トーナメント設定</h2>
              <div className="flex items-center gap-4">
                <span className="font-semibold">上位チーム数:</span>
                <span className="text-blue-600 font-bold">{teamFinalsLimit}チーム</span>
                <span className="text-gray-600">（設定ページから取得）</span>
              </div>
            </div>

            {/* 上位チーム一覧 */}
            <div className="card mb-6">
              <h2 className="card-title">上位{teamFinalsLimit}チーム</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-4 py-2">順位</th>
                      <th className="border border-gray-300 px-4 py-2">チーム名</th>
                      <th className="border border-gray-300 px-4 py-2">所属</th>
                      <th className="border border-gray-300 px-4 py-2">的中数</th>
                      <th className="border border-gray-300 px-4 py-2">メンバー</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topTeams.map((team, index) => (
                      <tr key={team.teamKey} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-4 py-2 text-center font-bold">{index + 1}位</td>
                        <td className="border border-gray-300 px-4 py-2 font-semibold">{team.teamName}</td>
                        <td className="border border-gray-300 px-4 py-2">{team.affiliation}</td>
                        <td className="border border-gray-300 px-4 py-2 text-center font-bold">{team.totalHits}本</td>
                        <td className="border border-gray-300 px-4 py-2 text-sm">{team.members.map(m => m.name).join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* トーナメント表 */}
            <div className="card">
              <h2 className="card-title">トーナメント表</h2>
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded">
                <p className="text-sm text-blue-800">
                  <strong>使い方：</strong>
                  <br />1. 各ラウンドの「---」をクリックしてチームを手動設定（全ラウンド可）
                  <br />2. 両チーム揃ったら「的中入力」で結果を記録（1人4射、1チーム12射）
                  <br />3. 勝者が決まったら「次の試合へ進める」ボタンで自動昇格
                  <br />4. 同中の場合は競射（1人1射）で決着
                </p>
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-max">
                  {tournamentRounds.map((round) => (
                    <div key={round.roundNumber} className="mb-8">
                      <h3 className="text-lg font-semibold mb-4 text-center">{round.roundName}</h3>
                      <div className="flex justify-center gap-4 flex-wrap">
                        {round.matches.map((match) => {
                          const matchKey = `${round.roundNumber}-${match.matchNumber}`;
                          const selectedMatch = selectedTeams[matchKey] || {};
                          const finalWinner = getFinalWinnerTeam(round.roundNumber, match.matchNumber);
                          const scores = matchScores[matchKey];

                          // 次のラウンドへの昇格先を計算
                          const hasNextRound = round.roundNumber < tournamentRounds.length;
                          const { nextRound, nextMatchNum, position: nextPosition } = hasNextRound
                            ? getNextRoundInfo(round.roundNumber, match.matchNumber)
                            : {};
                          const nextMatchKey = hasNextRound ? `${nextRound}-${nextMatchNum}` : null;
                          const alreadyAdvanced = hasNextRound &&
                            selectedTeams[nextMatchKey]?.[nextPosition]?.teamKey === finalWinner?.teamKey;

                          return (
                            <div
                              key={match.matchNumber}
                              className={`border-2 rounded-lg p-4 min-w-[300px] ${finalWinner ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-50'}`}
                            >
                              <div className="text-center mb-2">
                                <span className="font-semibold">試合 {match.matchNumber}</span>
                                {selectedMatch.team1 && selectedMatch.team2 && (
                                  <button
                                    onClick={() => {
                                      setCurrentRound(round.roundNumber);
                                      setCurrentMatchNum(match.matchNumber);
                                    }}
                                    className="ml-2 px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                                  >
                                    的中入力
                                  </button>
                                )}
                              </div>

                              <div className="space-y-2">
                                {/* チーム1スロット */}
                                <div
                                  className={`flex justify-between items-center p-2 bg-white rounded border cursor-pointer hover:bg-blue-50
                                    ${finalWinner?.teamKey === selectedMatch.team1?.teamKey ? 'border-green-500 bg-green-50' : ''}`}
                                  onClick={() => openTeamModal(matchKey, 'team1')}
                                >
                                  <span className="font-medium flex items-center gap-1">
                                    {finalWinner?.teamKey === selectedMatch.team1?.teamKey && (
                                      <span className="text-green-600 text-xs font-bold">🏆</span>
                                    )}
                                    {selectedMatch.team1 ? selectedMatch.team1.teamName : (
                                      <span className="text-gray-400">--- クリックして設定</span>
                                    )}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    {scores?.[selectedMatch.team1?.teamKey] && (
                                      <span className="text-xs font-bold text-blue-700">
                                        {scores[selectedMatch.team1.teamKey].hits}本
                                      </span>
                                    )}
                                    {selectedMatch.team1 && (
                                      <button
                                        onClick={e => { e.stopPropagation(); openTeamModal(matchKey, 'team1'); }}
                                        className="text-xs text-gray-400 hover:text-blue-500 ml-1"
                                        title="変更"
                                      >✏️</button>
                                    )}
                                  </div>
                                </div>

                                <div className="text-center text-gray-400">VS</div>

                                {/* チーム2スロット */}
                                <div
                                  className={`flex justify-between items-center p-2 bg-white rounded border cursor-pointer hover:bg-blue-50
                                    ${finalWinner?.teamKey === selectedMatch.team2?.teamKey ? 'border-green-500 bg-green-50' : ''}`}
                                  onClick={() => openTeamModal(matchKey, 'team2')}
                                >
                                  <span className="font-medium flex items-center gap-1">
                                    {finalWinner?.teamKey === selectedMatch.team2?.teamKey && (
                                      <span className="text-green-600 text-xs font-bold">🏆</span>
                                    )}
                                    {selectedMatch.team2 ? selectedMatch.team2.teamName : (
                                      <span className="text-gray-400">--- クリックして設定</span>
                                    )}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    {scores?.[selectedMatch.team2?.teamKey] && (
                                      <span className="text-xs font-bold text-blue-700">
                                        {scores[selectedMatch.team2.teamKey].hits}本
                                      </span>
                                    )}
                                    {selectedMatch.team2 && (
                                      <button
                                        onClick={e => { e.stopPropagation(); openTeamModal(matchKey, 'team2'); }}
                                        className="text-xs text-gray-400 hover:text-blue-500 ml-1"
                                        title="変更"
                                      >✏️</button>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* 勝者・昇格ボタン */}
                              <div className="mt-3">
                                {finalWinner ? (
                                  <div className="text-center">
                                    <p className="text-green-700 font-bold text-sm">🏆 勝者: {finalWinner.teamName}</p>
                                    {hasNextRound && (
                                      alreadyAdvanced ? (
                                        <p className="text-xs text-green-600 mt-1">✅ 次の試合へ昇格済み</p>
                                      ) : (
                                        <button
                                          onClick={() => advanceWinnerToNextRound(round.roundNumber, match.matchNumber)}
                                          className="mt-1 px-3 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 font-semibold"
                                        >
                                          ▶ 次の試合へ進める
                                        </button>
                                      )
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-center text-sm text-gray-400">勝者: 未定</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 順位表 */}
            {(() => {
              const totalRounds = tournamentRounds.length;
              if (totalRounds < 2) return null;

              const finalRound = totalRounds;           // 決勝
              const semiRound  = totalRounds - 1;       // 準決勝

              // 決勝の勝者・敗者
              const finalMatchKey = `${finalRound}-1`;
              const finalMatch    = selectedTeams[finalMatchKey] || {};
              const first         = getFinalWinnerTeam(finalRound, 1);
              const second        = first && finalMatch.team1 && finalMatch.team2
                ? (first.teamKey === finalMatch.team1.teamKey ? finalMatch.team2 : finalMatch.team1)
                : null;

              // 準決勝の敗者 × 2（準決勝の試合数分）
              const semiRoundData   = tournamentRounds.find(r => r.roundNumber === semiRound);
              const thirdPlaceTeams = semiRoundData
                ? semiRoundData.matches.map(m => {
                    const mk     = `${semiRound}-${m.matchNumber}`;
                    const sm     = selectedTeams[mk] || {};
                    const winner = getFinalWinnerTeam(semiRound, m.matchNumber);
                    if (!winner || !sm.team1 || !sm.team2) return null;
                    return winner.teamKey === sm.team1.teamKey ? sm.team2 : sm.team1;
                  }).filter(Boolean)
                : [];

              const allDetermined = first && second && thirdPlaceTeams.length >= 2;

              return (
                <div className="card mt-6">
                  <h2 className="card-title">🏅 最終順位</h2>
                  {!allDetermined ? (
                    <p className="text-center text-gray-400 py-4">全試合が終了すると順位が表示されます</p>
                  ) : (
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
                          <tr className="bg-yellow-50 hover:bg-yellow-100">
                            <td className="border border-gray-300 px-4 py-3 text-center">
                              <span className="text-2xl">🥇</span>
                              <div className="text-xs font-bold text-yellow-700">1位</div>
                            </td>
                            <td className="border border-gray-300 px-4 py-3 font-bold text-lg text-yellow-800">{first.teamName}</td>
                            <td className="border border-gray-300 px-4 py-3 text-center text-gray-600">{first.affiliation}</td>
                            <td className="border border-gray-300 px-4 py-3 text-sm text-gray-600">{first.members?.map(m => m.name).join(', ')}</td>
                          </tr>
                          {/* 2位 */}
                          <tr className="bg-gray-50 hover:bg-gray-100">
                            <td className="border border-gray-300 px-4 py-3 text-center">
                              <span className="text-2xl">🥈</span>
                              <div className="text-xs font-bold text-gray-500">2位</div>
                            </td>
                            <td className="border border-gray-300 px-4 py-3 font-bold text-gray-700">{second.teamName}</td>
                            <td className="border border-gray-300 px-4 py-3 text-center text-gray-600">{second.affiliation}</td>
                            <td className="border border-gray-300 px-4 py-3 text-sm text-gray-600">{second.members?.map(m => m.name).join(', ')}</td>
                          </tr>
                          {/* 3位（2チーム） */}
                          {thirdPlaceTeams.map((team, idx) => (
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
                  )}
                </div>
              );
            })()}
            {showModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[80vh] overflow-y-auto w-full mx-4">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h2 className="text-xl font-bold">チーム選択（手動設定）</h2>
                      {currentMatch && parseInt(currentMatch.matchKey.split('-')[0]) > 1 && (
                        <p className="text-xs text-orange-600 mt-1">※ 全チームから手動で設定できます</p>
                      )}
                    </div>
                    <button
                      onClick={() => { setShowModal(false); setCurrentMatch(null); }}
                      className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                    >
                      ×
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {getAvailableTeams().map(team => {
                      // このチームが既にどの試合に入っているか調べる
                      const assignedMatches = [];
                      Object.entries(selectedTeams).forEach(([key, match]) => {
                        if (match.team1?.teamKey === team.teamKey) assignedMatches.push(`${key} チーム1`);
                        if (match.team2?.teamKey === team.teamKey) assignedMatches.push(`${key} チーム2`);
                      });
                      return (
                        <div
                          key={team.teamKey}
                          className="border border-gray-300 rounded-lg p-4 bg-white hover:shadow-md hover:border-blue-400 transition-all cursor-pointer"
                          onClick={() => currentMatch && handleTeamSelect(currentMatch.matchKey, currentMatch.position, team)}
                        >
                          <div className="font-semibold text-lg mb-1">{team.teamName}</div>
                          <div className="text-sm text-gray-600 mb-1">{team.affiliation}</div>
                          <div className="text-sm font-medium mb-1">{team.totalHits}本</div>
                          <div className="text-xs text-gray-500 mb-1">{team.members.map(m => m.name).join(', ')}</div>
                          {assignedMatches.length > 0 && (
                            <div className="text-xs text-orange-500">配置済: {assignedMatches.join(', ')}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {getAvailableTeams().length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      選択可能なチームがありません
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 的中入力モーダル */}
            {currentRound !== null && currentMatchNum !== null && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">的中入力</h2>
                    <button 
                      onClick={() => {
                        setCurrentRound(null);
                        setCurrentMatchNum(null);
                      }}
                      className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {(() => {
                      const matchKey = `${currentRound}-${currentMatchNum}`;
                      const selectedMatch = selectedTeams[matchKey] || {};
                      const scores = matchScores[matchKey] || {};
                      
                      if (!selectedMatch.team1 || !selectedMatch.team2) {
                        return <div className="text-center text-gray-500">両チームが選択されていません</div>;
                      }
                      
                      return (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* チーム1 */}
                          <div className="archer-record">
                            <div className="archer-info">
                              <p><strong>🏹 {selectedMatch.team1.teamName}</strong></p>
                              <p className="text-sm" style={{color:'#6b7280'}}>🏛️ {selectedMatch.team1.affiliation}</p>
                              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                                <p className="text-sm" style={{ color: '#10b981', fontWeight: 600, margin: 0 }}>
                                  ✅ 的中: {scores[selectedMatch.team1.teamKey]?.hits || 0}本
                                </p>
                                <p className="text-sm" style={{ color: '#2563eb', fontWeight: 600, margin: 0 }}>
                                  🏆 射数: {scores[selectedMatch.team1.teamKey]?.totalShots || 0}/12
                                </p>
                              </div>
                            </div>
                            <span className="status status-input">⏳ 入力中</span>
                            <div className="arrows-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                              {selectedMatch.team1.members.map((member, memberIdx) => {
                                const shots = getIndividualShots(currentRound, currentMatchNum, selectedMatch.team1, memberIdx);
                                const memberHits = shots.filter(s => s === 1).length;
                                
                                return (
                                  <div key={memberIdx} className="arrow-input">
                                    <p>{member.name}</p>
                                    <p className="text-xs text-gray-600">{memberHits}本/4射</p>
                                    {[0, 1, 2, 3].map(shotIdx => (
                                      <div key={shotIdx} className="arrow-input">
                                        <p>{shotIdx + 1}本目</p>
                                        {shots[shotIdx] === undefined ? (
                                          <div className="arrow-buttons">
                                            <button 
                                              onClick={() => handleHitInput(currentRound, currentMatchNum, selectedMatch.team1, memberIdx, 1)}
                                              className="btn-circle btn-hit"
                                            >
                                              ◯
                                            </button>
                                            <button 
                                              onClick={() => handleHitInput(currentRound, currentMatchNum, selectedMatch.team1, memberIdx, 0)}
                                              className="btn-circle btn-miss"
                                            >
                                              ×
                                            </button>
                                            <button 
                                              onClick={() => handleHitInput(currentRound, currentMatchNum, selectedMatch.team1, memberIdx, '?')}
                                              className="btn-circle btn-unknown"
                                            >
                                              ?
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="arrow-result">
                                            <button disabled className={`btn-circle ${shots[shotIdx] === 1 ? 'btn-hit' : shots[shotIdx] === 0 ? 'btn-miss' : 'btn-unknown'}`}>
                                              {shots[shotIdx] === 1 ? '◯' : shots[shotIdx] === 0 ? '×' : '?'}
                                            </button>
                                            <button 
                                              onClick={() => handleUndo(currentRound, currentMatchNum, selectedMatch.team1, memberIdx, shotIdx)} 
                                              className="btn-fix"
                                            >
                                              🔄 修正
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          
                          {/* チーム2 */}
                          <div className="archer-record">
                            <div className="archer-info">
                              <p><strong>🏹 {selectedMatch.team2.teamName}</strong></p>
                              <p className="text-sm" style={{color:'#6b7280'}}>🏛️ {selectedMatch.team2.affiliation}</p>
                              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                                <p className="text-sm" style={{ color: '#10b981', fontWeight: 600, margin: 0 }}>
                                  ✅ 的中: {scores[selectedMatch.team2.teamKey]?.hits || 0}本
                                </p>
                                <p className="text-sm" style={{ color: '#2563eb', fontWeight: 600, margin: 0 }}>
                                  🏆 射数: {scores[selectedMatch.team2.teamKey]?.totalShots || 0}/12
                                </p>
                              </div>
                            </div>
                            <span className="status status-input">⏳ 入力中</span>
                            <div className="arrows-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                              {selectedMatch.team2.members.map((member, memberIdx) => {
                                const shots = getIndividualShots(currentRound, currentMatchNum, selectedMatch.team2, memberIdx);
                                const memberHits = shots.filter(s => s === 1).length;
                                
                                return (
                                  <div key={memberIdx} className="arrow-input">
                                    <p>{member.name}</p>
                                    <p className="text-xs text-gray-600">{memberHits}本/4射</p>
                                    {[0, 1, 2, 3].map(shotIdx => (
                                      <div key={shotIdx} className="arrow-input">
                                        <p>{shotIdx + 1}本目</p>
                                        {shots[shotIdx] === undefined ? (
                                          <div className="arrow-buttons">
                                            <button 
                                              onClick={() => handleHitInput(currentRound, currentMatchNum, selectedMatch.team2, memberIdx, 1)}
                                              className="btn-circle btn-hit"
                                            >
                                              ◯
                                            </button>
                                            <button 
                                              onClick={() => handleHitInput(currentRound, currentMatchNum, selectedMatch.team2, memberIdx, 0)}
                                              className="btn-circle btn-miss"
                                            >
                                              ×
                                            </button>
                                            <button 
                                              onClick={() => handleHitInput(currentRound, currentMatchNum, selectedMatch.team2, memberIdx, '?')}
                                              className="btn-circle btn-unknown"
                                            >
                                              ?
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="arrow-result">
                                            <button disabled className={`btn-circle ${shots[shotIdx] === 1 ? 'btn-hit' : shots[shotIdx] === 0 ? 'btn-miss' : 'btn-unknown'}`}>
                                              {shots[shotIdx] === 1 ? '◯' : shots[shotIdx] === 0 ? '×' : '?'}
                                            </button>
                                            <button 
                                              onClick={() => handleUndo(currentRound, currentMatchNum, selectedMatch.team2, memberIdx, shotIdx)} 
                                              className="btn-fix"
                                            >
                                              🔄 修正
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    
                    {/* 勝者判定 */}
                    {(() => {
                      const matchKey = `${currentRound}-${currentMatchNum}`;
                      const selectedMatch = selectedTeams[matchKey] || {};
                      const scores = matchScores[matchKey] || {};
                      const isShootOffStarted = shootOffStarted[matchKey] || false;
                      
                      return (scores?.[selectedMatch.team1?.teamKey]?.totalShots >= 12 && scores?.[selectedMatch.team2?.teamKey]?.totalShots >= 12) && (
                      <div className="card" style={{ marginTop: '2rem', background: '#fef3c7', border: '2px solid #f59e0b' }}>
                        {(() => {
                          const winner = determineWinner(currentRound, currentMatchNum);
                          if (winner === 'shootoff' || isShootOffStarted) {
                            return (
                              <div>
                                <h3 className="card-title" style={{ color: '#d97706' }}>⚠️ 同中です！競射を行います。</h3>
                                <div className="space-y-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* チーム1 競射 */}
                                    <div className="archer-record">
                                      <div className="archer-info">
                                        <p><strong>🏹 {selectedMatch.team1.teamName} - 競射</strong></p>
                                        <p className="text-sm text-gray-600">
                                          ラウンド {shootOffRounds[matchKey] || 1} | 
                                          的中: {shootOffScores[matchKey]?.[selectedMatch.team1.teamKey]?.hits || 0}本
                                        </p>
                                      </div>
                                      <div className="arrows-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                                        {selectedMatch.team1.members.map((member, memberIdx) => {
                                          const shots = getShootOffIndividualShots(selectedMatch.team1, memberIdx);
                                          const memberHits = shots.reduce((sum, hit) => sum + hit, 0);
                                          
                                          return (
                                            <div key={memberIdx} className="arrow-input">
                                              <p>{member.name}</p>
                                              <p className="text-xs text-gray-600">{memberHits}本/1射</p>
                                              {[0].map(shotIdx => (
                                                <div key={shotIdx} className="arrow-input">
                                                  <p>{shotIdx + 1}本目</p>
                                                  {shots[shotIdx] === undefined ? (
                                                    <div className="arrow-buttons">
                                                      <button 
                                                        onClick={() => handleShootOffInput(selectedMatch.team1, memberIdx, 1)}
                                                        className="btn-circle btn-hit"
                                                      >
                                                        ◯
                                                      </button>
                                                      <button 
                                                        onClick={() => handleShootOffInput(selectedMatch.team1, memberIdx, 0)}
                                                        className="btn-circle btn-miss"
                                                      >
                                                        ×
                                                      </button>
                                                      <button 
                                                        onClick={() => handleShootOffInput(selectedMatch.team1, memberIdx, '?')}
                                                        className="btn-circle btn-unknown"
                                                      >
                                                        ?
                                                      </button>
                                                    </div>
                                                  ) : (
                                                    <div className="arrow-result">
                                                      <button disabled className={`btn-circle ${shots[shotIdx] === 1 ? 'btn-hit' : shots[shotIdx] === 0 ? 'btn-miss' : 'btn-unknown'}`}>
                                                        {shots[shotIdx] === 1 ? '◯' : shots[shotIdx] === 0 ? '×' : '?'}
                                                      </button>
                                                      <button 
                                                        onClick={() => handleShootOffUndo(selectedMatch.team1, memberIdx)} 
                                                        className="btn-fix"
                                                      >
                                                        🔄 修正
                                                      </button>
                                                    </div>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                    
                                    {/* チーム2 競射 */}
                                    <div className="archer-record">
                                      <div className="archer-info">
                                        <p><strong>🏹 {selectedMatch.team2.teamName} - 競射</strong></p>
                                        <p className="text-sm text-gray-600">
                                          ラウンド {shootOffRounds[matchKey] || 1} | 
                                          的中: {shootOffScores[matchKey]?.[selectedMatch.team2.teamKey]?.hits || 0}本
                                        </p>
                                      </div>
                                      <div className="arrows-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                                        {selectedMatch.team2.members.map((member, memberIdx) => {
                                          const shots = getShootOffIndividualShots(selectedMatch.team2, memberIdx);
                                          const memberHits = shots.reduce((sum, hit) => sum + hit, 0);
                                          
                                          return (
                                            <div key={memberIdx} className="arrow-input">
                                              <p>{member.name}</p>
                                              <p className="text-xs text-gray-600">{memberHits}本/1射</p>
                                              {[0].map(shotIdx => (
                                                <div key={shotIdx} className="arrow-input">
                                                  <p>{shotIdx + 1}本目</p>
                                                  {shots[shotIdx] === undefined ? (
                                                    <div className="arrow-buttons">
                                                      <button 
                                                        onClick={() => handleShootOffInput(selectedMatch.team2, memberIdx, 1)}
                                                        className="btn-circle btn-hit"
                                                      >
                                                        ◯
                                                      </button>
                                                      <button 
                                                        onClick={() => handleShootOffInput(selectedMatch.team2, memberIdx, 0)}
                                                        className="btn-circle btn-miss"
                                                      >
                                                        ×
                                                      </button>
                                                      <button 
                                                        onClick={() => handleShootOffInput(selectedMatch.team2, memberIdx, '?')}
                                                        className="btn-circle btn-unknown"
                                                      >
                                                        ?
                                                      </button>
                                                    </div>
                                                  ) : (
                                                    <div className="arrow-result">
                                                      <button disabled className={`btn-circle ${shots[shotIdx] === 1 ? 'btn-hit' : shots[shotIdx] === 0 ? 'btn-miss' : 'btn-unknown'}`}>
                                                        {shots[shotIdx] === 1 ? '◯' : shots[shotIdx] === 0 ? '×' : '?'}
                                                      </button>
                                                      <button 
                                                        onClick={() => handleShootOffUndo(selectedMatch.team2, memberIdx)} 
                                                        className="btn-fix"
                                                      >
                                                        🔄 修正
                                                      </button>
                                                    </div>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* 競射スコア表示 */}
                                  <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div className="text-center">
                                      <p className="text-sm font-semibold">{selectedMatch.team1.teamName}</p>
                                      <p className="text-lg font-bold text-blue-600">
                                        {shootOffScores[matchKey]?.[selectedMatch.team1.teamKey]?.hits || 0}本
                                      </p>
                                    </div>
                                    <div className="text-center">
                                      <p className="text-sm font-semibold">{selectedMatch.team2.teamName}</p>
                                      <p className="text-lg font-bold text-blue-600">
                                        {shootOffScores[matchKey]?.[selectedMatch.team2.teamKey]?.hits || 0}本
                                      </p>
                                    </div>
                                  </div>
                                  
                                  {/* 競射勝者判定 */}
                                  {(() => {
                                    const shootOffWinner = determineShootOffWinner(selectedMatch.team1.teamKey, selectedMatch.team2.teamKey);
                                    if (shootOffWinner === 'next-round') {
                                      return (
                                        <div className="text-center mt-4">
                                          <p className="text-orange-600 font-semibold">同中です！次のラウンドへ進みます。</p>
                                          <button 
                                            onClick={advanceShootOffRound}
                                            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                                          >
                                            次のラウンドへ
                                          </button>
                                        </div>
                                      );
                                    } else if (shootOffWinner && shootOffWinner !== 'next-round') {
                                      const winnerTeam = shootOffWinner === selectedMatch.team1.teamKey ? selectedMatch.team1 : selectedMatch.team2;
                                      const hasNextRound = currentRound < tournamentRounds.length;
                                      const { nextRound: nr, nextMatchNum: nm, position: np } = hasNextRound ? getNextRoundInfo(currentRound, currentMatchNum) : {};
                                      const alreadyAdv = hasNextRound && selectedTeams[`${nr}-${nm}`]?.[np]?.teamKey === winnerTeam.teamKey;
                                      return (
                                        <div className="p-4 bg-green-50 border border-green-300 rounded text-center">
                                          <p className="text-green-600 font-bold text-xl">🏆 勝者: {winnerTeam.teamName}</p>
                                          {hasNextRound && (
                                            alreadyAdv ? (
                                              <p className="text-xs text-green-600 mt-2">✅ 次の試合へ昇格済み</p>
                                            ) : (
                                              <button
                                                onClick={() => advanceWinnerToNextRound(currentRound, currentMatchNum)}
                                                className="mt-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 font-semibold"
                                              >
                                                ▶ 次の試合へ進める
                                              </button>
                                            )
                                          )}
                                        </div>
                                      );
                                    } else {
                                      return (
                                        <div className="text-center mt-4">
                                          <p className="text-blue-600">競射中...</p>
                                          <p className="text-sm text-gray-600">
                                            ラウンド {shootOffRounds[matchKey] || 1} | 
                                            {selectedMatch.team1.teamName}: {shootOffScores[matchKey]?.[selectedMatch.team1.teamKey]?.hits || 0}本 vs 
                                            {selectedMatch.team2.teamName}: {shootOffScores[matchKey]?.[selectedMatch.team2.teamKey]?.hits || 0}本
                                          </p>
                                        </div>
                                      );
                                    }
                                  })()}
                                </div>
                              </div>
                            );
                          } else if (winner) {
                            const winnerTeam = winner === selectedMatch.team1.teamKey ? selectedMatch.team1 : selectedMatch.team2;
                            const hasNextRound = currentRound < tournamentRounds.length;
                            const { nextRound: nr, nextMatchNum: nm, position: np } = hasNextRound ? getNextRoundInfo(currentRound, currentMatchNum) : {};
                            const alreadyAdv = hasNextRound && selectedTeams[`${nr}-${nm}`]?.[np]?.teamKey === winnerTeam.teamKey;
                            return (
                              <div className="text-center p-4 bg-green-50 border border-green-300 rounded">
                                <p className="text-green-600 font-bold text-xl">🏆 勝者: {winnerTeam.teamName}</p>
                                {hasNextRound && (
                                  alreadyAdv ? (
                                    <p className="text-xs text-green-600 mt-2">✅ 次の試合へ昇格済み</p>
                                  ) : (
                                    <button
                                      onClick={() => advanceWinnerToNextRound(currentRound, currentMatchNum)}
                                      className="mt-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 font-semibold"
                                    >
                                      ▶ 次の試合へ進める
                                    </button>
                                  )
                                )}
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    );
                    })()}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TeamTournamentView;