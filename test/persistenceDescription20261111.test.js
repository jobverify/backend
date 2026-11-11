import assert from 'node:assert/strict'
import test from 'node:test'
import mongoose from 'mongoose'
import Job from '../src/models/Job.js'
import { buildDescriptionSourceUpdate, buildRewriteInput } from '../src/services/jobDescriptionPolicy.js'
import { hasSourceDescription } from '../src/utils/jobSourceContent.js'
import { buildSourceDescriptionDisplay, publicDescriptionFields } from '../src/utils/jobDescriptionDisplay.js'
import { postScrapeInput } from '../src/services/postScrapeClassification.js'
import { generateFingerprint } from '../scraper-support/utils/applicationIdentity.js'
import { formatStoredLocationLabel } from '../src/utils/jobLocations.js'
import { normalizeScrapedJob } from '../scraper-support/utils/normalizeScrapedJob.js'
import { saveToDB } from '../scraper-support/utils/saveToDB.js'

// Synthetic offline roles and model responses; no employer capture, remote
// model inference, browser, network request or database connection is involved.
const now = new Date('2026-11-11T00:00:00.000Z')
const base = () => ({ source: 'synthetic-description-control', jobId: 'R100', requisitionId: 'R100',
  title: 'Synthetic Engineer', company: 'Synthetic Employer', location: 'Bengaluru, India', country: 'India',
  sourceUrl: 'https://employer.example.test/roles/100', applyUrl: 'https://employer.example.test/roles/100',
  scrapedAt: now.toISOString() })
const missing = [
  ['absent', {}, null],
  ['explicit null with generated display', { sourceDescription: null, description: 'Generated ten years of Kubernetes experience.',
    jobDescription: 'Generated fallback description.' }, null],
  ['explicit empty with generated display', { sourceDescription: '', description: 'Generated display summary.' }, null],
  ['whitespace', { sourceDescription: ' \n\t\u00a0' }, null],
  ['markup only', { sourceDescription: '<p>&nbsp;<br></p>', description: 'Generated display summary.' }, '<p>&nbsp;<br></p>'],
  ['comment and script only', { sourceDescription: '<!-- no role details --><script>ignored()</script>' }, '<!-- no role details --><script>ignored()</script>'],
  ['placeholder only', { sourceDescription: 'Enter the job description...' }, 'Enter the job description...'],
]

for (const mode of ['off', 'publish']) for (const [label, fields, canonical] of missing) {
  test(`${mode} persistence omits display writes for ${label} source while keeping missing-source metadata`, () => {
    const input = { ...base(), ...fields }, original = structuredClone(input)
    const update = buildDescriptionSourceUpdate(input, null, { mode, now })
    assert.equal(hasSourceDescription(input), false)
    assert.equal(Object.hasOwn(update, 'description'), false)
    assert.equal(Object.hasOwn(update, 'descriptionFormat'), false)
    assert.equal(update.sourceDescription, canonical, 'immutable raw empty markup stays distinct from absent source')
    assert.equal(update.sourceContentHashVersion, 2)
    assert.match(update.sourceContentHash, /^[a-f0-9]{64}$/)
    assert.equal(update.descriptionRewrite.status, 'skipped')
    assert.equal(update.descriptionRewrite.reason, 'insufficient_source')
    assert.equal(update.descriptionRewrite.attempts, 0)
    assert.equal(update.descriptionRewrite.queuedAt, now)
    assert.deepEqual(input, original)
  })
}

