import '../loadEnv.js';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { buildDescriptionSourceUpdate } from '../src/services/jobDescriptionPolicy.js';
import { postScrapePersistencePatch, sourceSnapshotFilter } from '../src/services/postScrapeClassification.js';
import { buildMissingSourceDescriptionFilter, getSourceDescription, hasSourceDescription } from '../src/utils/jobSourceContent.js';
import { applyPublicJobVisibility } from '../src/utils/publicJobVisibility.js';
import { normalizePublicJobCategory } from '../src/utils/publicJobNormalization.js';
import { PUBLIC_JOB_TYPES } from '../src/utils/publicJobTypeLabel.js';
import { configureMongoDns } from '../src/utils/mongoDns.js';
import { resolveJobPublicationDate } from '../src/utils/jobPublicationDate.js';
import { analyzePublishableJobs } from '../scraper-support/utils/publishableJobMetrics.js';
import { generateFingerprint } from '../scraper-support/utils/applicationIdentity.js';
import { buildJobSearchKeys } from '../src/utils/jobSearchKeys.js';
import { buildJobDerivedFields } from '../src/utils/jobDerivedFields.js';
import { formatStoredLocationLabel } from '../src/utils/jobLocations.js';

const EJSON = mongoose.mongo.BSON.EJSON;
const serialize = value => EJSON.stringify(value, { relaxed: false });
export const descriptionRepairHash = plan => createHash('sha256').update(serialize(plan)).digest('hex');
const normalized = value => String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
const MAX_AGE = 48 * 3600000;
const repairFields = new Set(['sourceDescription', 'sourceContentHash', 'sourceContentHashVersion',
  'description', 'descriptionFormat', 'descriptionRewrite', 'sourceUrl', 'postClassification', 'updatedAt']);
const supportedSources = ['lowesindia', 'viewzenlabs', 'nashtechlabs', 'cloudambassadors', 'unstop', 'scripbox', 'seclore', 'seoak', 'cognustechnology', 'coupasoftwareinc', 'sobha', 'verteiltechnologies', 'aurigo', 'hexaviewtechnologies'];
const verifiedDateFields = new Set(['postedAt', 'postedAtProvenance', 'postedAtProvenanceValue', 'sortDate', 'closingDate']);
const nativeDateSources = new Set(['unstop', 'cognustechnology', 'scripbox', 'seclore', 'coupasoftwareinc', 'sobha', 'verteiltechnologies', 'aurigo']);
const nativeIdentitySources = new Set(['aurigo', 'hexaviewtechnologies']);
const nativeIdentityFields = new Set(['applyUrl', 'link', 'fingerprint', 'jobId', 'requisitionId']);
const nativeLocationFields = new Set(['country', 'state', 'city', 'location', 'locations', 'isPublicIndia',
  'companyKey', 'cityKey', 'locationKeys', 'publicCityKey']);
const jobIdentity = job => job.source === 'unstop' ? String(job.sourceUrl || job.link || job.applyUrl || '')
  : String(job.source === 'hexaviewtechnologies' ? job.sourceLegacyIdentity?.jobId || job.jobId : job.jobId);
const validDate = value => typeof value === 'string' && value.trim() !== '' && Number.isFinite(+new Date(value));

