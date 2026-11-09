import { createHash } from 'node:crypto';

export const hashValue = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');

export function supportedTarget(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    let provider;
    if (['jobs.lever.co', 'jobs.eu.lever.co'].includes(url.hostname)
      && /^\/[a-zA-Z0-9_-]+\/[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}(?:\/apply)?\/?$/i.test(url.pathname)) provider = 'lever';
    if (['boards.greenhouse.io', 'job-boards.greenhouse.io', 'job-boards.eu.greenhouse.io'].includes(url.hostname)
      && /^\/[a-zA-Z0-9_-]+\/jobs\/\d+\/?$/.test(url.pathname)) provider = 'greenhouse';
    if (!provider) return null;
    url.search = ''; url.hash = '';
    if (provider === 'lever') url.pathname = url.pathname.replace(/\/(?:apply)?\/?$/, '') + '/apply';
    return { provider, url: url.href };
  } catch { return null; }
}

export function submissionOutcome(text, before = '') {
  const value = String(text || '').toLowerCase();
  const refusals = [/there (?:was|is) an error/, /(?:error|failed|unable).{0,60}(?:submitting|submit|application)/,
    /(?:complete|fill|check).{0,40}required fields/, /please try again/, /application (?:was )?not submitted/];
  const refusal = refusals.find(pattern => pattern.test(value) && !pattern.test(String(before).toLowerCase()));
  if (refusal) return { status: 'blocked', reason: 'The employer form reported an error. Review it before trying again.' };
  const markers = ['thank you for applying', 'application submitted', 'application received', 'we have received your application',
    "we've received your application", 'your application has been submitted', 'your application has been received', 'application successfully submitted'];
  const marker = markers.find(item => value.includes(item) && !String(before).toLowerCase().includes(item));
  return marker ? { status: 'applied', confirmation: marker } : { status: 'unconfirmed', reason: 'Submission was attempted, but no confirmation was observed. Check the employer site or email before applying again.' };
}
