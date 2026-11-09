import mongoose from 'mongoose';
import { randomInt } from 'node:crypto';
import TelegramBroadcastSettings from '../models/TelegramBroadcastSettings.js';
import TelegramChannelSchedule from '../models/TelegramChannelSchedule.js';
import TelegramChannelDelivery from '../models/TelegramChannelDelivery.js';
import AdminAudit from '../models/AdminAudit.js';
import { hasSavedFilters, jobMatchesSavedFilters } from './jobFilterMatcher.js';
import { normalizeProfilePreferenceFilters } from '../utils/profilePreferenceFilters.js';
import { ROLE_DOMAIN_OPTIONS, WORK_ARRANGEMENT_OPTIONS } from '../constants/jobFilterTaxonomy.js';
import { DEFAULT_BROADCAST_TEMPLATE, validateBroadcastTemplate } from './telegramBroadcastTemplate.js';
import { nextBroadcastWindowAt, validateBroadcastWindow, validatePostingWindows } from './telegramBroadcastWindow.js';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
export const BROADCAST_DESTINATIONS = ['channel', 'group'];
const asConfig = doc => ({ id: doc._id, enabled: doc.enabled, chatId: doc.chatId,
  startTime: doc.startTime ?? '', endTime: doc.endTime ?? '',
  postingWindows: doc.postingWindows,
  minIntervalMinutes: doc.minIntervalMinutes, maxIntervalMinutes: doc.maxIntervalMinutes, matchAll: doc.matchAll,
  filters: normalizeProfilePreferenceFilters(doc.filters), template: doc.template, revision: doc.revision });
const defaults = id => asConfig({ _id: id, enabled: false, chatId: id === 'channel' ? '@jobverifychannel' : '@jobverifygroup',
  minIntervalMinutes: 20, maxIntervalMinutes: 30, matchAll: false, filters: {}, template: DEFAULT_BROADCAST_TEMPLATE, revision: 0 });

export async function getActiveBroadcastSettings({ session } = {}) {
  const query = TelegramBroadcastSettings.find({ enabled: true, revision: { $gte: 1 } });
  if (session) query.session(session);
  return (await query.lean()).map(asConfig);
}

export function jobMatchesBroadcastFilters(job, cfg) {
  if (cfg.matchAll) return true;
  const filters = normalizeProfilePreferenceFilters(cfg.filters);
  if (!hasSavedFilters(filters)) return false;
  return jobMatchesSavedFilters({ job, filters, ignoreProfileEligibility: true });
}

