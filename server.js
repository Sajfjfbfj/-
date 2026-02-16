import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import dns from 'node:dns/promises';


// Set custom DNS servers to fix MongoDB Atlas connection issues on Windows
(async () => {
  try {
    await dns.setServers(['1.1.1.1', '8.8.8.8']);
    console.log('✅ DNS servers configured successfully');
  } catch (error) {
    console.warn('⚠️ Failed to configure DNS servers:', error.message);
  }
})();

const app = express();

// CORS設定 - 開発環境と本番環境の両方をサポート
const corsOptions = {
  origin: function (origin, callback) {
    // 許可するオリジンのリスト
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000',
      'https://alluring-perfection-production-f96d.up.railway.app'
    ];
    
    // originがundefinedの場合(同一オリジンやサーバー間通信)も許可
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true); // 開発時は全て許可
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  optionsSuccessStatus: 200,
  preflightContinue: false
};

// CORSミドルウェアを適用
app.use(cors(corsOptions));

// 追加のCORSヘッダーを明示的に設定
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // プリフライトリクエストへの即座の応答
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// JSONパース
app.use(express.json());

// 静的ファイルの配信
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use(express.static(join(__dirname, 'dist')));

// MongoDB設定
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://Ibuki:Chipdale0402@cluster0.cpkknx9.mongodb.net/kyudo-tournament?retryWrites=true&w=majority';
const DB_NAME = 'kyudo-tournament';

// デバッグ出力
console.log('\n==========================================');
console.log('🎯 弓道大会運営システム サーバー起動');
console.log('==========================================');
console.log('Node version:', process.version);
console.log('Environment:');
console.log('  - PORT:', process.env.PORT || 3001);
console.log('  - MONGODB_URI exists:', !!MONGODB_URI);

if (MONGODB_URI) {
  const maskedUri = MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
  console.log('  - MONGODB_URI (masked):', maskedUri);
} else {
  console.log('  ❌ MONGODB_URI が設定されていません!');
  console.log('  .envファイルを確認してください');
}
console.log('==========================================\n');

let cachedClient = null;
let cachedDb = null;

// MongoDB接続関数
async function connectToDatabase() {
  if (cachedDb) {
    return cachedDb;
  }

  if (!MONGODB_URI) {
    throw new Error('❌ 環境変数 MONGODB_URI が設定されていません');
  }

  try {
    const client = await MongoClient.connect(MONGODB_URI, {
      connectTimeoutMS: 30000,
      serverSelectionTimeoutMS: 30000,
      maxPoolSize: 10,
      minPoolSize: 2,
      // SSL設定を追加（Railway環境で必要）
      tls: true,
      tlsAllowInvalidCertificates: true,
      tlsAllowInvalidHostnames: true
    });

    const db = client.db(DB_NAME);
    await db.admin().ping();
    console.log('✅ MongoDB connected successfully');

    cachedClient = client;
    cachedDb = db;
    return db;
  } catch (error) {
    console.error('\n❌ MongoDB connection failed!');
    throw error;
  }
}

// --- API エンドポイント ---

