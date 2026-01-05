import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import session from 'express-session';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// MongoDB接続設定
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ibukisaki0513_db_user:<password>@kyodo.dntg64x.mongodb.net/kyudo-tournament?retryWrites=true&w=majority';
const DB_NAME = 'kyudo-tournament';

// MongoDB接続クライアント
let client;
let db;

// MongoDBに接続
async function connectToMongoDB() {
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DB_NAME);
    console.log('MongoDBに接続しました');
  } catch (error) {
    console.error('MongoDB接続エラー:', error);
    process.exit(1);
  }
}

// アプリケーション起動時にMongoDBに接続
connectToMongoDB();

// アプリケーション終了時に接続を閉じる
process.on('SIGINT', async () => {
  if (client) {
    await client.close();
    console.log('MongoDB接続を閉じました');
  }
  process.exit(0);
});

const app = express();
const PORT = process.env.PORT || 3001;
const SESSION_SECRET = process.env.SESSION_SECRET || 'your-secret-key';

// ミドルウェアの設定
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // HTTPSの場合はtrueに変更
}));

// 静的ファイルの提供
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  
  // SPA用のルーティング
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

// セッションミドルウェア
app.use((req, res, next) => {
  if (!req.session.id) {
    req.session.id = uuidv4();
  }
  next();
});

// ===== データベース操作ユーティリティ =====

// 大会データを取得
async function getTournaments() {
  try {
    return await db.collection('tournaments').find({}).toArray();
  } catch (error) {
    console.error('大会データの取得中にエラーが発生しました:', error);
    return [];
  }
}

// 大会をIDで取得
async function getTournamentById(id) {
  try {
    return await db.collection('tournaments').findOne({ _id: id });
  } catch (error) {
    console.error('大会データの取得中にエラーが発生しました:', error);
    return null;
  }
}

// 大会を保存または更新
async function saveTournament(tournament) {
  try {
    const { _id, ...data } = tournament;
    const result = await db.collection('tournaments').updateOne(
      { _id: _id || new ObjectId() },
      { $set: data },
      { upsert: true }
    );
    return result.acknowledged;
  } catch (error) {
    console.error('大会の保存中にエラーが発生しました:', error);
    return false;
  }
}

// 大会を削除
async function deleteTournament(id) {
  try {
    const result = await db.collection('tournaments').deleteOne({ _id: id });
    return result.deletedCount > 0;
  } catch (error) {
    console.error('大会の削除中にエラーが発生しました:', error);
    return false;
  }
}

// ===== API エンドポイント =====

// 全大会を取得
app.get('/api/tournaments', async (req, res) => {
  try {
    const tournaments = await getTournaments();
    res.json({ 
      success: true, 
      data: tournaments,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: '大会の取得中にエラーが発生しました' 
    });
  }
});

// 大会をIDで取得
app.get('/api/tournaments/:id', async (req, res) => {
  try {
    const tournament = await getTournamentById(req.params.id);
    if (tournament) {
      res.json({ 
        success: true, 
        data: tournament,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({ 
        success: false, 
        message: '大会が見つかりません' 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: '大会の取得中にエラーが発生しました' 
    });
  }
});

// 大会を保存または更新
app.post('/api/tournaments', async (req, res) => {
  try {
    const { id, data } = req.body;
    
    if (!id || !data) {
      return res.status(400).json({ 
        success: false, 
        message: 'IDとデータは必須です' 
      });
    }

    const tournament = {
      _id: id,
      ...data,
      updatedAt: new Date().toISOString()
    };

    const success = await saveTournament(tournament);
    
    if (success) {
      res.json({ 
        success: true, 
        message: '大会を保存しました',
        id,
        timestamp: new Date().toISOString()
      });
    } else {
      throw new Error('保存に失敗しました');
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: '大会の保存中にエラーが発生しました' 
    });
  }
});

// 大会を削除
app.delete('/api/tournaments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await deleteTournament(id);
    
    if (success) {
      res.json({ 
        success: true, 
        message: '大会を削除しました',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({ 
        success: false, 
        message: '大会が見つかりませんでした' 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: '大会の削除中にエラーが発生しました' 
    });
  }
});

// エラーハンドリングミドルウェア
app.use((err, req, res, next) => {
  console.error('サーバーエラー:', err);
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

// サーバー起動
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});