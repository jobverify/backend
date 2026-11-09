import ResumeUsage from '../models/ResumeUsage.js';
export const usageError = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
export const dayKey = (date = new Date()) => date.toISOString().slice(0, 10);
export const monthKey = (date = new Date()) => date.toISOString().slice(0, 7);
/** Never refund ambiguous calls: reserving before provider I/O bounds worst-case charges. */
export async function reserveUsage(key, limit, { units = 1, user = null, now = new Date() } = {}) {
  if (!Number.isInteger(limit) || limit < units) throw usageError('The resume tailoring allowance is exhausted. Try again after it resets.', 429);
  try {
    await ResumeUsage.updateOne({ key }, { $setOnInsert: { used: 0, user, expiresAt: new Date(now.getTime() + 65 * 86400000) } }, { upsert: true });
  } catch (error) { if (error.code !== 11000) throw error; }
  const result = await ResumeUsage.findOneAndUpdate({ key, used: { $lte: limit - units } }, { $inc: { used: units } }, { new: true });
  if (!result) throw usageError('The resume tailoring allowance is exhausted. Try again after it resets.', 429);
  return result;
}

