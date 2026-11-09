import assert from 'node:assert/strict'
import test from 'node:test'
import mongoose from 'mongoose'

import Job from '../../src/models/Job.js'
import { createAppventurezScraper } from '../../scraper/appventurez/script.js'
import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'
import { generateFingerprint, saveToDB } from '../utils/saveToDB.js'
import { enrichJobsWithPublicExperience } from '../utils/publicExperienceEnrichment.js'
import { buildDescriptionSourceUpdate } from '../../src/services/jobDescriptionPolicy.js'
import { postScrapeInput } from '../../src/services/postScrapeClassification.js'
import { formatStoredLocationLabel } from '../../src/utils/jobLocations.js'

const now = new Date('2026-11-07T12:00:00.000Z')
const sourceUrl = 'https://www.appventurez.com/careers#ui-ux-designer-noida'
const employerDescription = 'Design accessible customer interfaces and validate prototypes with users. A design degree is required; experience with mobile applications is preferred.'
const careersHtml = `
  <h2>Current Openings</h2>
  <div class="grayBackOpenJobs">
    <h3>UI/UX Designer</h3><p>Experience : 3-6 Years</p>
    <p>Location : Noida</p><a href="#career_form">Apply Now</a>
  </div>
  <div id="career_form"></div>
  <p>jobs@appventurez.com careers@appventurez.com</p>
`

const partialCard = (experience = '3-6 Years') => ({
  title: 'UI/UX Designer', company: 'Appventurez', city: 'Noida',
  location: 'Noida, India', country: 'India', source: 'appventurez',
  sourceUrl, applyUrl: null, link: sourceUrl,
  jobId: 'ui-ux-designer-noida', requisitionId: 'ui-ux-designer-noida',
  sourceDescription: null, jobDescription: null,
  sourceExperienceRequired: experience, experienceRequired: experience,
  experienceRequiredProvenance: 'source', publicExperienceChecked: true,
  preserveExistingSourceDescription: true, employmentType: null,
  remoteStatus: null, scrapedAt: now.toISOString(),
})

const priorRole = (experience = '1-2 Years') => {
  const normalized = normalizeScrapedJob({
    ...partialCard(experience), preserveExistingSourceDescription: false,
    sourceDescription: employerDescription, jobDescription: employerDescription,
    sourceEmploymentType: 'Permanent', employmentType: 'Full-time',
    minimumQualification: 'Bachelor of Design',
    preferredQualification: 'Human-computer interaction coursework preferred',
    requiredSkills: ['Figma'], salary: 'INR 1200000 per year',
    eligibleBatches: [2024], eligibleBatchesProvenance: 'source',
  }, { source: 'appventurez' })
  normalized.location = formatStoredLocationLabel(normalized)
  const description = buildDescriptionSourceUpdate(normalized, null, { mode: 'publish', now })
  const prior = {
    ...normalized, ...description, _id: new mongoose.Types.ObjectId(),
    fingerprint: generateFingerprint(normalized), status: 'active',
    description: '<p>Previously published employer description.</p>', descriptionFormat: 'html',
    descriptionRewrite: { status: 'completed', inputHash: description.sourceContentHash },
  }
  prior.postClassification = {
    inputHash: postScrapeInput(prior, { now }).inputHash,
    mode: 'shadow', status: 'completed', result: {},
  }
  return prior
}

