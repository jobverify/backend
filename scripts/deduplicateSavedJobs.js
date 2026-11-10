import path from 'node:path';
import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';

export const deduplicateSavedJobs = async ({ model, apply = false } = {}) => {
  const User = model ?? (await import('../src/models/User.js')).default;
  const saved = { $ifNull: ['$savedJobs', []] };
  const filter = { $expr: { $gt: [{ $size: saved }, { $size: { $setUnion: [saved, []] } }] } };
  const candidates = await User.countDocuments(filter, { maxTimeMS: 30000 });
  if (!apply) return { candidates, modifiedCount: 0 };
  // Evaluate the current array on the server, preserving order and concurrent
  // set additions/removals. Never write a previously read array back to User.
  const result = await User.updateMany(filter, [{ $set: { savedJobs: {
    $reduce: { input: saved, initialValue: [], in: {
      $cond: [{ $in: ['$$this', '$$value'] }, '$$value', { $concatArrays: ['$$value', ['$$this']] }],
    } },
  } } }]);
  return { candidates, modifiedCount: result.modifiedCount };
};

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const apply = process.argv.includes('--apply');
    if (apply && process.env.JOBVERIFY_ACKNOWLEDGE_BOOKMARK_REPAIR !== 'true') {
      throw new Error('Apply requires JOBVERIFY_ACKNOWLEDGE_BOOKMARK_REPAIR=true after reviewing a backup.');
    }
    mongoose.set('autoCreate', false); mongoose.set('autoIndex', false);
    await import('../loadEnv.js');
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');
    await mongoose.connect(process.env.MONGO_URI, { autoCreate: false, autoIndex: false });
    console.log(JSON.stringify(await deduplicateSavedJobs({ apply })));
  } catch { console.error('Bookmark repair failed. Check configuration and explicit apply acknowledgement.'); process.exitCode = 1; }
  finally { await mongoose.disconnect(); }
}