// ヘルスチェック - シンプル版
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    success: true, 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// 1. 大会一覧取得
app.get('/api/tournaments', async (req, res) => {
  try {
    const db = await connectToDatabase();
    const tournaments = await db.collection('tournaments').find({}).toArray();
    res.status(200).json({ success: true, data: tournaments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. 大会保存
app.post('/api/tournaments', async (req, res) => {
  try {
    const db = await connectToDatabase();
    const data = req.body;
    
    if (!data.id || !data.data) {
      return res.status(400).json({ success: false, message: 'Invalid request' });
    }

    const result = await db.collection('tournaments').updateOne(
      { id: data.id },
      { $set: data },
      { upsert: true }
    );
    res.status(200).json({ success: true, message: '保存成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. 大会削除
app.delete('/api/tournaments/:id', async (req, res) => {
  try {
    const db = await connectToDatabase();
    const result = await db.collection('tournaments').deleteOne({ id: req.params.id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. 申込者一覧取得
app.get('/api/applicants/:tournamentId', async (req, res) => {
  try {
    const db = await connectToDatabase();
    const applicants = await db.collection('applicants')
      .find({ tournamentId: req.params.tournamentId })
      .toArray();
    res.status(200).json({ success: true, data: applicants });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. 申込者登録
app.post('/api/applicants', async (req, res) => {
  try {
    const db = await connectToDatabase();
    const { tournamentId, archerId, applicantData } = req.body;

    if (!tournamentId || !archerId || !applicantData) {
      return res.status(400).json({ success: false, message: 'Invalid request data' });
    }

    // 新規登録時はresultsフィールドも初期化しておくと安全
    const initialResults = {
      stand1: Array(10).fill(null),
      stand2: Array(10).fill(null),
      stand3: Array(10).fill(null),
      stand4: Array(10).fill(null),
      stand5: Array(10).fill(null),
      stand6: Array(10).fill(null)
    };

    const updateData = {
      ...applicantData,
      tournamentId,
      archerId,
      updatedAt: new Date()
    };

    // 既存データがある場合はresultsを上書きしないようにする
    const existing = await db.collection('applicants').findOne({ tournamentId, archerId });
    if (!existing) {
      updateData.results = initialResults;
    }

    await db.collection('applicants').updateOne(
      { tournamentId, archerId },
      { $set: updateData },
      { upsert: true }
    );

    res.status(200).json({ success: true, data: { ...updateData } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6. チェックイン
app.post('/api/checkin', async (req, res) => {
  try {
    const db = await connectToDatabase();
    const { tournamentId, archerId } = req.body;

    if (!tournamentId || !archerId) {
      return res.status(400).json({ success: false, message: 'Required fields missing' });
    }

    const applicant = await db.collection('applicants').findOne({ tournamentId, archerId });
    if (!applicant) {
      return res.status(404).json({ success: false, message: '該当する選手が見つかりません' });
    }

    if (applicant.isCheckedIn) {
      return res.status(400).json({ success: false, message: '既にチェックイン済みです' });
    }

    await db.collection('applicants').updateOne(
      { tournamentId, archerId },
      { $set: { isCheckedIn: true, checkedInAt: new Date() } }
    );

    res.status(200).json({ success: true, message: 'チェックイン完了' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 7. 射技結果を保存
app.post('/api/results', async (req, res) => {
  try {
    const db = await connectToDatabase();
    const { tournamentId, archerId, results } = req.body;

    if (!tournamentId || !archerId || !results) {
      return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    await db.collection('applicants').updateOne(
      { tournamentId, archerId },
      { $set: { results, updatedAt: new Date() } }
    );

    res.status(200).json({ success: true, message: '結果を保存しました' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 8. 選手情報を更新（段位・所属など）
app.patch('/api/applicants/:archerId', async (req, res) => {
  try {
    const db = await connectToDatabase();
    const { archerId } = req.params;
    const updateData = req.body;

    if (!archerId) {
      return res.status(400).json({ success: false, message: 'Archer ID is required' });
    }

    const result = await db.collection('applicants').updateOne(
      { archerId },
      { $set: { ...updateData, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: '選手が見つかりません' });
    }

    res.status(200).json({ success: true, message: '選手情報を更新しました' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 9. 射詰競射の初期データ保存
app.post('/api/ranking/shichuma', async (req, res) => {
  try {
    const db = await connectToDatabase();
    const { tournamentId, archerId, results, shootOffType } = req.body;

    if (!tournamentId || !archerId) {
      return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    await db.collection('applicants').updateOne(
      { tournamentId, archerId },
      { $set: { shichumaResults: results, updatedAt: new Date() } }
    );

    res.status(200).json({ success: true, message: '射詰競射データを保存しました' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 10. 射詰競射の最終結果保存
app.post('/api/ranking/shichuma/final', async (req, res) => {
  try {
    const db = await connectToDatabase();
    const { tournamentId, shootOffType, targetRank, results } = req.body;

    if (!tournamentId || !results) {
      return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    // 既存のデータを取得
    const existingData = await db.collection('shichuma_results').findOne({ tournamentId });
    
    let mergedResults = [];
    if (existingData && existingData.results) {
      // 既存の結果から同じtargetRankのものを除外
      mergedResults = existingData.results.filter(r => r.targetRank !== targetRank);
    }
    
    // 新しい結果を追加
    mergedResults = [...mergedResults, ...results];
    
    console.log(`🔄 Shichuma Results Merge: tournamentId=${tournamentId}, targetRank=${targetRank}`);
    console.log(`  既存データ: ${existingData?.results?.length || 0}件`);
    console.log(`  新規データ: ${results.length}件`);
    console.log(`  マージ後: ${mergedResults.length}件`);

    const finalData = {
      tournamentId,
      shootOffType,
      results: mergedResults,
      completedAt: new Date()
    };

    await db.collection('shichuma_results').updateOne(
      { tournamentId },
      { $set: finalData },
      { upsert: true }
    );

    console.log(`🎯 Shichuma Final Results Saved: ${tournamentId}`);
    res.status(200).json({ success: true, data: finalData });

  } catch (error) {
    console.error('❌ POST /api/ranking/shichuma/final error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 11. 射詰競射の結果取得
app.get('/api/ranking/shichuma/:tournamentId', async (req, res) => {
  try {
    const db = await connectToDatabase();
    const { tournamentId } = req.params;

    const result = await db.collection('shichuma_results').findOne({ tournamentId });

    if (!result) {
      return res.status(404).json({ success: false, message: 'No shichuma results found' });
    }

    res.status(200).json({ success: true, data: result });

  } catch (error) {
    console.error('❌ GET /api/ranking/shichuma error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 11-2. 射詰競射の結果削除
app.delete('/api/ranking/shichuma/:tournamentId', async (req, res) => {
  try {
    const db = await connectToDatabase();
    const { tournamentId } = req.params;

    const result = await db.collection('shichuma_results').deleteOne({ tournamentId });

    if (result.deletedCount === 0) {
      console.log(`⚠️ Shichuma results not found for deletion: ${tournamentId}`);
      return res.status(404).json({ success: false, message: 'No shichuma results found to delete' });
    }

    console.log(`🗑️ Shichuma Results Deleted: ${tournamentId}`);
    res.status(200).json({ success: true, message: 'Shichuma results deleted successfully' });

  } catch (error) {
    console.error('❌ DELETE /api/ranking/shichuma error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 12. 遠近競射の最終結果保存
app.post('/api/ranking/enkin/final', async (req, res) => {
  try {
    const db = await connectToDatabase();
    const { tournamentId, shootOffType, targetRank, results } = req.body;

    if (!tournamentId || !results) {
      return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    // 既存のデータを取得
    const existingData = await db.collection('enkin_results').findOne({ tournamentId });
    
    let mergedResults = [];
    if (existingData && existingData.results) {
      // 既存の結果から同じtargetRankのものを除外
      mergedResults = existingData.results.filter(r => r.targetRank !== targetRank);
    }
    
    // 新しい結果を追加
    mergedResults = [...mergedResults, ...results];
    
    console.log(`🔄 Enkin Results Merge: tournamentId=${tournamentId}, targetRank=${targetRank}`);
    console.log(`  既存データ: ${existingData?.results?.length || 0}件`);
    console.log(`  新規データ: ${results.length}件`);
    console.log(`  マージ後: ${mergedResults.length}件`);

    const finalData = {
      tournamentId,
      shootOffType,
      results: mergedResults,
      completedAt: new Date()
    };

    await db.collection('enkin_results').updateOne(
      { tournamentId },
      { $set: finalData },
      { upsert: true }
    );

    console.log(`✅ Enkin Final Results Saved: ${tournamentId}`);
    res.status(200).json({ success: true, data: finalData });

  } catch (error) {
    console.error('❌ POST /api/ranking/enkin/final error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 13. 遠近競射の結果取得
app.get('/api/ranking/enkin/:tournamentId', async (req, res) => {
  try {
    const db = await connectToDatabase();
    const { tournamentId } = req.params;

    const result = await db.collection('enkin_results').findOne({ tournamentId });

    if (!result) {
      return res.status(404).json({ success: false, message: 'No enkin results found' });
    }

    res.status(200).json({ success: true, data: result });

  } catch (error) {
    console.error('❌ GET /api/ranking/enkin error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 13-2. 遠近競射の結果削除(新規追加)
app.delete('/api/ranking/enkin/:tournamentId', async (req, res) => {
  try {
    const db = await connectToDatabase();
    const { tournamentId } = req.params;

    const result = await db.collection('enkin_results').deleteOne({ tournamentId });

    if (result.deletedCount === 0) {
      console.log(`⚠️ Enkin results not found for deletion: ${tournamentId}`);
      return res.status(404).json({ success: false, message: 'No enkin results found to delete' });
    }

    console.log(`🗑️ Enkin Results Deleted: ${tournamentId}`);
    res.status(200).json({ success: true, message: 'Enkin results deleted successfully' });

  } catch (error) {
    console.error('❌ DELETE /api/ranking/enkin error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 14. 全ての順位決定戦の結果を取得
app.get('/api/ranking/shootoff/:tournamentId', async (req, res) => {
  try {
    const db = await connectToDatabase();
    const { tournamentId } = req.params;

    // 射詰競射の結果を取得
    const shichumaResult = await db.collection('shichuma_results').findOne({ tournamentId });
    
    // 遠近競射の結果を取得
    const enkinResult = await db.collection('enkin_results').findOne({ tournamentId });

    const allResults = {
      tournamentId,
      shichuma: shichumaResult || null,
      enkin: enkinResult || null,
      updatedAt: new Date()
    };

    res.status(200).json({ success: true, data: allResults });

  } catch (error) {
    console.error('❌ GET /api/ranking/shootoff error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 15. 選手の性別情報を更新
app.patch('/api/applicants/:archerId/gender', async (req, res) => {
  try {
    const db = await connectToDatabase();
    const { archerId } = req.params;
    const { gender } = req.body;

    if (!archerId || !gender || !['male', 'female'].includes(gender)) {
      return res.status(400).json({ success: false, message: 'Invalid request data' });
    }

    const result = await db.collection('applicants').updateOne(
      { archerId },
      { $set: { gender, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: '選手が見つかりません' });
    }

    res.status(200).json({ success: true, message: '性別情報を更新しました' });
  } catch (error) {
    console.error('❌ PATCH /api/applicants/:archerId/gender error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 16. 順位決定戦関連フィールドをクリア(新規追加)
app.post('/api/ranking/clear/:tournamentId', async (req, res) => {
  try {
    const db = await connectToDatabase();
    const { tournamentId } = req.params;

    // 該当する大会の全選手の競射関連フィールドをクリア
    const result = await db.collection('applicants').updateMany(
      { tournamentId },
      { 
        $unset: { 
          shichumaResults: "",
          enkinRank: "",
          enkinArrowType: ""
        } 
      }
    );

    console.log(`🗑️ Cleared shoot-off fields for ${result.modifiedCount} applicants in tournament: ${tournamentId}`);
    
    res.status(200).json({ 
      success: true, 
      message: 'Shoot-off fields cleared successfully',
      stats: {
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount
      }
    });

  } catch (error) {
    console.error('❌ POST /api/ranking/clear error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

const PORT = process.env.PORT || 3001;

// 本番環境用に静的ファイルを提供
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist'));
}

// SPAルーティング対応 - API以外のリクエストはindex.htmlを返す
// 必ずAPIルートの後に配置すること
app.use((req, res, next) => {
  // APIリクエストでない場合のみindex.htmlを返す
  if (!req.path.startsWith('/api')) {
    res.sendFile(join(__dirname, 'dist', 'index.html'));
  } else {
    next();
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  
  // 初期DB接続は非同期で試行(失敗してもサーバーは起動)
  connectToDatabase()
    .then(() => console.log('✅ Initial DB connection successful\n'))
    .catch(err => console.log('⚠️ Initial DB connection failed (will retry on API calls):', err.message));
});

export default app;