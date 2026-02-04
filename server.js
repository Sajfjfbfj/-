import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';

const app = express();

app.use(cors());
app.use(express.json());

// 静的ファイルの配信
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use(express.static(join(__dirname, 'dist')));

// MongoDB設定
const MONGODB_URI = process.env.MONGODB_URI;
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
      return res.status(200).json({ success: true, data: applicant, message: '既に受付済みです' });
    }

    await db.collection('applicants').updateOne(
      { tournamentId, archerId },
      { $set: { isCheckedIn: true, checkedInAt: new Date() } }
    );

    const updated = await db.collection('applicants').findOne({ tournamentId, archerId });
    res.status(200).json({ success: true, data: updated, message: '受付が完了しました' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 7. 結果記録 (リアルタイム更新用)
app.post('/api/results', async (req, res) => {
  try {
    const db = await connectToDatabase();
    const { tournamentId, archerId, stand, arrowIndex, result } = req.body;
    // result: 'o' (中), 'x' (はずれ), null (取り消し)

    if (!tournamentId || !archerId || !stand || arrowIndex === undefined) {
      return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    const standKey = `stand${stand}`;
    const updatePath = `results.${standKey}.${arrowIndex}`;

    // 配列の特定インデックスを更新
    // 注: 配列が存在しない場合はMongoDBが自動生成しない場合があるため、
    // 必要に応じて初期化ロジックを入れるか、アプリ側で初期化されている前提とする。
    // 今回は初期登録時にresultsを作っているので、ドット記法でいけるはず。
    
    // まずドキュメントが存在するか確認し、resultsフィールドが無い場合のガード
    const doc = await db.collection('applicants').findOne({ tournamentId, archerId });
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Archer not found' });
    }

    // resultsフィールドが無い、または該当standが無い場合の初期化
    if (!doc.results || !doc.results[standKey]) {
      const emptyArray = Array(10).fill(null);
      await db.collection('applicants').updateOne(
        { tournamentId, archerId },
        { $set: { [`results.${standKey}`]: emptyArray } }
      );
    }

    await db.collection('applicants').updateOne(
      { tournamentId, archerId },
      { $set: { [updatePath]: result } }
    );

    console.log(`🎯 Result Updated: ${archerId} ${standKey}[${arrowIndex}] = ${result}`);
    res.status(200).json({ success: true });

  } catch (error) {
    console.error('❌ POST /api/results error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 8. 射詰競射結果保存
app.post('/api/ranking/shichuma', async (req, res) => {
  try {
    const db = await connectToDatabase();
    const { tournamentId, archerId, arrowIndex, result } = req.body;

    if (!tournamentId || !archerId || arrowIndex === undefined) {
      return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    const updatePath = `shichumaResults.arrow${arrowIndex}`;

    await db.collection('applicants').updateOne(
      { tournamentId, archerId },
      { $set: { [updatePath]: result } }
    );

    console.log(`🎯 Shichuma Result Updated: ${archerId} arrow${arrowIndex} = ${result}`);
    res.status(200).json({ success: true });

  } catch (error) {
    console.error('❌ POST /api/ranking/shichuma error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 9. 遠近競射結果保存
app.post('/api/ranking/enkin', async (req, res) => {
  try {
    const db = await connectToDatabase();
    const { tournamentId, archerId, rank, arrowType } = req.body;

    if (!tournamentId || !archerId || rank === undefined) {
      return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    await db.collection('applicants').updateOne(
      { tournamentId, archerId },
      { $set: { enkinRank: rank, enkinArrowType: arrowType || 'normal' } }
    );

    console.log(`🎯 Enkin Result Updated: ${archerId} rank = ${rank}, arrowType = ${arrowType || 'normal'}`);
    res.status(200).json({ success: true });

  } catch (error) {
    console.error('❌ POST /api/ranking/enkin error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 10. 射詰競射の最終結果保存
app.post('/api/ranking/shichuma/final', async (req, res) => {
  try {
    const db = await connectToDatabase();
    const { tournamentId, shootOffType, results } = req.body;

    if (!tournamentId || !results) {
      return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    // 既存のデータを取得
    const existingData = await db.collection('shichuma_results').findOne({ tournamentId });
    
    let mergedResults = [];
    if (existingData && existingData.results) {
      // 既存の結果から同じdivisionIdのものを除外（遠近競射と同じパターン）
      mergedResults = existingData.results.filter(r => !results.some(newResult => newResult.divisionId === r.divisionId));
    }
    
    // 新しい結果を追加
    mergedResults = [...mergedResults, ...results];
    
    console.log(`🔄 Shichuma Results Merge: tournamentId=${tournamentId}`);
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

// 13-2. 遠近競射の結果削除（新規追加）
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

// 16. 順位決定戦関連フィールドをクリア（新規追加）
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

// SPAルーティング対応 - API以外のGETリクエストはindex.htmlを返す
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(join(__dirname, 'dist', 'index.html'));
  }
});

// サーバー起動
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 Server ready at http://localhost:${PORT}`);
  
  connectToDatabase()
    .then(() => console.log('✅ Initial DB connection successful\n'))
    .catch(err => console.error('⚠️ Initial DB connection failed:', err.message));
});

export default app;