import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import session from 'express-session';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import path from 'path';

// 未処理の例外をキャッチ（サーバー停止を防ぐ）
process.on('uncaughtException', (error) => {
  console.error('未処理の例外:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未処理のPromise拒否:', reason);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== 設定 =====
// 環境変数が設定されていない場合のフォールバック（本番では環境変数が優先されます）
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ibukisaki0513_db_user:ibukisaki0513_db_user@kyudo.dntg64x.mongodb.net/kyudo-tournament?retryWrites=true&w=majority';
const DB_NAME = 'kyudo-tournament';
const PORT = process.env.PORT || 3001;

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'kyudo-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// ===== MongoDB 接続管理 (Serverless対応) =====
let client = null;
let db = null;
let connectionPromise = null;

async function connectToMongoDB() {
  // すでに接続がある場合は再利用
  if (db) return db;

  // 接続中のPromiseがあればそれを待つ（二重接続防止）
  if (!connectionPromise) {
    console.log('🔄 MongoDB接続試行中...');
    client = new MongoClient(MONGODB_URI, {
      connectTimeoutMS: 10000, // 10秒でタイムアウト
      serverSelectionTimeoutMS: 10000,
    });

    connectionPromise = client.connect().then(() => {
      console.log('✅ MongoDBに正常に接続されました');
      db = client.db(DB_NAME);
      return db;
    }).catch(err => {
      connectionPromise = null;
      console.error('❌ MongoDB接続エラー:', err);
      throw err;
    });
  }
  return connectionPromise;
}

// ===== API Routes =====

// 1. 全大会データの取得
app.get('/api/tournaments', async (req, res, next) => {
  try {
    const database = await connectToMongoDB();
    const tournaments = await database.collection('tournaments').find({}).toArray();
    res.json({ success: true, data: tournaments });
  } catch (error) {
    next(error);
  }
});

// 2. 大会データの保存・更新
app.post('/api/tournaments', async (req, res, next) => {
  try {
    const database = await connectToMongoDB();
    const tournamentData = req.body;

    // IDがある場合は更新、ない場合は新規作成
    if (tournamentData._id) {
      const id = tournamentData._id;
      delete tournamentData._id;
      await database.collection('tournaments').updateOne(
        { _id: new ObjectId(id) },
        { $set: tournamentData },
        { upsert: true }
      );
    } else {
      await database.collection('tournaments').insertOne(tournamentData);
    }

    res.json({ success: true, message: '保存完了' });
  } catch (error) {
    next(error);
  }
});

// 3. 大会データの削除
app.delete('/api/tournaments/:id', async (req, res, next) => {
  try {
    const database = await connectToMongoDB();
    const result = await database.collection('tournaments').deleteOne({
      _id: new ObjectId(req.params.id)
    });
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    next(error);
  }
});

// ===== 静的ファイルの配信（Vercel以外での実行用） =====
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    }
  });
}

// ===== エラーハンドリング（JSONを返す） =====
app.use((err, req, res, next) => {
  console.error('🔥 サーバーエラー詳細:', err.stack);
  res.status(500).json({
    success: false,
    message: 'サーバー内でエラーが発生しました',
    error: err.message, // デバッグ用にメッセージを含める
    timestamp: new Date().toISOString()
  });
});

// サーバー起動
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Local Server running on http://localhost:${PORT}`);
  });
}

export default app; // Vercel用