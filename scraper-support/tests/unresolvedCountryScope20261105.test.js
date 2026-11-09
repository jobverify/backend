import assert from 'node:assert/strict'
import test from 'node:test'
import { decorateJobsWithProviderMetadata } from '../providers/index.js'
import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'
import { analyzePublishableJobs } from '../utils/publishableJobMetrics.js'
import { buildJobDerivedFields } from '../../src/utils/jobDerivedFields.js'

const provider = { source: 'unresolved-country-control', companyName: 'Example', countryFilter: 'India' }
const role = {
  title: 'Applied AI Engineer',
  sourceUrl: 'https://example.com/career/applied-ai-engineer',
  location: 'Bangalore',
  jobDescription: 'Build, test and operate production conversational systems with engineering and product teams.',
  sourceCountryScopeUnresolved: true,
}

for (const [label, countryFields] of [
  ['omitted', {}], ['null', { country: null }], ['undefined', { country: undefined }], ['empty', { country: '' }],
]) {
  test('explicit native country uncertainty survives provider decoration and pure normalization: ' + label, () => {
    const raw = { ...role, ...countryFields }, before = structuredClone(raw)
    const decorated = decorateJobsWithProviderMetadata([raw], provider)[0]
    const normalizedDirect = normalizeScrapedJob(raw, provider)
    const normalizedRegistered = normalizeScrapedJob(decorated, provider)
    for (const job of [raw, decorated, normalizedDirect, normalizedRegistered]) {
      assert.equal(job.sourceCountryScopeUnresolved, true)
      assert.equal(job.location, 'Bangalore')
      assert.equal(analyzePublishableJobs([job]).eligibleJobs.length, 0)
      assert.equal(buildJobDerivedFields(job).isPublicIndia, false)
    }
    assert.equal(decorated.country == null || decorated.country === '', true)
    assert.equal(normalizedDirect.country, null)
    assert.equal(normalizedRegistered.country, null)
    assert.deepEqual(raw, before)
  })
}

test('confirmed India and foreign countries survive the same unresolved-secondary-country boundary', () => {
  for (const country of ['India', 'IN', 'IND', 'United States']) {
    const raw = { ...role, country }
    const decorated = decorateJobsWithProviderMetadata([raw], provider)[0]
    const normalized = normalizeScrapedJob(decorated, provider)
    assert.equal(decorated.country, country)
    assert.equal(normalized.country, country)
    assert.equal(analyzePublishableJobs([normalized]).eligibleJobs.length, country === 'United States' ? 0 : 1)
    assert.equal(buildJobDerivedFields(normalized).isPublicIndia, country !== 'United States')
  }
})

test('unflagged legacy records retain provider defaults after both normalization paths', () => {
  for (const flag of [undefined, false]) {
    const raw = { ...role, sourceCountryScopeUnresolved: flag }
    const decorated = decorateJobsWithProviderMetadata([raw], provider)[0]
    assert.equal(decorated.country, 'India')
    for (const job of [normalizeScrapedJob(raw, provider), normalizeScrapedJob(decorated, provider)]) {
      assert.equal(job.country, 'India')
      assert.equal(analyzePublishableJobs([job]).eligibleJobs.length, 1)
      assert.equal(buildJobDerivedFields(job).isPublicIndia, true)
    }
  }
})
