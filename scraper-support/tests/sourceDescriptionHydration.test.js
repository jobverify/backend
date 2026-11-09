import assert from 'node:assert/strict'
import test from 'node:test'
import { hydrateSourceDescriptions, sourceDescriptionFromPosting } from '../utils/sourceDescriptionHydration.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { extractionDetailHealth } from '../utils/extractionDetailHealth.js'

const job = { source: 'source-detail', company: 'Employer', title: 'Engineer', jobId: 'R1',
  sourceUrl: 'https://careers.employer.test/jobs/R1', jobDescription: null }
const posting = { '@type': 'JobPosting', title: job.title, hiringOrganization: { name: job.company },
  url: job.sourceUrl, identifier: { value: job.jobId }, description: '<p>Build reliable software for our customers.</p>' }
const response = (value = posting, extra = {}) => ({ status: 200, url: job.sourceUrl,
  html: '<script type="application/ld+json">' + JSON.stringify(value) + '</script>', ...extra })

test('hydrates employer-authored source content before detail-health diagnostics', async () => {
  const jobs = [job]
  assert.equal(extractionDetailHealth(jobs).missingDescriptions, 1)
  const hydrated = await hydrateSourceDescriptions(jobs, { fetchDetail: async role => sourceDescriptionFromPosting(role, response()) })
  assert.equal(hydrated[0].sourceDescription, posting.description)
  assert.equal(hydrated[0].sourceDetailComplete, true)
  assert.deepEqual(extractionDetailHealth(hydrated), { complete: true, inspectedJobs: 1, incompleteJobs: 0, missingDescriptions: 0, failureKinds: {} })
  assert.equal(job.jobDescription, null, 'The input listing must remain unchanged')
})

test('detail hydration preserves listing inventory evidence and incomplete-listing state', async () => {
  const jobs = [{ ...job, sourceListingComplete: false }]
  attachInventoryEvidence(jobs, { status: 'discovery-only', firstParty: true, listingComplete: false,
    surface: 'https://careers.employer.test/jobs', pagesFetched: 1, reportedTotal: 20, verifiedAt: new Date().toISOString() })
  const hydrated = await hydrateSourceDescriptions(jobs, { fetchDetail: async () => ({ jobDescription: posting.description }) })
  assert.deepEqual(readInventoryEvidence(hydrated), readInventoryEvidence(jobs))
  assert.equal(hydrated[0].sourceListingComplete, false)
  assert.equal(extractionDetailHealth(hydrated).complete, false)
})

for (const [name, value] of [
  ['wrong role', { ...posting, identifier: { value: 'R2' } }],
  ['wrong employer', { ...posting, hiringOrganization: { name: 'Other Employer' } }],
  ['wrong title', { ...posting, title: 'Other role' }],
  ['wrong URL', { ...posting, url: 'https://careers.employer.test/jobs/R2' }],
  ['placeholder', { ...posting, description: 'Description coming soon' }],
]) test('does not promote source content from ' + name, async () => {
  const hydrated = await hydrateSourceDescriptions([job], { fetchDetail: async role => sourceDescriptionFromPosting(role, response(value)) })
  assert.equal(hydrated[0].sourceDetailComplete, false)
  assert.equal(hydrated[0].jobDescription, null)
  assert.equal(extractionDetailHealth(hydrated).missingDescriptions, 1)
})

for (const [name, extra] of [
  ['redirect to homepage', { url: 'https://careers.employer.test/' }],
  ['HTTP failure', { status: 403 }],
]) test('rejects a verified-looking schema with ' + name, () => {
  assert.equal(sourceDescriptionFromPosting(job, response(posting, extra)), null)
})

test('an upstream error leaves that role incomplete while other roles are hydrated', async () => {
  const hydrated = await hydrateSourceDescriptions([job, { ...job, jobId: 'R2' }], {
    fetchDetail: async role => { if (role.jobId === 'R1') throw new Error('HTTP 503'); return { jobDescription: posting.description } },
  })
  assert.equal(hydrated[0].sourceDetailFailureKind, 'upstream')
  assert.equal(hydrated[1].sourceDetailComplete, true)
})

test('zero detail budget makes no requests and records incomplete source content', async () => {
  let calls = 0
  const hydrated = await hydrateSourceDescriptions([job], { detailEnrichmentBudgetMs: 0, fetchDetail: async () => { calls++; return posting } })
  assert.equal(calls, 0)
  assert.equal(hydrated[0].sourceDetailFailureKind, 'budget-exhausted')
})

test('a detail budget aborts in-flight requests and retains the unfetched tail', async () => {
  let active = 0
  const hydrated = await hydrateSourceDescriptions([job, { ...job, jobId: 'R2' }], {
    concurrency: 1, detailEnrichmentBudgetMs: 10,
    fetchDetail: async (_role, { signal }) => {
      active++
      try { await new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })) }
      finally { active-- }
    },
  })
  assert.equal(active, 0)
  assert.ok(hydrated.every(role => role.sourceDetailFailureKind === 'budget-exhausted'))
})

test('caller cancellation propagates instead of becoming a source warning', async () => {
  const controller = new AbortController(), reason = new Error('operator cancelled')
  await assert.rejects(hydrateSourceDescriptions([job], { signal: controller.signal,
    fetchDetail: async () => { controller.abort(reason); throw reason },
  }), error => error === reason)
})

test('existing source content is kept without a second detail fetch', async () => {
  const original = { ...job, sourceDescription: 'Already verified employer content.' }
  const hydrated = await hydrateSourceDescriptions([original], { fetchDetail: async () => assert.fail('Existing content must not be refetched') })
  assert.deepEqual(hydrated, [original])
})

test('malformed detail content cannot become a healthy stringified object', async () => {
  const hydrated = await hydrateSourceDescriptions([job], { fetchDetail: async () => ({ jobDescription: { changed: 'schema' } }) })
  assert.equal(hydrated[0].sourceDetailComplete, false)
  assert.equal(hydrated[0].jobDescription, null)
})
