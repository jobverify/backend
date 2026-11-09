import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { buildScrapers } from '../../scraper-support/providers/index.js'
import { analyzePublishableJobs } from '../../scraper-support/utils/publishableJobMetrics.js'
import { CAREERS_URL, extractJobsFromCareersHtml } from './script.js'

const input = new URL('./test-inputs/careers-20261031.html.gz', import.meta.url)
const metadata = JSON.parse(fs.readFileSync(new URL('./test-inputs/careers-20261031.metadata.json', import.meta.url)))
const html = gunzipSync(fs.readFileSync(input)).toString('utf8')

test('Smart IMS current native email roles retain their public source page and pass the shared URL filter', async () => {
  assert.equal(createHash('sha256').update(html).digest('hex'), metadata.sha256)
  assert.equal(metadata.status, 200)
  const scraper = buildScrapers().find(item => item.name === 'smartims')
  const requested = []
  const jobs = await scraper.run({ fetchText: async url => { requested.push(url); return html } })
  assert.deepEqual(requested, [CAREERS_URL])
  assert.equal(jobs.length, 3)
  for (const job of jobs) {
    assert.equal(job.sourceUrl, CAREERS_URL)
    assert.equal(job.applyUrl, 'mailto:Indiacareers@SmartIMS.com')
    assert.ok(job.jobDescription.length > 1800)
  }
  const analysis = analyzePublishableJobs(jobs, { now: new Date(metadata.capturedAt) })
  assert.equal(analysis.filterCounts.invalidUrl, 0)
  assert.deepEqual(analysis.eligibleJobs, jobs)
})

test('Smart IMS source-page binding preserves the native description and email rather than substituting a web application', () => {
  const jobs = extractJobsFromCareersHtml(html)
  assert.equal(jobs.length, 3)
  for (const job of jobs) {
    assert.equal(job.sourceUrl, job.detailUrl)
    assert.match(job.applyUrl, /^mailto:/)
    assert.match(job.jobDescription, /To apply send your profile to/)
  }
  const invalid = { ...jobs[0], applyUrl: 'javascript:alert(1)' }
  assert.equal(analyzePublishableJobs([invalid]).filterCounts.invalidUrl, 1)
})