function verifiedSourceUrl(job) {
  let url;
  try { url = new URL(job.sourceUrl); } catch { return false; }
  const darwinbox = ['scripbox', 'seclore'].includes(job.source);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.port
    || (url.search && !(darwinbox && url.search === '?from=all')
      && !(job.source === 'cognustechnology' && url.search === '?source=CareerSite')
      && !(job.source === 'verteiltechnologies' && url.search === `?job=${job.jobId}`))) return false;
  if (job.source === 'lowesindia') return job.sourceDetailComplete === true
    && /^JR-\d+$/.test(job.jobId) && url.hostname === 'talent.lowes.com'
    && url.pathname.startsWith(`/in/en/job/LOWEUS${job.jobId.replaceAll('-', '')}EXTERNALENIN/`);
  if (job.source === 'viewzenlabs') return url.href === 'https://www.viewzenlabs.com/careers'
    && job.sourceDetailComplete === false && job.sourceDetailFailureKind === 'full-description-not-published';
  if (job.source === 'cloudambassadors') return url.href === 'https://cloudambassadors.com/careers'
    && job.sourceDetailComplete === true;
  if (job.source === 'unstop') return url.hostname === 'unstop.com' && /^\/jobs\/[^/]+-unstop-\d+$/.test(url.pathname)
    && job.sourceDetailComplete === true && job.sourceDateEvidence === 'unstop-canonical-amp-jobposting-and-visible-deadline-v1'
    && job.sourceClosingDateIsExact === true && Number.isFinite(+new Date(job.postingDate)) && Number.isFinite(+new Date(job.closingDate));
  if (darwinbox) return job.sourceDetailComplete === true && /^[a-f0-9]{14}$/i.test(job.jobId)
    && job.sourceDateEvidence === 'darwinbox-native-posted-on-v1' && typeof job.postingDate === 'string'
    && Number.isFinite(+new Date(job.postingDate))
    && url.origin === `https://${job.source}.darwinbox.in`
    && url.pathname === `/ms/candidatev2/main/careers/jobDetails/${job.jobId}`;
  if (job.source === 'seoak') {
    let asset;
    try { asset = new URL(job.sourceDetailUrl); } catch { return false; }
    return url.href === 'https://www.seoak.in/careers' && job.sourceDetailComplete === true
      && asset.origin === 'https://www.seoak.in' && !asset.username && !asset.password && !asset.search && !asset.hash
      && /^\/_next\/static\/chunks\/app\/careers\/page-[a-z0-9]+\.js$/i.test(asset.pathname);
  }
  if (job.source === 'cognustechnology') return job.sourceDetailContentComplete === true
    && job.sourceDateEvidence === 'cognus-verified-native-inline-job-v1' && /^\d{17}$/.test(job.requisitionId)
    && job.jobId === `cognustechnology-${job.requisitionId}`
    && url.origin === 'https://cognustechnology.zohorecruit.in'
    && new RegExp(`^/jobs/Careers/${job.requisitionId}/[^/]+$`).test(url.pathname)
    && /^\d{4}-\d{2}-\d{2}$/.test(job.postingDate) && Number.isFinite(+new Date(job.postingDate));
  if (job.source === 'coupasoftwareinc') return job.sourceDetailComplete === true
    && job.sourceDateEvidence === 'coupa-canonical-jobposting-dates-v1' && validDate(job.postingDate)
    && /^\d+$/.test(job.jobId) && url.origin === 'https://careers.coupa.com'
    && new RegExp(`^/en/jobs/[a-f0-9-]{36}/[^/]+-${job.jobId}/$`, 'i').test(url.pathname);
  if (job.source === 'sobha') return job.sourceDetailComplete === true && job.sourceNativeRealm === 1368
    && job.nativeRequisitionStatus === 'OPEN' && /^MPR-GMW-\d{6}$/.test(job.jobId)
    && job.sourceDateEvidence === 'sobha-peoplestrong-native-detail-listing-v1' && validDate(job.postingDate)
    && url.origin === 'https://sobhalimited-careers.peoplestrong.com' && url.pathname === `/job/detail/${job.jobId}`;
  if (job.source === 'verteiltechnologies') return job.sourceDetailComplete === true && /^\d+$/.test(job.jobId)
    && job.sourceDateEvidence === 'verteil-native-job-posting-v1' && validDate(job.postingDate)
    && url.origin === 'https://recruitcareers.zappyhire.com' && url.pathname === '/en/Verteil/apply'
    && url.search === `?job=${job.jobId}`
    && job.sourceDetailUrl === `https://verteil.zappyhire-multitenant-be-prod.zappyhire.com/api/careers/jobs/${job.jobId}/`;
  if (job.source === 'aurigo') return job.sourceDetailComplete === true && /^\d+$/.test(job.jobId)
    && job.sourceDateEvidence === 'aurigo-native-posting-dates-v1' && validDate(job.postingDate)
    && job.sourceDetailEvidence === 'aurigo-native-canonical-role-microdata-v1'
    && url.origin === 'https://careers.aurigo.com' && new RegExp(`^/job/[^/]+/${job.jobId}/$`).test(url.pathname)
    && job.sourceCanonicalUrl === url.href.replace(`/${job.jobId}/`, `/${job.jobId}-en_US/`);
  if (job.source === 'hexaviewtechnologies') return job.sourceDetailComplete === true
    && job.sourceIdentityEvidence === 'hexaview-native-card-canonical-cms-binding-v1'
    && /^[a-z0-9-]+$/.test(job.requisitionId) && job.jobId.startsWith(`${job.requisitionId}-`)
    && url.origin === 'https://www.hexaviewtech.com' && url.pathname === `/job-openings/${job.requisitionId}`
    && job.applyUrl === url.href;
  if (job.source === 'nashtechlabs') return url.hostname === 'cdn.prod.website-files.com'
    && /^\/66a9e20e39727c40cabc8902\/[^/]+\.pdf$/i.test(url.pathname)
    && job.sourceDetailComplete === false && job.sourceDetailFailureKind === 'pdf-completeness-unverified';
  return false;
}

