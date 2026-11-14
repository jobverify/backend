import User from '../models/User.js';
import AppleTokenRevocation from '../models/AppleTokenRevocation.js';
import { appleIdentity, hashAppleChallenge } from '../utils/appleAuth.js';

const RETENTION = 30 * 86400000;
async function attemptRevocation(entry) {
  try {
    await appleIdentity.revokeEncryptedToken(entry.encryptedToken, entry.clientId);
    await AppleTokenRevocation.deleteOne({ _id: entry._id });
    return true;
  } catch {
    // Never log credentials, ciphertext or provider response bodies.
    await AppleTokenRevocation.updateOne({ _id: entry._id }, { $inc: { attempts: 1 } });
    return false;
  }
}

export async function queueAppleRevocation(user) {
  if (!user.apple?.sub) return;
  const stored = await User.findById(user._id).select('+apple.refreshToken');
  const encryptedToken = stored?.apple?.refreshToken;
  // Missing legacy credentials must not prevent local account deletion.
  if (!encryptedToken) return;
  const entry = { _id: hashAppleChallenge(encryptedToken), encryptedToken,
    clientId: stored.apple.clientId, createdAt: new Date(), expiresAt: new Date(Date.now() + RETENTION) };
  // Persist before local cleanup, so a provider outage cannot lose revocation.
  await AppleTokenRevocation.updateOne({ _id: entry._id }, { $setOnInsert: entry }, { upsert: true });
  await attemptRevocation(entry);
}

export async function retryAppleRevocations({ limit = 100 } = {}) {
  const boundedLimit = Math.max(1, Math.min(100, Math.floor(Number(limit)) || 100));
  const entries = await AppleTokenRevocation.find({ expiresAt: { $gt: new Date() } })
    .select('+encryptedToken').sort({ createdAt: 1 }).limit(boundedLimit);
  let revoked = 0;
  for (const entry of entries) if (await attemptRevocation(entry)) revoked += 1;
  return { attempted: entries.length, revoked, failed: entries.length - revoked };
}
