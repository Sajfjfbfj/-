import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Vercel環境でのタイムアウトを防ぐための設定
app.use(cors());
app.use(express.json());

// MongoDB設定
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'kyudo-tournament';

let cachedClient = null;
let cachedDb = null;

// 接続関数（Serverless用に最適化）
async function connectToDatabase() {
  if (cachedDb) return cachedDb;

  if (!MONGODB_URI) {
    throw new Error('環境変数 MONGODB_URI が設定されていません。');
  }

  const client = await MongoClient.connect(MONGODB_URI, {
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 10000,
  });

  const db = client.db(DB_NAME);
  cachedClient = client;
  cachedDb = db;
  return db;
}

// --- API ルート ---

// 1. 大会一覧取得
app.get('/api/tournaments', async (req, res) => {
  try {
    const db = await connectToDatabase();
    const tournaments = await db.collection('tournaments').find({}).toArray();
    res.status(200).json({ success: true, data: tournaments });
  } catch (error) {
    console.error('Fetch Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. 大会保存
app.post('/api/tournaments', async (req, res) => {
  try {
    const db = await connectToDatabase();
    const data = req.body;
    
    if (data._id) {
      const id = data._id;
      delete data._id;
      await db.collection('tournaments').updateOne(
        { _id: new ObjectId(id) },
        { $set: data },
        { upsert: true }
      );
    } else {
      await db.collection('tournaments').insertOne(data);
    }
    res.status(200).json({ success: true, message: '保存成功' });
  } catch (error) {
    console.error('Save Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. 削除
app.delete('/api/tournaments/:id', async (req, res) => {
  try {
    const db = await connectToDatabase();
    await db.collection('tournaments').deleteOne({ _id: new ObjectId(req.params.id) });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// サーバー起動（ローカル用）
if (process.env.NODE_ENV !== 'production') {
  const PORT = 3001;
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

export default app;