function nativeIdentityPatch(before, candidate, location = {}) {
  if (!nativeIdentitySources.has(before.source)) return {};
  if (before.source === 'hexaviewtechnologies') {
    const proof = candidate.sourceLegacyIdentity;
    if (!proof || proof.savedId !== String(before._id) || before.requisitionId !== 'undefined'
      || before.sourceUrl !== 'https://www.hexaviewtech.com/undefined' || before.applyUrl !== before.sourceUrl
      || !['undefined-noida-in', 'undefined-bangalore'].includes(before.jobId)
      || ['jobId', 'requisitionId', 'fingerprint', 'sourceUrl', 'applyUrl'].some(key => proof[key] !== before[key])
      || serialize(proof.locations) !== serialize(before.locations)
      || serialize(candidate.locations) !== serialize(before.locations)) return null;
  } else if (candidate.sourceUrl !== before.sourceUrl || candidate.applyUrl !== before.applyUrl
    || before.sourceUrl !== before.applyUrl) return null;
  const sourceUrl = before.source === 'aurigo' ? candidate.sourceCanonicalUrl : candidate.sourceUrl;
  if (before.link && before.link !== before.applyUrl) return null;
  const patch = { sourceUrl, applyUrl: sourceUrl,
    ...(before.link ? { link: sourceUrl } : {}),
    ...(before.source === 'hexaviewtechnologies' ? { jobId: candidate.jobId, requisitionId: candidate.requisitionId } : {}) };
  return { ...patch, fingerprint: generateFingerprint({ ...before, ...location, ...patch }) };
}

function assertIdentityCollisions(plan) {
  const claimed = new Set();
  for (const entry of plan.entries.filter(row => Object.hasOwn(row.update.$set, 'fingerprint'))) {
    const after = { ...entry.before, ...entry.update.$set };
    if (claimed.has(after.fingerprint) || plan.originalJobs.some(job => String(job._id) !== String(after._id)
      && (job.fingerprint === after.fingerprint || (job.source === after.source && job.jobId === after.jobId)))) {
      throw new Error('Native identity collision requires separate review');
    }
    claimed.add(after.fingerprint);
  }
}