for (const mode of ['off', 'publish']) for (const [label, fields, expected] of [
  ['short source', { sourceDescription: 'Build APIs.' }, 'Build APIs.'],
  ['title-only source string', { sourceDescription: 'Synthetic Engineer' }, 'Synthetic Engineer'],
  ['legacy description fallback', { description: 'Maintain customer services.' }, 'Maintain customer services.'],
  ['native multiline wording', { sourceDescription: 'Responsibilities:\nBuild services.\n\nRequirements:\nFive years of experience.' },
    'Responsibilities:\nBuild services.\n\nRequirements:\nFive years of experience.'],
]) {
  test(`${mode} persistence retains existing eligibility and wording for ${label}`, () => {
    const input = { ...base(), ...fields }, rewrite = buildRewriteInput(input)
    const update = buildDescriptionSourceUpdate(input, null, { mode, now })
    assert.equal(rewrite.eligible, true, 'this repair must not introduce a source-length or title-content threshold')
    assert.equal(update.sourceDescription, expected)
    assert.equal(update.description, expected)
    assert.equal(update.descriptionFormat, 'plain')
    assert.equal(update.descriptionRewrite.status, mode === 'publish' ? 'pending' : 'skipped')
    assert.equal(update.descriptionRewrite.reason, mode === 'publish' ? null : 'disabled')
  })
}

for (const [label, fields] of missing) {
  test(`a genuine prior source and published display survive ${label} current source`, () => {
    const prior = { ...base(), sourceDescription: 'Original employer responsibilities and qualifications.',
      description: '## Published employer description', descriptionFormat: 'markdown', sourceContentHashVersion: 2,
      sourceContentHash: 'a'.repeat(64), descriptionRewrite: { status: 'published', inputHash: 'a'.repeat(64) } }
    const original = structuredClone(prior)
    const update = buildDescriptionSourceUpdate({ ...base(), ...fields }, prior, { mode: 'publish', now })
    assert.deepEqual(update, {})
    assert.deepEqual({ ...prior, ...update }, original)
  })
}

test('fresh genuine source still replaces a prior published display when its source changes', () => {
  const prior = { ...base(), sourceDescription: 'Original employer text.', description: 'Published original summary.',
    sourceContentHashVersion: 2, sourceContentHash: 'b'.repeat(64) }
  const current = { ...base(), sourceDescription: 'New employer responsibilities.\nNew required qualifications.' }
  const update = buildDescriptionSourceUpdate(current, prior, { mode: 'publish', now })
  assert.equal(update.sourceDescription, 'New employer responsibilities.\nNew required qualifications.')
  assert.equal(update.description, 'New employer responsibilities.\nNew required qualifications.')
  assert.equal(update.descriptionRewrite.status, 'pending')
  assert.notEqual(update.sourceContentHash, prior.sourceContentHash)
})

const persistWithModelStubs = async (t, input, overrides = {}, existing = null) => {
  assert.equal(mongoose.connection.readyState, 0)
  assert.equal(mongoose.connection.db, undefined)
  const descriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState')
  const databaseDescriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'db')
  Object.defineProperty(mongoose.connection, 'readyState', { configurable: true, value: 1 })
  // A local sentinel admits the real prior-row lookup in both rewrite modes;
  // every operation remains stubbed and no driver/client is created.
  if (existing) Object.defineProperty(mongoose.connection, 'db', { configurable: true, value: {} })
  const previousMode = process.env.POST_SCRAPE_CLASSIFICATION_MODE
  process.env.POST_SCRAPE_CLASSIFICATION_MODE = 'shadow'
  t.after(() => {
    if (descriptor) Object.defineProperty(mongoose.connection, 'readyState', descriptor)
    else delete mongoose.connection.readyState
    if (databaseDescriptor) Object.defineProperty(mongoose.connection, 'db', databaseDescriptor)
    else delete mongoose.connection.db
    if (previousMode === undefined) delete process.env.POST_SCRAPE_CLASSIFICATION_MODE
    else process.env.POST_SCRAPE_CLASSIFICATION_MODE = previousMode
  })
  t.mock.method(mongoose, 'connect', () => assert.fail('Actual database connection forbidden'))
  t.mock.method(globalThis, 'fetch', () => assert.fail('Network and remote model inference forbidden'))
  t.mock.method(Job, 'find', () => ({ fields: [],
    select(value) { this.fields = value.split(/\s+/); return this },
    lean() { return this },
    async exec() {
      return existing ? [{ _id: existing._id, ...Object.fromEntries(this.fields
        .filter(key => Object.hasOwn(existing, key)).map(key => [key, existing[key]])) }] : []
    },
  }))
  t.mock.method(Job, 'deleteMany', () => assert.fail('Incomplete source evidence cannot authorize deletion'))
  t.mock.method(Job, 'updateMany', () => assert.fail('Incomplete source evidence cannot authorize lifecycle misses'))
  const operations = []
  t.mock.method(Job, 'bulkWrite', async writes => {
    operations.push(...writes)
    return { upsertedCount: existing ? 0 : writes.length, modifiedCount: existing ? writes.length : 0 }
  })
  const original = structuredClone(input)
  const result = await saveToDB([input], input.source, { now, enrichPublicExperience: false,
    descriptionRewriteMode: 'publish', replaceExisting: true, refreshDatasetSummary: false,
    enqueueAlerts: false, ...overrides })
  assert.deepEqual(input, original)
  assert.equal(operations.length, 1)
  return { result, operation: operations[0].updateOne.update }
}

