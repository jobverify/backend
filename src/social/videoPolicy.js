import { createHash } from 'node:crypto';
import { ROLE_DOMAIN_OPTIONS, WORK_ARRANGEMENT_OPTIONS } from '../constants/jobFilterTaxonomy.js';
import { normalizeProfilePreferenceFilters } from '../utils/profilePreferenceFilters.js';
import { hasSavedFilters, jobMatchesSavedFilters } from '../services/jobFilterMatcher.js';
import { socialError } from './policy.js';
import { validateReelCover } from './videoJpeg.js';
import { validateReelMp4 } from './videoMp4.js';

export const VIDEO_LEASE_MS = 10 * 60_000;
export const VIDEO_LIMITS = { video: 16 * 1024 ** 2, cover: 2 * 1024 ** 2, subtitles: 64 * 1024 };
export const VIDEO_TYPES = { video: 'video/mp4', cover: 'image/jpeg', subtitles: 'application/x-subrip' };
export const VIDEO_FAILURES = ['narration_failed', 'render_failed', 'upload_failed', 'invalid_media', 'timeout', 'runner_failed'];
export function normalizeVideoPreferences(input = {}, previous = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw socialError('Provide Instagram draft preferences.');
  const merged = { enabled: false, matchAll: false, filters: {}, ...previous, ...input };
  if (typeof merged.enabled !== 'boolean' || typeof merged.matchAll !== 'boolean' || !merged.filters || typeof merged.filters !== 'object' || Array.isArray(merged.filters)) throw socialError('Invalid Instagram draft preferences.');
  const inputFilters = merged.filters;
  const listKeys = ['company', 'jobType', 'location', 'roleDomain', 'workArrangement', 'datePostedDays'];
  if (Object.keys(inputFilters).some(key => ![...listKeys, 'experienceYear', 'sortBy'].includes(key))) throw socialError('Unsupported job filter.');
  for (const key of listKeys) if (inputFilters[key] !== undefined && (!Array.isArray(inputFilters[key]) || inputFilters[key].length > 20 || inputFilters[key].some(value => typeof value !== 'string' || !value.trim() || value.length > 80))) throw socialError(`Choose up to 20 valid ${key} filter values.`);
  if (inputFilters.experienceYear !== undefined && typeof inputFilters.experienceYear !== 'string') throw socialError('Choose a valid experience year.');
  if (inputFilters.sortBy !== undefined && !['all', 'popularity', 'latest', 'oldest'].includes(inputFilters.sortBy)) throw socialError('Choose a valid sort value.');
  const filters = normalizeProfilePreferenceFilters(inputFilters);
  if (!['', 'unspecified', ...Array.from({ length: 16 }, (_, index) => String(index))].includes(filters.experienceYear)) throw socialError('Choose a valid experience year.');
  if (filters.jobType.some(value => !['Intern', 'Full-time Fresher', 'Full-time Experienced', 'Contract'].includes(value))) throw socialError('Choose a valid job type.');
  if (filters.roleDomain.some(value => !ROLE_DOMAIN_OPTIONS.includes(value))) throw socialError('Choose a valid role domain.');
  if (filters.workArrangement.some(value => !WORK_ARRANGEMENT_OPTIONS.includes(value))) throw socialError('Choose a valid work mode.');
  if (inputFilters.datePostedDays && filters.datePostedDays.length !== new Set(inputFilters.datePostedDays.map(value => value.trim().toLowerCase())).size) throw socialError('Choose a valid date filter value.');
  if (merged.enabled && !merged.matchAll && !hasSavedFilters(filters)) throw socialError('Choose filters or explicitly matchAll all eligible jobs.');
  return { enabled: merged.enabled, matchAll: merged.matchAll, filters };
}
export const matchesVideoPreferences = (job, prefs, now = new Date()) => hasSavedFilters(prefs.filters)
  ? jobMatchesSavedFilters({ job, filters: prefs.filters, ignoreProfileEligibility: true, now }) : prefs.matchAll === true;
