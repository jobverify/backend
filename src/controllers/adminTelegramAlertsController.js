import TelegramChannelDelivery from '../models/TelegramChannelDelivery.js';
import { BROADCAST_DESTINATIONS, listBroadcastSettings, saveBroadcastSettings } from '../services/telegramBroadcastSettingsService.js';
import { BROADCAST_TOKENS, DEFAULT_BROADCAST_TEMPLATE, BROADCAST_SAMPLE_JOBS, renderBroadcastTemplate } from '../services/telegramBroadcastTemplate.js';
import { isTelegramDeliveryEnabled } from '../services/telegramProvider.js';

const handle = operation => async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  try { res.json({ success: true, data: await operation(req) }); }
  catch (error) {
    if ([400, 409].includes(error?.status)) return res.status(error.status).json({ success: false, message: error.message });
    return next(error);
  }
};
export const getAdminTelegramAlerts = handle(async () => ({ destinations: await listBroadcastSettings(),
  tokens: BROADCAST_TOKENS, defaultTemplate: DEFAULT_BROADCAST_TEMPLATE,
  botReady: isTelegramDeliveryEnabled() && Boolean(process.env.TELEGRAM_BOT_TOKEN) }));

export const saveAdminTelegramAlerts = handle(req => saveBroadcastSettings(req.params.destination, req.body, req.user._id));

export const previewAdminTelegramAlert = handle(req => {
  const sample = req.body?.sample ?? 'complete';
  if (!Object.hasOwn(BROADCAST_SAMPLE_JOBS, sample)) throw Object.assign(new Error('Choose the complete or minimal sample.'), { status: 400 });
  const text = renderBroadcastTemplate(req.body?.template, BROADCAST_SAMPLE_JOBS[sample]);
  return { text, characters: text.length, sampleLabel: sample === 'complete' ? 'Illustrative sample with source details' : 'Illustrative sample with missing details' };
});

export const getAdminTelegramAlertLogs = handle(async req => {
  const id = req.query.destination;
  if (!BROADCAST_DESTINATIONS.includes(id)) throw Object.assign(new Error('Choose channel or group.'), { status: 400 });
  const settings = (await listBroadcastSettings()).find(destination => destination.id === id);
  const rows = await TelegramChannelDelivery.find({ $or: [{ destination: id }, { channel: settings.chatId, destination: { $exists: false } }] }).sort({ createdAt: -1, _id: -1 }).limit(20)
    .select('destination channel job status reason createdAt sentAt providerMessageId configRevision').populate({ path: 'job', select: 'title company' }).lean();
  return rows.map(row => ({ id: String(row._id), destination: row.destination || id, chatId: row.channel,
    job: row.job ? { title: row.job.title, company: row.job.company } : null,
    status: row.status, reason: row.reason, createdAt: row.createdAt, sentAt: row.sentAt,
    providerMessageId: row.providerMessageId, configRevision: row.configRevision }));
});
