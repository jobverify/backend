import assert from 'node:assert/strict'
import test from 'node:test'
import { activeHead, activeIframeSources } from '../utils/activeNativeHtml.js'
import { enrichJobWithPublicExperience, enrichJobsWithPublicExperience } from '../utils/publicExperienceEnrichment.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'

const role = (id = 'R100') => ({
  source: 'malformed-html-regression', jobId: id, title: 'Platform Engineer',
  company: 'Example Employer', country: 'India', location: 'Bengaluru, India',
  sourceUrl: `https://careers.example.com/job/${id}`,
  sourceDescription: null, description: null, jobDescription: null,
})
const childUrl = 'https://boards.greenhouse.io/exampleemployer/jobs/100'
// Synthetic HTML reproducing the exception logged by run 40157274099. The
// archives do not contain the actual page that caused that run to abort.
const malformed = `<html><head><meta name="description" name="other" content="Job page"></head>
  <body><iframe src="${childUrl}"></iframe></body></html>`
const response = (job, html) => ({ status: 200, url: job.sourceUrl, html })

test('malformed wrapper metadata cannot abort enrichment or authorize its embedded job', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Network forbidden') })
  const input = { ...role(), sourceDescription: 'Original employer summary.' }
  const original = structuredClone(input), calls = []
  const enriched = await enrichJobWithPublicExperience(input, { fetchText: async url => {
    calls.push(url)
    return response(input, malformed)
  } })
  assert.deepEqual(calls, [input.sourceUrl], 'An invalid wrapper cannot delegate to the iframe')
  assert.equal(enriched.sourceUrl, input.sourceUrl)
  assert.equal(enriched.sourceDescription, original.sourceDescription)
  assert.notEqual(enriched.publicExperienceChecked, true)
  assert.deepEqual(input, original)
})

test('a malformed source page does not cancel valid jobs in the enrichment batch', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Network forbidden') })
  const bad = role(), good = role('R101'), inputs = [bad, good]
  const original = structuredClone(inputs), calls = []
  const description = '<p>Design distributed systems and maintain production cloud services.</p>'
    + '<p>Requirements: five years of software engineering experience and reliable service delivery.</p>'
  const posting = { '@type': 'JobPosting', identifier: { value: good.jobId },
    title: good.title, hiringOrganization: { name: good.company }, url: good.sourceUrl, description }
  const healthy = `<html><head><title>${good.title}</title></head><body><h1>${good.title}</h1>`
    + `<script type="application/ld+json">${JSON.stringify(posting)}</script></body></html>`
  const results = await enrichJobsWithPublicExperience(inputs, {
    concurrency: 1, useBrowserFallback: false,
    fetchText: async url => {
      calls.push(url)
      assert.ok(inputs.some(job => job.sourceUrl === url), 'No unverified iframe request')
      return url === bad.sourceUrl ? response(bad, malformed) : response(good, healthy)
    },
  })
  assert.equal(results.length, 2)
  assert.equal(results[0].jobId, bad.jobId)
  assert.equal(hasSourceDescription(results[0]), false)
  assert.notEqual(results[0].publicExperienceChecked, true)
  assert.equal(results[1].sourceDescription, description)
  assert.equal(results[1].publicExperienceChecked, true)
  assert.deepEqual(calls, [bad.sourceUrl, good.sourceUrl])
  assert.deepEqual(inputs, original)
})

test('strict native metadata readers continue to reject duplicate attributes', () => {
  for (const read of [activeHead, activeIframeSources]) {
    assert.throws(() => read(malformed), /Active native content: Duplicate native meta attribute/)
  }
})

test('unexpected wrapper processing errors still propagate', async () => {
  const input = role(), failure = new TypeError('Unexpected wrapper processing error')
  const wrapper = response(input, '')
  Object.defineProperty(wrapper, 'html', { get() { throw failure } })
  await assert.rejects(enrichJobWithPublicExperience(input, {
    fetchText: async () => wrapper,
  }), error => error === failure)
})

test('cancellation during malformed-page enrichment still propagates', async () => {
  const input = role(), controller = new AbortController(), failure = new Error('User stopped the run')
  await assert.rejects(enrichJobWithPublicExperience(input, {
    signal: controller.signal,
    fetchText: async () => { controller.abort(failure); return response(input, malformed) },
  }), error => error === failure)
})