const short = (text, length, words = 10) => String(text || '').normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, length).split(' ').slice(0, words).join(' ');
export function videoPlan(facts, branding = {}) {
  if (!/^[a-f0-9]{24}$/i.test(facts.id || '')) throw socialError('A valid JobVerify job is required for the QR code.');
  const jobUrl = `https://www.jobverify.in/jobs/${facts.id}`;
  const location = String(Array.isArray(facts.location) ? facts.location[0] || '' : facts.location || '').split(',')[0].replace(/\s*\[[A-Z]{2}\].*$/i, '').trim();
  const jobType = short(facts.jobType, 30, 3).toLowerCase();
  const audience = jobType === 'intern' ? 'internship seekers' : jobType && `${jobType} job seekers`;
  const opening = `${short(facts.company, 55, 5)} is hiring for ${short(facts.title, 85, 9)}${location ? ` in ${short(location, 40, 4)}` : ''}${audience ? ` for ${audience}` : ''}`;
  const experience = short(facts.experience, 45).replace(/\s+(?:of\s+)?experience\.?$/i, '');
  const experienceDetail = experience && `${experience}${/\b(?:years?|months?|yrs?|mos?)\b/i.test(experience) ? ' of experience' : /^[\d+\s-]+$/.test(experience) ? ' years of experience' : ' experience'}`;
  const cta = 'Scan the QR code for full details and to apply. Follow JobVerify.in for more jobs.';
  let experienceClause = experienceDetail ? ` with ${experienceDetail}` : '';
  let salarySentence = facts.salary ? ` Salary: ${short(facts.salary, 45)}.` : '';
  const narration = () => `${opening}${experienceClause}.${salarySentence} ${cta}`;
  if (narration().length > 440 || narration().split(/\s+/).length > 45) salarySentence = '';
  if (narration().length > 440 || narration().split(/\s+/).length > 45) experienceClause = '';
  return { templateVersion: 'jobverify-reel-v6', jobUrl, companyDomain: short(branding.companyDomain, 253, 1).toLowerCase(), voice: 'en-IN-NeerjaNeural', script: narration(),
    width: 1080, height: 1920, fps: 30, minDuration: 15, maxDuration: 15, ctaHold: 3 };
}
function validateSrt(bytes) {
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim(); } catch { throw socialError('Invalid UTF-8 subtitles.'); }
  if (!text || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) throw socialError('Invalid subtitle text.');
  const stamp = value => { const [, h, m, s, ms] = /^(\d{2}):([0-5]\d):([0-5]\d),(\d{3})$/.exec(value) || []; return h === undefined ? NaN : +h * 3600 + +m * 60 + +s + +ms / 1000; };
  let previous = 0; let cues = 0;
  for (const block of text.split(/\n\s*\n/)) {
    const [index, timing, ...lines] = block.split('\n'); const match = /^(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})$/.exec(timing || '');
    const start = stamp(match?.[1] || ''); const end = stamp(match?.[2] || '');
    if (+index !== ++cues || !match || !Number.isFinite(start) || !Number.isFinite(end) || start < previous || end <= start || end > 30.1 || !lines.join('').trim() || lines.join('').length > 1000) throw socialError('Invalid timed SRT subtitles.');
    previous = end;
  }
  return { cues, duration: previous };
}
export function validateVideoArtifact(kind, bytes, type) {
  if (!Object.hasOwn(VIDEO_LIMITS, kind) || type?.split(';')[0] !== VIDEO_TYPES[kind] || !Buffer.isBuffer(bytes) || !bytes.length || bytes.length > VIDEO_LIMITS[kind]) throw socialError('Invalid media type or size.');
  let properties;
  if (kind === 'cover') return validateReelCover(bytes, type);
  if (kind === 'video') properties = validateReelMp4(bytes);
  else properties = validateSrt(bytes);
  const hash = createHash('sha256').update(bytes).digest('hex');
  return { ...properties, hash, key: `social/${hash}.${kind === 'video' ? 'mp4' : 'srt'}`, type: VIDEO_TYPES[kind], size: bytes.length };
}