for (const [label, experience, expected] of [['range including zero', '0-1 Years', '0-1 Years'], ['numeric zero', 0, '0']]) {
  test(`missing-source persistence retains ${label} experience and source criteria with cleanup held`, async t => {
    const input = { ...base(), sourceDescription: null, description: 'Generated summary must not become employer wording.',
      sourceExperienceRequired: experience, experienceRequired: experience, publicExperienceChecked: true,
      sourceEmploymentType: 'Permanent', minimumQualification: 'Bachelor of Engineering',
      preferredQualification: 'Linux administration coursework', requiredSkills: ['SQL'], sourceDetailComplete: false }
    const normalized = normalizeScrapedJob(input, { source: input.source })
    assert.equal(normalized.sourceExperienceRequired, expected)
    const { result, operation } = await persistWithModelStubs(t, input)
    assert.equal(Object.hasOwn(operation.$set, 'description'), false)
    assert.equal(Object.hasOwn(operation.$set, 'descriptionFormat'), false)
    assert.equal(Object.hasOwn(operation.$unset ?? {}, 'description'), false)
    assert.equal(operation.$set.sourceDescription, null)
    assert.equal(operation.$set.sourceExperienceRequired, expected)
    assert.equal(operation.$set.sourceEmploymentType, 'Permanent')
    assert.equal(operation.$set.minimumQualification, 'Bachelor of Engineering')
    assert.equal(operation.$set.preferredQualification, 'Linux administration coursework')
    assert.deepEqual(operation.$set.requiredSkills, ['SQL'])
    assert.equal(operation.$set.publicExperienceChecked, true)
    assert.equal(operation.$set.descriptionRewrite.reason, 'insufficient_source')
    assert.equal(operation.$set.postClassification.status, 'pending')
    assert.equal(operation.$set.postClassification.mode, 'shadow')
    assert.equal(result.eligibleJobs, 1)
    assert.equal(result.filteredEmptyDescription, 0)
    assert.equal(result.staleCheckSkipped, true)
    assert.match(result.staleCheckReason, /Incomplete source role details/)
    // Instantiate the real local schema only; no document is saved. Its null
    // default must survive when the update omits a missing display description.
    const document = new Job(operation.$set)
    assert.equal(document.description, null)
  })
}

test('genuine source display cannot remove a source-declared lifecycle hold', async t => {
  const input = { ...base(), sourceDescription: 'Original employer responsibilities and requirements.',
    sourceExperienceRequired: '0-1 Years', lifecycleCleanupAllowed: false, sourceListingComplete: false }
  const { result, operation } = await persistWithModelStubs(t, input)
  assert.equal(operation.$set.description, 'Original employer responsibilities and requirements.')
  assert.equal(operation.$set.sourceDescription, 'Original employer responsibilities and requirements.')
  assert.equal(operation.$set.sourceExperienceRequired, '0-1 Years')
  assert.equal(result.staleCheckSkipped, true)
  assert.equal(result.staleCheckReasonCode, 'source-cleanup-forbidden')
})