export function buildDescriptionRepairPlan({ jobs, statuses = [], trials, siteSettings = {}, now = new Date() }) {
  if (!Array.isArray(jobs) || !Array.isArray(trials) || !trials.length || !Number.isFinite(+now)) throw new Error('Invalid repair evidence');
  const entries = [], skipped = [], sources = new Set();
  for (const trial of trials) {
    const at = new Date(trial.finishedAt);
    if (sources.has(trial.source) || !Array.isArray(trial.jobs) || trial.productionWrites !== false
      || !Number.isFinite(+at) || at > now || now - at > MAX_AGE) throw new Error('Fresh distinct read-only trials required');
    sources.add(trial.source);
    if (!supportedSources.includes(trial.source)) throw new Error('Unsupported repair source');
    if (trial.source === 'lowesindia' && (trial.inventoryEvidence?.status !== 'complete-inventory'
      || trial.inventoryEvidence?.firstParty !== true || trial.inventoryEvidence?.listingComplete !== true)) {
      throw new Error('Complete native Lowe\'s inventory required');
    }
    const listed = new Map();
    for (const candidate of trial.jobs) {
      const key = jobIdentity(candidate);
      if (listed.has(key)) throw new Error('Duplicate trial identity');
      listed.set(key, candidate);
    }
    for (const before of jobs.filter(job => job.source === trial.source)) {
      const candidate = listed.get(jobIdentity(before));
      let reason;
      const dates = {}, location = {};
      let identity = {};
      if (statuses.some(status => status.source === before.source && status.isActive === false)) reason = 'source_disabled';
      else if (hasSourceDescription(before)) reason = 'already_has_source_content';
      else if (!candidate || !hasSourceDescription(candidate)) reason = 'no_recovered_current_description';
      else if (candidate.source !== before.source || !verifiedSourceUrl(candidate)
        || normalized(candidate.title) !== normalized(before.originalTitle || before.title)
        || normalized(candidate.company) !== normalized(before.company)
        || normalized(candidate.department) !== normalized(before.department)
        || (!['lowesindia', 'cognustechnology', 'verteiltechnologies', 'hexaviewtechnologies'].includes(before.source) && candidate.sourceUrl !== before.sourceUrl)) reason = 'source_identity_conflict';
      if (!reason && before.source === 'verteiltechnologies' && candidate.sourceUrl !== before.applyUrl) reason = 'source_identity_conflict';
      if (!reason && before.source === 'cognustechnology') {
        if (normalized(candidate.city) !== normalized(before.city) || typeof candidate.country !== 'string'
          || typeof candidate.location !== 'string' || !candidate.nativeLocationEvidence
          || candidate.nativeLocationEvidence.Country !== candidate.country) reason = 'native_location_evidence_conflict';
        else Object.assign(location, { country: candidate.country, state: candidate.state ?? null, location: candidate.location,
          isPublicIndia: analyzePublishableJobs([candidate], { now }).indiaJobs.length === 1 });
      }
      if (!reason && before.source === 'aurigo' && candidate.sourceLocationEvidence === 'aurigo-native-visible-posting-location-v1') {
        if (candidate.city !== 'Bangalore' || candidate.location !== 'Bangalore, India' || candidate.country !== 'India'
          || serialize(candidate.locations) !== serialize(['Bangalore, India'])) reason = 'native_location_evidence_conflict';
        else Object.assign(location, { city: candidate.city, country: candidate.country,
          location: formatStoredLocationLabel(candidate), locations: candidate.locations });
      }
      if (!reason && Object.keys(location).length) {
        const corrected = { ...before, ...location };
        Object.assign(location, buildJobSearchKeys(corrected));
        const derived = buildJobDerivedFields(corrected);
        Object.assign(location, { isPublicIndia: derived.isPublicIndia, publicCityKey: derived.publicCityKey });
      }
      if (!reason && nativeIdentitySources.has(before.source)) {
        identity = nativeIdentityPatch(before, candidate, location);
        if (!identity) reason = 'native_identity_evidence_conflict';
      }
      if (!reason && nativeDateSources.has(before.source)) {
        const prior = resolveJobPublicationDate(before), native = resolveJobPublicationDate(candidate);
        if (native.provenance !== 'source' || !native.date) reason = 'missing_verified_source_date';
        else if (prior.provenance === 'source' && +prior.date !== +native.date) reason = 'existing_source_date_conflict';
        else {
          if (validDate(candidate.closingDate) && (candidate.sourceClosingDateIsExact === true
            || (candidate.sourceClosingDateIsExact === false && candidate.sourceDatePrecision === 'day'))) {
            dates.closingDate = new Date(candidate.closingDate);
            if (candidate.sourceClosingDateIsExact === false) dates.closingDate.setUTCHours(24, 0, 0, 0);
          }
          if (prior.provenance === 'observation') Object.assign(dates, { postedAt: native.date,
            postedAtProvenance: 'source', postedAtProvenanceValue: native.date.toISOString(), sortDate: native.date });
        }
      }
      if (reason) { skipped.push({ source: before.source, jobId: before.jobId, reason }); continue; }
      const sourceDescription = getSourceDescription(candidate);
      if (sourceDescription.length > 250000) throw new Error('Oversized repair description');
      const source = buildDescriptionSourceUpdate({ ...before, sourceDescription }, before, { mode: 'off', now });
      const updated = { ...before, ...source, ...dates, ...location, sourceUrl: candidate.sourceUrl, ...identity };
      const classification = postScrapePersistencePatch(updated, before, {
        now, mode: before.postClassification?.mode === 'policy' ? 'policy' : 'shadow',
      });
      const classified = { ...updated, ...classification.set };
      for (const field of Object.keys(classification.unset)) delete classified[field];
      const publicCategory = normalizePublicJobCategory(classified);
      const categoryVisible = PUBLIC_JOB_TYPES.includes(publicCategory)
        && !(siteSettings.experiencedJobsEnabled === false && publicCategory === 'Full-time Experienced');
      const expectedVisible = categoryVisible && (!nativeDateSources.has(before.source) || (updated.isPublicIndia === true && updated.status === 'active'
        && (!resolveJobPublicationDate(updated).date || resolveJobPublicationDate(updated).date <= now)
        && analyzePublishableJobs([{ ...updated, sourceClosingDateIsExact: true }], { now }).eligibleJobs.length === 1));
      entries.push({ source: before.source, jobId: before.jobId, before, expectedVisible,
        filter: { $and: [sourceSnapshotFilter(before), { source: before.source, jobId: before.jobId,
          company: before.company, department: before.department ?? null, updatedAt: before.updatedAt ?? null,
          fingerprint: before.fingerprint ?? null, applyUrl: before.applyUrl ?? null, sourceUrl: before.sourceUrl ?? null,
          requisitionId: before.requisitionId ?? null, locations: before.locations ?? null,
          closingDate: before.closingDate ?? null, country: before.country ?? null, state: before.state ?? null,
          location: before.location ?? null, isPublicIndia: before.isPublicIndia ?? null }, buildMissingSourceDescriptionFilter()] },
        update: { $set: { ...source, ...dates, ...location, sourceUrl: candidate.sourceUrl, ...identity, ...classification.set, updatedAt: now },
          ...(Object.keys(classification.unset).length ? { $unset: classification.unset } : {}) },
      });
    }
  }
  if (new Set(entries.map(entry => String(entry.before._id))).size !== entries.length) throw new Error('Duplicate stored identity');
  const plan = { schemaVersion: 1, generatedAt: now, productionWrites: false, siteSettings,
    trialEvidence: trials.map(trial => ({ source: trial.source, finishedAt: trial.finishedAt,
      hash: createHash('sha256').update(JSON.stringify(trial)).digest('hex') })),
    originalJobs: jobs, entries, skipped };
  assertIdentityCollisions(plan);
  return plan;
}

