import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';

const app = express();

app.use(cors());
app.use(express.json());

// MongoDB設定
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'kyudo-tournament';

// デバッグ出力
console.log('\n==========================================');
console.log('🎯 弓道大会運営システム サーバー起動');
console.log('==========================================');
console.log('Node version:', process.version);
console.log('Current directory:', process.cwd());
console.log('Environment:');
console.log('  - NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('  - PORT:', process.env.PORT || 3001);
console.log('  - MONGODB_URI exists:', !!MONGODB_URI);

if (MONGODB_URI) {
  const maskedUri = MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
  console.log('  - MONGODB_URI (masked):', maskedUri);
} else {
  console.log('  ❌ MONGODB_URI が設定されていません！');
  console.log('  .envファイルを確認してください');
}
console.log('==========================================\n');

let cachedClient = null;
let cachedDb = null;

// MongoDB接続関数
async function connectToDatabase() {
  if (cachedDb) {
    console.log('✅ Using cached MongoDB connection');
    return cachedDb;
  }

  if (!MONGODB_URI) {
    throw new Error('❌ 環境変数 MONGODB_URI が設定されていません');
  }

  try {
    console.log('🔄 Connecting to MongoDB...');
    console.log('   Target cluster: kyudo.dntg64x.mongodb.net');
    console.log('   Database:', DB_NAME);
    
    const client = await MongoClient.connect(MONGODB_URI, {
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
      minPoolSize: 2,
    });

    const db = client.db(DB_NAME);
    
    // 接続テスト
    await db.admin().ping();
    console.log('✅ MongoDB connected successfully\n');

    cachedClient = client;
    cachedDb = db;
    return db;
  } catch (error) {
    console.error('\n❌ MongoDB connection failed!');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    if (error.message.includes('authentication failed') || error.message.includes('bad auth')) {
      console.error('\n🔍 認証エラーの解決方法:');
      console.error('1. MongoDB Atlasにログイン');
      console.error('2. Database Access で以下を確認:');
      console.error('   - ユーザー名: ibukisaki0513_db_user');
      console.error('   - パスワード: Chipdale0402');
      console.error('   - 権限: Atlas admin または Read and write to any database');
      console.error('3. Network Access で 0.0.0.0/0 が許可されているか確認');
      console.error('4. .envファイルのMONGODB_URIが正しいか確認\n');
    }
    
    throw error;
  }
}

// --- API エンドポイント ---

// ヘルスチェック
app.get('/api/health', async (req, res) => {
  try {
    const db = await connectToDatabase();
    await db.admin().ping();
    res.status(200).json({ 
      success: true, 
      message: 'Server is healthy',
      database: 'Connected',
      dbName: DB_NAME,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Database connection failed',
      error: error.message 
    });
  }
});

// 1. 大会一覧取得
app.get('/api/tournaments', async (req, res) => {
  try {
    console.log('📋 GET /api/tournaments');
    const db = await connectToDatabase();
    const tournaments = await db.collection('tournaments').find({}).toArray();
    console.log(`✅ Found ${tournaments.length} tournaments`);
    res.status(200).json({ success: true, data: tournaments });
  } catch (error) {
    console.error('❌ GET /api/tournaments error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. 大会保存
app.post('/api/tournaments', async (req, res) => {
  try {
    console.log('💾 POST /api/tournaments');
    const db = await connectToDatabase();
    const data = req.body;
    
    if (!data.id || !data.data) {
      console.log('❌ Invalid request data');
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid request: id and data are required' 
      });
    }

    const result = await db.collection('tournaments').updateOne(
      { id: data.id },
      { $set: data },
      { upsert: true }
    );

    console.log(`✅ Tournament saved: ${data.id} (upserted: ${result.upsertedCount > 0})`);
    res.status(200).json({ 
      success: true, 
      message: '保存成功',
      upserted: result.upsertedCount > 0
    });
  } catch (error) {
    console.error('❌ POST /api/tournaments error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. 大会削除
app.delete('/api/tournaments/:id', async (req, res) => {
  try {
    console.log('🗑️  DELETE /api/tournaments/:id');
    const db = await connectToDatabase();
    
    const result = await db.collection('tournaments').deleteOne({ 
      id: req.params.id 
    });

    if (result.deletedCount === 0) {
      console.log('❌ Tournament not found');
      return res.status(404).json({ 
        success: false, 
        message: 'Tournament not found' 
      });
    }

    console.log(`✅ Tournament deleted: ${req.params.id}`);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ DELETE /api/tournaments/:id error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. 申込者一覧取得
app.get('/api/applicants/:tournamentId', async (req, res) => {
  try {
    console.log(`📋 GET /api/applicants/${req.params.tournamentId}`);
    const db = await connectToDatabase();
    const applicants = await db.collection('applicants')
      .find({ tournamentId: req.params.tournamentId })
      .toArray();
    console.log(`✅ Found ${applicants.length} applicants`);
    res.status(200).json({ success: true, data: applicants });
  } catch (error) {
    console.error('❌ GET /api/applicants/:tournamentId error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. 申込者登録
app.post('/api/applicants', async (req, res) => {
  try {
    console.log('👤 POST /api/applicants');
    const db = await connectToDatabase();
    const { tournamentId, archerId, applicantData } = req.body;

    if (!tournamentId || !archerId || !applicantData) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid request data' 
      });
    }

    const result = await db.collection('applicants').updateOne(
      { tournamentId, archerId },
      { $set: { ...applicantData, tournamentId, archerId, updatedAt: new Date() } },
      { upsert: true }
    );

    console.log(`✅ Applicant saved: ${archerId}`);
    res.status(200).json({ 
      success: true, 
      data: { ...applicantData, archerId }
    });
  } catch (error) {
    console.error('❌ POST /api/applicants error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6. 申込者更新
app.put('/api/applicants/:tournamentId/:archerId', async (req, res) => {
  try {
    console.log(`✏️  PUT /api/applicants/${req.params.tournamentId}/${req.params.archerId}`);
    const db = await connectToDatabase();
    const { tournamentId, archerId } = req.params;
    const { applicantData } = req.body;

    const result = await db.collection('applicants').updateOne(
      { tournamentId, archerId },
      { $set: { ...applicantData, updatedAt: new Date() } }
    );

    console.log(`✅ Applicant updated: ${archerId}`);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ PUT /api/applicants error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 7. 申込者削除
app.delete('/api/applicants/:tournamentId/:archerId', async (req, res) => {
  try {
    console.log(`🗑️  DELETE /api/applicants/${req.params.tournamentId}/${req.params.archerId}`);
    const db = await connectToDatabase();
    
    const result = await db.collection('applicants').deleteOne({
      tournamentId: req.params.tournamentId,
      archerId: req.params.archerId
    });

    console.log(`✅ Applicant deleted: ${req.params.archerId}`);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ DELETE /api/applicants error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 8. チェックイン
app.post('/api/checkin', async (req, res) => {
  try {
    console.log('✅ POST /api/checkin');
    const db = await connectToDatabase();
    const { tournamentId, archerId } = req.body;

    if (!tournamentId || !archerId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid request data' 
      });
    }

    const result = await db.collection('applicants').findOneAndUpdate(
      { tournamentId, archerId },
      { $set: { isCheckedIn: true, checkedInAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      console.log('❌ Applicant not found');
      return res.status(404).json({ 
        success: false, 
        message: '該当する選手が見つかりません' 
      });
    }

    console.log(`✅ Check-in completed: ${archerId}`);
    res.status(200).json({ 
      success: true, 
      data: result.value 
    });
  } catch (error) {
    console.error('❌ POST /api/checkin error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// エラーハンドラー
app.use((err, req, res, next) => {
  console.error('💥 Unhandled error:', err);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error',
    error: err.message 
  });
});

// 404ハンドラー
app.use((req, res) => {
  console.log(`⚠️  404 Not Found: ${req.method} ${req.path}`);
  res.status(404).json({ 
    success: false, 
    message: 'Endpoint not found' 
  });
});

// サーバー起動（MongoDB接続とは独立して起動）
const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log('\n==========================================');
  console.log('🚀 サーバー起動完了！');
  console.log('==========================================');
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`📊 ヘルスチェック: http://localhost:${PORT}/api/health`);
  console.log('==========================================\n');
  console.log('利用可能なエンドポイント:');
  console.log('  GET    /api/health');
  console.log('  GET    /api/tournaments');
  console.log('  POST   /api/tournaments');
  console.log('  DELETE /api/tournaments/:id');
  console.log('  GET    /api/applicants/:tournamentId');
  console.log('  POST   /api/applicants');
  console.log('  PUT    /api/applicants/:tournamentId/:archerId');
  console.log('  DELETE /api/applicants/:tournamentId/:archerId');
  console.log('  POST   /api/checkin');
  console.log('\n準備完了！アプリを使用できます。\n');
  
  // サーバー起動後にMongoDB接続をテスト（失敗してもサーバーは継続）
  connectToDatabase()
    .then(() => {
      console.log('✅ MongoDB初期接続テスト成功\n');
    })
    .catch((error) => {
      console.error('⚠️  MongoDB初期接続テスト失敗（リクエスト時に再試行します）');
      console.error('   エラー:', error.message, '\n');
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    if (cachedClient) {
      cachedClient.close();
    }
  });
});

export default app;