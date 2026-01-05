import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import session from 'express-session';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import path from 'path';

// 未処理の例外をキャッチ
process.on('uncaughtException', (error) => {
  console.error('未処理の例外:', error);
  process.exit(1);
});

// 未処理のPromise拒否をキャッチ
process.on('unhandledRejection', (reason, promise) => {
  console.error('未処理のPromise拒否:', reason);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// MongoDB接続設定
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ibukisaki0513_db_user:ibukisaki0513_db_user@kyudo.dntg64x.mongodb.net/kyudo-tournament?retryWrites=true&w=majority';
const DB_NAME = 'kyudo-tournament';

// MongoDB接続オプション
const mongoOptions = {
  serverApi: {
    version: '1',
    strict: true,
    deprecationErrors: true,
  },
  maxPoolSize: 10, // コネクションプールの最大サイズ
  connectTimeoutMS: 5000, // 接続タイムアウト (5秒)
  socketTimeoutMS: 45000, // ソケットタイムアウト (45秒)
  serverSelectionTimeoutMS: 5000, // サーバー選択タイムアウト (5秒)
};

// MongoDB接続クライアント
let client;
let db;
let isConnected = false;

// MongoDBに接続
async function connectToMongoDB() {
  if (isConnected) return;

  try {
    client = new MongoClient(MONGODB_URI, mongoOptions);
    await client.connect();
    await client.db('admin').command({ ping: 1 });
    
    db = client.db(DB_NAME);
    isConnected = true;
    
    console.log('✅ MongoDBに接続しました');
    
    // 接続エラー時のイベントハンドラ
    client.on('error', (error) => {
      console.error('❌ MongoDB接続エラー:', error);
      isConnected = false;
    });
    
    // 接続が切れた場合の再試行
    client.on('close', () => {
      console.log('ℹ️ MongoDB接続が切れました。再接続を試みます...');
      isConnected = false;
      setTimeout(connectToMongoDB, 5000); // 5秒後に再接続を試みる
    });
    
  } catch (error) {
    console.error('❌ MongoDB接続エラー:', error);
    isConnected = false;
    // 接続に失敗した場合、5秒後に再試行
    setTimeout(connectToMongoDB, 5000);
  }
}

// 接続を安全に取得するヘルパー関数
async function getDb() {
  if (!isConnected) {
    await connectToMongoDB();
  }
  return db;
}

// アプリケーション起動時にMongoDBに接続
connectToMongoDB();

// アプリケーション終了時に接続を閉じる
async function closeConnection() {
  try {
    if (client) {
      await client.close();
      isConnected = false;
      console.log('ℹ️ MongoDB接続を閉じました');
    }
  } catch (error) {
    console.error('MongoDB接続クローズエラー:', error);
  }
}

// シグナルハンドリング
['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
  process.on(signal, async () => {
    await closeConnection();
    process.exit(0);
  });
});

// 未処理のPromise拒否をキャッチ
process.on('unhandledRejection', (reason, promise) => {
  console.error('未処理のPromise拒否:', reason);
});

const app = express();
const PORT = process.env.PORT || 3001;
const SESSION_SECRET = process.env.SESSION_SECRET || 'your-secret-key';

// 許可するオリジンのリスト
const allowedOrigins = [
  'https://kyudotaikai.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001'
];

// CORS設定
app.use(cors({
  origin: function(origin, callback) {
    // オリジンチェックを緩和（開発環境の場合）
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      console.warn('ブロックされたオリジン:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200 // 一部の古いブラウザ対応
}));

// プリフライトリクエストの処理
app.options('*', (req, res) => {
  // 許可するオリジンを設定（実際のオリジンに合わせて調整）
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.status(200).end();
});

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

// ヘルスチェックエンドポイント
app.get('/api/health', async (req, res) => {
  try {
    await db.command({ ping: 1 });
    res.status(200).json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 全大会を取得
app.get('/api/tournaments', async (req, res) => {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error('データベースに接続されていません');
    }
    
    const tournaments = await db.collection('tournaments').find({}).toArray();
    res.status(200).json({ 
      success: true, 
      data: tournaments,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('大会データの取得エラー:', error);
    res.status(500).json({ 
      success: false, 
      message: '大会の取得中にエラーが発生しました',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

// 大会をIDで取得
app.get('/api/tournaments/:id', async (req, res) => {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error('データベースに接続されていません');
    }
    
    const tournament = await db.collection('tournaments').findOne({ _id: req.params.id });
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
      message: '大会の削除中にエラーが発生しました',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

// エラーハンドリングミドルウェア
app.use((err, req, res, next) => {
  console.error('サーバーエラー:', err);
  
  // 既にレスポンスが送信されている場合は何もしない
  if (res.headersSent) {
    return next(err);
  }
  
  // エラーレスポンスを送信
  res.status(500).json({ 
    success: false, 
    message: 'サーバーでエラーが発生しました',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    timestamp: new Date().toISOString(),
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
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
async function startServer() {
  try {
    // MongoDBに接続
    await connectToMongoDB();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server is running on http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('MongoDB connected:', isConnected);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();