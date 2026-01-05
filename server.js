import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;
const DATA_FILE = path.join(__dirname, 'tournaments.json');
const SESSION_SECRET = 'your-secret-key'; // 本番環境では環境変数から取得することを推奨

// グローバルデータストア
let globalState = {
  tournaments: [],
  sessions: {}
};

// CORSを有効化（すべてのオリジンからのアクセスを許可）
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // プリフライトリクエストの処理
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});
app.use(express.json());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // HTTPSの場合はtrueに変更
}));

// データ同期ミドルウェア
app.use((req, res, next) => {
  // セッションIDがなければ新規発行
  if (!req.session.id) {
    req.session.id = uuidv4();
  }
  
  // グローバルステートからセッション固有のデータをアタッチ
  if (!globalState.sessions[req.session.id]) {
    globalState.sessions[req.session.id] = {};
  }
  
  // データをリクエストオブジェクトにアタッチ
  req.appState = {
    ...globalState,
    sessionData: globalState.sessions[req.session.id]
  };
  
  next();
});

// データファイルの初期化
const initializeDataFile = () => {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ tournaments: [] }, null, 2));
  }
};

// データの読み込みと同期
const readTournaments = (forceFromFile = false) => {
  try {
    if (forceFromFile || globalState.tournaments.length === 0) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      globalState.tournaments = JSON.parse(data).tournaments || [];
    }
    return [...globalState.tournaments]; // コピーを返す
  } catch (error) {
    console.error('Error reading tournaments:', error);
    return [];
  }
};

// データの保存
const saveTournaments = (tournaments) => {
  try {
    // グローバルステートを更新
    globalState.tournaments = [...tournaments];
    // ファイルに保存
    fs.writeFileSync(DATA_FILE, JSON.stringify({ tournaments }, null, 2));
    
    return true;
  } catch (error) {
    console.error('Error saving tournaments:', error);
    return false;
  }
};

// 初期データ読み込み
readTournaments(true); // 起動時にファイルからデータを読み込む

// 初期化
initializeDataFile();

// ========== API エンドポイント ==========

// 1. 全大会を取得（セッション対応）
app.get('/api/tournaments', (req, res) => {
  const tournaments = readTournaments();
  
  // セッションに最後に取得したデータのタイムスタンプを保存
  if (req.appState.sessionData) {
    req.appState.sessionData.lastTournamentFetch = new Date().toISOString();
  }
  
  res.json({ 
    success: true, 
    data: tournaments,
    timestamp: new Date().toISOString()
  });
});

// 2. 大会を新規作成/更新（セッション対応）
app.post('/api/tournaments', (req, res) => {
  const { id, data } = req.body;

  if (!id || !data) {
    return res.status(400).json({ success: false, message: 'ID and data are required' });
  }

  let tournaments = readTournaments();
  const existingIndex = tournaments.findIndex(t => t.id === id);
  const now = new Date().toISOString();

  if (existingIndex >= 0) {
    // 更新
    tournaments[existingIndex] = { 
      ...tournaments[existingIndex],
      data: { ...tournaments[existingIndex].data, ...data },
      updatedAt: now 
    };
  } else {
    // 新規作成
    tournaments.push({ 
      id, 
      data: { 
        ...data,
        applicants: [],
        checkIns: []
      }, 
      createdAt: now,
      updatedAt: now
    });
  }

  const success = saveTournaments(tournaments);
  
  if (success) {
    res.json({ 
      success: true, 
      message: '大会の保存に成功しました',
      id,
      timestamp: now
    });
  } else {
    res.status(500).json({ 
      success: false, 
      message: '大会の保存中にエラーが発生しました' 
    });
  }
});

// 3. 大会を削除
app.delete('/api/tournaments/:id', (req, res) => {
  const { id } = req.params;

  let tournaments = readTournaments();
  tournaments = tournaments.filter(t => t.id !== id);

  saveTournaments(tournaments);
  res.json({ success: true, message: 'Tournament deleted successfully' });
});

