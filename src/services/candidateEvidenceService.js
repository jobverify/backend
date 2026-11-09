import { createHash } from 'node:crypto';
import mongoose, { Types, isObjectIdOrHexString } from 'mongoose';
import CandidateEvidence from '../models/CandidateEvidence.js';
import Job from '../models/Job.js';
import User from '../models/User.js';
import { applyPublicJobVisibility } from '../utils/publicJobVisibility.js';

const EXPERIENCE_KEYS = ['kind', 'company', 'role', 'startDate', 'endDate', 'current', 'summary', 'skills'];
const ACHIEVEMENT_KEYS = ['experienceId', 'claim', 'context', 'metrics', 'skills', 'sourceRef', 'confirmed'];
const MAX_EXPERIENCES = 50;
const MAX_ACHIEVEMENTS = 200;
const MATCH_SCAN_LIMIT = 200;
const skillKey = value => String(value).normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
const uniqueSkills = values => [...new Map(values.map(value => [skillKey(value), value])).values()];

function evidenceError(status, message, code = 'INVALID_EVIDENCE', currentVersion) {
  return Object.assign(new Error(message), { status, code, ...(currentVersion === undefined ? {} : { currentVersion }) });
}
const invalid = message => { throw evidenceError(400, message); };
const conflict = version => evidenceError(409, 'Your evidence changed in another window. Reload the latest evidence before saving again.', 'EVIDENCE_VERSION_CONFLICT', version);

function text(value, name, limit, required = false) {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || value.length > limit) invalid(`${name} must be text of ${limit} characters or fewer.`);
  const normalized = value.trim();
  if (required && !normalized) invalid(`${name} is required.`);
  return normalized;
}

function readSkills(value = []) {
  if (!Array.isArray(value) || value.length > 30) invalid('Use up to 30 skills per entry.');
  const result = []; const seen = new Set();
  for (const skill of value) {
    const normalized = text(skill, 'Each skill', 80, true).replace(/\s+/g, ' ');
    if (!seen.has(skillKey(normalized))) { seen.add(skillKey(normalized)); result.push(normalized); }
  }
  return result;
}

function date(value, name) {
  const result = text(value, name, 10);
  if (!result) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(`${result}T00:00:00Z`))
    || new Date(`${result}T00:00:00Z`).toISOString().slice(0, 10) !== result) invalid(`${name} must be a valid calendar date.`);
  return result;
}

function readExperience(body) {
  if (!['job', 'project'].includes(body.kind)) invalid('Choose job or project for the experience type.');
  if (body.current !== undefined && typeof body.current !== 'boolean') invalid('Current experience must be true or false.');
  const startDate = date(body.startDate, 'Start date'); const endDate = date(body.endDate, 'End date');
  if (startDate && endDate && endDate < startDate) invalid('End date must be on or after the start date.');
  if (body.current && endDate) invalid('A current experience cannot have an end date.');
  return { kind: body.kind, company: text(body.company, 'Company or project organization', 160), role: text(body.role, 'Role or project name', 160, true),
    startDate, endDate, current: body.current === true, summary: text(body.summary, 'Summary', 2000), skills: readSkills(body.skills) };
}

function readAchievement(body, bank, previous) {
  const experienceId = body.experienceId === '' || body.experienceId == null ? null : body.experienceId;
  if (experienceId !== null && (typeof experienceId !== 'string' || !bank.experiences.some(row => row.id === experienceId))) invalid('Choose an experience from your evidence bank.');
  if (body.confirmed !== undefined && typeof body.confirmed !== 'boolean') invalid('Confirmation must be true or false.');
  return { experienceId, claim: text(body.claim, 'Achievement', 800, true), context: text(body.context, 'Context', 1500),
    metrics: text(body.metrics, 'Results or metrics', 500), skills: readSkills(body.skills), sourceRef: text(body.sourceRef, 'Source reference', 500),
    provenance: previous?.provenance || 'manual',
    confirmed: previous?.provenance === 'agent_inferred' ? body.confirmed ?? previous.confirmed : true };
}

const toExperience = row => ({ id: String(row.id), kind: row.kind, company: row.company || '', role: row.role,
  startDate: row.startDate || '', endDate: row.endDate || '', current: row.current === true, summary: row.summary || '', skills: row.skills || [] });