const operations = plan => plan.entries.map(entry => ({ updateOne: { filter: entry.filter, update: entry.update, upsert: false } }));

function validatePlanShape(plan, now = new Date()) {
  if (plan.schemaVersion !== 1 || plan.productionWrites !== false || !plan.entries?.length
    || !Number.isFinite(+new Date(plan.generatedAt)) || new Date(plan.generatedAt) > now
    || now - new Date(plan.generatedAt) > MAX_AGE) throw new Error('Fresh nonempty repair plan required');
  for (const entry of plan.entries) {
    if (!supportedSources.includes(entry.source)
      || Object.keys(entry.update.$set).some(key => !repairFields.has(key)
        && !(nativeDateSources.has(entry.source) && verifiedDateFields.has(key))
        && !(nativeIdentitySources.has(entry.source) && nativeIdentityFields.has(key))
        && !(['cognustechnology', 'aurigo'].includes(entry.source) && nativeLocationFields.has(key)))
      || Object.keys(entry.update.$unset || {}).some(key => key !== 'classification')
      || !hasSourceDescription(entry.update.$set)) throw new Error('Unsupported repair operation');
    if (Object.hasOwn(entry.update.$set, 'postedAt') && resolveJobPublicationDate(entry.before).provenance !== 'observation') {
      throw new Error('Existing employer publication dates cannot be overwritten');
    }
    if (Object.hasOwn(entry.update.$set, 'fingerprint')
      && entry.update.$set.fingerprint !== generateFingerprint({ ...entry.before, ...entry.update.$set })) {
      throw new Error('Native identity fingerprint does not match its application');
    }
  }
  assertIdentityCollisions(plan);
}

