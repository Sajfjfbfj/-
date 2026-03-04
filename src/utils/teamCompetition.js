// 団体戦用のユーティリティ関数

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
 * 保存された順序があればそれを使用、なければ新規生成
 */
export const generateTeamStandOrder = (teams, savedOrder = null) => {
  let orderedTeams;
  
  if (savedOrder && Array.isArray(savedOrder) && savedOrder.length > 0) {
    // 保存された順序を使用
    const teamMap = new Map(teams.map(t => [t.teamKey, t]));
    orderedTeams = savedOrder
      .map(teamKey => teamMap.get(teamKey))
      .filter(Boolean);
    
    // 保存された順序にないチームがあれば末尾に追加
    const savedKeys = new Set(savedOrder);
    const newTeams = teams.filter(t => !savedKeys.has(t.teamKey));
    orderedTeams = [...orderedTeams, ...newTeams];
  } else {
    // 新規にランダム配置
    orderedTeams = shuffleTeams(teams);
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
 * チーム順序をlocalStorageから取得
 */
export const fetchTeamOrder = async (tournamentId) => {
  try {
    const stored = localStorage.getItem(`teamOrder_${tournamentId}`);
    if (stored) {
      const data = JSON.parse(stored);
      console.log('✅ チーム順序取得:', tournamentId, data);
      return data;
    }
    console.log('⚠️ チーム順序なし:', tournamentId);
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * チーム順序をlocalStorageに保存
 */
export const saveTeamOrder = async (tournamentId, teamOrder) => {
  try {
    console.log('💾 チーム順序保存:', tournamentId, teamOrder);
    localStorage.setItem(`teamOrder_${tournamentId}`, JSON.stringify(teamOrder));
    console.log('✅ 保存成功');
    return true;
  } catch (error) {
    console.error('❌ 保存エラー:', error);
    return false;
  }
};
