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
  maxPoolSize: 10,
  connectTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 5000,
};

// MongoDB接続クライアント
let client = null;
let db = null;
let isConnected = false;
let connectionPromise = null;

// MongoDBに接続（重複接続を防止）
async function connectToMongoDB() {
  // 既に接続中 or 接続済みの場合はそれを返す
  if (connectionPromise) {
    return connectionPromise;
  }

  if (isConnected && db) {
    return db;
  }

  connectionPromise = (async () => {
    try {
      console.log('🔄 MongoDBに接続中...');
      client = new MongoClient(MONGODB_URI, mongoOptions);
      await client.connect();
      await client.db('admin').command({ ping: 1 });
      
      db = client.db(DB_NAME);
      isConnected = true;
      connectionPromise = null;
      
      console.log('✅ MongoDBに接続しました');
      
      // 接続エラー時のイベントハンドラ
      client.on('error', (error) => {
        console.error('❌ MongoDB接続エラー:', error);
        isConnected = false;
      });
      
      // 接続が切れた場合の再試行
      client.on('close', () => {
        console.log('ℹ️ MongoDB接続が切れました');
        isConnected = false;
        connectionPromise = null;
      });
      
      return db;
    } catch (error) {
      console.error('❌ MongoDB接続エラー:', error);
      isConnected = false;
      connectionPromise = null;
      throw error;
    }
  })();

  return connectionPromise;
}

// 接続を安全に取得するヘルパー関数
async function getDb() {
  if (!isConnected || !db) {
    db = await connectToMongoDB();
  }
  return db;
}

// アプリケーション起動時にMongoDBに接続（非ブロッキング）
connectToMongoDB().catch(err => {
  console.error('初期接続に失敗しました:', err);
});

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
    console.log(`${signal}を受信しました`);
    await closeConnection();
    process.exit(0);
  });
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
  optionsSuccessStatus: 200
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// セッションミドルウェア
app.use((req, res, next) => {
  if (!req.session.id) {
    req.session.id = uuidv4();
  }
  next();
});

// ===== ヘルスチェックエンドポイント =====
app.get('/api/health', async (req, res) => {
  try {
    const database = await getDb();
    await database.command({ ping: 1 });
    res.status(200).json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('ヘルスチェックエラー:', error);
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ===== 全大会を取得 =====
app.get('/api/tournaments', async (req, res) => {
  try {
    const database = await getDb();
    const tournaments = await database.collection('tournaments').find({}).toArray();
    
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

// ===== 大会をIDで取得 =====
app.get('/api/tournaments/:id', async (req, res) => {
  try {
    const database = await getDb();
    const tournament = await database.collection('tournaments').findOne({ _id: req.params.id });
    
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
    console.error('大会データ取得エラー:', error);
    res.status(500).json({ 
      success: false, 
      message: '大会の取得中にエラーが発生しました',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ===== 大会を保存または更新 =====
app.post('/api/tournaments', async (req, res) => {
  try {
    const { id, data } = req.body;
    
    if (!id || !data) {
      return res.status(400).json({ 
        success: false, 
        message: 'IDとデータは必須です' 
      });
    }

    const database = await getDb();
    
    const tournament = {
      _id: id,
      ...data,
      updatedAt: new Date().toISOString()
    };

    const result = await database.collection('tournaments').updateOne(
      { _id: id },
      { $set: tournament },
      { upsert: true }
    );
    
    if (result.acknowledged) {
      res.status(200).json({ 
        success: true, 
        message: '大会を保存しました',
        id,
        timestamp: new Date().toISOString()
      });
    } else {
      throw new Error('データベース更新に失敗しました');
    }
  } catch (error) {
    console.error('大会保存エラー:', error);
    res.status(500).json({ 
      success: false, 
      message: '大会の保存中にエラーが発生しました',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

// ===== 大会を削除 =====
app.delete('/api/tournaments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const database = await getDb();
    
    const result = await database.collection('tournaments').deleteOne({ _id: id });
    
    if (result.deletedCount > 0) {
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
    console.error('大会削除エラー:', error);
    res.status(500).json({ 
      success: false, 
      message: '大会の削除中にエラーが発生しました',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

// ===== 静的ファイルの提供とSPA用ルーティング（APIルートの後に配置） =====
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  
  // すべのAPE以外のリクエストをindex.htmlにマップ（SPA用）
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

// ===== エラーハンドリング =====
app.use((err, req, res, next) => {
  console.error('サーバーエラー:', err);
  
  if (res.headersSent) {
    return next(err);
  }
  
  // 常にJSONレスポンスを返す
  res.status(err.status || 500).json({ 
    success: false, 
    message: 'サーバーでエラーが発生しました',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    timestamp: new Date().toISOString(),
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 存在しないルートのハンドリング（最後に配置）
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: '指定されたリソースが見つかりません' 
  });
});

// ===== サーバー起動 =====
async function startServer() {
  try {
    app.listen(PORT, '0.0.0.0', async () => {
      console.log(`✅ Server is running on http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      
      // サーバー起動後に接続を確認
      try {
        await getDb();
        console.log('✅ データベース接続確認完了');
      } catch (err) {
        console.warn('⚠️ データベース接続に失敗しました。後で再試行します:', err.message);
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();