// 4. 選手申し込みを取得（セッション対応）
app.get('/api/applicants/:tournamentId', (req, res) => {
  const { tournamentId } = req.params;
  const tournaments = readTournaments();
  const tournament = tournaments.find(t => t.id === tournamentId);

  if (!tournament) {
    return res.status(404).json({ success: false, message: '大会が見つかりません' });
  }

  // データの初期化
  if (!tournament.data.applicants) tournament.data.applicants = [];
  if (!tournament.data.checkIns) tournament.data.checkIns = [];

  // セッションに最後に取得したデータのタイムスタンプを保存
  if (req.appState.sessionData) {
    if (!req.appState.sessionData.lastFetch) {
      req.appState.sessionData.lastFetch = {};
    }
    req.appState.sessionData.lastFetch[`applicants_${tournamentId}`] = new Date().toISOString();
  }

  // チェックインステータスを追加
  const applicantsWithStatus = tournament.data.applicants.map(applicant => ({
    ...applicant,
    isCheckedIn: tournament.data.checkIns.includes(applicant.archerId)
  }));

  res.json({ 
    success: true, 
    data: applicantsWithStatus,
    tournamentName: tournament.data.name,
    timestamp: new Date().toISOString()
  });
});

// 5. 選手を申し込む（セッション対応）
app.post('/api/applicants', (req, res) => {
  const { tournamentId, archerId, applicantData } = req.body;
  const now = new Date().toISOString();

  console.log('Received applicant request:', { tournamentId, archerId, applicantData });

  if (!tournamentId || !archerId || !applicantData) {
    return res.status(400).json({ 
      success: false, 
      message: '必須項目が不足しています' 
    });
  }

  const tournaments = readTournaments();
  const tournamentIndex = tournaments.findIndex(t => t.id === tournamentId);

  if (tournamentIndex === -1) {
    return res.status(404).json({ 
      success: false, 
      message: '大会が見つかりません' 
    });
  }

  const tournament = tournaments[tournamentIndex];
  
  // データの初期化
  if (!tournament.data.applicants) tournament.data.applicants = [];
  
  // 既存の申し込みを確認
  const existingIndex = tournament.data.applicants.findIndex(
    a => a.archerId === archerId
  );

  const applicant = {
    archerId,
    ...applicantData,
    appliedAt: now,
    updatedAt: now
  };

  if (existingIndex >= 0) {
    // 既存の申し込みを更新
    tournament.data.applicants[existingIndex] = {
      ...tournament.data.applicants[existingIndex],
      ...applicant,
      updatedAt: now
    };
  } else {
    // 新規申し込みを追加
    tournament.data.applicants.push(applicant);
  }

  // グローバルステートを更新
  tournaments[tournamentIndex] = tournament;
  const success = saveTournaments(tournaments);

  if (success) {
    console.log('Applicant saved successfully:', applicant);
    res.json({ 
      success: true, 
      message: '申し込みが完了しました',
      archerId,
      data: applicant,
      timestamp: now
    });
  } else {
    console.error('Failed to save applicant');
    res.status(500).json({ 
      success: false, 
      message: '申し込みの処理中にエラーが発生しました' 
    });
  }
});

// 6. 選手を削除（セッション対応）
app.delete('/api/applicants/:tournamentId/:archerId', (req, res) => {
  const { tournamentId, archerId } = req.params;
  const now = new Date().toISOString();

  console.log('Received delete request:', { tournamentId, archerId });

  const tournaments = readTournaments();
  const tournamentIndex = tournaments.findIndex(t => t.id === tournamentId);

  if (tournamentIndex === -1) {
    return res.status(404).json({ 
      success: false, 
      message: '大会が見つかりません' 
    });
  }

  const tournament = tournaments[tournamentIndex];
  let modified = false;

  // 申し込みから削除
  if (tournament.data.applicants) {
    const initialCount = tournament.data.applicants.length;
    tournament.data.applicants = tournament.data.applicants.filter(
      a => a.archerId !== archerId
    );
    modified = modified || (initialCount !== tournament.data.applicants.length);
  }
  
  // チェックインからも削除
  if (tournament.data.checkIns) {
    const initialCount = tournament.data.checkIns.length;
    tournament.data.checkIns = tournament.data.checkIns.filter(
      id => id !== archerId
    );
    modified = modified || (initialCount !== tournament.data.checkIns.length);
  }

  if (modified) {
    // グローバルステートを更新
    tournaments[tournamentIndex] = {
      ...tournament,
      updatedAt: now
    };
    
    const success = saveTournaments(tournaments);
    
    if (success) {
      console.log('Applicant deleted successfully');
      return res.json({ 
        success: true, 
        message: '選手情報を削除しました',
        timestamp: now
      });
    } else {
      return res.status(500).json({ 
        success: false, 
        message: '削除処理中にエラーが発生しました' 
      });
    }
  } else {
    return res.status(404).json({ 
      success: false, 
      message: '削除対象の選手が見つかりませんでした' 
    });
  }
});

