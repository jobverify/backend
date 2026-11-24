import Job from '../models/Job.js';
import { getSiteSettings } from './siteSettingsService.js';
import { applyPublicJobVisibility } from '../utils/publicJobVisibility.js';
import { normalizePublicJobCategory } from '../utils/publicJobNormalization.js';
import { PUBLIC_JOB_TYPE_EXPRESSION } from '../utils/publicJobType.js';
import { formatStoredLocationLabel } from '../utils/jobLocations.js';
import { buildApplicationState } from '../controllers/jobController.js';
import { resolveFrontendOrigin } from '../utils/runtimeConfig.js';
import { APIError } from '../middleware/errorHandler.js';

export const WHATSAPP_DIGEST_POST_LIMIT = 3500;
const INDIA_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;
const MAX_JOBS = 50;
const digestDate = now => new Date(now.getTime() + INDIA_OFFSET_MS).toISOString().slice(0, 10);

export function parseWhatsAppDigestQuery(query = {}, now = new Date()) {
  if (Object.keys(query).some(key => !['date', 'limit'].includes(key))) throw new APIError(400, 'Choose a digest date and job limit.');
  const date = query.date === undefined ? digestDate(now) : query.date;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new APIError(400, 'Choose a valid digest date.');
  const midnight = new Date(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(midnight.getTime()) || midnight.toISOString().slice(0, 10) !== date || date < '2000-01-01' || date > digestDate(now)) {
    throw new APIError(400, 'Choose today or a past calendar date from 2000 onwards.');
  }
  const rawLimit = query.limit === undefined ? '20' : query.limit;
  if (typeof rawLimit !== 'string' || !/^\d{1,2}$/.test(rawLimit) || Number(rawLimit) < 1 || Number(rawLimit) > MAX_JOBS) {
    throw new APIError(400, 'Choose between 1 and 50 jobs.');
  }
  const start = new Date(midnight.getTime() - INDIA_OFFSET_MS);
  return { date, limit: Number(rawLimit), start, end: new Date(start.getTime() + DAY_MS) };
}

// Source fields remain single-line facts. Links are generated only from our own job IDs.
function plainFact(value, maxLength) {
  const text = String(value ?? '').slice(0, 8192).replace(/<[^<>]*>/g, ' ').replace(/[<>]/g, ' ')
    .replace(/(?:https?:\/\/|www\.)\S+/gi, ' ')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069*_~`]/g, ' ')
    .replace(/\s+/g, ' ').trim().toWellFormed();
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).replace(/[\uD800-\uDBFF]$/u, '')}…`;
}

function digestJob(row, origin) {
  const id = String(row._id ?? row.id ?? '');
  const title = plainFact(row.title, 180);
  if (!/^[a-f\d]{24}$/i.test(id) || !title) return null;
  const category = normalizePublicJobCategory(row);
  return { id, title, company: plainFact(row.company, 100), location: plainFact(formatStoredLocationLabel(row), 120),
    jobType: category === 'Unspecified' ? '' : plainFact(category, 60), url: new URL(`/jobs/${id}`, origin).href };
}

function prepareJobs(rows, origin) {
  const seen = new Set();
  return rows.map(row => digestJob(row, origin)).filter(job => {
    if (!job || seen.has(job.id)) return false;
    seen.add(job.id);
    return true;
  });
}

function postsForJobs(jobs, date, origin) {
  if (!jobs.length) return [];
  const label = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })
    .format(new Date(`${date}T00:00:00+05:30`));
  const heading = `*Jobverify daily job digest*\n${label} (IST)\nAdded to Jobverify on this date.`;
  const footer = `Check the employer page for current availability.\nMore jobs: ${new URL('/jobs', origin).href}`;
  // Reserve a two-digit part label before splitting; no job or surrogate is cut in half.
  const available = WHATSAPP_DIGEST_POST_LIMIT - heading.length - footer.length - '\nPart 50 of 50\n\n\n\n'.length;
  const parts = [];
  let entries = [];
  let length = 0;
  for (const [index, job] of jobs.entries()) {
    const entry = [`*${index + 1}. ${job.title}*`, job.company, [job.location, job.jobType].filter(Boolean).join(' · '), job.url].filter(Boolean).join('\n');
    if (entries.length && length + 2 + entry.length > available) {
      parts.push(entries);
      entries = [];
      length = 0;
    }
    length += (entries.length ? 2 : 0) + entry.length;
    entries.push(entry);
  }
  if (entries.length) parts.push(entries);
  return parts.map((part, index) => ({ jobCount: part.length,
    text: `${heading}${parts.length > 1 ? `\nPart ${index + 1} of ${parts.length}` : ''}\n\n${part.join('\n\n')}\n\n${footer}` }));
}

export function buildWhatsAppDigestPosts(rows, date, origin) {
  return postsForJobs(prepareJobs(rows.slice(0, MAX_JOBS), origin), date, origin);
}

export async function getWhatsAppDigest(query = {}, now = new Date()) {
  const { date, limit, start, end } = parseWhatsAppDigestQuery(query, now);
  const origin = resolveFrontendOrigin();
  const filter = applyPublicJobVisibility({ status: 'active', 'sourceAvailability.state': { $ne: 'closed' },
    createdAt: { $gte: start, $lt: end }, $or: [{ closingDate: null }, { closingDate: { $gt: now } }] }, await getSiteSettings(), now);
  const cursor = Job.find(filter).sort({ createdAt: -1, _id: -1 })
    .select({ title: 1, company: 1, city: 1, location: 1, locations: 1, _publicJobType: PUBLIC_JOB_TYPE_EXPRESSION,
      applyUrl: 1, sourceUrl: 1, workdayApplicationStatus: 1, workdayApplicationStatusReason: 1, workdayApplicationStatusCheckedAt: 1 })
    .maxTimeMS(5000).lean().cursor({ batchSize: 100 });
  const jobs = [];
  try {
    // Use the public board's recorded application state, without probing employer sites.
    // Apply the limit after availability so skipped rows cannot hide eligible jobs.
    for await (const row of cursor) {
      if (buildApplicationState(row).applicationStatus !== 'available') continue;
      const job = digestJob(row, origin);
      if (job) jobs.push(job);
      if (jobs.length > limit) break;
    }
  } finally {
    await cursor.close();
  }
  const hasMore = jobs.length > limit;
  if (hasMore) jobs.pop();
  return { date, timezone: 'Asia/Kolkata', limit, generatedAt: now.toISOString(), hasMore,
    postCharacterLimit: WHATSAPP_DIGEST_POST_LIMIT, jobs, posts: postsForJobs(jobs, date, origin) };
}