async function withStats(config) {
  const [groups, schedule] = await Promise.all([
    TelegramChannelDelivery.aggregate([{ $match: { channel: config.chatId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    TelegramChannelSchedule.findById(config.chatId).lean(),
  ]);
  const counts = Object.fromEntries(groups.map(group => [group._id, group.count]));
  return { ...config, stats: { queued: counts.queued || 0, sending: counts.sending || 0, sent: counts.sent || 0,
    skipped: counts.skipped || 0, uncertain: counts.uncertain || 0,
    nextPostAt: config.enabled && schedule?.nextPostAt
      ? nextBroadcastWindowAt(new Date(Math.max(Date.now(), new Date(schedule.nextPostAt).getTime())), config) : null,
    lastSentAt: schedule?.lastSentAt ?? null } };
}

export async function listBroadcastSettings() {
  const docs = await TelegramBroadcastSettings.find().lean();
  return Promise.all(BROADCAST_DESTINATIONS.map(id => withStats(docs.find(doc => doc._id === id) ? asConfig(docs.find(doc => doc._id === id)) : defaults(id))));
}

function validateFilters(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Provide job filters as an object.');
  const listKeys = ['company', 'jobType', 'location', 'roleDomain', 'workArrangement', 'datePostedDays'];
  if (Object.keys(input).some(key => ![...listKeys, 'experienceYear', 'sortBy'].includes(key))) fail('Unsupported job filter.');
  for (const key of listKeys) if (input[key] !== undefined && (!Array.isArray(input[key]) || input[key].length > 20
    || input[key].some(value => typeof value !== 'string' || !value.trim() || value.length > 80))) fail(`Choose up to 20 valid ${key} values.`);
  const filters = normalizeProfilePreferenceFilters(input);
  if (!['', 'unspecified', ...Array.from({ length: 16 }, (_, index) => String(index))].includes(filters.experienceYear)) fail('Choose a valid experience year.');
  if (filters.jobType.some(type => !['Intern', 'Full-time Fresher', 'Full-time Experienced', 'Contract'].includes(type))) fail('Choose a valid job type.');
  if (filters.roleDomain.some(domain => !ROLE_DOMAIN_OPTIONS.includes(domain))) fail('Choose a valid role domain.');
  if (filters.workArrangement.some(mode => !WORK_ARRANGEMENT_OPTIONS.includes(mode))) fail('Choose a valid work mode.');
  if (input.datePostedDays && filters.datePostedDays.length !== new Set(input.datePostedDays).size) fail('Choose a valid listing freshness filter.');
  return filters;
}

export function validateBroadcastSettings(id, body) {
  if (!BROADCAST_DESTINATIONS.includes(id)) fail('Choose channel or group.');
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Provide destination settings.');
  const keys = ['enabled', 'chatId', 'minIntervalMinutes', 'maxIntervalMinutes', 'startTime', 'endTime', 'postingWindows', 'matchAll', 'filters', 'template', 'revision'];
  if (Object.keys(body).some(key => !keys.includes(key))) fail('Unsupported destination setting.');
  if (typeof body.enabled !== 'boolean' || typeof body.matchAll !== 'boolean') fail('Enabled and matchAll must be true or false.');
  if (!Number.isInteger(body.revision) || body.revision < 0) fail('Provide the settings revision.');
  if (![body.minIntervalMinutes, body.maxIntervalMinutes].every(value => Number.isInteger(value) && value >= 1 && value <= 1440)
    || body.maxIntervalMinutes < body.minIntervalMinutes) fail('Choose an interval range from 1 to 1440 minutes, with maximum at least minimum.');
  if (typeof body.chatId !== 'string' || body.chatId.length > 64) fail('Provide a valid Telegram chat ID or @username.');
  const chatId = body.chatId.trim().toLowerCase();
  const validChat = id === 'group' ? /^(@[a-z0-9_]{5,32}|-[1-9]\d*)$/ : /^(@[a-z0-9_]{5,32}|-100\d+)$/;
  if ((chatId || body.enabled) && !validChat.test(chatId)) fail('Provide a valid Telegram chat ID or @username.');
  const filters = validateFilters(body.filters);
  const window = validateBroadcastWindow(body);
  const postingWindows = validatePostingWindows(body);
  if (body.enabled && !body.matchAll && !hasSavedFilters(filters)) fail('Choose at least one job filter or explicitly select all jobs.');
  return { enabled: body.enabled, chatId, minIntervalMinutes: body.minIntervalMinutes, maxIntervalMinutes: body.maxIntervalMinutes,
    ...window, postingWindows, matchAll: body.matchAll, filters, template: validateBroadcastTemplate(body.template), revision: body.revision };
}

export async function saveBroadcastSettings(id, body, adminId) {
  const next = validateBroadcastSettings(id, body);
  try {
    await mongoose.connection.transaction(async session => {
      const current = await TelegramBroadcastSettings.findById(id).session(session).lean();
      if ((current?.revision ?? 0) !== next.revision) fail('Settings changed in another session. Reload before saving.', 409);
      const duplicate = next.chatId && await TelegramBroadcastSettings.exists({ _id: { $ne: id }, chatId: next.chatId }).session(session);
      if (duplicate) fail('Channel and group must use different Telegram chat IDs.');
      for (const chat of new Set([current?.chatId, next.chatId].filter(Boolean))) {
        const schedule = await TelegramChannelSchedule.findById(chat).session(session).lean();
        if (schedule?.claimToken && schedule.claimExpiresAt > new Date()) fail('A Telegram post is in progress. Retry saving shortly.', 409);
        const changed = !current || !current.enabled || current.chatId !== next.chatId
          || (current.startTime ?? '') !== next.startTime || (current.endTime ?? '') !== next.endTime
          || JSON.stringify(current?.postingWindows) !== JSON.stringify(next.postingWindows)
          || current.minIntervalMinutes !== next.minIntervalMinutes || current.maxIntervalMinutes !== next.maxIntervalMinutes;
        const candidate = changed || !schedule?.nextPostAt
          ? new Date(Date.now() + randomInt(next.minIntervalMinutes * 60000, next.maxIntervalMinutes * 60000 + 1)) : schedule.nextPostAt;
        const nextPostAt = nextBroadcastWindowAt(new Date(Math.max(Date.now(), new Date(candidate).getTime())), next);
        await TelegramChannelSchedule.updateOne({ _id: chat }, { $set: { nextPostAt } }, { upsert: true, session });
      }
      if (current?.chatId && current.chatId !== next.chatId) {
        await TelegramChannelDelivery.updateMany({ channel: current.chatId, destination: id, status: 'queued' },
          { $set: { status: 'skipped', reason: 'destination_changed', retryAt: null } }, { session });
      }
      if (next.chatId) {
        await TelegramChannelDelivery.updateMany({ channel: next.chatId, status: 'queued',
          $or: [{ configRevision: { $exists: false } }, { configRevision: null }, { configRevision: { $lt: 1 } }] },
        { $set: { status: 'skipped', reason: 'legacy_configuration', destination: id, retryAt: null } }, { session });
      }
      await TelegramBroadcastSettings.findOneAndUpdate({ _id: id }, { $set: { ...next, revision: next.revision + 1, updatedBy: adminId } },
        { upsert: true, new: true, runValidators: true, session });
      await AdminAudit.create([{ admin: adminId, action: 'telegram_broadcast_settings_updated', targetType: 'TelegramBroadcastSettings',
        details: JSON.stringify({ destination: id, chatId: next.chatId, enabled: next.enabled, revision: next.revision + 1 }) }], { session });
    });
  } catch (error) {
    if (error?.code === 11000) fail(error.keyPattern?._id ? 'Settings changed in another session. Reload before saving.' : 'Channel and group must use different Telegram chat IDs.', error.keyPattern?._id ? 409 : 400);
    throw error;
  }
  return withStats(asConfig(await TelegramBroadcastSettings.findById(id).lean()));
}