const toAchievement = row => ({ id: String(row.id), experienceId: row.experienceId ? String(row.experienceId) : null,
  claim: row.claim, context: row.context || '', metrics: row.metrics || '', skills: row.skills || [], provenance: row.provenance,
  sourceRef: row.sourceRef || '', confirmed: row.confirmed === true });

function publicBank(bank) {
  const experiences = (bank?.experiences || []).map(toExperience);
  const achievements = (bank?.achievements || []).map(toAchievement);
  // Hash all editable content, including pending suggestions. Timestamps/fences do
  // not change it; absent and persisted empty banks have the same stable hash.
  const hash = createHash('sha256').update(JSON.stringify({ experiences, achievements })).digest('hex');
  return { version: bank?.version || 0, hash, experiences, achievements };
}

export async function getCandidateEvidence(userId, { session } = {}) {
  return publicBank(await CandidateEvidence.findById(userId).session(session || null).lean());
}

export async function getCandidateEvidenceSnapshot(userId, { session } = {}) {
  const bank = await getCandidateEvidence(userId, { session });
  const achievements = bank.achievements.filter(row => row.provenance !== 'agent_inferred' || row.confirmed);
  return { ...bank, achievements, skills: uniqueSkills([...bank.experiences.flatMap(row => row.skills), ...achievements.flatMap(row => row.skills)]) };
}

// A snapshot read alone does not prevent a concurrent edit between generation
// and commit. This write must share the CV/revision publication transaction.
export async function lockCandidateEvidenceSnapshot(userId, expected, { session } = {}) {
  if (!session?.inTransaction()) throw new Error('Evidence publication requires an active transaction.');
  const actual = await getCandidateEvidenceSnapshot(userId, { session });
  if (actual.version !== expected?.version || actual.hash !== expected?.hash) throw conflict(actual.version);
  try {
    const result = await CandidateEvidence.findOneAndUpdate({ _id: userId, version: expected.version }, {
      $inc: { generationFence: 1 },
      $setOnInsert: { user: userId, version: 0, experiences: [], achievements: [] },
    }, { new: true, upsert: expected.version === 0, session, setDefaultsOnInsert: false }).lean();
    if (!result) throw conflict(actual.version);
  } catch (error) {
    if (error.code === 11000) throw conflict(actual.version);
    throw error;
  }
  return actual;
}

