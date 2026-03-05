// 団体戦用のユーティリティ関数
import { API_URL } from './api';

/**
 * チームごとにグループ化（重複除外）
 */
export const groupByTeam = (archers) => {
  if (!archers || !Array.isArray(archers)) return [];
  
  const teams = {};
  const seenArcherIds = new Set();
  
  archers.forEach(archer => {
    // 重複チェック：同じarcherIdは1回だけ処理
    if (seenArcherIds.has(archer.archerId)) {
      console.warn(`⚠️ 重複選手を検出してスキップ: ${archer.name} (${archer.archerId})`);
      return;
    }
    seenArcherIds.add(archer.archerId);
    
    if (archer.isTeamMember && archer.teamName) {
      const key = `${archer.affiliation}_${archer.teamName}`;
      if (!teams[key]) {
        teams[key] = {
          teamKey: key,
          affiliation: archer.affiliation,
          teamName: archer.teamName,
          members: []
        };
      }
      teams[key].members.push(archer);
    }
  });
  
  // メンバーを登録順にソート
  Object.values(teams).forEach(team => {
    team.members.sort((a, b) => new Date(a.appliedAt) - new Date(b.appliedAt));
  });
  
  return Object.values(teams);
};

/**
 * チームの的中数を計算
 */
export const calculateTeamHitCount = (members, tournament) => {
  if (!members || !Array.isArray(members)) return 0;
  
  const arrows1 = tournament?.arrowsRound1 || 4;
  const arrows2 = tournament?.arrowsRound2 || 4;
  const total = arrows1 + arrows2;
  
  let teamTotal = 0;
  members.forEach(member => {
    const results = member.results || {};
    for (let s = 1; s <= 6; s++) {
      const arr = results[`stand${s}`] || [];
      for (let i = 0; i < Math.min(total, arr.length); i++) {
        if (arr[i] === 'o') teamTotal++;
      }
    }
  });
  
  return teamTotal;
};

/**
 * チームをランダムに配置（シャッフル）
 */
export const shuffleTeams = (teams) => {
  const shuffled = [...teams];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * チームの立ち順を生成（ランダム配置）
 * 保存された順序があり、チーム数が同じであればそれを使用、なければ新規生成
 */
export const generateTeamStandOrder = (teams, savedOrderData = null) => {
  let orderedTeams;
  
  // savedOrderDataがオブジェクト形式か配列形式かを判定
  let savedOrder = null;
  let savedTeamCount = 0;
  
  if (savedOrderData) {
    if (Array.isArray(savedOrderData)) {
      // 古い形式（配列のみ）
      savedOrder = savedOrderData;
      savedTeamCount = savedOrderData.length;
    } else if (savedOrderData.order && Array.isArray(savedOrderData.order)) {
      // 新しい形式（オブジェクト）
      savedOrder = savedOrderData.order;
      savedTeamCount = savedOrderData.teamCount || savedOrderData.order.length;
    }
  }
  
  // チーム数が変わった場合は新規生成
  if (savedOrder && savedTeamCount === teams.length) {
    // 保存された順序を使用
    const teamMap = new Map(teams.map(t => [t.teamKey, t]));
    orderedTeams = savedOrder
      .map(teamKey => teamMap.get(teamKey))
      .filter(Boolean);
    
    // 保存された順序にないチームがあれば末尾に追加
    const savedKeys = new Set(savedOrder);
    const newTeams = teams.filter(t => !savedKeys.has(t.teamKey));
    orderedTeams = [...orderedTeams, ...newTeams];
    
    console.log('✅ 保存されたチーム順序を使用 (チーム数: ' + teams.length + ')');
  } else {
    // 新規にランダム配置
    orderedTeams = shuffleTeams(teams);
    console.log('🎲 新規ランダム配置 (チーム数: ' + teams.length + ', 保存済み: ' + savedTeamCount + ')');
  }
  
  let order = 1;
  orderedTeams.forEach(team => {
    team.members.forEach(member => {
      member.standOrder = order++;
    });
  });
  
  return orderedTeams;
};

/**
 * チーム順序をサーバーから取得
 */
export const fetchTeamOrder = async (tournamentId) => {
  try {
    const response = await fetch(`${getApiUrl()}/team-order/${tournamentId}`);
    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data) {
        console.log('✅ チーム順序取得:', tournamentId, result.data);
        return result.data;
      }
    }
    console.log('⚠️ チーム順序なし:', tournamentId);
    return null;
  } catch (error) {
    console.error('❌ チーム順序取得エラー:', error);
    return null;
  }
};

/**
 * チーム順序をサーバーに保存（チーム数も保存）
 */
export const saveTeamOrder = async (tournamentId, teamOrder) => {
  try {
    console.log('💾 チーム順序保存:', tournamentId, teamOrder);
    const data = {
      order: teamOrder,
      teamCount: teamOrder.length,
      savedAt: new Date().toISOString()
    };
    const response = await fetch(`${getApiUrl()}/team-order/${tournamentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (response.ok) {
      console.log('✅ 保存成功');
      return true;
    }
    console.error('❌ 保存失敗');
    return false;
  } catch (error) {
    console.error('❌ 保存エラー:', error);
    return false;
  }
};

const getApiUrl = () => {
  return API_URL;
};
