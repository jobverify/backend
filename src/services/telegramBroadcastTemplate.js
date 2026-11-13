import { normalizePublicJobCategory } from '../utils/publicJobNormalization.js';
import { normalizePublicWorkArrangement } from '../utils/publicWorkArrangement.js';
import { telegramJobLink } from './jobAlertService.js';
import { formatBatchEligibility } from '../utils/jobBatchEligibility.js';

export const BROADCAST_TOKENS = [
  ['company', 'Company'], ['title', 'Job title'], ['jobType', 'Job type'], ['location', 'Location'],
  ['batch', 'Graduation years (estimates marked)'], ['experience', 'Source-stated experience'], ['workMode', 'Work mode'],
  ['skills', 'Required skills'], ['salary', 'Source-stated salary'], ['jobUrl', 'Application link'],
].map(([name, label]) => ({ name, label }));

export const DEFAULT_BROADCAST_TEMPLATE = [
  '📌 {company} is hiring {title}', '',
  '🎓 Batch :- {batch}', '⚙️ Type :- {jobType}', '📍 Location :- {location}', '', '👔 Job link', '{jobUrl}', '',
  'Follow Jobverify 📈 channel for more jobs', 'http://bit.ly/4aATqJE', 'https://t.me/jobverifychannel', '',
  'Join Jobverify 📈 Group for discussion', 'https://bit.ly/4kI5HAJ', 'https://t.me/jobverifygroup',
].join('\n');

export const BROADCAST_SAMPLE_JOBS = {
  complete: { title: 'Software Engineer', company: 'Example Company', jobType: 'Full-time Fresher',
    city: 'Bangalore', workArrangement: 'Hybrid', eligibleBatches: [2026], eligibleBatchesProvenance: 'source',
    requiredSkills: ['Java', 'SQL'], salary: '₹6–8 LPA', sourceUrl: 'https://example.test/jobs/sample',
    experienceProfile: { hasExplicitExperience: true, minimumYears: 0, maximumYears: 1 } },
  minimal: { title: 'Software Engineer', company: 'Example Company', sourceUrl: 'https://example.test/jobs/sample' },
};

const TOKEN = /\{([A-Za-z][A-Za-z0-9]*)\}/g;
const limits = { company: 100, title: 160, jobType: 60, location: 100, batch: 100, experience: 100,
  workMode: 60, skills: 240, salary: 160, jobUrl: 400 };
const invalid = message => Object.assign(new Error(message), { status: 400 });
const clean = (value, max) => {
  const text = String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^(?:unspecified|unknown|not (?:specified|available|disclosed)|n\/a|na)$/i.test(text)) return '';
  if (text.length <= max) return text;
  return text.slice(0, max - 1).replace(/[\uD800-\uDBFF]$/u, '') + '…';
};

export function validateBroadcastTemplate(template) {
  if (typeof template !== 'string' || !template.trim() || template.length > 3000
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(template)) throw invalid('Provide a message template of 1–3000 characters.');
  const names = [...template.matchAll(TOKEN)].map(match => match[1]);
  if (/[{}]/.test(template.replace(TOKEN, ''))) throw invalid('Use single-brace placeholders such as {title}.');
  const unknown = names.find(name => !Object.hasOwn(limits, name));
  if (unknown) throw invalid(`Unsupported placeholder: {${unknown}}.`);
  if (!names.includes('jobUrl')) throw invalid('Include {jobUrl} so every alert has an application link.');
  if (template.replace(TOKEN, (_match, name) => 'x'.repeat(limits[name])).length > 4096) {
    throw invalid('The expanded template could exceed Telegram’s 4096-character limit. Shorten it.');
  }
  return template.replace(/\r\n/g, '\n').trim();
}

function valuesFor(job) {
  const category = normalizePublicJobCategory(job);
  const batches = ['source', 'inferred'].includes(job.eligibleBatchesProvenance)
    ? formatBatchEligibility(job, { markEstimate: true }) : '';
  const profile = job.experienceProfile;
  const min = profile?.minimumYears; const max = profile?.maximumYears;
  let experience = '';
  if (profile?.hasExplicitExperience === true && Number.isFinite(min) && min >= 0 && min <= 40) {
    experience = Number.isFinite(max) && max >= min && max <= 40 && max !== min ? `${min}–${max} years` : `${min}${profile.isOpenEnded ? '+' : ''} years`;
  }
  const raw = { company: job.company, title: job.title, jobType: /^full[ -]time/i.test(category) ? 'Full time' : category,
    location: job.city || job.location, batch: batches, experience,
    workMode: job.sourceRemoteStatusUnresolved === true ? normalizePublicWorkArrangement(job.workArrangement, job) : job.workArrangement,
    skills: Array.isArray(job.requiredSkills) ? job.requiredSkills.join(', ') : '', salary: job.salary,
    jobUrl: telegramJobLink(job) };
  return Object.fromEntries(Object.entries(raw).map(([name, value]) => [name, clean(value, limits[name])]));
}

export function renderBroadcastTemplate(template, job) {
  const source = validateBroadcastTemplate(template);
  const values = valuesFor(job);
  let text = source.split('\n').flatMap(line => {
    const names = [...line.matchAll(TOKEN)].map(match => match[1]);
    if (names.some(name => !values[name])) return [];
    return [line.replace(TOKEN, (_match, name) => values[name]).trimEnd()];
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  // Optional metadata may share a line with the required link. Preserve the
  // application URL even when dropping that incomplete metadata line.
  if (!text.includes(values.jobUrl)) text = [text, values.jobUrl].filter(Boolean).join('\n');
  if (text.length > 4096) throw invalid('The rendered message exceeds Telegram’s 4096-character limit.');
  return text;
}