const renderedMissing = [
  ['encoded empty paragraph', '&lt;p&gt;&nbsp;&lt;/p&gt;'],
  ['template-only text', '<template>Non-visible synthetic text</template>'],
  ['encoded editor placeholder', '&lt;p&gt;Enter the job description...&lt;/p&gt;'],
]
const genuinePrior = () => {
  const normalized = normalizeScrapedJob({ ...base(),
    sourceDescription: 'Original employer responsibilities and qualifications.', sourceExperienceRequired: '0-1 Years' })
  normalized.location = formatStoredLocationLabel(normalized)
  const update = buildDescriptionSourceUpdate(normalized, null, { mode: 'publish', now })
  return { ...normalized, ...update, sortDate: normalized.postedAt,
    _id: new mongoose.Types.ObjectId(), fingerprint: generateFingerprint(normalized),
    description: '## Original employer responsibilities and qualifications.', descriptionFormat: 'markdown',
    descriptionRewrite: { ...update.descriptionRewrite, status: 'published' } }
}

for (const mode of ['off', 'publish']) for (const [label, sourceDescription] of renderedMissing) {
  test(`${mode} new ${label} source is canonical missing content with a stored-representation hash`, () => {
    const input = { ...base(), sourceDescription, description: 'Generated summary must not survive as employer source.',
      sourceExperienceRequired: 0, minimumQualification: 'Bachelor of Engineering', sourceEmploymentType: 'Permanent' }
    const original = structuredClone(input)
    assert.equal(buildRewriteInput(input).eligible, true, 'this is the raw predicate/formatter mismatch')
    assert.equal(hasSourceDescription({ sourceDescription: buildSourceDescriptionDisplay(sourceDescription).description }), false)
    const update = buildDescriptionSourceUpdate(input, null, { mode, now }), stored = { ...input, ...update }
    assert.equal(update.sourceDescription, null)
    assert.equal(Object.hasOwn(update, 'description'), false)
    assert.equal(Object.hasOwn(update, 'descriptionFormat'), false)
    assert.equal(update.descriptionRewrite.status, 'skipped')
    assert.equal(update.descriptionRewrite.reason, 'insufficient_source')
    assert.equal(update.sourceContentHash, buildRewriteInput(stored).inputHash)
    assert.equal(update.descriptionRewrite.inputHash, update.sourceContentHash)
    assert.equal(hasSourceDescription(stored), false)
    assert.equal(postScrapeInput(stored, { now }).sourceFields.description, '')
    assert.equal(postScrapeInput(stored, { now }).sourceFields.experienceRequired, '0')
    assert.deepEqual(publicDescriptionFields(stored), { description: '', descriptionFormat: 'plain' })
    assert.deepEqual(input, original)
  })

  test(`${mode} ${label} input cannot replace genuine prior source, display or rewrite metadata`, () => {
    const prior = genuinePrior(), original = structuredClone(prior)
    const update = buildDescriptionSourceUpdate({ ...base(), sourceDescription }, prior, { mode, now })
    assert.deepEqual(update, {})
    const stored = { ...prior, ...update }
    for (const key of ['sourceDescription', 'description', 'descriptionFormat', 'sourceContentHash',
      'sourceContentHashVersion', 'descriptionRewrite']) assert.deepEqual(stored[key], original[key], key)
    assert.equal(hasSourceDescription(stored), true)
    assert.deepEqual(publicDescriptionFields(stored), {})
  })
}

for (const mode of ['off', 'publish']) {
  test(`${mode} preserveExistingSourceContent bypasses display parsing and keeps prior metadata`, () => {
    const prior = genuinePrior()
    const update = buildDescriptionSourceUpdate({ ...base(), preserveExistingSourceContent: true,
      sourceDescription: '<div data-key="one" data-key="two">Invalid synthetic wrapper</div>' }, prior, { mode, now })
    assert.deepEqual(update, {})
  })

  test(`${mode} encoded genuine employer wording stays raw in source and readable in display`, () => {
    const sourceDescription = '&lt;p&gt;Build APIs and preserve employer criteria.&lt;/p&gt;'
    const input = { ...base(), sourceDescription, sourceExperienceRequired: '0-1 Years' }
    const update = buildDescriptionSourceUpdate(input, null, { mode, now })
    assert.equal(update.sourceDescription, sourceDescription)
    assert.equal(update.description, 'Build APIs and preserve employer criteria.')
    assert.equal(update.descriptionFormat, 'markdown')
    assert.equal(update.descriptionRewrite.status, mode === 'publish' ? 'pending' : 'skipped')
    assert.equal(update.descriptionRewrite.reason, mode === 'publish' ? null : 'disabled')
    assert.equal(update.sourceContentHash, buildRewriteInput({ ...input, ...update }).inputHash)
  })
}