// 7. 受付処理（セッション対応）
app.post('/api/checkin', (req, res) => {
  const { tournamentId, archerId } = req.body;
  const now = new Date().toISOString();

  if (!tournamentId || !archerId) {
    return res.status(400).json({ 
      success: false, 
      message: '大会IDと選手IDは必須です' 
    });
  }

  const tournaments = readTournaments();
  const tournamentIndex = tournaments.findIndex(t => t.id === tournamentId);

  if (tournamentIndex === -1) {
    return res.status(404).json({ 
      success: false, 
      message: '大会が見つかりません' 
    });
  }

  const tournament = tournaments[tournamentIndex];
  
  // 申し込み者を検索
  const applicant = tournament.data.applicants?.find(
    a => a.archerId === archerId
  );
  
  if (!applicant) {
    return res.status(404).json({ 
      success: false, 
      message: '申し込みが見つかりません' 
    });
  }

  // チェックイン配列を初期化
  if (!tournament.data.checkIns) {
    tournament.data.checkIns = [];
  }

  // 既にチェックイン済みか確認
  const isAlreadyCheckedIn = tournament.data.checkIns.includes(archerId);
  
  if (isAlreadyCheckedIn) {
    return res.json({ 
      success: true, 
      message: '既に受付済みです',
      data: { 
        ...applicant, 
        isCheckedIn: true,
        checkedInAt: tournament.data.checkedInAt?.[archerId] || now
      },
      timestamp: now
    });
  }

  // チェックインを記録
  tournament.data.checkIns.push(archerId);
  
  // チェックイン日時を記録
  if (!tournament.data.checkedInAt) {
    tournament.data.checkedInAt = {};
  }
  tournament.data.checkedInAt[archerId] = now;
  
  // グローバルステートを更新
  tournaments[tournamentIndex] = {
    ...tournament,
    updatedAt: now
  };
  
  const success = saveTournaments(tournaments);

  if (success) {
    res.json({ 
      success: true, 
      message: '受付が完了しました',
      data: { 
        ...applicant, 
        isCheckedIn: true,
        checkedInAt: now
      },
      timestamp: now
    });
  } else {
    res.status(500).json({ 
      success: false, 
      message: '受付処理中にエラーが発生しました' 
    });
  }
});

// 8. セッション状態を取得
app.get('/api/session', (req, res) => {
  res.json({
    success: true,
    sessionId: req.session.id,
    lastActivity: req.session.lastActivity,
    data: req.appState.sessionData || {}
  });
});

// 9. 最終同期状態を更新
app.post('/api/sync', (req, res) => {
  const { timestamp, tournamentId } = req.body;
  
  if (!req.appState.sessionData.lastSync) {
    req.appState.sessionData.lastSync = {};
  }
  
  if (tournamentId) {
    req.appState.sessionData.lastSync[tournamentId] = timestamp || new Date().toISOString();
  }
  
  res.json({
    success: true,
    timestamp: new Date().toISOString()
  });
});

// エラーハンドリングミドルウェアを追加
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    success: false, 
    message: 'サーバーでエラーが発生しました',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 存在しないルートのハンドリング
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: '指定されたリソースが見つかりません' 
  });
});

// ========== サーバー起動 ==========

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Data file: ${DATA_FILE}`);
});