export async function validateDescriptionRepairPlan(plan) {
  validatePlanShape(plan);
  if (mongoose.connection.readyState !== 0) throw new Error('Validation requires a disconnected process');
  const mongo = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' }, binary: {
    version: '8.2.6', ...(process.env.MONGOMS_SYSTEM_BINARY ? { systemBinary: process.env.MONGOMS_SYSTEM_BINARY } : {}),
  } });
  try {
    await mongoose.connect(mongo.getUri(), { autoIndex: false, autoCreate: false });
    const collection = mongoose.connection.db.collection('jobs');
    const sentinel = { _id: new mongoose.Types.ObjectId(), source: 'unrelated-sentinel', status: 'private', title: 'Preserve me' };
    await collection.insertMany([...plan.originalJobs, sentinel]);
    await collection.createIndex({ fingerprint: 1 }, { unique: true, sparse: true });
    const ids = plan.entries.map(entry => entry.before._id);
    const query = applyPublicJobVisibility({ _id: { $in: ids }, status: 'active' }, plan.siteSettings, new Date(plan.generatedAt));
    const visibleBefore = await collection.countDocuments(query);
    const result = await collection.bulkWrite(operations(plan), { ordered: true });
    assert.equal(result.matchedCount, plan.entries.length);
    assert.equal(result.modifiedCount, plan.entries.length);
    assert.equal(visibleBefore, 0);
    const visibleAfter = await collection.find(query, { projection: { _id: 1 } }).toArray();
    const expectedVisibleIds = plan.entries.filter(entry => entry.expectedVisible !== false).map(entry => String(entry.before._id)).sort();
    assert.deepEqual(visibleAfter.map(job => String(job._id)).sort(), expectedVisibleIds);
    assert.equal(await collection.countDocuments({}), plan.originalJobs.length + 1);
    assert.equal(serialize(await collection.findOne({ _id: sentinel._id })), serialize(sentinel));
    for (const entry of plan.entries) {
      const expected = { ...entry.before, ...entry.update.$set };
      for (const key of Object.keys(entry.update.$unset || {})) delete expected[key];
      assert.deepEqual(await collection.findOne({ _id: entry.before._id }), expected);
    }
    const repeat = await collection.bulkWrite(operations(plan));
    assert.equal(repeat.matchedCount, 0);
    const first = plan.entries[0];
    await collection.deleteOne({ _id: first.before._id });
    await collection.insertOne(first.before);
    await collection.updateOne({ _id: first.before._id }, { $set: { description: 'Concurrent source content' } });
    assert.equal((await collection.updateOne(first.filter, first.update)).matchedCount, 0);
    return { passed: true, environment: 'temporary-local-mongodb', productionWrites: false,
      planHash: descriptionRepairHash(plan), testedAt: new Date().toISOString(),
      jobsRepaired: plan.entries.length, visibleBefore, visibleAfter: visibleAfter.length,
      correctlyPrivateAfter: plan.entries.length - visibleAfter.length,
      observationDatesCorrected: plan.entries.filter(entry => Object.hasOwn(entry.update.$set, 'postedAt')).length,
      applicationIdentitiesCorrected: plan.entries.filter(entry => Object.hasOwn(entry.update.$set, 'fingerprint')).length,
      idempotent: true, concurrentChangesProtected: true, employerPostingDatesPreserved: true, recordIdsPreserved: true,
      identitiesPreserved: plan.entries.every(entry => !Object.hasOwn(entry.update.$set, 'fingerprint')),
      unrelatedRecordsPreserved: true };
  } finally {
    await mongoose.disconnect();
    await mongo.stop();
  }
}

