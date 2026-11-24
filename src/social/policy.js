import { createHash } from 'node:crypto';

export const PLATFORMS = ['linkedin', 'instagram'];
export const BATCH_MS = 10 * 60_000;
export const GRACE_MS = 15 * 60_000;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const socialError = (message, status = 400) => Object.assign(new Error(message), { statusCode: status });
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
export const factsDigest = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');

export function dueSocialSlot(now = new Date()) {
  const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const slot = new Date([day + 12.5 * 3600_000, day + 4.5 * 3600_000, day - 11.5 * 3600_000].find(time => time <= now.getTime()));
  return { slot, claimable: now.getTime() - slot.getTime() < GRACE_MS };
}

export function parseSocialSlot(value, now = new Date()) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) throw socialError('Choose a valid publishing date and slot.');
  const slot = new Date(value);
  if (!Number.isFinite(slot.getTime()) || slot <= now || slot - now > 30 * 86400_000 || slot.getUTCMinutes() !== 30
    || ![4, 12].includes(slot.getUTCHours()) || slot.getUTCSeconds() || slot.getUTCMilliseconds()) {
    throw socialError('Choose a future 10:00 or 18:00 IST slot within 30 days.');
  }
  return slot;
}

const text = value => typeof value === 'string' ? value.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() : '';
const factualValue = value => Array.isArray(value) ? value.map(text).filter(Boolean).join(', ') : text(value);
export function socialFacts(job) {
  return Object.fromEntries(Object.entries({
    id: String(job._id ?? job.id), title: text(job.title), company: text(job.company),
    location: factualValue(job.location || job.locations || job.city),
    jobType: text(job.jobType), experience: factualValue(job.experienceRequired),
    qualification: factualValue(job.minimumQualification), salary: factualValue(job.salary),
    sourceUrl: text(job.sourceUrl), applyUrl: text(job.applyUrl || job.applicationUrl),
    closingDate: job.closingDate ? new Date(job.closingDate).toISOString() : '',
    description: text(job.description),
  }).filter(([, value]) => value !== ''));
}

export function defaultSocialCaptions(facts, origin = 'https://www.jobverify.in') {
  const basics = [`${facts.company}: ${facts.title}`, facts.location, facts.experience && `Experience: ${facts.experience}`,
    facts.qualification && `Qualification: ${facts.qualification}`, facts.salary && `Salary: ${facts.salary}`].filter(Boolean).join('\n');
  const link = new URL(`/jobs/${facts.id}`, origin);
  link.search = new URLSearchParams({ utm_source: 'linkedin', utm_medium: 'social', utm_campaign: 'job_promotion' }).toString();
  const instagramLink = new URL(link);
  instagramLink.searchParams.set('utm_source', 'instagram');
  return { linkedin: `${basics}\n\nView details and apply: ${link.href}\n\n#Jobverify #Jobs`,
    instagram: `${basics}\n\nView details and apply: ${instagramLink.href}\n\n#Jobverify #Jobs #Careers` };
}

export function validateCaptions(captions) {
  if (!captions || PLATFORMS.some(platform => typeof captions[platform] !== 'string' || !captions[platform].trim()
    || [...captions[platform]].length > (platform === 'linkedin' ? 3000 : 2200))) throw socialError('Provide LinkedIn (up to 3000 characters) and Instagram (up to 2200 characters) captions.');
  return Object.fromEntries(PLATFORMS.map(platform => [platform, captions[platform].trim()]));
}

export function approvalDigest(post, accounts) {
  const reel = post.instagramMediaType === 'reel' ? { instagramMediaType: 'reel', videoHash: post.video?.mp4?.hash, coverHash: post.video?.cover?.hash, videoFactsHash: post.video?.factsHash, planHash: post.video?.planHash } : {};
  return factsDigest({ ...reel, factsHash: post.factsHash, imageHash: post.image?.hash, captions: post.captions,
    accounts: accounts.map(account => ({ platform: account.platform ?? account._id, destination: account.destination, revision: account.revision }))
      .sort((a, b) => a.platform.localeCompare(b.platform)) });
}

export function validateSocialJpeg(bytes, type, expectedHeight = 1350) {
  if (type?.split(';')[0] !== 'image/jpeg' || !Buffer.isBuffer(bytes) || bytes.length < 20 || bytes.length > MAX_IMAGE_BYTES
    || bytes.readUInt16BE(0) !== 0xffd8 || bytes.readUInt16BE(bytes.length - 2) !== 0xffd9) throw socialError('Upload a complete JPEG no larger than 2 MiB.');
  let offset = 2; let width; let height; let scanned = false;
  while (offset < bytes.length - 2) {
    if (bytes[offset++] !== 0xff) throw socialError('Invalid JPEG structure.');
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (offset + 2 > bytes.length) throw socialError('Invalid JPEG structure.');
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length - 2) throw socialError('Invalid JPEG segment.');
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (length < 8 || width) throw socialError('Invalid JPEG frame.');
      height = bytes.readUInt16BE(offset + 3); width = bytes.readUInt16BE(offset + 5);
    }
    if (marker === 0xda) { scanned = true; break; }
    offset += length;
  }
  if (!scanned || width !== 1080 || height !== expectedHeight) throw socialError(`The image must be a 1080 × ${expectedHeight} JPEG.`);
  const hash = createHash('sha256').update(bytes).digest('hex');
  return { hash, key: `social/${hash}.jpg`, width, height, size: bytes.length, type: 'image/jpeg' };
}