for (const mode of ['off', 'publish']) for (const [label, sourceDescription] of renderedMissing.slice(0, 2)) {
  for (const [experience, expected] of [[0, '0'], ['0-1 Years', '0-1 Years']]) {
    test(`${mode} persisted ${label} becomes missing for consumers while experience ${expected} and holds survive`, async t => {
      const input = { ...base(), sourceDescription, description: 'Generated source fallback must be ignored.',
        sourceExperienceRequired: experience, sourceEmploymentType: 'Permanent', minimumQualification: 'Bachelor of Engineering',
        sourceDetailComplete: false, lifecycleCleanupAllowed: false }
      const { result, operation } = await persistWithModelStubs(t, input, { descriptionRewriteMode: mode })
      const fields = operation.$set, stored = new Job(fields).toObject()
      assert.equal(fields.sourceDescription, null)
      assert.equal(Object.hasOwn(fields, 'description'), false)
      assert.equal(Object.hasOwn(fields, 'descriptionFormat'), false)
      assert.equal(Object.hasOwn(operation.$unset ?? {}, 'description'), false)
      assert.equal(stored.description, null)
      assert.equal(hasSourceDescription(stored), false)
      assert.equal(postScrapeInput(stored, { now }).sourceFields.description, '')
      assert.equal(postScrapeInput(stored, { now }).sourceFields.experienceRequired, expected)
      assert.deepEqual(publicDescriptionFields(stored), { description: '', descriptionFormat: 'plain' })
      assert.equal(fields.sourceExperienceRequired, expected)
      assert.equal(fields.minimumQualification, 'Bachelor of Engineering')
      assert.equal(fields.sourceEmploymentType, 'Permanent')
      assert.equal(fields.sourceContentHash, buildRewriteInput(stored).inputHash)
      assert.equal(fields.descriptionRewrite.inputHash, fields.sourceContentHash)
      assert.equal(fields.descriptionRewrite.status, 'skipped')
      assert.equal(fields.descriptionRewrite.reason, 'insufficient_source')
      assert.equal(fields.postClassification.status, 'pending')
      assert.equal(result.staleCheckSkipped, true)
      assert.equal(result.staleCheckReasonCode, 'source-cleanup-forbidden')
    })
  }

  test(`${mode} persisted ${label} retains a matched role's genuine source and published display`, async t => {
    const prior = genuinePrior(), original = structuredClone(prior)
    const input = { ...base(), sourceDescription, sourceExperienceRequired: '0-1 Years',
      sourceDetailComplete: false, lifecycleCleanupAllowed: false }
    const { operation, result } = await persistWithModelStubs(t, input, { descriptionRewriteMode: mode }, prior)
    const stored = { ...prior, ...operation.$set }
    for (const key of ['sourceDescription', 'description', 'descriptionFormat', 'sourceContentHash',
      'sourceContentHashVersion', 'descriptionRewrite']) {
      assert.equal(Object.hasOwn(operation.$set, key), false, key)
      assert.deepEqual(stored[key], original[key], key)
    }
    assert.equal(hasSourceDescription(stored), true)
    assert.deepEqual(publicDescriptionFields(stored), {})
    assert.match(postScrapeInput(stored, { now }).sourceFields.description, /Original employer/)
    assert.equal(stored.sourceContentHash, buildRewriteInput(stored).inputHash)
    assert.equal(result.staleCheckSkipped, true)
  })
}