export async function mutateCandidateEvidence(userId, { collection, action, id, body }, { session, sessionVersion } = {}) {
  if (!['experiences', 'achievements'].includes(collection) || !['create', 'update', 'delete'].includes(action)) invalid('Unknown evidence action.');
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('Provide an evidence entry and its version.');
  if (!Number.isSafeInteger(body.version) || body.version < 0) invalid('A non-negative evidence version is required. Reload your evidence and retry.');
  const allowed = ['version', ...(action === 'delete' ? [] : collection === 'experiences' ? EXPERIENCE_KEYS : ACHIEVEMENT_KEYS)];
  if (Object.keys(body).some(key => !allowed.includes(key))) invalid('This request includes unsupported evidence fields.');
  if (action !== 'create' && !isObjectIdOrHexString(id)) invalid('Choose a valid evidence entry.');
  if (!session) return mongoose.connection.transaction(activeSession => mutateCandidateEvidence(userId, { collection, action, id, body }, { session: activeSession, sessionVersion }));
  if (!session.inTransaction()) throw new Error('Evidence edits require an active transaction.');
  // Account cleanup marks the User before deleting its evidence. Sharing this
  // write fence prevents a previously authorized request from recreating facts
  // after cleanup, and rejects writes from a session revoked in the meantime.
  const sessionFilter = sessionVersion === undefined ? {} : sessionVersion === 0
    ? { $or: [{ sessionVersion: 0 }, { sessionVersion: { $exists: false } }, { sessionVersion: null }] } : { sessionVersion };
  const owner = await User.updateOne({ _id: userId, deactivated: { $ne: true }, accountDeletingAt: null,
    ...sessionFilter }, { $inc: { __v: 1 } }, { session });
  if (!owner.matchedCount) throw evidenceError(401, 'Your account or session is no longer active. Please sign in again.', 'EVIDENCE_ACCOUNT_UNAVAILABLE');
  const existing = await CandidateEvidence.findById(userId).session(session || null).lean();
  const bank = publicBank(existing);
  if (body.version !== bank.version) throw conflict(bank.version);
  const index = bank[collection].findIndex(row => row.id === id);
  if (action !== 'create' && index < 0) throw evidenceError(404, 'This evidence entry was not found.', 'EVIDENCE_NOT_FOUND');
  if (action === 'delete') {
    bank[collection].splice(index, 1);
    // Preserve facts when their associated job/project is removed.
    if (collection === 'experiences') bank.achievements = bank.achievements.map(row => row.experienceId === id ? { ...row, experienceId: null } : row);
  } else {
    const values = collection === 'experiences' ? readExperience(body) : readAchievement(body, bank, bank[collection][index]);
    if (action === 'create') {
      const limit = collection === 'experiences' ? MAX_EXPERIENCES : MAX_ACHIEVEMENTS;
      if (bank[collection].length >= limit) invalid(`Keep up to ${limit} ${collection} in your evidence bank.`);
      bank[collection].push({ id: String(new Types.ObjectId()), ...values });
    } else bank[collection][index] = { id, ...values };
  }
  try {
    if (!existing) {
      const [created] = await CandidateEvidence.create([{ _id: userId, user: userId, version: 1, experiences: bank.experiences, achievements: bank.achievements }], { session });
      return publicBank(created.toObject());
    }
    const updated = await CandidateEvidence.findOneAndUpdate({ _id: userId, version: body.version }, {
      $set: { experiences: bank.experiences, achievements: bank.achievements }, $inc: { version: 1 },
    }, { new: true, runValidators: true, session }).lean();
    if (updated) return publicBank(updated);
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  const latest = await CandidateEvidence.findById(userId).session(session || null).select('version').lean();
  throw conflict(latest?.version || 0);
}

function explainMatch(job, snapshot) {
  // Match literal structured skill names. Avoid claiming semantic similarity,
  // job suitability or unverified proficiency from an opaque model score.
  const requirements = uniqueSkills([...(job.requiredSkills || []), ...(job.jobSkills || []).map(skill => skill.canonicalName)].filter(value => typeof value === 'string' && value.trim()).slice(0, 100));
  const available = new Set(snapshot.skills.map(skillKey));
  const matchedSkills = requirements.filter(skill => available.has(skillKey(skill)));
  if (!matchedSkills.length) return null;
  const evidence = matchedSkills.map(skill => ({ skill,
    sources: [
      ...snapshot.experiences.filter(row => row.skills.some(value => skillKey(value) === skillKey(skill))).map(row => ({ experienceId: row.id, achievementId: null, label: row.role, claim: null, provenance: 'manual' })),
      ...snapshot.achievements.filter(row => row.skills.some(value => skillKey(value) === skillKey(skill))).map(row => ({ experienceId: row.experienceId, achievementId: row.id, label: row.claim, claim: row.claim, provenance: row.provenance })),
    ],
  }));
  const sources = evidence.flatMap(item => item.sources.map(source => ({ skill: item.skill, ...source })));
  return { job: { id: String(job._id), title: job.title, company: job.company, location: job.location || job.city || '' }, matchedSkills,
    missingSkills: requirements.filter(skill => !available.has(skillKey(skill))), listedSkillCount: requirements.length,
    evidence: sources.slice(0, 12), evidenceCount: sources.length };
}

export async function matchCandidateEvidenceJobs(userId, { limit = 10, siteSettings = {}, now = new Date() } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) invalid('Choose a match limit from 1 to 20.');
  const snapshot = await getCandidateEvidenceSnapshot(userId);
  const base = { evidenceVersion: snapshot.version, evidenceHash: snapshot.hash, method: 'exact_skill_evidence', scanLimit: MATCH_SCAN_LIMIT };
  if (!snapshot.skills.length) return { ...base, scannedJobs: 0, matches: [] };
  const jobs = await Job.find(applyPublicJobVisibility({ status: 'active' }, siteSettings, now))
    .sort({ sortDate: -1, _id: -1 }).limit(MATCH_SCAN_LIMIT)
    .select('title company location city requiredSkills jobSkills').maxTimeMS(5000).lean();
  const matches = jobs.map(job => explainMatch(job, snapshot)).filter(Boolean)
    .sort((a, b) => b.matchedSkills.length - a.matchedSkills.length || a.missingSkills.length - b.missingSkills.length || a.job.id.localeCompare(b.job.id)).slice(0, limit);
  return { ...base, scannedJobs: jobs.length, matches };
}
