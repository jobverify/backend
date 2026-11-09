import test from 'node:test'
import assert from 'node:assert/strict'
import * as engine from '../myworkday/engine.js'
import { resolveClassification, buildClassificationInput } from '../../src/services/jobClassificationPolicy.js'
import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'
import { inferExperienceFromPublicPageHtml } from '../utils/publicExperienceEnrichment.js'
import { fileURLToPath } from 'node:url'
import { WorkdayRequestScheduler } from '../myworkday/requestScheduler.js'

test('structured Workday detail URLs retain the configured board and job path', () => {
  assert.equal(typeof engine.buildWorkdayDetailApiUrl, 'function')
  assert.equal(engine.buildWorkdayDetailApiUrl('https://soti.wd3.myworkdayjobs.com/en-US/Careers/job/Kochi-India/Procurement_R10267-1',
    'https://soti.wd3.myworkdayjobs.com/wday/cxs/soti/Careers/jobs'),
  'https://soti.wd3.myworkdayjobs.com/wday/cxs/soti/Careers/job/Kochi-India/Procurement_R10267-1')
  assert.equal(engine.buildWorkdayDetailApiUrl('https://other.example/job/one', 'https://soti.wd3.myworkdayjobs.com/wday/cxs/soti/Careers/jobs'), null)
  assert.equal(engine.buildWorkdayDetailApiUrl('https://soti.wd3.myworkdayjobs.com/Careers', 'https://soti.wd3.myworkdayjobs.com/wday/cxs/soti/Careers/jobs'), null)
})

test('the complete structured employer description keeps required years separate from an optional skill through enrichment and storage', () => {
  assert.equal(typeof engine.extractWorkdayStructuredDetail, 'function')
  const detail = engine.extractWorkdayStructuredDetail({ jobPostingInfo: { title: 'Procurement Specialist', jobReqId: 'R10267',
    location: 'Kochi, India', jobDescription: '<p>Experience You Will Bring</p><ul><li>1-2 years of procurement experience</li><li>Strong Excel skills preferred</li></ul><p>Final employer paragraph.</p>' } })
  assert.match(detail.sourceDescription, /experience\nStrong Excel/)
  assert.match(detail.sourceDescription, /Final employer paragraph\.$/)
  const job = { title: 'Procurement Specialist', ...detail }
  const enriched = inferExperienceFromPublicPageHtml(job, '<h1>Procurement Specialist</h1><p>Apply for this role.</p>')
  const decision = resolveClassification(enriched, null, { mode: 'policy', now: new Date('2026-10-03T12:00:00Z') })
  assert.equal(decision.resolved.jobType, 'Full-time Experienced')
  assert.deepEqual(decision.resolved.experienceYears, [1, 2])
  assert.equal(decision.resolved.employerExperienceProfile.preferredMinimumYears, null)
  assert.equal(buildClassificationInput(normalizeScrapedJob(enriched)).body, buildClassificationInput(job).body)
})

test('empty or malformed structured details remain eligible for the existing HTML fallback', () => {
  assert.equal(typeof engine.extractWorkdayStructuredDetail, 'function')
  for (const payload of [null, {}, { jobPostingInfo: {} }, { jobPostingInfo: { jobDescription: ' ' } }, { jobPostingInfo: { jobDescription: {} } }])
    assert.equal(engine.extractWorkdayStructuredDetail(payload), null)
})

test('structured location country codes and secondary locations retain their own scope', () => {
  const description = '<p>Professional experience required.</p>'
  for (const country of ['India', { alpha2Code: 'IN' }]) {
    assert.deepEqual(engine.extractWorkdayStructuredDetail({ jobPostingInfo: {
      location: 'Remote', country, jobDescription: description,
    } }).indiaScopeLocations, ['Remote, India'])
  }
  assert.deepEqual(engine.extractWorkdayStructuredDetail({ jobPostingInfo: {
    location: 'Remote', country: { alpha2Code: 'US' }, additionalLocations: [
      { descriptor: 'Bangalore', country: { alpha2Code: 'IN' } },
      { descriptor: 'Remote', country: { alpha2Code: 'US' } },
    ], jobDescription: description,
  } }).indiaScopeLocations, ['Bangalore, India'])
})

test('an unbound requisition country stays unknown while a bound foreign office proves foreign scope', () => {
  const posting = { location: 'Remote', jobRequisitionLocation: { country: { alpha2Code: 'US' } },
    additionalLocations: ['Remote'], jobDescription: '<p>Professional experience required.</p>' }
  // The requisition office may differ from every advertised posting location.
  // A country without its office descriptor cannot certify the public location.
  assert.equal(engine.extractWorkdayStructuredDetail({ jobPostingInfo: posting }).indiaScopeLocations, null)
  const bound = { ...posting, jobRequisitionLocation: { ...posting.jobRequisitionLocation, descriptor: 'Remote' } }
  assert.deepEqual(engine.extractWorkdayStructuredDetail({ jobPostingInfo: bound }).indiaScopeLocations, [])
})

test('authoritative structured countries scope Remote jobs and retain an India secondary location', async t => {
  let current
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    if (options.method === 'POST') return Response.json({ total: 1, jobPostings: [
      { title: 'Engineer', locationsText: 'Remote', externalPath: '/job/Remote/Engineer_R1' },
    ] })
    if (String(url).includes('/wday/cxs/') && String(url).includes('/job/')) return Response.json({ jobPostingInfo: current })
    return new Response('<html>Workday shell</html>')
  })
  for (const [country, secondary, expected] of [['India', [], 1], ['United States of America', [], 0],
    ['United States of America', [{ descriptor: 'Bangalore, India', country: { alpha2Code: 'IN' } }], 1]]) {
    current = { title: 'Engineer', location: 'Remote', country: { descriptor: country }, additionalLocations: secondary,
      jobDescription: '<p>1 year of professional experience required.</p>' }
    const jobs = await engine.runWorkdayScraper({ company: 'Structured country', source: 'structured-country',
      baseUrl: 'https://country-test.wd930.myworkdayjobs.com/External',
      scraperDir: fileURLToPath(new URL('../myworkday', import.meta.url)),
      requestScheduler: new WorkdayRequestScheduler({ minIntervalMs: 0 }),
    })
    assert.equal(jobs.length, expected, country)
    if (expected) assert.match(jobs[0].location, /India/)
  }
})