const persistWithStubs = async (t, incoming, prior = null, enrichment = {}) => {
  assert.equal(mongoose.connection.readyState, 0, 'Never reuse an application database connection')
  assert.equal(mongoose.connection.db, undefined)
  const descriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState')
  Object.defineProperty(mongoose.connection, 'readyState', { configurable: true, value: 1 })
  const previousMode = process.env.POST_SCRAPE_CLASSIFICATION_MODE
  process.env.POST_SCRAPE_CLASSIFICATION_MODE = 'shadow'
  t.after(() => {
    if (descriptor) Object.defineProperty(mongoose.connection, 'readyState', descriptor)
    else delete mongoose.connection.readyState
    if (previousMode === undefined) delete process.env.POST_SCRAPE_CLASSIFICATION_MODE
    else process.env.POST_SCRAPE_CLASSIFICATION_MODE = previousMode
  })
  t.mock.method(mongoose, 'connect', () => assert.fail('Database connections are forbidden in these fixtures'))
  t.mock.method(globalThis, 'fetch', () => assert.fail('External requests are forbidden in these fixtures'))
  t.mock.method(Job, 'find', () => ({
    fields: [],
    select(value) { this.fields = value.split(/\s+/); return this },
    lean() { return this },
    async exec() {
      if (!prior) return []
      // Honor the actual persistence projection so omitted retained fields fail.
      return [{ _id: prior._id, ...Object.fromEntries(this.fields
        .filter(key => Object.hasOwn(prior, key)).map(key => [key, prior[key]])) }]
    },
  }))
  const writes = []
  t.mock.method(Job, 'bulkWrite', async operations => {
    writes.push(...operations)
    return { upsertedCount: prior ? 0 : operations.length, modifiedCount: prior ? operations.length : 0 }
  })
  t.mock.method(Job, 'updateMany', () => assert.fail('Lifecycle writes are disabled'))
  t.mock.method(Job, 'deleteMany', () => assert.fail('Deletion is disabled'))
  const untouched = structuredClone(incoming)
  const result = await saveToDB([incoming], 'appventurez', {
    now, descriptionRewriteMode: 'publish', enrichPublicExperience: false, ...enrichment,
    replaceExisting: false, refreshDatasetSummary: false, enqueueAlerts: false,
  })
  assert.deepEqual(incoming, untouched, 'Persistence must not mutate the source card')
  assert.equal(writes.length, 1)
  const update = writes[0].updateOne.update
  const stored = { ...prior, ...update.$set }
  for (const key of Object.keys(update.$unset || {})) delete stored[key]
  return { stored, update, result }
}

test('Appventurez cards retain native experience without fabricating a description or appointment', async () => {
  const requests = []
  const jobs = await createAppventurezScraper({ now: () => now.toISOString() }).run({
    fetchText: async url => { requests.push(url); return careersHtml },
  })
  assert.deepEqual(requests, ['https://www.appventurez.com/careers'])
  assert.equal(jobs.length, 1)
  const job = jobs[0]
  assert.equal(job.jobDescription, null)
  assert.equal(job.sourceExperienceRequired, '3-6 Years')
  assert.equal(job.experienceRequiredProvenance, 'source')
  assert.equal(job.preserveExistingSourceDescription, true)
  assert.equal(job.publicExperienceChecked, true)
  assert.equal(job.employmentType, null)
  assert.equal(job.remoteStatus, null)
  const normalized = normalizeScrapedJob(job)
  assert.equal(normalized.sourceExperienceRequired, '3-6 Years')
  const input = postScrapeInput(normalized, { now })
  assert.equal(input.sourceFields.description, '')
  assert.match(input.body, /3-6 Years/)
  assert.equal(input.incomplete, false, 'The explicit native requirement remains usable evidence')
  let sharedPageFetches = 0
  let browserFetches = 0
  const [enriched] = await enrichJobsWithPublicExperience(jobs, {
    fetchText: async () => { sharedPageFetches += 1; return careersHtml },
    fetchBrowserText: async () => { browserFetches += 1; return careersHtml },
    useBrowserFallback: false,
  })
  assert.equal(sharedPageFetches, 0, 'A listing-only card must not re-fetch its shared page')
  assert.equal(browserFetches, 0)
  assert.equal(enriched.jobDescription, null)
  assert.equal(enriched.sourceExperienceRequired, '3-6 Years')
})

for (const hasPrior of [false, true]) {
  test(`Appventurez listing-only cards remain source-safe through enabled enrichment and persistence (prior=${hasPrior})`, async t => {
    const [card] = await createAppventurezScraper({ now: () => now.toISOString() }).run({
      fetchText: async () => careersHtml,
    })
    let fetches = 0
    const { stored } = await persistWithStubs(t, card, hasPrior ? priorRole() : null, {
      enrichPublicExperience: true,
      fetchText: async () => { fetches += 1; return careersHtml },
      useBrowserFallback: false,
    })
    assert.equal(fetches, 0)
    assert.equal(stored.sourceDescription, hasPrior ? employerDescription : null)
    assert.equal(stored.sourceExperienceRequired, '3-6 Years')
    assert.equal(stored.sourceEmploymentType, hasPrior ? 'Permanent' : null)
  })
}