export async function applyDescriptionRepairPlan(plan, validation, { onProgress = async () => {} } = {}) {
  validatePlanShape(plan);
  if (validation?.passed !== true || validation?.environment !== 'temporary-local-mongodb'
    || validation.planHash !== descriptionRepairHash(plan)) throw new Error('Matching successful local validation required');
  if (mongoose.connection.readyState !== 0 || !process.env.MONGO_URI) throw new Error('A fresh configured connection is required');
  const progress = { startedAt: new Date().toISOString(), mode: 'guarded-source-content-repair',
    planHash: validation.planHash, completed: false, rows: [] };
  try {
    configureMongoDns();
    await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false,
      serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000 });
    const db = mongoose.connection.db;
    const rekeys = plan.entries.filter(entry => Object.hasOwn(entry.update.$set, 'fingerprint'));
    if (rekeys.length) {
      const indexes = await db.collection('jobs').indexes();
      if (!indexes.some(index => index.unique === true && Object.keys(index.key).length === 1 && index.key.fingerprint === 1)) {
        throw new Error('Existing unique application identity index required');
      }
      for (const entry of rekeys) {
        const after = { ...entry.before, ...entry.update.$set };
        if (await db.collection('jobs').findOne({ _id: { $ne: after._id }, $or: [
          { fingerprint: after.fingerprint }, { source: after.source, jobId: after.jobId },
        ] }, { projection: { _id: 1 } })) throw new Error('Native identity collision requires separate review');
      }
    }
    const sources = [...new Set(plan.entries.map(entry => entry.source))];
    const disabled = await db.collection('scraperstatuses').find({ source: { $in: sources }, isActive: false }).toArray();
    if (disabled.length) throw new Error('A selected source is disabled');
    const settings = await db.collection('sitesettings').findOne({ _id: 'global' });
    if ((settings?.experiencedJobsEnabled !== false) !== (plan.siteSettings.experiencedJobsEnabled !== false)) throw new Error('Public settings changed after validation');
    await onProgress(progress);
    for (const source of sources) {
      const subset = { ...plan, entries: plan.entries.filter(entry => entry.source === source) };
      const result = await db.collection('jobs').bulkWrite(operations(subset), { ordered: true });
      const ids = subset.entries.map(entry => entry.before._id);
      const visible = await db.collection('jobs').countDocuments(applyPublicJobVisibility({ _id: { $in: ids }, status: 'active' }, settings || {}, new Date()));
      const expectedVisible = subset.entries.filter(entry => entry.expectedVisible !== false).length;
      progress.rows.push({ source, planned: ids.length, matched: result.matchedCount,
        modified: result.modifiedCount, concurrentConflicts: ids.length - result.matchedCount, visible, expectedVisible,
        correctlyPrivate: ids.length - visible, visibilityMatchesValidation: visible === expectedVisible });
      await onProgress(progress);
      if (result.matchedCount === ids.length && visible !== expectedVisible) throw new Error('Publication outcome differs from local validation');
    }
    const { refreshJobDatasetSummary } = await import('../src/services/jobDatasetSummaryService.js');
    await refreshJobDatasetSummary();
    progress.summaryRefreshed = true;
    progress.completed = true;
  } catch {
    progress.errorKind = 'repair_stopped_review_progress_before_retry';
  } finally {
    progress.finishedAt = new Date().toISOString();
    await onProgress(progress);
    await mongoose.disconnect();
  }
  return progress;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const option = name => { const index = args.indexOf(name); return index < 0 ? null : args[index + 1]; };
  const read = async file => EJSON.parse(await fs.readFile(path.resolve(file), 'utf8'));
  if (args.includes('--apply')) {
    const file = path.resolve(option('--plan'));
    const plan = await read(file);
    const validation = JSON.parse(await fs.readFile(file + '.validation.json', 'utf8'));
    const destination = path.resolve(option('--output') || file + '.result.json');
    const report = await applyDescriptionRepairPlan(plan, validation, {
      onProgress: progress => fs.writeFile(destination, JSON.stringify(progress, null, 2) + '\n'),
    });
    console.log(JSON.stringify(report));
    if (!report.completed) process.exitCode = 1;
  } else {
    const backup = await read(option('--backup'));
    const trials = await Promise.all(option('--trials').split(',').map(read));
    const settings = option('--settings') ? JSON.parse(await fs.readFile(path.resolve(option('--settings')), 'utf8')).siteSettings : {};
    const plan = buildDescriptionRepairPlan({ ...backup, trials, siteSettings: settings });
    const validation = await validateDescriptionRepairPlan(plan);
    const destination = path.resolve(option('--output'));
    await fs.writeFile(destination, serialize(plan) + '\n');
    await fs.writeFile(destination + '.validation.json', JSON.stringify(validation, null, 2) + '\n');
    console.log(JSON.stringify({ ...validation, sources: [...new Set(plan.entries.map(entry => entry.source))], skipped: plan.skipped.length }));
  }
}
