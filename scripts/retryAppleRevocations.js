import mongoose from 'mongoose';
import connectDB from '../db/db.js';
import { retryAppleRevocations } from '../src/services/appleTokenRevocation.js';

// Requires an explicit operator action and the deployment's existing secure env.
// No environment files or provider credentials are printed or changed.
if (!process.argv.includes('--apply')) {
  console.error('Usage: node scripts/retryAppleRevocations.js --apply');
  process.exitCode = 1;
} else {
  try {
    await connectDB();
    const result = await retryAppleRevocations();
    console.log(JSON.stringify(result));
    if (result.failed) process.exitCode = 1;
  } catch {
    console.error('Apple token revocation retry failed. Check secure runtime configuration and database availability.');
    process.exitCode = 1;
  } finally { await mongoose.disconnect(); }
}
