import mongoose from 'mongoose';
import User from '../../src/models/User.js';

// Unit tests replace the persistence boundary; real transaction behavior is
// exercised by accountDeletionWritersMongo.test.js against an isolated replica.
export function mockActiveAccountWrites(t) {
  t.mock.method(mongoose.connection, 'transaction', async write => write({}));
  t.mock.method(User, 'updateOne', async () => ({ matchedCount: 1 }));
}
