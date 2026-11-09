import assert from 'node:assert/strict'
import test from 'node:test'

import { enrichJobWithPublicExperience, enrichJobsWithPublicExperience } from '../utils/publicExperienceEnrichment.js'

const role = (extra = {}) => ({
  title: 'Cloud Engineer', company: 'Example',
  sourceUrl: 'https://example.com/careers/cloud-engineer',
  applyUrl: 'https://example.com/careers/cloud-engineer',
  jobDescription: null, experienceRequired: null, ...extra,
})
const detail = '<html><body><h1>Cloud Engineer</h1><h2>Required Experience</h2><p>5 years of professional cloud engineering experience.</p><p>Build and maintain production cloud services for customer applications.</p></body></html>'

test('an explicit enrichment opt-out retains native evidence without raw or browser recovery', async () => {
  const job = role({ skipPublicExperienceEnrichment: true, sourceExperienceRequired: '0-2 Years', experienceRequired: '0-2 Years' })
  const before = structuredClone(job)
  let rawFetches = 0
  let browserFetches = 0
  const output = await enrichJobWithPublicExperience(job, {
    fetchText: async () => { rawFetches += 1; return detail },
    fetchBrowserText: async () => { browserFetches += 1; return detail },
  })
  assert.equal(rawFetches, 0)
  assert.equal(browserFetches, 0)
  assert.deepEqual(job, before)
  assert.deepEqual(output, before)
})

for (const marker of [undefined, false, 'true']) {
  test(`ordinary role detail recovery remains enabled for marker=${String(marker)}`, async () => {
    const job = role(marker === undefined ? {} : { skipPublicExperienceEnrichment: marker })
    let fetches = 0
    const output = await enrichJobWithPublicExperience(job, {
      fetchText: async () => { fetches += 1; return detail },
      useBrowserFallback: false,
    })
    assert.equal(fetches, 1)
    assert.match(output.experienceRequired, /^5/)
    assert.match(output.jobDescription, /professional cloud engineering/)
    assert.equal(job.jobDescription, null)
  })
}

test('batch enrichment preserves order and independently recovers unmarked detail jobs', async () => {
  const jobs = [role({ id: 'listing', skipPublicExperienceEnrichment: true }), role({ id: 'detail' })]
  let fetches = 0
  const output = await enrichJobsWithPublicExperience(jobs, {
    fetchText: async () => { fetches += 1; return detail },
    useBrowserFallback: false,
  })
  assert.equal(fetches, 1)
  assert.deepEqual(output.map(job => job.id), ['listing', 'detail'])
  assert.deepEqual(output[0], jobs[0])
  assert.match(output[1].experienceRequired, /^5/)
})

test('listing-only opt-out still honors an already aborted operation', async () => {
  const controller = new AbortController()
  const reason = new Error('Stop this ingestion operation')
  controller.abort(reason)
  let fetches = 0
  await assert.rejects(enrichJobWithPublicExperience(role({ skipPublicExperienceEnrichment: true }), {
    signal: controller.signal,
    fetchText: async () => { fetches += 1; return detail },
  }), error => error === reason)
  assert.equal(fetches, 0)
})
