import '../loadEnv.js';
import fs from 'node:fs';
import mongoose from 'mongoose';
import { configureMongoDns } from '../src/utils/mongoDns.js';

const folder = new URL('../../artifacts/classification-analysis-2026-10-29/', import.meta.url);
const skipped = JSON.parse(fs.readFileSync(new URL('rows.json', folder))).filter(row => row.status === 'skipped');
if (!process.env.MONGO_URI) { console.log(JSON.stringify({available:false,reason:'MONGO_URI not configured'})); process.exit(0); }
try {
  configureMongoDns();
  await mongoose.connect(process.env.MONGO_URI, {serverSelectionTimeoutMS:12000,connectTimeoutMS:12000});
  const rows = await mongoose.connection.db.collection('jobs').find(
    {_id:{$in:skipped.map(row => new mongoose.Types.ObjectId(row.id))}},
    {projection:{title:1,originalTitle:1,source:1,company:1,sourceUrl:1,applyUrl:1,link:1,sourceDescription:1,jobDescription:1,description:1,sourceContentHash:1,descriptionRewrite:1,scrapedAt:1,scrapedTimestamp:1,updatedAt:1,status:1,jobId:1,requisitionId:1},maxTimeMS:30000}
  ).toArray();
  fs.writeFileSync(new URL('skipped-current-db.json',folder),JSON.stringify({readAt:new Date().toISOString(),jobs:rows},null,2));
  console.log(JSON.stringify({available:true,requested:skipped.length,found:rows.length}));
} catch (error) {
  console.log(JSON.stringify({available:false,errorType:error.name,errorCode:error.code || null}));
} finally {await mongoose.disconnect();}
