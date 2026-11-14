import mongoose from 'mongoose';
import User from '../models/User.js';

export class InactiveAccountError extends Error {
  constructor() {
    super('Your account is no longer active.');
    this.name = 'InactiveAccountError';
    this.code = 'ACCOUNT_INACTIVE';
    this.statusCode = 404;
  }
}

export function withActiveAccountWrite(userId, write) {
  return mongoose.connection.transaction(async session => {
    // Account deletion marks this same row before sweeping private records.
    // A write fence serializes both paths; a snapshot read would still race.
    const owner = await User.updateOne({ _id: userId, deactivated: { $ne: true }, accountDeletingAt: null },
      { $inc: { __v: 1 } }, { session });
    if (owner.matchedCount !== 1) throw new InactiveAccountError();
    return write(session);
  });
}