test('new cards save explicit zero-inclusive experience without fabricating a description', async t => {
  const { stored } = await persistWithStubs(t, partialCard('0-1 Years'))
  assert.equal(stored.sourceDescription, null)
  assert.equal(stored.description, undefined)
  assert.equal(stored.sourceExperienceRequired, '0-1 Years')
  assert.equal(stored.publicExperienceChecked, true)
  assert.equal(stored.descriptionRewrite.reason, 'insufficient_source')
  assert.equal(stored.postClassification.status, 'pending')
  assert.equal(stored.postClassification.reason, 'source_requires_classification')
  assert.equal(postScrapeInput(stored, { now }).sourceFields.description, '')
})

test('a fresh card updates experience while preserving the matched role employer text and qualifications', async t => {
  const prior = priorRole()
  const { stored, update, result } = await persistWithStubs(t, partialCard(), prior)
  assert.equal(result.inserted, 0)
  assert.equal(stored.sourceDescription, employerDescription)
  assert.equal(stored.description, employerDescription)
  assert.equal(stored.sourceExperienceRequired, '3-6 Years')
  assert.equal(stored.experienceRequired, '3-6 Years')
  for (const key of ['minimumQualification', 'preferredQualification', 'sourceEmploymentType', 'salary']) {
    assert.equal(stored[key], prior[key], key)
  }
  assert.deepEqual(stored.requiredSkills, prior.requiredSkills)
  assert.deepEqual(stored.eligibleBatches, prior.eligibleBatches)
  assert.equal(stored.eligibleBatchesProvenance, 'source')
  assert.notEqual(stored.sourceContentHash, prior.sourceContentHash)
  assert.equal(stored.descriptionRewrite.status, 'pending')
  assert.equal(stored.postClassification.status, 'pending')
  assert.equal(stored.postClassification.reason, 'source_requires_classification')
  assert.notEqual(stored.postClassification.inputHash, prior.postClassification.inputHash)
  assert.equal(update.$unset.classification, '')
})

test('an unchanged partial card preserves its published description, source hash and cached input', async t => {
  const prior = priorRole('3-6 Years')
  const { stored } = await persistWithStubs(t, partialCard(), prior)
  assert.equal(stored.sourceDescription, prior.sourceDescription)
  assert.equal(stored.sourceContentHash, prior.sourceContentHash)
  assert.equal(stored.description, prior.description)
  assert.equal(stored.descriptionFormat, prior.descriptionFormat)
  assert.deepEqual(stored.descriptionRewrite, prior.descriptionRewrite)
  assert.deepEqual(stored.postClassification, prior.postClassification)
})

test('a genuine new description supersedes the partial-card preservation marker', async t => {
  const description = 'Design and validate mobile interfaces. A master degree in design is required.'
  const { stored } = await persistWithStubs(t, {
    ...partialCard(), sourceDescription: description, jobDescription: description,
    minimumQualification: 'Master of Design', requiredSkills: ['Figma'],
  }, priorRole())
  assert.equal(stored.sourceDescription, description)
  assert.equal(stored.description, description)
  assert.equal(stored.minimumQualification, 'Master of Design')
  assert.equal(stored.sourceExperienceRequired, '3-6 Years')
})

test('legacy preserve-all fallbacks still retain prior source eligibility and description', async t => {
  const prior = priorRole()
  const { stored } = await persistWithStubs(t, {
    ...partialCard(null), preserveExistingSourceDescription: false,
    preserveExistingSourceContent: true,
  }, prior)
  assert.equal(stored.sourceDescription, prior.sourceDescription)
  assert.equal(stored.sourceContentHash, prior.sourceContentHash)
  assert.equal(stored.description, prior.description)
  assert.equal(stored.sourceExperienceRequired, prior.sourceExperienceRequired)
})
