import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { createPublishingGapAtsScraper } from '../scraper-support/utils/publishingGapAts.js'
import { normalizeScrapedJob } from '../scraper-support/utils/normalizeScrapedJob.js'
import { buildDescriptionSourceUpdate } from '../src/services/jobDescriptionPolicy.js'

const folder = new URL('../scraper-support/tests/greenhouseNativeDisplayResponses/', import.meta.url)
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', folder), 'utf8'))
const encodedTags = /(?:&lt;|&#0*60;|&#x0*3c;)\/?(?:div|p|h[1-6]|ul|li|br|strong)\b/i
for (const input of manifest.inputs) test(`${input.source} full native content reaches backend description consumers without encoded markup`, async () => {
  const body = gunzipSync(fs.readFileSync(new URL(input.filename, folder)))
  assert.equal(createHash('sha256').update(body).digest('hex'), input.bodySHA256)
  const payload = JSON.parse(body)
  const native = payload.jobs.find(post => post.internal_job_id && post.content && !/talent (?:pool|community|network)/i.test(post.title))
  assert.ok(native, 'The actual snapshot must contain a regular public role')
  const originalContent = native.content
  // Deliberately synthetic location for this display-only regression. The
  // complete captured role content and all other source records remain intact.
  native.location.name = 'Bengaluru, India'; native.offices = []
  if (Array.isArray(native.metadata)) for (const item of native.metadata) if (/^countr(?:y|ies)$/i.test(item.name)) item.value = Array.isArray(item.value) ? ['India'] : 'India'
  const provider = { ...input, atsPlatform: 'greenhouse', sourceScopeComplete: false }
  const jobs = await createPublishingGapAtsScraper(provider).run({ fetchJson: async url => { assert.equal(url, input.apiURL); return payload } })
  const job = jobs.find(job => String(job.jobId) === String(native.id))
  assert.ok(job)
  const normalized = normalizeScrapedJob(job, provider)
  const persisted = buildDescriptionSourceUpdate({ ...normalized, sourceDescription: job.sourceDescription }, null)
  assert.equal(encodedTags.test(persisted.description), false, 'Native markup must not remain literal display text')
  assert.equal(job.nativeDescriptionRaw, originalContent)
  assert.equal(job.nativeSourceRecord.content, originalContent)
  assert.equal(job.nativeSourceRecord.first_published, native.first_published)
  assert.equal(job.nativeSourceRecord.updated_at, native.updated_at)
  assert.equal(job.sourceDescription, job.jobDescription)
  assert.equal(job.sourceScopeComplete, false)
  assert.equal(job.sourceListingComplete, false)
  assert.equal(job.lifecycleCleanupAllowed, false)
})

const provider = { source: 'description-example', companyName: 'Description Example', companyCareerPage: 'https://example.com/careers',
  atsPlatform: 'greenhouse', boardToken: 'example', sourceScopeComplete: false }
const runContent = async content => {
  const native = { id: 123, internal_job_id: 456, title: 'Engineer', location: { name: 'Bengaluru, India' },
    absolute_url: 'https://job-boards.greenhouse.io/example/jobs/123', content,
    first_published: '2026-07-01T10:00:00-04:00', updated_at: '2026-10-29T12:00:00-04:00' }
  const jobs = await createPublishingGapAtsScraper(provider).run({ fetchJson: async () => ({ jobs: [native], meta: { total: 1 } }) })
  return jobs[0]
}
test('Greenhouse decodes one publisher encoding layer and retains the exact original representation', async () => {
  const job = await runContent('&lt;p&gt;Build &amp; maintain services; keep x &amp;lt; y in examples.&lt;/p&gt;')
  assert.equal(job.sourceDescription, '<p>Build & maintain services; keep x &lt; y in examples.</p>')
  assert.equal(job.jobDescription, '<p>Build & maintain services; keep x &lt; y in examples.</p>')
  assert.equal(job.nativeDescriptionRaw, '&lt;p&gt;Build &amp; maintain services; keep x &amp;lt; y in examples.&lt;/p&gt;')
})
test('already decoded native HTML keeps literal entities within technical examples', async () => {
  const content = '<p>Build &amp; maintain services; retain x &lt; y and &lt;code&gt; examples.</p>'
  const job = await runContent(content)
  assert.equal(job.sourceDescription, content)
  assert.equal(job.jobDescription, content)
  assert.equal(job.nativeDescriptionRaw, content)
})
